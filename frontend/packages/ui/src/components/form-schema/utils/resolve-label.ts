/**
 * resolve-label —— SchemaNode.label 渲染期求值（i18n 函数式落地，架构审查 PM 发现 3）
 *
 * 与 reaction 管线的分工：
 * - reaction.label 函数（收 model）在 schema 渲染前被 use-reaction 求值成 string 写入 node.label
 * - 因此本函数拿到函数值时可确定是 i18n 函数（收 t），以 props.t 求值即可
 *
 * 必须在 render effect 内调用（render-form-item / render-schema-node / render-array-node
 * 均满足）：vue-i18n 的 t 借此建立 locale 依赖，语言切换自动重渲
 *
 * @group 表单编排：渲染
 */
import type { SchemaNode, XFormTranslateFn } from '../types'

/** 缺省翻译函数：identity —— 未注入 props.t 时函数式 label 收到 key 原样返回 */
const FALLBACK_T: XFormTranslateFn = (key) => key

/**
 * 求值节点 label 为最终展示字符串
 * - undefined → undefined（调用方自行决定占位/不渲染）
 * - string → 原样返回
 * - XFormLabelFn → fn(t ?? identity) 求值
 */
export function resolveLabel(label: SchemaNode['label'], t?: XFormTranslateFn): string | undefined {
  if (label === undefined) return undefined
  if (typeof label === 'function') return label(t ?? FALLBACK_T)
  return label
}
