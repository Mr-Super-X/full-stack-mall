import { h, type VNode } from 'vue'

/**
 * withHidden —— 给 VNode 套 display:none wrapper
 *
 * 与 ignore 不同：ignore 不创建节点，hidden 创建但隐藏（保留表单字段注册与反应式跟踪）
 *
 * @group 表单编排：渲染
 */
export function withHidden(vnode: VNode): VNode {
  return h('div', { style: 'display: none', 'aria-hidden': 'true' }, [vnode]) as unknown as VNode
}
