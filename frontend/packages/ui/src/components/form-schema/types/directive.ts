/**
 * 指令系统 + FormItem 包裹配置
 *
 * 两个职责互相关联但语法独立：
 * - DirectiveConfig：节点级 Vue 指令挂载（v-permission 等），由 apply-directives.ts 在 h() 时通过
 *   withDirectives 注入。directive 字段同时支持字符串名（注册到 app.directive）和对象（直接传入）。
 * - FormItemConfig：节点是否包 el-form-item 的详细配置。SchemaNode.formItem 三态之一就是 FormItemConfig，
 *   允许指定 component / props / slots / rules 全覆盖默认值（例如把 formItem 换成自定义 XxxFormItem）。
 *
 * `[key: string]: unknown` 索引签名是开闭原则：FormItemConfig 既透传 el-form-item 的所有 props，
 * 又允许未来新增 SchemaNode 派生字段时类型不报错。代价是丢失部分类型安全，但 formItem 是
 * 高级配置入口，业务罕用，可接受。
 *
 * @see ../composables/apply-directives.ts 指令挂载实现
 * @see ../composables/render-form-item.ts formItem 渲染入口
 *
 * @group 类型系统
 */
import type { Directive } from 'vue'
import type { SchemaNode } from './schema-node'
import type { SchemaSlot } from './base'

/** 单个 Vue 指令挂载配置 —— 与 Vue 官方 DirectiveBinding 字段一一对应 */
export interface DirectiveConfig {
  /** 指令名（已通过 app.directive 注册）或指令对象 */
  directive: string | Directive
  /** 指令 arg（如 v-on:click 中的 click） */
  arg?: string
  /** 指令修饰符（如 v-on:click.stop 中的 stop） */
  modifiers?: Record<string, boolean>
  /** 指令 value（如 v-permission="'user.edit'" 中的 'user.edit'） */
  value?: unknown
}

/** FormItem 包裹详细配置 —— SchemaNode.formItem 字段的详细形态 */
export interface FormItemConfig {
  /** 自定义 formItem 组件名（如 'XxxFormItem'）；不传则默认 el-form-item */
  component?: string
  /** 透传给 formItem 组件的 props */
  props?: Record<string, unknown>
  /** formItem 内的 Vue 指令挂载 */
  directives?: DirectiveConfig[]
  /** formItem 的 slot 内容（label / error 等） */
  slots?: Record<string, SchemaSlot>
  /** formItem 级 rules（与字段级 rules 合并） */
  rules?: SchemaNode['rules']
  /** 开闭原则：透传 formItem 组件任意未知 props */
  [key: string]: unknown
}
