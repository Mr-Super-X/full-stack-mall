/**
 * 字段权限解析 —— 三态 view/edit/hidden
 *
 * 解析优先级：string 字面量 → 函数 → '{{ fn }}' 表达式 → undefined（视为 'edit'）。
 * 权限码（如 'user.edit'）通过 XFormProps.permissionResolver 映射；默认 identity，
 * resolver 返回非三态值或抛错时降级为 'edit'（最安全的可见可编辑态）。
 *
 * @see ../types/xform.ts XFormProps.permissionResolver —— XForm 入参契约
 * @see render-schema-node.ts RenderSchemaNodeOptions.permissionResolver —— 渲染层注入点
 *
 * @group 表单编排：权限
 */
import type { SchemaNode } from '../types'
import { get } from 'lodash-es'
import { resolveFunctionExpression, type ExpressionScope } from './use-expression'

export type FieldPermission = 'view' | 'edit' | 'hidden'

export interface ResolvePermissionOptions {
  model: () => Record<string, unknown> | undefined
  /** 权限码 → 三态映射；默认 identity。业务可注入 useAuth().hasPerm */
  permissionResolver?: (perm: string) => FieldPermission
  /**
   * H2：实例级表达式解析器（缺省回退模块级，向后兼容）。
   * 由 composer 注入 createExpressionScope() 产物，保证同页多 XForm 实例的
   * 权限表达式各用各的函数表。
   * @see ./use-expression.ts createExpressionScope
   */
  resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']
}

/** 字段权限解析：字面量 / 函数 / '{{ fn }}' 三种来源，返回 view | edit | hidden */
export function resolvePermission(
  node: SchemaNode,
  opts: ResolvePermissionOptions
): FieldPermission {
  const raw = node.permission
  if (raw === undefined || raw === null) return 'edit'
  // 权限求值抛错（函数 / 表达式 / resolver 内部异常）不能炸掉整表单渲染 ——
  // 降级为 edit（最安全的可见可编辑态）并给出可诊断日志
  try {
    // 函数
    if (typeof raw === 'function') {
      const model = opts.model() ?? {}
      return (raw as (m: Record<string, unknown>) => FieldPermission)(model) ?? 'edit'
    }
    // 字符串
    if (typeof raw === 'string') {
      // 1) 尝试函数表达式解析（与 reaction 一致；H2：优先实例级注入解析器）
      const fn = (opts.resolveFunctionExpression ?? resolveFunctionExpression)(raw)
      if (fn) {
        const model = opts.model() ?? {}
        const result = (fn as (m: Record<string, unknown>) => unknown)(model)
        if (result === 'view' || result === 'edit' || result === 'hidden') return result
      }
      // 2) 字面量或权限码 —— 走 resolver 映射
      const resolver = opts.permissionResolver ?? ((p: string) => p as FieldPermission)
      const resolved = resolver(raw)
      if (resolved === 'view' || resolved === 'edit' || resolved === 'hidden') return resolved
      return 'edit'
    }
    return 'edit'
  } catch (err) {
    console.error('[XForm] permission evaluation failed:', raw, err)
    return 'edit'
  }
}

/** view 态渲染占位：纯文本展示 model value（复杂组件如 Upload 建议节点层 reaction 自实现） */
export function renderViewPlaceholder(
  node: SchemaNode,
  model: Record<string, unknown> | undefined
): string {
  if (!node.name) return ''
  const value = get(model, node.name)
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}
