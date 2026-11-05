/**
 * 把 node.directives 数组应用到 vnode（vue withDirectives 包装）：
 * 第二参数必须是元组数组 `[dir, value, arg, modifiers]`（Vue 按 .length 解构，对象会被静默跳过）。
 * 字符串指令名暂不可解析（注册表尚未接线），跳过；当前仅支持直接传 Directive 对象。
 *
 * @group 表单编排：渲染
 */
import { withDirectives, type VNode, type Directive } from 'vue'
import type { DirectiveConfig } from '../types'

/** applyDirectives —— 把 node.directives 数组应用到 vnode（vue withDirectives 包装） */
export function applyDirectives(vnode: VNode, directives: DirectiveConfig[] | undefined): VNode {
  if (!directives || directives.length === 0) return vnode
  try {
    const bindings: unknown[] = []
    for (const d of directives) {
      let dirObj: Directive
      if (typeof d.directive === 'string') {
        continue
      } else {
        dirObj = d.directive as Directive
      }
      bindings.push([dirObj, d.value, d.arg, d.modifiers])
    }
    if (bindings.length === 0) return vnode
    return withDirectives(vnode, bindings as Parameters<typeof withDirectives>[1]) as VNode
  } catch (err) {
    console.warn('[XForm] applyDirectives failed:', err)
    return vnode
  }
}
