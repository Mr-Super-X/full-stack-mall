/**
 * inheritContainerLabelWidth —— 容器级 labelWidth 向子树字段继承拍平
 *
 * 背景：XForm 的 labelWidth 消费原本只有两层——XForm 顶层 schema（→ el-form 实例级，
 * element-plus 原生继承）与字段级（render-form-item 显式透传）。嵌套容器（数组 item 根 /
 * 布局容器）上的 labelWidth 无人消费，被静默忽略（mall-admin 规格行 itemSchema 根 55px
 * 不生效实证，2026-11-12）。
 *
 * 本工具在渲染前置处理（use-schema-renderer clone 后、reactive 前）把「容器 labelWidth」
 * 下推给子树中未配置的字段节点：
 * - 顶层 schema 的 labelWidth **不参与下推**——el-form 已承担全局默认，避免双重语义
 * - 字段级已配置 labelWidth 的节点不动（字段级优先）
 * - 无 label 的字段不继承——保持 render-form-item「无 label 强制 0px」的防空白语义
 * - 数组节点 itemSchema 随容器链传播（规格行 itemSchema 根 labelWidth → 行内字段），
 *   数组节点自身的 labelWidth 亦是其容器 formItem 的 label 宽，两语义一致
 * - 就近优先：内层容器 labelWidth 覆盖外层继承值
 *
 * 为什么自写 DFS 而不复用 walkSchema：需要祖先继承上下文（非 visit 单参语义），
 * 且写目标仅限 children / array.itemSchema 两向（slots 内节点不承载 labelWidth）。
 *
 * 原地修改入参树——调用方须保证传入的是已克隆、非用户持有的树。
 *
 * @group 表单编排：工具
 * @see ../composables/use-schema-renderer.ts 渲染前置处理调用点
 * @see ../composables/render-form-item.ts 字段级 labelWidth 消费点
 */
import type { SchemaNode } from '../types'

type LabelWidthValue = string | number

function isContainerNode(n: SchemaNode): boolean {
  return n.kind === 'array' || n.children !== undefined
}

function hasLabelText(n: SchemaNode): boolean {
  // 函数式 label（i18n）同样视为有 label（resolveLabel 渲染期求值）
  return n.label != null && n.label !== ''
}

export function inheritContainerLabelWidth(schema: SchemaNode | SchemaNode[]): void {
  const walk = (
    nodes: SchemaNode | SchemaNode[] | undefined,
    inherited: LabelWidthValue | undefined
  ): void => {
    if (!nodes) return
    const list = Array.isArray(nodes) ? nodes : [nodes]
    for (const node of list) {
      const isContainer = isContainerNode(node)
      // 容器自身配了 labelWidth → 更新继承值；未配 → 透传上游继承值
      const current = isContainer && node.labelWidth !== undefined ? node.labelWidth : inherited
      if (isContainer) {
        if (node.kind === 'array' && node.array?.itemSchema) {
          walk(node.array.itemSchema as SchemaNode | SchemaNode[], current)
        }
        if (node.children !== undefined) {
          walk(node.children as SchemaNode | SchemaNode[], current)
        }
        continue
      }
      // 字段节点：未配置 + 祖先有继承值 + 有 label → 写入继承值
      if (node.labelWidth === undefined && current !== undefined && hasLabelText(node)) {
        node.labelWidth = current
      }
    }
  }

  // 顶层 schema 自身的 labelWidth 是 el-form 全局默认（EP 原生承担），从 children 起传 undefined
  if (Array.isArray(schema)) {
    walk(schema, undefined)
    return
  }
  if (schema.kind === 'array' && schema.array?.itemSchema) {
    walk(schema.array.itemSchema as SchemaNode | SchemaNode[], undefined)
  }
  if (schema.children !== undefined) {
    walk(schema.children as SchemaNode | SchemaNode[], undefined)
  }
}
