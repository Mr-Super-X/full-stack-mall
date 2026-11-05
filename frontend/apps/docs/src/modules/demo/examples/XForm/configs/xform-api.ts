/**
 * XForm demo 的 API 文档数据（Props / Events / Slots / 实例方法）
 *
 * 数据源：@vv/ui/components/form-schema/types.ts（XFormProps / XFormExpose / SchemaNode）。
 * 结构兼容 ApiTable 的 items 入参（TypeScript 结构化类型，无需显式依赖）。
 */

export interface XFormApiItem {
  name: string
  type?: string
  default?: string
  description: string
  required?: boolean
}

export const propsItems: XFormApiItem[] = [
  {
    name: 'schema',
    type: 'SchemaNode | SchemaNode[]',
    required: true,
    description:
      '表单 schema（全量 17 字段 DSL：component / props / on / children / name / label / rules / reaction ...）',
  },
  {
    name: 'model',
    type: 'Record<string, unknown>',
    description:
      '响应式数据对象（需 reactive() 包装；校验 / 默认值 / reaction / dirty 追踪均依赖它）',
  },
  {
    name: 'components',
    type: 'Record<string, Component>',
    description: '自定义组件映射（覆盖内置 element-plus 映射）',
  },
  {
    name: 'rules',
    type: 'Record<string, RuleItem>',
    description: '校验规则命名引用（schema 节点 rules 可写字符串名）',
  },
  {
    name: 'directives',
    type: 'Record<string, Directive>',
    description: '自定义指令映射（预留：当前节点 directives 请直接传 Directive 对象）',
  },
  {
    name: 'beforeChange',
    type: '(item, newVal, oldVal) => unknown | Promise',
    description: '字段值变化前拦截：同步返回值替换 / Promise resolve 后更新 / reject 跳过更新',
  },
  {
    name: 'zodSchema',
    type: 'ZodType',
    description: 'zod 顶层校验 schema（配合 validateWithZod 实例方法）',
  },
  {
    name: 'componentProps',
    type: 'Record<string, Record<string, unknown>>',
    description: '按组件名注入默认 props（节点级 props 可覆盖）',
  },
  {
    name: 'scrollToError',
    type: 'boolean',
    default: 'false',
    description:
      '校验失败自动滚动到第一个错误字段（透传 ElForm 原生能力，跨字段错误由 XForm 内部滚动）',
  },
  {
    name: 'scrollIntoViewOptions',
    type: 'ScrollIntoViewOptions | boolean',
    default: 'true',
    description: '滚动行为选项透传 ElForm',
  },
]

export const eventsItems: XFormApiItem[] = [
  {
    name: 'node.on',
    type: 'Record<string, Function | {{ fn }}>',
    description:
      'XForm 组件本身不 emit 事件；字段级事件经 schema 节点 on 配置——键为组件事件名（change / input / blur ...），值为回调函数或 {{ }} 函数表达式',
  },
]

export const slotsItems: XFormApiItem[] = [
  {
    name: 'node.slots',
    type: 'SchemaSlot',
    description:
      'XForm 组件本身无插槽；字段插槽经 schema 节点 slots 配置，支持三种内容：SchemaNode / 字符串 / slot 函数（含 scoped slot）',
  },
]

/** SchemaNode 字段（schema DSL 简表）—— 完整定义见 types.ts */
export const schemaNodeItems: XFormApiItem[] = [
  {
    name: 'component',
    type: 'string | Component',
    required: true,
    description: '组件名（内置 EL 短名 / components prop 注册名）或直接传组件对象',
  },
  {
    name: 'name / label',
    type: 'string',
    description: '表单域绑定路径（支持 lodash 路径，如 items[0].qty）/ 字段标签',
  },
  {
    name: 'props',
    type: 'Record<string, unknown>',
    description: '组件属性（节点级，覆盖 componentProps 全局默认）',
  },
  {
    name: 'on',
    type: 'Record<string, Function | {{ fn }}>',
    description: '字段事件：键为组件事件名，值为回调函数或沙箱表达式',
  },
  {
    name: 'children',
    type: 'SchemaNode | SchemaNode[] | string',
    description: '子节点递归（嵌套布局 / 组件内容）',
  },
  {
    name: 'rules',
    type: 'string | RuleItem | Array<string | RuleItem>',
    description: '校验规则：async-validator 兼容；字符串先查 rules 命名表，未命中退化为 required',
  },
  {
    name: 'formItem',
    type: 'boolean | FormItemConfig',
    description:
      '是否包 el-form-item（false 裸渲染）；对象形式可自定义 FormItem 组件 / props / slots',
  },
  {
    name: 'modelProp',
    type: 'string',
    default: "'modelValue'",
    description: '自定义 v-model 双向绑定属性名（默认 modelValue / update:modelValue）',
  },
  {
    name: 'defaultValue',
    type: 'unknown',
    description: '挂载时填充到 model（仅字段未定义时）',
  },
  {
    name: 'row / column / col',
    type: 'RowConfig | number | boolean | ColConfig',
    description: '栅格：行配置（gutter / 对齐 / 断点）/ 每行列数 / 列配置（span / offset / 断点）',
  },
  {
    name: 'reaction',
    type: 'ReactionConfig',
    description:
      '反应式覆盖 hidden / disabled / rules / props / label，支持 sync / debounce / throttle',
  },
  {
    name: 'directives',
    type: 'DirectiveConfig[]',
    description: '节点级自定义指令（directive 对象 + value / arg / modifiers）',
  },
  {
    name: 'asyncOptions',
    type: 'AsyncOptionsConfig',
    description: '异步选项数据源（Select / Cascader / TreeSelect / Autocomplete）',
  },
  {
    name: 'slots',
    type: 'Record<string, SchemaSlot>',
    description: '插槽：SchemaNode / 字符串 / slot 函数（含 scoped slot）',
  },
  {
    name: 'disabled',
    type: 'ReactionValue<boolean>',
    description: '字段禁用（支持反应式），el-form 自动跳过禁用字段校验',
  },
  {
    name: 'permission',
    type: "ReactionValue<'view' | 'edit' | 'hidden'>",
    description: '字段权限三态：view 只读纯文本 / edit 可编辑 / hidden 不渲染',
  },
  {
    name: 'ignore / hidden / key',
    type: 'boolean | boolean | string | number',
    description: '忽略（不参与字段索引）/ 隐藏（渲染但不可见）/ 渲染 key',
  },
  {
    name: 'kind + array',
    type: "'array' + ArrayNodeConfig",
    description: '数组容器节点：itemSchema 每行子 schema + 增删移 / minItems / maxItems',
  },
]

export const methodsItems: XFormApiItem[] = [
  {
    name: 'validate',
    type: '() => Promise<boolean>',
    description: 'el-form 整体校验（async-validator）',
  },
  {
    name: 'validateDetail',
    type: '() => Promise<ValidateResult>',
    description: '详细校验结果（含跨字段 crossValidator 错误的 keyPath + message）',
  },
  {
    name: 'validateWithZod',
    type: '() => { success, errors }',
    description: 'zod 顶层校验（需传 zodSchema prop）',
  },
  { name: 'clearValidate', type: '() => void', description: '清除全部字段校验状态' },
  { name: 'resetFields', type: '() => void', description: '重置字段为初始值' },
  { name: 'scrollToField', type: '(name: string) => void', description: '滚动到指定字段' },
  {
    name: 'getRef',
    type: '(key) => Component | HTMLElement | null',
    description: '获取字段组件 / 元素引用',
  },
  { name: 'getNames', type: '(includesIgnore?) => string[]', description: '全部字段名列表' },
  {
    name: 'setFieldError',
    type: '(name, message, state?) => void',
    description: '手动写入字段错误（服务端 422 场景）',
  },
  {
    name: 'setFieldValidating',
    type: '(name) => void',
    description: '标记字段为校验中（form-item 显示 loading 图标）',
  },
  {
    name: 'validateFromServer',
    type: '(response) => number',
    description: '服务端响应映射：success=true 清空全部错误；errors 写入字段红字',
  },
  { name: 'addItem', type: '(name, init?) => void', description: '数组节点追加一行' },
  { name: 'removeItem', type: '(name, index) => void', description: '数组节点删除指定行' },
  { name: 'moveItem', type: '(name, from, to) => void', description: '数组节点行位置调整' },
  { name: 'isDirty', type: '() => boolean', description: '是否有未保存修改（相对基线）' },
  { name: 'getDirtyFields', type: '() => string[]', description: '全部 dirty 字段路径列表' },
  { name: 'isTouched', type: '(name) => boolean', description: '指定字段是否被修改过' },
  { name: 'resetDirty', type: '() => void', description: '把当前状态标记为新基线' },
]
