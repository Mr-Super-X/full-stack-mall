/**
 * SchemaNode 命名空间 —— 渲染属性（5 字段）
 *
 * P2-1 拆分：原 SchemaNode 31 字段拆为 9 个命名空间接口，本文件定义「渲染属性」子集：
 * props / on / children / slots / directives —— 节点渲染时透传给 component 的属性与事件。
 *
 * 业务用法：
 * - 直接 import 此接口用于"只需 props/on 等渲染配置 + 其他命名空间字段"的子类型场景
 * - 通过 SchemaNode（schema-node.ts）使用全部 9 个命名空间
 *
 * 不变量：
 * - SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价
 * - 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变
 */
import type { EventFn, FunctionExpression, SchemaSlot } from './base'
import type { DirectiveConfig } from './directive'
import type { SchemaNode } from './schema-node'

/**
 * SchemaNodeRender —— 渲染属性（props/on/children/slots/directives）
 */
export interface SchemaNodeRender {
  /**
   * 透传给 component 的属性对象（element-plus 组件对应 ElXxxProps）
   * 推荐：使用 `SchemaNodeFor<C>` 泛型版本按 component 字段推导 props 类型
   * @group 节点标识
   */
  props?: Record<string, unknown>
  /**
   * 事件绑定 —— 键为事件名（如 'change' / 'blur'），值可为函数或 `{{ fn }}` 表达式
   * @group 渲染属性
   */
  on?: Record<string, EventFn | FunctionExpression>
  /**
   * 子节点（递归 SchemaNode） / 子节点数组 / 字符串文本（用于 slot 内 text 内容）
   * @group 渲染属性
   */
  children?: SchemaNode | SchemaNode[] | string
  /**
   * 节点插槽内容 —— 键为 slot 名（如 'default' / 'tip'），值为 SchemaSlot（节点/字符串/渲染函数）
   * @group 渲染属性
   */
  slots?: Record<string, SchemaSlot>
  /**
   * 自定义指令数组（vue withDirectives 对应）
   * - directive 字段支持 string 指令名（待注册表接线）或直接传 Directive 对象
   * - 当前以 path-only 形式应用在渲染层 vnode 上
   * @group 渲染属性
   */
  directives?: DirectiveConfig[]
}
