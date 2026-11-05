/**
 * build-on-bindings —— node.on 转 vue 事件 prop 的纯函数工厂
 *
 * 函数直接传；字符串经 resolveFunctionExpression 解析（失败则跳过该事件，避免 Vue prop 警告）。
 *
 * @group 表单编排：渲染
 */
import type { SchemaNode } from '../types'
// 注意：第 3 参缺省值故意引用 @deprecated 模块级 API —— 旧调用方不传 resolve 时
// 必须回退模块级表保持行为不变，这是向后兼容设计
import { resolveFunctionExpression, type ExpressionScope } from './use-expression'

/**
 * 节点事件绑定：node.on 转 vue 事件 prop（`on<EventName>` = on + 大写首字母）。
 * 函数直接传；字符串经 resolveFunctionExpression 解析（失败则跳过该事件）。
 *
 * @param resolve H2：实例级表达式解析器（缺省回退模块级，向后兼容旧调用方）
 */
export function buildOnBindings(
  node: SchemaNode,
  model: Record<string, unknown> | undefined,
  resolve: ExpressionScope['resolveFunctionExpression'] = resolveFunctionExpression
): Record<string, unknown> {
  if (!node.on) return {}
  const out: Record<string, unknown> = {}
  for (const [evt, raw] of Object.entries(node.on)) {
    const propKey = `on${evt[0]!.toUpperCase()}${evt.slice(1)}`
    if (typeof raw === 'function') {
      out[propKey] = raw
    } else if (typeof raw === 'string') {
      const fn = resolve(raw)
      if (fn) {
        out[propKey] = (...args: unknown[]) =>
          (fn as (m: Record<string, unknown>, ...args: unknown[]) => unknown)(model ?? {}, ...args)
      }
    }
  }
  return out
}
