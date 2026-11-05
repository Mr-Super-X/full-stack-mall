// inputDebounce 指令类型定义（与 inputDebounce.ts 配套）
// 分离类型声明到 .d.ts：与 buttonDebounce 同范式，便于 IDE 单独 hover 类型

/**
 * 扩展 HTMLElement（兼容 Element Plus 等 UI 库封装的元素）
 * 与 buttonDebounce.d.ts 的 ElHTMLElement 等价；本文件独立定义避免跨文件依赖
 */
export type ElHTMLElement = HTMLElement

/**
 * v-inputDebounce 指令的 binding 值类型
 *
 * 用法：v-inputDebounce="onInput" 或 v-inputDebounce:500="onInput"
 * - value：实际 input 处理函数
 * - arg：可选延迟（毫秒），默认 300
 */
export interface InputDebounceBinding {
  value: (event: Event) => void
  arg?: string
}
