// buttonDebounce 指令类型定义（与 buttonDebounce.ts 配套）
// 作用：分离类型声明到 .d.ts，让 buttonDebounce.ts 自身可被 TS 仅做类型检查时引用

/**
 * 扩展 HTMLElement（兼容 Element Plus 等 UI 库封装的元素）
 */
export type ElHTMLElement = HTMLElement

/**
 * v-buttonDebounce 指令的 binding 值类型
 *
 * 用法：v-buttonDebounce="onClick" 或 v-buttonDebounce:500="onClick"
 * - value：实际点击处理函数
 * - arg：可选延迟（毫秒），默认 500
 */
export interface ButtonDebounceBinding {
  value: (event: Event) => void
  arg?: string
}

/**
 * 模块级 click 函数引用（按参考范式约定）
 * 配合 debounce 工具闭包使用；inputDebounce 也可共享。
 */
export let clickFunction: (event: Event) => void
