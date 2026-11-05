/**
 * form-schema 公共入口 —— 组件 / composable / 类型 / 构建器 聚合 barrel
 *
 * 项目角色：XForm 组件库对外唯一出口，业务方通过 `import { XForm, ... } from '@components/form-schema'`
 * 即可获得组件 + 链式 builder + 辅助 composable + 全部类型。
 *
 * 依赖：./components/XForm.vue 组件 / ./composables/* 子能力 / ./adapters 组件适配层 / ./builders 链式 API / ./types 类型契约。
 *
 * JSDoc IDE 提示规范：所有 re-export 上方必须有 JSDoc（types.ts barrel 已对齐）。
 * 原因：业务方 hover `import { Xxx } from '@components/form-schema'` 时，IDE 直接跳到本 barrel，
 * 如果 re-export 行无 JSDoc，IDE 只显示 `(alias) ...`，真实定义位置的注释不显示。
 * @see ./types.ts types barrel 完整类型索引
 * @see ./composables barrel 模块级 composable 重导出
 *
 * @group XForm 入口
 */
import type { App, Component } from 'vue'
import XForm from './components/XForm.vue'

/** XForm 组件（具名导出；默认导出是插件形式） */
export { XForm }
/** validate —— 静态校验 schema DSL 合法性（dev mode 调试用） */
export { validate, validateWithZod } from './composables/use-validate'
/** useFormPersist —— 表单草稿持久化 composable（localStorage 后端） */
export { useFormPersist } from './composables/use-form-persist'
/** FormPersistOptions / FormPersistReturn —— useFormPersist 入参与返回值类型 */
export { type FormPersistOptions, type FormPersistReturn } from './composables/use-form-persist'
/** useFormDirty —— dirty 状态追踪 composable */
export { useFormDirty } from './composables/use-form-dirty'
/** UseFormDirtyOptions / UseFormDirtyReturn —— useFormDirty 入参与返回值类型 */
export { type UseFormDirtyOptions, type UseFormDirtyReturn } from './composables/use-form-dirty'
/** useSchemaIndex / buildIndex —— 字段元数据中央索引 composable */
export { useSchemaIndex, buildIndex } from './composables/use-schema-index'
/** UseSchemaIndexReturn / SchemaIndex / CrossRuleEntry —— schema 索引类型 */
export {
  type UseSchemaIndexReturn,
  type SchemaIndex,
  type CrossRuleEntry,
} from './composables/use-schema-index'
/**
 * resolveFunctionExpression —— 编译并执行 `{{ fn }}` 函数表达式字符串（沙箱）
 *
 * @deprecated 2026-09-09（H2）：模块级共享缓存 + 函数表导致多 XForm 实例互相污染。
 * 新代码请用 createExpressionScope()（每实例一份）。保留是为向后兼容已接入的旧调用方。
 * 移除锚点：v4.0（架构审查 #13，2026-09-18）——届时删除本导出，调用方须迁移到 createExpressionScope
 */
export { resolveFunctionExpression } from './composables/use-expression'
/** resolveElComponentName —— schema.component 字符串解析到最终组件名 */
export { resolveElComponentName } from './adapters/element-plus-adapter'

// 链式构建器全集（27 个工厂函数：xInput / xSelect / ... / xRate / xArray）
/** 链式 builder API —— xInput / xSelect / xDatePicker / xArray / ... 全集 */
export * from './builders'

/**
 * XForm schema DSL 核心类型 —— 业务方按需 import
 * @see ./types.ts barrel 完整索引
 */
export {
  type SchemaNode,
  type XFormProps,
  type XFormExpose,
  type RuleItem,
  type ReactionConfig,
  type DirectiveConfig,
  type FormItemConfig,
  type RowConfig,
  type ColConfig,
  type EventFn,
  type FunctionExpression,
} from './types'

/** Vue 插件形式：app.use(FormSchema) 注册 <XForm> 全局组件 */
const FormSchemaPlugin: { install: (app: App) => void } & Component = {
  install(app: App) {
    app.component('XForm', XForm)
  },
}

export default FormSchemaPlugin
