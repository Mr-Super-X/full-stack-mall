// permission 指令类型定义（与 permission.ts 配套）
// 分离类型到 .d.ts：与 inputDebounce/buttonDebounce 同范式

/**
 * 扩展 HTMLElement（兼容 Element Plus 等 UI 库封装的元素）
 */
export type ElHTMLElement = HTMLElement

/**
 * v-permission 指令的 binding 类型
 *
 * 用法：
 *   v-permission="'user:edit'"                 // 单权限
 *   v-permission="['user:view','user:edit']"   // 多权限（AND 语义，全部满足）
 *   v-permission:any="['a','b']"                // 多权限（ANY 语义，任一满足）
 *
 * - value：单个权限码字符串 或 权限码数组
 * - arg：':any' 修饰符切到 ANY 语义
 */
export interface PermissionBinding {
  value: string | string[]
  arg?: string
}
