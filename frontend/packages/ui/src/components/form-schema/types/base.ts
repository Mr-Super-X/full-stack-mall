/**
 * 基础类型 —— XForm schema DSL 的事件 / 表达式 / slot 语义原子
 *
 * 与具体的字段 / 校验 / 反应式 / 权限等职责无关，仅定义三套跨命名空间复用的"叶子原子"：
 * - EventFn：节点 `on` 回调签名
 * - FunctionExpression：`{{ fn }}` 表达式沙箱的字符串载荷（解析见 ./composables/use-expression.ts）
 * - SchemaSlot：节点 `slots` 字段接受的内容形态（节点 / 节点数组 / 字符串 / 渲染函数）
 *
 * 为何独立成文件：4 个其他命名空间（render / reactive / directive / array）都依赖这三个原子，
 * 但原子本身没有任何业务领域语义，集中放置避免循环引用 + 便于 TS 编译器并行解析。
 *
 * @see ./schema-node.ts 顶层使用方
 * @see ../composables/use-expression.ts FunctionExpression 沙箱解析入口
 *
 * @group 类型系统
 */
import type { VNode } from 'vue'
import type { SchemaNode } from './schema-node'

/** 节点 `on` 事件回调 —— 第 1 参数为事件值，后续透传组件 emit 参数 */
export type EventFn = (value: unknown, ...args: unknown[]) => unknown
/** 函数表达式：`{{ ... }}` 包裹的函数体字符串，由 use-expression 在沙箱中编译执行 */
export type FunctionExpression = string

/** slot 渲染函数 —— 同时支持普通 slot / scoped slot；JSX 实质是其语法糖 */
export type SlotRenderFn = (
  scope?: Record<string, unknown>
) => VNode | VNode[] | string | undefined | null

/** Schema 节点支持的单个 slot 内容形态 —— 节点 / 节点数组 / 字符串 / 渲染函数四选一 */
export type SchemaSlot = SchemaNode | SchemaNode[] | string | undefined | SlotRenderFn
