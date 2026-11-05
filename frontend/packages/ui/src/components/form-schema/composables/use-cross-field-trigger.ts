/**
 * useCrossFieldTrigger —— 反向跨字段实时校验（精确触发 + 兜底 + debounce）
 *
 * 触发路径：
 * - 精确：trigger(fieldName) —— XForm 在 onValueChange 时调用，只跑 deps 包含 fieldName 的 rule
 * - 兜底：watch model deep diff 变化字段，逐个 run（处理 setModel 等不经过
 *   onValueChange 的场景，避免漏触发；resetFields 走 onFormReset 重拍快照，不在此列）
 *
 * debounce 调度：
 * - 全局默认：opts.defaultDebounceMs（getter 形式，schema.debounceValidation 运行时可改）
 * - 字段覆盖：RuleItem.debounceMs 优先于 defaultDebounceMs
 * - 0 = 同步执行；>0 = lodash.debounce
 * - runner 按 `target|delay` 缓存；模式切换延迟变化时清理同 target 旧 runner
 *
 * 设计要点：
 * - 空值跳过：避免空字符串把已通过字段错误重置（与正向逻辑对齐）
 * - schema 替换时重建索引 + 清空 runner 缓存 + 取消遗留 debounce timer（防内存泄漏 + counter 虚高）
 * - 同 tick 去重：onValueChange + watch model 可能同 tick 触发同字段；trigger() 先登记字段，
 *   watch 回调末尾清空 triggeredFields 窗口
 * - 序号令牌：异步 crossValidator 连续触发时，旧 Promise 后返回不得覆盖新结果
 *
 * @see ./use-cross-field-rule-trigger.ts 正向字段事件触发（blur/change）
 *
 * @group 表单编排：校验
 */
import { watch, type WatchStopHandle } from 'vue'
import { debounce, get, isEqual } from 'lodash-es'
import {
  runCrossRuleMaybeSync,
  createCrossSeqGuard,
  type CrossRuleOutcome,
} from './cross-rule-runner'
import type { RuleItem } from '../types'

interface ReverseRule {
  /** 规则所属的目标字段（错误写入这里） */
  target: string
  /** 规则依赖的字段路径集合（lodash get 支持 'items[0].qty'） */
  deps: string[]
  rule: RuleItem
  /**
   * 行模板标记（A1-反向）：规则来自 array.itemSchema 时由 useSchemaIndex 置 true ——
   * target/deps 为行内相对名，trigger 收到全路径 changedField 时按行前缀 concrete 化后执行
   */
  rowScoped?: boolean
}

/**
 * useCrossFieldTrigger 入参 —— 反向跨字段实时触发配置
 *
 * - crossRules: getter 返回扁平跨字段规则数组（XForm 通过 useSchemaIndex().crossRules 注入）
 * - setFieldError / clearValidate: 来自 useFormInstance 的错误写入 + 官方清错流程
 * - defaultDebounceMs: getter 形式（schema.debounceValidation 可能运行时改变）
 */
export interface UseCrossFieldTriggerOptions {
  /**
   * 跨字段规则的扁平数组 —— 由 XForm 通过 useSchemaIndex().crossRules 拍平后传入。
   * XForm setup 时一次扁平，schema 整体替换时由 XForm 重新构造此函数返回值。
   */
  crossRules: () => ReverseRule[]
  model: () => Record<string, unknown> | undefined
  /** 写错误到 form-item（由 XForm 通过 useFormInstance.setFieldError 注入） */
  setFieldError: (name: string, message: string) => void
  /** 清错误 —— 用 element-plus el-form.clearValidate([prop]) 走官方清错流程 */
  clearValidate: (names?: string[]) => void
  /**
   * 全局默认 debounce 时延（毫秒，getter 形式）
   * - 返回 0：实时执行（每键触发）
   * - 返回 >0：依赖字段停止变化 delay ms 后跑一次 crossValidator
   * 字段级 RuleItem.debounceMs 优先于本配置
   * getter 形式：useCrossFieldTrigger 在 setup 时实例化，但 schema.debounceValidation
   * 可能在运行中改变（demo 模式切换 / 远程拉取 schema 覆盖等）；getter 保证读取最新值
   */
  defaultDebounceMs?: () => number
  /**
   * deep watch model 兜底开关（架构审查 #8，默认 true 保持向后兼容）
   *
   * true：常驻 deep watch 整个 model + 每键 isEqual 快照 diff —— 覆盖「绕过 v-model 直改
   * model」（如 setModel 赋值 / 外部 patch）的兜底场景；代价是大表单每键 isEqual 成本。
   * false：关闭兜底 —— 纯 v-model 表单（所有写入都经 onValueChange）可省掉 deep watch，
   * 但绕过 v-model 的写入不再自动触发跨字段校验（需调用方手动 trigger）。
   */
  watchFallback?: boolean
}

/** useCrossFieldTrigger —— 反向跨字段实时校验（精确 + 兑底 + debounce） */
export function useCrossFieldTrigger(opts: UseCrossFieldTriggerOptions): {
  stop: () => void
  /**
   * 阶段 3.1 修复：精确触发反向校验
   * - 只跑 deps 包含 changedField 的 rules（避免改 password 误触发日期校验）
   * - 调用方：XForm.vue 的 onValueChange 回调精确传入 node.name
   */
  trigger: (changedField: string) => void
  /**
   * resetFields 同步调用（须在 model 已被重置之后、同 tick 内调用）：
   * - 取消排队中的 debounce runner（reset 已清错，残留 timer 到期不得把错误写回）
   * - 重拍 deps 快照 —— 兜底 watch 随后到达时新旧快照一致空跑，不把「重置造成的
   *   值变化」当普通变化重新校验（对齐 el-form 官方 resetFields 不重新校验的惯例；
   *   无此防护时未成年 crossValidator 会在重置后把红字重新写上）
   * @see ./use-xform-composer.ts resetFields 包装调用点
   */
  onFormReset: () => void
} {
  let rules: ReverseRule[] = opts.crossRules()
  // runner 类型：debounced 函数（lodash 返回）带 .cancel()；sync 函数无 cancel。
  // 统一类型让清理逻辑可以安全调用 cancel（lodash.debounce 返回值 cast 后 cancel 存在）
  type Runner = (() => void) & { cancel?: () => void }
  const stops: WatchStopHandle[] = []
  // 序号令牌：异步 crossValidator 连续触发时，旧 Promise 后返回不得覆盖新结果（H3）
  // seq 原语统一收敛到 cross-rule-runner；本路径 bump 时机 = 空值检查之后（行为保持，见 runner 文件头）
  const seqGuard = createCrossSeqGuard()
  // runner 缓存：key = rule 引用（2026-10-19 修复：原为 `${target}|${delay}` 字符串——
  // 同 target 多条 cross 规则（不同 deps）时 key 相同，第二条命中第一条的缓存 runner
  // （闭包绑第一条的 rule 引用）→ 第二条规则永不执行。rule 引用作 key 后同 target
  // 每条规则独立 runner；rules 数组整体替换时由 crossRules watch 统一取消 + 清空）
  const runnerCache = new Map<ReverseRule, Runner>()
  // 同 tick 去重窗口：XForm.onValueChange 在 v-model 更新时同步调 trigger(field)，
  // 同一 tick 内 deep watch model 又会 diff 出同一字段 —— 两条路径都 run(field) 会让
  // delay=0（实时模式）的 crossValidator 每键执行 2 次（demo counter 虚高）。
  // trigger() 先登记字段，watch 回调 diff 时跳过已登记的；窗口在每次 watch 回调末尾关闭，
  // 保证下一 tick 的真实变化不被误吞
  const triggeredFields = new Set<string>()

  /** 单条 rule 的同步执行（debounce 包装内部调用），同步/异步结果都走 seqGuard 防竞态 */
  function executeRule(r: ReverseRule): void {
    const model = opts.model()
    if (!model) return
    const value = get(model, r.target)
    if (value === '' || value === undefined || value === null) {
      opts.clearValidate([r.target])
      return
    }
    if (!r.rule.crossValidator) return
    // bump 时机保持原语义：空值检查之后（空值不清 seq，旧飞行结果落盘时仍 current）
    const seq = seqGuard.begin(r.target)
    const settle = (outcome: CrossRuleOutcome): void => {
      if (outcome.kind === 'pass') opts.clearValidate([r.target])
      else if (outcome.kind === 'fail') opts.setFieldError(r.target, outcome.message)
      // threw：runCrossRuleMaybeSync 内已 console.error，静默跳过
    }
    const outcome = runCrossRuleMaybeSync(r.rule, model, r.target)
    if (outcome instanceof Promise) {
      // 异步结果：seq 过期丢弃（连续触发竞态防护，H3）
      outcome.then((o) => {
        if (!seqGuard.isCurrent(r.target, seq)) return
        settle(o)
      })
    } else {
      // 同步结果同步写入（保持原语义：同步 crossValidator 不经过微任务，无 seq 检查）
      settle(outcome)
    }
  }

  /** 取 rule 的 debounce runner：0 = 同步执行；>0 = lodash.debounce
   *  关键：delay 用 getter 形式（r.rule.debounceMs ?? opts.defaultDebounceMs?.() ?? 0）
   *  保证 schema 全局 debounceValidation 改变后立即生效，不需要重建 useCrossFieldTrigger 实例
   *  缓存 key = rule 引用：同 target 多条规则各自独立 runner（同 target 不同 delay 的旧 runner 仍清理） */
  function getRunner(r: ReverseRule): Runner {
    const defaultMs = opts.defaultDebounceMs?.() ?? 0
    const delay = r.rule.debounceMs ?? defaultMs ?? 0
    const cached = runnerCache.get(r)
    if (cached) return cached
    // 同 target 其他 delay 的旧 runner 取消 + 删除（模式切换延迟变化时缓存清理）
    for (const [oldRule, old] of runnerCache) {
      if (oldRule === r) continue
      const oldDelay = oldRule.rule.debounceMs ?? defaultMs ?? 0
      if (oldRule.target === r.target && oldDelay !== delay) {
        old.cancel?.()
        runnerCache.delete(oldRule)
      }
    }
    const fn: Runner =
      delay > 0
        ? (() => {
            const d = debounce(() => executeRule(r), delay)
            return d as unknown as Runner
          })()
        : (Object.assign(() => executeRule(r), { cancel: () => {} }) as Runner)
    runnerCache.set(r, fn)
    return fn
  }

  /**
   * A1-反向（docs/audit/2026-10-15-engine-audit-summary）：把规则解析为本次应执行的具体规则
   * - 无 changedField（全量路径：resetFields / setModel 整体替换）→ 原样返回
   * - 直接命中（deps 含 changedField 或 target === changedField，绝对路径规则）→ 原样返回
   * - rowScoped 行模板：changedField 带行前缀（'items[0].qty' / 'orders[0].items[1].qty'）
   *   且行内相对名命中模板 deps/target → 返回 concrete 副本执行
   * - 都不命中 → undefined（跳过）
   */
  function resolveConcreteRule(r: ReverseRule, changedField?: string): ReverseRule | undefined {
    if (!changedField) return r
    if (r.deps.includes(changedField) || r.target === changedField) return r
    if (!r.rowScoped) return undefined
    // 行前缀 = changedField 去掉最后一段（'items[0].qty' → 'items[0]'；嵌套数组取最深行）
    const dot = changedField.lastIndexOf('.')
    if (dot <= 0) return undefined
    const prefix = changedField.slice(0, dot)
    const rel = changedField.slice(dot + 1)
    if (!r.deps.includes(rel) && r.target !== rel) return undefined
    return concretizeRowRule(r, prefix)
  }

  /**
   * 行模板 concrete 化：target/deps 重写为 `${prefix}.<相对名>` 绝对路径副本。
   * 逐 dep 按「行内相对优先、顶层绝对回退」解析（与 use-validate.rewriteRuleDeps
   * 同语义，兼容「行小计 ≤ 全局上限」混合写法：行内有该键取行内，行内无取顶层）。
   * 执行原语 runCrossRuleMaybeSync 从 rule.dependsOn 取值，故 rule 也必须副本重写，
   * 否则 crossValidator 收到的是根 model 上 undefined 的相对路径值
   */
  function concretizeRowRule(r: ReverseRule, prefix: string): ReverseRule {
    const model = opts.model()
    const resolve = (dep: string): string => {
      const rowPath = `${prefix}.${dep}`
      return model !== undefined && get(model, rowPath) !== undefined ? rowPath : dep
    }
    const rule: RuleItem = { ...r.rule }
    if (r.rule.dependsOn) {
      rule.dependsOn = Array.isArray(r.rule.dependsOn)
        ? r.rule.dependsOn.map(resolve)
        : resolve(r.rule.dependsOn)
    }
    if (r.rule.deps) {
      rule.deps = Array.isArray(r.rule.deps) ? r.rule.deps.map(resolve) : resolve(r.rule.deps)
    }
    return { ...r, target: `${prefix}.${r.target}`, deps: r.deps.map(resolve), rule }
  }

  /**
   * 内部实现：跑 rules 的核心逻辑
   * - changedField 为空/undefined 时跑所有 rules（兜底路径：resetFields / setModel 整个替换）
   * - changedField 有值时只跑 deps 包含 changedField 的 rules（精确路径）
   */
  function run(changedField?: string): void {
    for (const r of rules) {
      // manual trigger 不响应反向 —— 仅 validateForm() 时跑
      if (r.rule.trigger === 'manual') continue
      // 精确双向触发：
      // - 反向：deps 包含 changedField（"改 A 触发 B 重算"）
      // - 正向：target === changedField（"改 B 触发 B 自己的跨字段规则重算"）
      // - A1-反向：rowScoped 行模板按行前缀 concrete 化后匹配（数组行内 cross 校验）
      const concrete = resolveConcreteRule(r, changedField)
      if (!concrete) continue
      const runner = getRunner(concrete)
      runner()
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // H3 修复（审计 2026-09-09）：deps 值快照 diff —— 对齐 use-reaction deps 快照模式
  // ──────────────────────────────────────────────────────────────────────
  // 背景：旧实现对 model 做顶层浅拷贝 `{ ...model }` diff —— 嵌套 mutate
  // （如 model.user.age = 30）时新旧快照是同一对象引用，isEqual 恒 true 恒判未变；
  // 且就算 diff 出顶层 key 'user'，deps 精确匹配（'user.age' ≠ 'user'）也让 run 空跑。
  // 改为：每条 rule 记录 deps 各路径取值快照 + target 当前值，watch 触发时逐项 isEqual。
  interface RuleSnapshot {
    depsValues: unknown[]
    targetValue: unknown
  }
  function takeSnapshot(): Map<ReverseRule, RuleSnapshot> {
    const m = new Map<ReverseRule, RuleSnapshot>()
    const model = opts.model()
    if (!model) return m
    for (const r of rules) {
      m.set(r, {
        depsValues: r.deps.map((d) => get(model, d)),
        targetValue: get(model, r.target),
      })
    }
    return m
  }
  // 初始快照基于 setup 时的 rules（crossRules watch immediate 同步重建后也会重置）
  let oldSnapshot = takeSnapshot()

  // 跨字段规则重建（依赖 XForm 通过 opts.crossRules 传入；索引变化时该 getter 返回新数组）
  // 重建时清空 runner 缓存 + 取消所有遗留 debounce timer：
  // 仅 runnerCache.clear() 会留下 in-flight 的 lodash.debounce 内部 setTimeout，
  // 这些 timer 到期仍会调用闭包里的 executeRule → counter 累加 → 校验次数虚高
  // 必须先调每个 runner.cancel() 再清缓存
  stops.push(
    watch(
      opts.crossRules,
      (next) => {
        rules = next
        for (const r of runnerCache.values()) {
          if (typeof r.cancel === 'function') r.cancel()
        }
        runnerCache.clear()
        seqGuard.clear()
        // 规则集变化后旧快照中的 rule 引用全部失效，立即重建防止旧快照误触发
        oldSnapshot = takeSnapshot()
      },
      { immediate: true, flush: 'sync' }
    )
  )

  // watch model 兜底：deep 监听 + deps 快照精确 diff（H3 修复，见文件头快照工具注释）
  // - dep 值变化 → run(depPath)（deps 精确匹配命中该 rule）
  // - target 值变化 → run(target)（正向重算 + 空值跳过语义，覆盖绕过 v-model 直改 target）
  // - 与任何 rule 无关的 key 变化不再 run（旧逻辑顶层 diff 对无关 key 也是空跑，行为等价且更省）
  // - watchFallback=false 逃逸口（架构审查 #8）：纯 v-model 表单可关 deep watch 省每键 isEqual
  if (opts.watchFallback !== false) {
    stops.push(
      watch(
        () => opts.model(),
        (newModel) => {
          if (!newModel) {
            oldSnapshot = new Map()
            return
          }
          const fresh = takeSnapshot()
          const changed: string[] = []
          for (const [r, snap] of fresh) {
            const prev = oldSnapshot.get(r)
            // rules 重建时已同步重置快照，prev 恒存在；防御性跳过缺失项
            if (!prev) continue
            r.deps.forEach((d, i) => {
              if (!isEqual(snap.depsValues[i], prev.depsValues[i])) changed.push(d)
            })
            if (!isEqual(snap.targetValue, prev.targetValue)) changed.push(r.target)
          }
          oldSnapshot = fresh
          for (const key of changed) {
            // trigger() 同 tick 已精确处理过的字段跳过（嵌套路径如 user.age
            // 在 onValueChange 路径以完整 name 登记，同 tick 去重窗口保留）
            if (triggeredFields.has(key)) continue
            run(key)
          }
          triggeredFields.clear()
        },
        { deep: true } // 关键:deep 监听 model 内部属性变化（嵌套路径依赖此触发）
      )
    )
  }

  return {
    stop: () => {
      // stop 时也要取消遗留 debounce timer，否则组件卸载后 timer 仍 fire（内存泄漏 + 错误调用）
      for (const r of runnerCache.values()) {
        if (typeof r.cancel === 'function') r.cancel()
      }
      runnerCache.clear()
      triggeredFields.clear()
      stops.forEach((s) => s())
    },
    trigger: (changedField: string) => {
      triggeredFields.add(changedField)
      run(changedField)
    },
    onFormReset: () => {
      // ① 取消排队中的 debounce timer（sync runner 的 cancel 为空操作，安全统一调用）
      for (const r of runnerCache.values()) {
        if (typeof r.cancel === 'function') r.cancel()
      }
      // ② 重拍快照：调用方保证 model 已完成重置且与本调用同 tick（watch 异步 flush），
      // 随后到达的兜底 watch pass 因新旧快照一致而空跑
      oldSnapshot = takeSnapshot()
    },
  }
}
