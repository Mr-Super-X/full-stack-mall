/**
 * use-expression —— `{{ fn }}` 表达式沙箱解析与缓存
 *
 * 编译期：用 `new Function` 替代 eval（比 eval 安全），仅暴露白名单 fns + 组件事件参数；
 * 危险标识符扫描兜底在 ./use-scan-forbidden.ts。
 *
 * 运行时：模块级状态（EXPRESSION_CACHE / EXPRESSION_FNS / fnsVersion），业务方应通过
 * ExpressionScope 而非直接读写这些全局；模块级形态保留是为向后兼容旧调用方。
 *
 * @see ./use-expression-functions.ts 表达式函数表生命周期管理
 * @see ./use-scan-forbidden.ts dev 危险标识符扫描
 *
 * @group 表单编排：表达式
 */
// SECURITY：用 new Function 替代 eval，仅暴露白名单 fns 与组件事件参数；危险标识符扫描见 ./use-scan-forbidden.ts

const EXPRESSION_REG = /^\s*\{\{([\s\S]+)\}\}\s*$/
const CACHE_LIMIT = 500

// 模块级状态（向后兼容旧调用方，新调用方请使用 ExpressionScope）
const EXPRESSION_CACHE = new Map<string, ((model: unknown) => unknown) | null>()
let EXPRESSION_FNS: Record<string, (...args: never[]) => unknown> = {}
let fnsVersion = 0

/**
 * 注册表达式可用函数表（XForm setup 调用；传 undefined 清空）
 *
 * @deprecated 2026-09-09（H2）：模块级共享表导致多 XForm 实例互相污染。
 * 新代码请用 createExpressionScope()（每实例一份）。保留是为向后兼容已接入的旧调用方。
 */
export function setExpressionFunctions(fns?: Record<string, (...args: never[]) => unknown>): void {
  EXPRESSION_FNS = fns ?? {}
  fnsVersion++ // fns 变化时旧编译缓存必须失效（同字符串表达式作用域已变）
}

/** 每个 XForm 实例一个独立作用域，避免多实例共享 module 级缓存相互覆盖 */
export interface ExpressionScope {
  setExpressionFunctions(fns?: Record<string, (...args: never[]) => unknown>): void
  resolveFunctionExpression: <T extends (...a: unknown[]) => unknown>(raw: unknown) => T | null
}

/**
 * 深冻结 model 为安全 DTO：排除函数 / 原型链 / 循环引用 / 危险字段
 *
 * 性能优化（架构审查 #7）：每次调用 compiled() 都全量深拷贝 model 是大表单热点
 * （N 个 reaction × 每次 deps 变化 × O(model)）。改为按【本轮 tick】缓存——
 * 同一微任务内多次调用（同字段连续多表达式、多字段同批 reaction）只深拷贝一次，
 * 缓存随微任务结束自动失效；model 值在 tick 间变化时下一次求值重新拷贝，行为保持。
 */
let safeDtoCache: { raw: unknown; dto: unknown } | null = null
function toSafeDtoCached(model: unknown): unknown {
  if (safeDtoCache && safeDtoCache.raw === model) return safeDtoCache.dto
  const dto = toSafeDto(model)
  safeDtoCache = { raw: model, dto }
  // 微任务结束即失效：避免跨 tick 读到旧快照
  queueMicrotask(() => {
    safeDtoCache = null
  })
  return dto
}

function toSafeDto(model: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (model === null || typeof model !== 'object' || seen.has(model)) return model
  if (typeof model === 'function') return undefined
  seen.add(model)
  if (Array.isArray(model)) return model.map((m) => toSafeDto(m, seen))
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(model as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    out[k] = toSafeDto((model as Record<string, unknown>)[k], seen)
  }
  return out
}

/**
 * 编译一次并写入缓存。模块级 API 与 scope 工厂共享同一实现，保证行为一致
 */
function compileExpression(
  raw: string,
  cache: Map<string, ((model: unknown) => unknown) | null>,
  fnsRef: { current: Record<string, (...args: never[]) => unknown> }
): ((model: unknown, ...rest: unknown[]) => unknown) | null {
  let compiled: ((model: unknown, ...rest: unknown[]) => unknown) | null = null
  try {
    // 白名单函数注入表达式作用域：表达式可直接引用注册名（如 formatDate）
    const names = Object.keys(fnsRef.current)
    // __rest 透传组件事件参数（on 绑定第 2 起的实参）；reaction / permission 等
    // 单参求值路径传入空数组，调用形态与旧版保持一致
    const fn = new Function(
      'model',
      '__rest',
      ...names,
      `return (${raw.trim()})(model, ...__rest)`
    ) as (model: unknown, rest: unknown[], ...whitelist: unknown[]) => unknown
    compiled = (model: unknown, ...rest: unknown[]) =>
      fn(toSafeDtoCached(model), rest, ...names.map((n) => fnsRef.current[n]))
  } catch (err) {
    console.error('[XForm] Invalid function expression:', raw, err)
  }
  // 超上限整体清空：表达式集通常远小于上限，clear 比 LRU 逐出实现简单且命中影响可忽略
  if (cache.size >= CACHE_LIMIT) cache.clear()
  return compiled
}

/**
 * 模块级 API：解析 {{ fn }} 表达式
 *
 * @deprecated 2026-09-09（H2）：模块级共享缓存 + 函数表导致多 XForm 实例互相污染。
 * 新代码请用 createExpressionScope()（每实例一份）。保留是为向后兼容已接入的旧调用方。
 */
export function resolveFunctionExpression<T extends (...a: unknown[]) => unknown>(
  raw: unknown
): T | null {
  if (typeof raw !== 'string') return null
  const m = raw.match(EXPRESSION_REG)
  if (!m || !m[1]) return null
  const cacheKey = `${fnsVersion}:${raw}`
  const hit = EXPRESSION_CACHE.get(cacheKey)
  if (hit !== undefined) return hit as T | null
  const fnsRef = { current: EXPRESSION_FNS }
  const compiled = compileExpression(m[1], EXPRESSION_CACHE, fnsRef)
  EXPRESSION_CACHE.set(cacheKey, compiled)
  return compiled as T | null
}

/** 为单个 XForm 实例创建独立 cache + fns 表，避免多实例共享状态 */
export function createExpressionScope(): ExpressionScope {
  const cache = new Map<string, ((model: unknown) => unknown) | null>()
  const fnsRef = { current: {} as Record<string, (...args: never[]) => unknown> }
  const versionRef = { current: 0 }

  function setExpressionFunctions(fns?: Record<string, (...args: never[]) => unknown>): void {
    fnsRef.current = fns ?? {}
    versionRef.current++
  }

  function resolve<T extends (...a: unknown[]) => unknown>(raw: unknown): T | null {
    if (typeof raw !== 'string') return null
    const m = raw.match(EXPRESSION_REG)
    if (!m || !m[1]) return null
    const cacheKey = `${versionRef.current}:${raw}`
    const hit = cache.get(cacheKey)
    if (hit !== undefined) return hit as T | null
    const compiled = compileExpression(m[1], cache, fnsRef)
    cache.set(cacheKey, compiled)
    return compiled as T | null
  }

  return {
    setExpressionFunctions,
    resolveFunctionExpression: resolve,
  }
}
