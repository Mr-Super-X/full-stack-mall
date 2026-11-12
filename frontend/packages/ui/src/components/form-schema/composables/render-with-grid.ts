/**
 * render-with-grid —— 视觉容器内栅格渲染
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 *
 * @group 表单编排：渲染
 */
import { h, type VNode } from 'vue'
import { ElRow, ElCol } from 'element-plus'
import type { SchemaNode } from '../types'
import type { RenderFieldContext } from './render-schema-node'

type RenderFn = (
  node: SchemaNode | SchemaNode[] | string | undefined | null,
  fieldCtx?: RenderFieldContext
) => VNode | string | VNode[] | undefined

/** 视觉容器内栅格渲染（Card 等 + row/column 时使用）—— fieldCtx 透传到 children 渲染 */
export function renderToComponentWithGrid(
  node: SchemaNode,
  renderToComponent: RenderFn,
  fieldCtx?: RenderFieldContext
): VNode {
  const cs = node.column ? Math.floor(24 / node.column) : 24
  const arr = Array.isArray(node.children)
    ? (node.children as SchemaNode[])
    : node.children && typeof node.children === 'object'
      ? [node.children as SchemaNode]
      : []
  // 类型归因：ElRow/ElCol 与 SchemaNode 字面类型不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；
  // 嵌套 h() 的 component / props / children 三参都需兜底，运行时已验证，TS 层用 as never 替代 as any（全局 §1.5 违规）。
  return h(ElRow as never, { ...node.row } as never, {
    default: () =>
      arr.map((c, i) => {
        const inner = renderToComponent(c, fieldCtx)
        return h(
          ElCol as never,
          { span: cs, key: (c as Record<string, unknown>).key ?? i } as never,
          { default: () => (Array.isArray(inner) ? inner : [inner]) as never }
        ) as never
      }),
  }) as never
}
