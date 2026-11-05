// copy 指令类型定义（与 copy.ts 配套）
// 分离类型声明到 .d.ts：与 permission/inputDebounce/buttonDebounce/draggable 同范式，
// 便于 IDE 单独 hover 类型，也便于未来扩展（arg/modifiers）时改这里不动 .ts。

/**
 * 扩展 HTMLElement（兼容 Element Plus 等 UI 库封装的元素）
 *
 * 与其他指令的同名 type 各自独立定义：避免跨文件循环依赖，类型层零耦合。
 */
export type ElHTMLElement = HTMLElement

/**
 * v-copy 指令的 binding 值类型
 *
 * 用法：
 *   v-copy="'hello world'"              静态字符串（updated 时整体替换）
 *   v-copy="() => `订单-${id}`"         动态函数（每次点击实时求值，避免闭包陈旧）
 *
 * 函数形式为什么必须支持：复制内容往往依赖运行时状态（如当前行 id、表单字段拼接），
 * 直接传字符串会在 mounted 时定死，组件状态变化后指令拿不到最新值。
 */
export type CopyValue = string | (() => string)
