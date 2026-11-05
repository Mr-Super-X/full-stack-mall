/**
 * 视觉容器渲染（Card 等带 row/column 的节点，无 name 时走该分支）：
 * 默认 slot 来自 node.children 或 grid 渲染。
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 *
 * @group 表单编排：渲染
 */
import { h, type VNode } from 'vue'
import type { SchemaNode } from '../types'
import { buildSlotFn, getComponentDefaultProps } from './barrel'
import { renderToComponentWithGrid } from './render-with-grid'
import type { RenderSchemaNodeOptions } from './render-schema-node'

/** renderVisualContainer —— 视觉容器渲染（Card 等无 name 节点） */
export function renderVisualContainer(
  node: SchemaNode,
  Comp: object | string,
  opts: RenderSchemaNodeOptions,
  asyncProps: Record<string, unknown>
): VNode {
  const slotMap: Record<string, (scope?: unknown) => unknown> = {}
  if (node.slots) {
    for (const [k, v] of Object.entries(node.slots)) slotMap[k] = buildSlotFn(v, opts.render)
  }
  const useGrid = !!(node.row || node.column !== undefined)
  slotMap.default = useGrid
    ? () => renderToComponentWithGrid(node, opts.render)
    : () => opts.render(node.children as never) as never
  // 类型归因：动态 Comp（resolveComponentFor 返回 object | string）与 h() 第一参 union 不等价
  // （C1 根因，详见 types/TYPE-CAST-AUDIT.md）；运行时 render 验证通过，TS 层用 as never 兜底。
  return h(
    Comp as never,
    {
      ...getComponentDefaultProps(node, opts.componentProps),
      ...node.props,
      ...asyncProps,
      ...(node.disabled !== undefined ? { disabled: node.disabled } : {}),
      ...(node.key !== undefined && { key: node.key }),
    } as never,
    slotMap
  ) as never
}
