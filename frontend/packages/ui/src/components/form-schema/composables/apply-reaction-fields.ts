/**
 * apply-reaction-fields —— reaction 字段求值后写入 node（use-reaction 的纯函数形态）
 *
 * 与 use-reaction 的区别：
 * - use-reaction：watch model + 调度策略 + 副作用预算（带 reactive state）
 * - apply-reaction-fields：纯函数版"把 reaction 字段求值后写回 node"，给 static schema 初始化用
 *
 * 元字段（strategy / delay / deps）仅用于 use-reaction 调度策略，不写入 node
 * 避免序列化时带元数据。
 *
 * @group 表单编排：联动
 */
import type { SchemaNode } from '../types'
import { isEqual } from 'lodash-es'
import { resolveFunctionExpression, type ExpressionScope } from './use-expression'
// 注意：下方缺省参数故意引用 @deprecated 模块级 API —— 旧调用方（外部直接调用 applyReactions
// / applyReactionFields 不传 resolve）必须回退模块级表才能保持行为不变，这是向后兼容设计

/** reaction 元字段 —— 仅用于 use-reaction 调度策略,不写入 node(避免序列化时带元数据) */
const REACTION_META_KEYS = new Set(['strategy', 'delay', 'deps'])

/**
 * 应用 reaction 字段：对每个 reaction 配置项求值后写入 node[field]
 *
 * - 字面量 / 字符串函数表达式：写入 node[key]（如 label: 'xxx' / label: '{{ fn }}'）
 * - 函数 reaction：执行 + 返回值赋给 node[key]（label 用法兼容；函数内部可同时写 model 副作用）
 * - 元字段（strategy / delay）：跳过，不写入 node
 *
 * @param resolve H2：实例级表达式解析器（缺省回退模块级，向后兼容旧调用方）
 */
export function applyReactionFields(
  node: SchemaNode,
  reaction: NonNullable<SchemaNode['reaction']>,
  model: Record<string, unknown>,
  resolve: ExpressionScope['resolveFunctionExpression'] = resolveFunctionExpression
): void {
  for (const [key, raw] of Object.entries(reaction)) {
    if (REACTION_META_KEYS.has(key)) continue
    let value: unknown = raw
    if (typeof raw === 'string') {
      const fn = resolve(raw)
      if (fn) value = (fn as (m: Record<string, unknown>) => unknown)(model)
    } else if (typeof raw === 'function') {
      value = (raw as (m: Record<string, unknown>) => unknown)(model)
    }
    const target = node as Record<string, unknown>
    // 值未变化时跳过写入：reaction 会在 model 任意变化时重跑（未声明 deps 时），
    // 无条件写入会产生多余的响应式通知，放大下游重渲染与联动链
    if (isEqual(target[key], value)) continue
    target[key] = value
  }
}
