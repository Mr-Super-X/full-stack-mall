/**
 * useCrossFieldRuleTrigger —— 字段事件（blur/change）跨字段规则触发器
 *
 * 抽离自 useFormValidation（序号令牌 + matchTrigger + 空值跳过 + 异步竞态防护）；
 * 内部委托，公开签名不变。
 *
 * @see ./use-form-validation.ts 调用方
 * @see ./use-cross-field-trigger.ts 反向（model 变化触发）兄弟 composable
 *
 * @group 表单编排：校验
 */
import { get } from 'lodash-es'
import { matchTrigger } from './match-trigger'
import { runCrossRule, createCrossSeqGuard } from './cross-rule-runner'
import type { RuleItem, SchemaNode } from '../types'

/**
 * useCrossFieldRuleTrigger 入参 —— 模型 + 错误写入
 * @see ./use-form-validation.ts 内部委托本 composable
 */
export interface UseCrossFieldRuleTriggerDeps {
  /** 表单数据 */
  model: { value: Record<string, unknown> | undefined }
  /** 写错误到 form-item */
  setFieldError: (name: string, message: string, state?: '' | 'error') => void
}

/**
 * useCrossFieldRuleTrigger 返回值 —— 字段事件跨字段规则触发器
 *
 * triggerCrossFieldValidator(node, eventType): 让 crossValidator 响应 trigger 配置
 * 成功 → 清掉之前可能的红字；失败 → setFieldError 红字提示；空值字段跳过
 */
export interface UseCrossFieldRuleTriggerReturn {
  /**
   * 字段事件触发跨字段校验 —— 让 crossValidator 响应 trigger 配置
   * - 遍历当前字段 rules,提取 dependsOn + crossValidator + trigger 配置
   * - 检查 rule.trigger 与当前事件类型是否匹配
   * - 跑 crossValidator(支持同步/异步)
   * - 成功 → 清掉之前可能的红字
   * - 失败 → setFieldError 红字提示
   * - 跳过空值字段(空值交给普通 required 校验处理)
   */
  triggerCrossFieldValidator: (node: SchemaNode, eventType: 'blur' | 'change') => Promise<void>
}

/**
 * 字段事件跨字段规则触发器
 * - 序号令牌：连续 blur/change 触发时，旧 Promise 后返回不得覆盖新结果
 * - 实例级：组件 unmount 时随 composable scope 一起 GC
 *
 * seq 原语统一收敛到 cross-rule-runner；本路径 bump 时机 = 触发开始（先于空值检查，
 * 空值也消耗一个 seq —— 行为保持，见 runner 文件头「刻意不统一」）
 */
export function useCrossFieldRuleTrigger(
  deps: UseCrossFieldRuleTriggerDeps
): UseCrossFieldRuleTriggerReturn {
  const seqGuard = createCrossSeqGuard()

  async function triggerCrossFieldValidator(
    node: SchemaNode,
    eventType: 'blur' | 'change'
  ): Promise<void> {
    if (!node.name || !node.rules) return
    const m = deps.model.value
    if (!m) return
    // 序号令牌：连续 blur/change 触发时，旧 Promise 后返回不得覆盖新结果（H3）
    const seq = seqGuard.begin(node.name)
    const rules = Array.isArray(node.rules) ? node.rules : [node.rules]
    const currentValue = get(m, node.name)
    // 空值跳过 cross 校验(留给 required / type 规则)
    if (currentValue === '' || currentValue === undefined || currentValue === null) return
    for (const r of rules) {
      if (typeof r !== 'object' || r === null) continue
      const rule = r as RuleItem
      if (!rule.crossValidator || !(rule.dependsOn ?? rule.deps)) continue
      // trigger 字段过滤
      if (!matchTrigger(rule.trigger, eventType)) continue
      const outcome = await runCrossRule(rule, m, node.name)
      if (!seqGuard.isCurrent(node.name, seq)) return // 已有更新的触发，丢弃过期结果
      if (outcome.kind === 'pass') {
        deps.setFieldError(node.name, '', '')
      } else if (outcome.kind === 'fail') {
        deps.setFieldError(node.name, outcome.message)
      }
      // threw：runCrossRule 内已 console.error，继续下一条 rule（对齐原 catch → continue 语义）
    }
  }

  return { triggerCrossFieldValidator }
}
