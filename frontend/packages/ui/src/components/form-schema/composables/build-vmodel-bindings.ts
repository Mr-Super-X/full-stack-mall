/**
 * build-vmodel-bindings —— beforeChange 3 层钩子 + node.modelProp → vue v-model 装配
 *
 * 关键责任：
 * - layer1 全局 Props / namespaceRules 动态命名空间 / fieldBeforeChange 字段级 三层 beforeChange 编排
 * - makeCtx 每字段独立 ctx（setFieldValue / setFieldError / abort）
 * - onValueChange 写入 model 后触发（跨字段校验 + dirty 追踪）
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 *
 * @group 表单编排：v-model
 */
import { get, set } from 'lodash-es'
import type {
  BeforeChangeCtx,
  BeforeChangeFn,
  BeforeChangeRule,
  SchemaNode,
  XFormExpose,
} from '../types'

/**
 * beforeChange 3 层钩子配置（buildVModelBindings 接收）
 *
 * - layer1: 全局 Props beforeChange（横切关注点）
 * - namespaceRules: 动态命名空间规则数组（按 pattern 匹配字段路径）
 * - fieldBeforeChange: 字段级 beforeChange（可不传，自动从 node.beforeChange 取）
 * - makeCtx: 每字段独立 ctx 工厂
 * - onValueChange: 写入 model 后触发（跨字段校验 / dirty 追踪）
 * - formRef: XFormExpose，给 ctx.setFieldError 用
 */
export interface BeforeChangeConfig {
  layer1?: BeforeChangeFn | undefined
  namespaceRules?: BeforeChangeRule[] | undefined
  fieldBeforeChange?: BeforeChangeFn | undefined
  makeCtx?: ((node: SchemaNode) => BeforeChangeCtx) | undefined
  onValueChange?: ((node: SchemaNode, newValue: unknown) => void) | undefined
  formRef?: XFormExpose | undefined
}

/**
 * 单层钩子执行：区分同步 throw（放行原值）vs Promise.reject（中断 chain）
 * 同步 throw 进内层 try/catch → warn + 返回原值
 * Promise.reject 通过 await 抛出 → propagate 到 chain caller
 */
async function runLayer(
  fn: BeforeChangeFn,
  node: SchemaNode,
  curr: unknown,
  oldVal: unknown,
  allValues: Record<string, unknown>,
  ctx: BeforeChangeCtx
): Promise<unknown> {
  let syncResult: unknown
  try {
    syncResult = fn(node, curr, oldVal, allValues, ctx)
  } catch (err) {
    // 同步 throw → warn + 放行原值给下一层
    console.warn('[beforeChange] handler sync threw', err)
    return curr
  }
  if (syncResult instanceof Promise) {
    // Promise.reject 让 await 抛出 → propagate 中断 chain
    const r = await syncResult
    return r === undefined ? curr : r
  }
  return syncResult === undefined ? curr : syncResult
}

/**
 * 匹配 pattern：RegExp 直接 test；string 支持 '*'(单层) / '**'(多层) 通配
 */
function patternMatches(pattern: RegExp | string, name: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(name)
  if (pattern === name) return true
  // 字符串通配符：'*' 匹配不含 . 的单层，'**' 匹配多层含 .
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DBL_STAR__')
    .replace(/\*/g, '[^.]+')
    .replace(/__DBL_STAR__/g, '.*')
  return new RegExp(`^${escaped}$`).test(name)
}

/**
 * 3 层串行 resolveBeforeChangeChain
 *
 * 第 1 层 props.beforeChange -> 第 2 层 namespaceRules[pattern 匹配] -> 第 3 层 node.beforeChange
 * - 每层返回新值透传给下一层；任一层返回 Promise.resolve 异步等待
 * - 任一层抛同步异常 → catch + warn + 放行上一层结果给下一层（不阻断）
 * - 任一层 Promise.reject → 整个 chain throw 中断（applyValue 跳过写入）
 */
export async function resolveBeforeChangeChain(
  node: SchemaNode,
  newVal: unknown,
  oldVal: unknown,
  allValues: Record<string, unknown>,
  ctx: BeforeChangeCtx,
  config: BeforeChangeConfig = {}
): Promise<unknown> {
  let curr = newVal
  const layer1 = config.layer1
  const namespaceRules = config.namespaceRules ?? []
  const fieldBeforeChange = config.fieldBeforeChange ?? node.beforeChange

  // 第 1 层: 全局 Props
  if (layer1) {
    curr = await runLayer(layer1, node, curr, oldVal, allValues, ctx)
  }

  // 第 2 层: 命名空间规则（多规则按数组顺序串行）
  const matched = namespaceRules.filter((r) => patternMatches(r.pattern, ctx.name))
  for (const rule of matched) {
    curr = await runLayer(rule.handler, node, curr, oldVal, allValues, ctx)
  }

  // 第 3 层: 字段级
  if (fieldBeforeChange) {
    curr = await runLayer(fieldBeforeChange, node, curr, oldVal, allValues, ctx)
  }

  return curr
}

/**
 * 构造默认 ctx 工厂（use-xform-composer 在 render 阶段调用）
 */
export function makeDefaultBeforeChangeCtx(
  node: SchemaNode,
  model: Record<string, unknown>,
  formRef?: XFormExpose | (() => XFormExpose | undefined)
): BeforeChangeCtx {
  const abortFlag = { aborted: false }
  const resolveFormRef = (): XFormExpose | undefined =>
    typeof formRef === 'function' ? formRef() : formRef
  return {
    get name() {
      return node.name ?? ''
    },
    setFieldValue: (name, value) => {
      set(model, name, value)
    },
    setFieldError: (name, message) => {
      const r = resolveFormRef()
      if (!r) return
      r.setFieldError(name, message)
      // XForm onValueChange.clearValidate 会在 model 写入后清掉外部错误（同步）。
      // setTimeout 0 等下一个 macrotask 让 clearValidate 先跑完，再重新写入红字。
      // ctx.setFieldError 的语义是"强制显示错误"——即使 input 触发了 validate
      // 且当前 value 通过了规则，红字也要保留（典型场景：手动校验失败，input 没改）
      if (message) {
        setTimeout(() => resolveFormRef()?.setFieldError(name, message), 0)
      }
    },
    abort: () => {
      abortFlag.aborted = true
    },
  }
}

/**
 * 构建节点 vModel 绑定：含 3 层 beforeChange 拦截
 *
 * - 异步链结束后才写入 model
 * - onValueChange 钩子在写入完成后触发
 */
export function buildVModelBindings(
  node: SchemaNode,
  model: Record<string, unknown> | undefined,
  config: BeforeChangeConfig = {}
): Record<string, unknown> {
  if (node.name === undefined || !model) return {}
  const prop = node.modelProp ?? 'modelValue'
  const eventProp = `on${`update:${prop}`.charAt(0).toUpperCase()}${`update:${prop}`.slice(1)}`

  const ctx = config.makeCtx?.(node) ?? makeDefaultBeforeChangeCtx(node, model, config.formRef)

  const applyValue = (finalValue: unknown): void => {
    set(model, node.name as string, finalValue)
    config.onValueChange?.(node, finalValue)
  }

  return {
    [prop]: get(model, node.name),
    [eventProp]: (v: unknown) => {
      const oldVal = get(model, node.name as string)
      resolveBeforeChangeChain(node, v, oldVal, model, ctx, config)
        .then(applyValue)
        .catch((err: unknown) => {
          console.warn('[beforeChange] chain aborted', err)
        })
    },
  }
}
