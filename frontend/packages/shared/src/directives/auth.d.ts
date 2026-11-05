/**
 * 权限指令类型定义
 *
 * v-auth 用法：
 *   v-auth="'user:view'"               单个权限（缺一不可）
 *   v-auth="['user:view','user:edit']" 多个权限，全部满足才显示（AND 语义）
 *   v-auth:any="['a','b']"             任一满足即显示（ANY 语义修饰符）
 *
 * 无权限时默认行为：移除元素（display: none）
 * 也可通过修饰符 `disabled` / `remove` 切换：
 *   v-auth:any.disabled="['a','b']"    无权限添加 is-disabled 类 + pointer-events: none
 *   v-auth:any.remove="['a','b']"      无权限彻底从 DOM 移除（默认行为）
 */
export type ElHTMLElement = HTMLElement

export interface AuthBinding {
  /** 权限码（字符串）或权限码数组（AND 语义） */
  value: string | string[]
  /** 修饰符：`any` = ANY 语义；`disabled` = 仅禁用；省略 = 移除元素 */
  modifiers?: {
    any?: boolean
    disabled?: boolean
    remove?: boolean
  }
}
