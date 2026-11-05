/**
 * XForm schema DSL —— 公共类型 barrel
 *
 * 原 types.ts 单文件 556 行含 29 字段 SchemaNode + 全部子类型。重构后按职责拆为 9 个子文件，
 * 本文件仅做 re-export，保持所有现有 `import type { ... } from '@components/form-schema/types'` 不变。
 *
 * ## 子文件索引
 *
 * | 子文件 | 关键类型 | 职责 |
 * | ------ | -------- | ---- |
 * | ./types/base.ts          | EventFn / FunctionExpression / SchemaSlot | 事件 / 表达式 / slot 基础原子 |
 * | ./types/rule.ts          | RuleItem | async-validator 兼容 + 跨字段扩展 |
 * | ./types/reaction.ts      | ReactionValue / ReactionConfig | 反应式字段求值 |
 * | ./types/directive.ts     | DirectiveConfig / FormItemConfig | 指令 + FormItem 包裹 |
 * | ./types/array.ts         | ArrayNodeConfig | 数组节点配置（kind='array'） |
 * | ./types/layout.ts        | RowConfig / ColConfig / ResponsiveColConfig | 栅格响应式 |
 * | ./types/async-options.ts | AsyncOptionsConfig | 远程数据源（Select/Cascader/...） |
 * | ./types/schema-node.ts   | SchemaNode / ComponentPropsRegistry / SchemaNodeFor | **核心节点定义** |
 * | ./types/xform.ts         | XFormProps / XFormExpose / ValidateResult | Vue 组件契约 + 校验入出参 |
 *
 * @see ./types/schema-node.ts —— SchemaNode 完整字段表（30 字段）请看这个文件
 * @see ./types/xform.ts —— XFormProps / XFormExpose / beforeChange 完整说明
 * @see ./types/rule.ts —— RuleItem 跨字段规则 + crossValidator / debounceMs
 *
 * @group 类型系统
 */

/**
 * EventFn —— 节点 on 回调的函数签名
 * @see ./types/base.ts
 */
export { type EventFn } from './types/base'
/** FunctionExpression —— {{ fn }} 包裹的函数体字符串（沙箱解析见 use-expression） */
export { type FunctionExpression } from './types/base'
/** SlotRenderFn —— slot 渲染函数（支持普通 / scoped slot） */
export { type SlotRenderFn } from './types/base'
/** SchemaSlot —— SchemaNode 节点支持的单个 slot 内容形态（节点 / 节点数组 / 字符串 / 渲染函数） */
export { type SchemaSlot } from './types/base'

/**
 * RuleItem —— async-validator 兼容 + 跨字段扩展的校验规则
 *
 * 标准字段：required / pattern / min / max / validator / trigger / type
 * 跨字段扩展：dependsOn / crossValidator / debounceMs（详见 ./types/rule.ts）
 */
export { type RuleItem } from './types/rule'

/**
 * ReactionValue<T> —— 反应式字段值（字面量 / 函数 / 函数表达式字符串 三选一）
 */
export { type ReactionValue } from './types/reaction'
/**
 * ReactionConfig —— 反应式配置（覆盖节点的任意字段）
 *
 * 关键字段：strategy (sync/debounce/throttle) / delay / deps（性能优化关键，详见 ./types/reaction.ts）
 */
export { type ReactionConfig } from './types/reaction'

/** DirectiveConfig —— 自定义指令配置 */
export { type DirectiveConfig } from './types/directive'
/** FormItemConfig —— formItem 包裹详细配置（component / props / slots / rules） */
export { type FormItemConfig } from './types/directive'

/** ArrayNodeConfig —— kind='array' 时的容器配置（itemSchema / minItems / maxItems / labels / draggable） */
export { type ArrayNodeConfig } from './types/array'

/** ResponsiveColConfig —— Col 响应式单档（span/offset/push/pull） */
export { type ResponsiveColConfig } from './types/layout'
/** RowConfig —— el-row 栅格行（gutter / type / align / justify / responsive） */
export { type RowConfig } from './types/layout'
/** ColConfig —— el-col 栅格列（span / offset / push / pull / responsive） */
export { type ColConfig } from './types/layout'

/** AsyncOptionsConfig —— Select/Cascader/TreeSelect/Autocomplete 远程数据源（source / deps / transform） */
export { type AsyncOptionsConfig } from './types/async-options'

/**
 * SchemaNode —— XForm schema DSL 的核心节点定义（31 字段接口）
 *
 * 字段分组：节点标识（component/name/label/key）、渲染属性（props/on/children/slots/directives）、
 * 布局（row/column/col/formItem）、校验（rules/defaultValue）、响应式（reaction/disabled/permission/...）、
 * 数组节点（kind/array）、数据加载（asyncOptions）、v-model 适配（modelProp）、顶层配置（labelPosition/...）
 *
 * 推荐使用 `SchemaNodeFor<C>` 泛型版本按 component 字段推导 props 类型：
 *   const node: SchemaNodeFor<'Input'> = { component: 'Input', props: { placeholder: 'x' } }
 *
 * 完整字段表 + 每个字段的业务说明见 `./types/schema-node.ts`
 */
export { type SchemaNode } from './types/schema-node'
/**
 * P2-1 命名空间分组 —— SchemaNode 由 9 个子接口 extends 组合而成
 * 业务可按需 import 某个命名空间（仅关心某类字段的子类型场景）
 * @see ./types/schema-node.ts 字段分组对照表
 */
export { type SchemaNodeIdentity } from './types/identity'
/** XFormTranslateFn —— i18n 翻译函数签名（调用方注入 vue-i18n 的 t 或自研字典函数） */
export { type XFormTranslateFn } from './types/identity'
/** XFormLabelFn —— i18n 函数式 label（收 t，渲染期在 render effect 内求值，语言切换自动重渲） */
export { type XFormLabelFn } from './types/identity'
export { type SchemaNodeRender } from './types/render'
export { type SchemaNodeLayout } from './types/layout'
export { type SchemaNodeValidate } from './types/validate'
export { type SchemaNodeReactive } from './types/reaction'
export { type SchemaNodeArray } from './types/array'
export { type SchemaNodeData } from './types/async-options'
export { type SchemaNodeVModel } from './types/v-model'
export { type SchemaNodeTopLevel } from './types/top-level'
/**
 * ComponentPropsRegistry —— 快捷名 → 组件 props 类型映射
 *
 * 消费方可 TS module augmentation 扩展自定义组件：
 * ```ts
 * declare module '@components/form-schema/types' {
 *   interface ComponentPropsRegistry { MyInput: MyInputProps }
 * }
 * ```
 */
export { type ComponentPropsRegistry } from './types/schema-node'
/** PropsByComponent —— ComponentPropsRegistry 的向后兼容别名 */
export { type PropsByComponent } from './types/schema-node'
/** ComponentName —— SchemaNode.component 支持的字面量联合类型 */
export { type ComponentName } from './types/schema-node'
/** SchemaNodeFor<C> —— 按 component 字段推导 props 类型的 SchemaNode 泛型版本 */
export { type SchemaNodeFor } from './types/schema-node'

/**
 * XFormProps —— Vue 组件入参（schema / model / components / rules / beforeChange / zodSchema / ...）
 *
 * 完整字段说明 + beforeChange 3 层钩子语义见 `./types/xform.ts`
 */
export { type XFormProps } from './types/xform'
/**
 * XFormExpose —— Vue 组件实例方法（validate / validateDetail / setFieldError / addItem / isDirty / ...）
 *
 * 完整 19 方法列表见 `./types/xform.ts`
 */
export { type XFormExpose } from './types/xform'
/** ValidateOptions —— validate() 入参（validateFirst / knownComponents） */
export { type ValidateOptions } from './types/xform'
/** ValidateResult —— validate() 出参（isValid + errors 含 keyPath + message） */
export { type ValidateResult } from './types/xform'
/**
 * BeforeChangeCtx —— beforeChange 钩子上下文
 *
 * 提供 setFieldValue（联动改兄弟字段）/ setFieldError（强制显示错误）/ abort（取消写入）
 */
export { type BeforeChangeCtx } from './types/xform'
/** BeforeChangeFn —— beforeChange 函数签名（全局 / 字段级 / 命名空间 handler 共用） */
export { type BeforeChangeFn } from './types/xform'
/** BeforeChangeRule —— 动态命名空间拦截规则（按 pattern 匹配字段路径） */
export { type BeforeChangeRule } from './types/xform'
