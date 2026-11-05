/**
 * cross-rule-runner —— 跨字段规则统一执行原语（架构审查 #11）
 *
 * 三条 cross 校验路径共享的执行语义在此收敛：
 * - use-cross-field-trigger（反向：model 变化触发）
 * - use-cross-field-rule-trigger（正向：blur/change 事件触发）
 * - use-validate.runCrossFieldValidation（批量：validate 全量遍历）
 *
 * 统一的部分：
 * - dependsOn 单值/数组归一 + lodash get 取值
 * - 同步/异步 crossValidator 返回值归一（runCrossRuleMaybeSync 同步直返 / Promise 分流）
 * - crossValidator 抛错兜底（console.error + 'threw'，不阻断整表单剩余规则）
 * - seq 竞态令牌原语（连续触发时旧 Promise 后返回不得覆盖新结果，H3）
 *
 * 刻意不统一的部分（三路径语义本就不同，调用方保留职责）：
 * - seq bump 时机：反向 = 空值检查之后；事件 = 触发开始（先于空值检查）——统一时机会行为漂移
 * - 空值策略：反向 = clearValidate 清错；事件 = 静默跳过；批量 = 照跑
 * - 结果写入：clearValidate vs setFieldError vs 收集 errors
 *
 * @group 表单编排：校验
 */
import { get } from 'lodash-es'
import type { RuleItem } from '../types'

/** cross 规则执行结果归纳（'threw' 已 console.error，调用方静默跳过即可） */
export type CrossRuleOutcome =
  { kind: 'pass' } | { kind: 'fail'; message: string } | { kind: 'threw' }

/**
 * 执行单条 cross 规则并归纳结果（同步 crossValidator 直返 outcome，保持同步写入语义）
 *
 * 调用方须在调用前完成：空值策略判断、trigger 事件过滤、crossValidator/dependsOn 存在性过滤
 * （这三项三路径语义不同，见文件头「刻意不统一」）
 *
 * @param valuePath - 被校验字段的 model 路径（lodash get 语法，支持 'items[0].qty'）
 * @returns 同步 crossValidator 返回 CrossRuleOutcome；异步返回 Promise<CrossRuleOutcome>
 */
export function runCrossRuleMaybeSync(
  rule: Pick<RuleItem, 'crossValidator' | 'dependsOn' | 'deps'>,
  model: Record<string, unknown>,
  valuePath: string
): CrossRuleOutcome | Promise<CrossRuleOutcome> {
  const cv = rule.crossValidator
  // dependsOn 优先，deps 是别名（与 reaction/asyncOptions 命名统一，PM 审查发现 4）
  const dependsOn = rule.dependsOn ?? rule.deps
  if (!cv || !dependsOn) return { kind: 'threw' }
  const depsValues = (Array.isArray(dependsOn) ? dependsOn : [dependsOn]).map((d) => get(model, d))
  let result: true | string | Promise<true | string>
  try {
    result = cv(get(model, valuePath), ...depsValues)
  } catch (err) {
    console.error('[XForm] crossValidator threw:', err)
    return { kind: 'threw' }
  }
  if (result instanceof Promise) {
    return result
      .then((r): CrossRuleOutcome => (r === true ? { kind: 'pass' } : { kind: 'fail', message: r }))
      .catch((err): CrossRuleOutcome => {
        console.error('[XForm] crossValidator threw:', err)
        return { kind: 'threw' }
      })
  }
  return result === true ? { kind: 'pass' } : { kind: 'fail', message: result }
}

/**
 * runCrossRule —— async 包装版（事件 / 批量路径用 await 串行消费）
 *
 * 同步 crossValidator 也会被包进微任务 —— 需要保持同步写入语义的调用方
 * （use-cross-field-trigger 反向路径）请用 runCrossRuleMaybeSync
 */
export async function runCrossRule(
  rule: Pick<RuleItem, 'crossValidator' | 'dependsOn' | 'deps'>,
  model: Record<string, unknown>,
  valuePath: string
): Promise<CrossRuleOutcome> {
  return runCrossRuleMaybeSync(rule, model, valuePath)
}

/**
 * seq 竞态令牌 —— 连续触发时旧 Promise 后返回不得覆盖新结果（H3）
 *
 * 实例级 Map：由调用方在各自 composable 内创建一次，随组件 unmount GC
 * （改前 use-form-validation 用模块级 Map，多实例共享，卸载后仍持有 entry —— OPT-5）
 */
export function createCrossSeqGuard(): {
  /** 序号 +1 并返回新 seq；调用方按各路径正确时机调用（见文件头「刻意不统一」） */
  begin: (key: string) => number
  /** 异步结果落盘前校验 seq 是否仍为最新 */
  isCurrent: (key: string, seq: number) => boolean
  /** 规则集重建时清零（旧飞行结果全部过期；不清零则 seq 单调递增，旧 seq 也永不撞号） */
  clear: () => void
} {
  const seqMap = new Map<string, number>()
  return {
    begin: (key) => {
      const seq = (seqMap.get(key) ?? 0) + 1
      seqMap.set(key, seq)
      return seq
    },
    isCurrent: (key, seq) => seq === seqMap.get(key),
    clear: () => seqMap.clear(),
  }
}
