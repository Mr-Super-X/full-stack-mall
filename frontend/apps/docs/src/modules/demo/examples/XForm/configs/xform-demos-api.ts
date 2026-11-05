/**
 * form 系列 demo 的专属 API 数据（A 档）
 *
 * 原则：每个 demo 只列「该功能专属」的 API 面（schema 字段 / 配置项 / 相关方法），
 * 与 XForm 总览（xform-api.ts 的 Props/Events/Slots/实例方法）不重复。
 * 数据源：@vv/ui/components/form-schema/types.ts 与各 composable 签名。
 */
import type { XFormApiItem } from './xform-api'

// XFormPersist —— useFormPersist 配置与返回值
export const persistItems: XFormApiItem[] = [
  {
    name: 'key',
    type: 'string',
    required: true,
    description: '草稿唯一标识，建议 `<模块>.<表单名>.draft`（经 storage namespace 隔离）',
  },
  {
    name: 'model',
    type: 'Record<string, unknown>',
    required: true,
    description: '被监听的 reactive model（deep watch 防抖落盘）',
  },
  {
    name: 'storage',
    type: "'local' | 'session'",
    default: "'local'",
    description: "存储介质：'local' 跨会话保留；'session' 关标签页失效",
  },
  { name: 'debounce', type: 'number', default: '400', description: '自动保存防抖 ms' },
  {
    name: 'exclude',
    type: 'string[]',
    default: '[]',
    description: '敏感字段 lodash 路径（如 card.cvv），序列化剔除、不落盘',
  },
  {
    name: 'restoreFilter',
    type: '(draft) => draft | null',
    description: '恢复过滤器：schema 升级后裁剪旧草稿；返回 null 丢弃草稿',
  },
  {
    name: 'save() / load() / clear()',
    type: '() => void / () => boolean / () => void',
    description: '手动补丁：立即落盘 / 恢复草稿（可反复 load）/ 清除草稿',
  },
  {
    name: 'hasDraft / lastSavedAt',
    type: 'Ref<boolean> / Ref<number | null>',
    description: '初始化同步得出的草稿存在标记 / 最后保存时间戳',
  },
]

// XFormArray —— ArrayNodeConfig
export const arrayItems: XFormApiItem[] = [
  { name: 'kind', type: "'array'", required: true, description: '节点类型声明（配合 array 配置）' },
  {
    name: 'array.itemSchema',
    type: 'SchemaNode | SchemaNode[]',
    required: true,
    description: '每行渲染的子 schema（套到 model[name] 每个数组元素）',
  },
  {
    name: 'array.initialLength',
    type: 'number',
    default: '1',
    description: 'model 未定义时的初始行数',
  },
  {
    name: 'array.minItems / maxItems',
    type: 'number',
    description: '行数下限（达限禁删）/ 上限（达限禁增），校验同步读取',
  },
  {
    name: 'array.showActions',
    type: 'boolean | { add, remove, move }',
    default: 'true',
    description: '操作按钮显隐（可分别控制增 / 删 / 移）',
  },
  {
    name: 'array.labels',
    type: '{ add, remove, moveUp, moveDown }',
    description: '操作按钮文案（默认 添加/删除/上移/下移）',
  },
  { name: 'array.title', type: 'string', description: '容器标题（默认不渲染表头）' },
  {
    name: 'array.draggable',
    type: 'boolean',
    default: 'false',
    description: '行拖拽排序：开启后行可 HTML5 拖拽换位（drop 调 moveItem 更新 model）',
  },
]

// XFormReaction —— ReactionConfig 核心字段
export const reactionItems: XFormApiItem[] = [
  {
    name: 'strategy',
    type: "'sync' | 'debounce' | 'throttle'",
    default: "'sync'",
    description: '调度策略：依赖变化立即执行 / 停止变化 delay ms 后执行一次 / delay ms 内最多一次',
  },
  {
    name: 'delay',
    type: 'number',
    description: 'debounce / throttle 延迟 ms（strategy ≠ sync 时生效）',
  },
  {
    name: 'hidden / disabled',
    type: 'ReactionValue<boolean>',
    description: '反应式显隐 / 禁用（值支持字面量 / 函数 / {{ }} 表达式）',
  },
  {
    name: 'rules / props / label',
    type: 'ReactionValue<...>',
    description: '反应式校验规则 / 组件属性 / 标签文字',
  },
]

// XFormAsyncOptions —— AsyncOptionsConfig
export const asyncOptionsItems: XFormApiItem[] = [
  {
    name: 'source',
    type: '(query?) => Promise<T[]> | T[]',
    required: true,
    description: '数据源函数（Autocomplete 场景可接收 query 参数）',
  },
  {
    name: 'immediate',
    type: 'boolean',
    default: 'true',
    description: '节点创建时是否立即请求',
  },
  {
    name: 'deps',
    type: 'string | string[]',
    description: '依赖字段路径（lodash 路径），任一依赖变化重新请求',
  },
  {
    name: 'transform',
    type: '(raw: T[]) => { label, value }[]',
    description: '把原始数组转为组件需要的 label/value 数组',
  },
  {
    name: 'onError',
    type: '(err) => void',
    description: '请求出错回调（默认写入内部 error 状态）',
  },
]

// XFormCrossField —— RuleItem 跨字段字段
export const crossFieldItems: XFormApiItem[] = [
  {
    name: 'dependsOn',
    type: 'string | string[]',
    description: '声明依赖的其他字段名（lodash 路径），仅与 crossValidator 配合',
  },
  {
    name: 'crossValidator',
    type: '(value, ...deps) => true | string | Promise',
    description:
      '跨字段校验：返回 true 通过；返回 string 作为错误信息；Promise 支持异步（validateForm 会 await）',
  },
  {
    name: 'trigger',
    type: "'blur' | 'change' | 'manual'",
    description: '校验触发时机（依赖字段变化时的实时重算由 XForm 内部反向触发）',
  },
]

// XFormFieldPermission —— permission 字段
export const permissionItems: XFormApiItem[] = [
  {
    name: 'permission',
    type: "ReactionValue<'view' | 'edit' | 'hidden'>",
    default: "'edit'",
    description: '字段权限三态：view 只读纯文本（跳过校验）/ edit 正常可编辑 / hidden 不渲染',
  },
  {
    name: '函数形式',
    type: '(model) => Permission',
    description: '根据当前 model 动态决定权限',
  },
  {
    name: '权限码形式',
    type: "string（如 'user.edit'）",
    description: '配合 XForm 的 permissionResolver（默认接受普通字符串字面量）',
  },
  {
    name: 'permissionResolver（XFormProps）',
    type: '(perm: string) => "view" | "edit" | "hidden"',
    description: '权限码 → 三态映射函数（业务侧注入；默认 identity 返回原值）',
  },
  {
    name: '默认 identity',
    type: '—',
    description: 'permission 字符串字面量直接当作状态返回；resolver 返回非三态值降级为 edit',
  },
]

// XFormDisabled —— disabled 字段
export const disabledItems: XFormApiItem[] = [
  {
    name: 'disabled',
    type: 'ReactionValue<boolean>',
    description: '字段禁用：支持静态 boolean / 函数 / {{ }} 表达式（数组节点仅控制容器按钮）',
  },
  {
    name: 'props.disabled 优先级',
    type: 'boolean',
    description: '用户显式写在 props 里的 disabled 会覆盖本字段',
  },
  { name: '校验行为', type: '—', description: 'el-form 自动跳过 disabled 字段的校验' },
]

// XFormResponsive —— responsive 配置
export const responsiveItems: XFormApiItem[] = [
  {
    name: 'row.responsive',
    type: '{ xs?, sm?, md?, lg?, xl? }',
    description: '每个断点独立 gutter / type / align / justify',
  },
  {
    name: 'col.responsive',
    type: '{ xs?, sm?, md?, lg?, xl? }',
    description: '每个断点独立 span / offset / push / pull（传对象时 el-col 自动按 viewport 选）',
  },
  {
    name: '断点档位',
    type: 'xs / sm / md / lg / xl',
    description: '< 768 / ≥ 768 / ≥ 992 / ≥ 1200 / ≥ 1920（element-plus 标准 5 档）',
  },
]

// XFormBuilder —— builder 链式方法
export const builderItems: XFormApiItem[] = [
  {
    name: '基础 builder',
    type: 'xInput / xSelect / xSwitch / xDatePicker / xTextarea / xRadioGroup / xCard',
    description: '基础控件 builder（详见 README「链式构建器」章节）',
  },
  {
    name: '本 demo 补齐',
    type: 'xCascader / xUpload / xAutocomplete / xTimePicker / xTimeSelect / xTreeSelect / xTransfer',
    description: '7 个 builder 链式方法',
  },
  {
    name: 'xArray',
    type: '数组节点 builder',
    description:
      '链式构造数组节点：item / initialLength / minItems / maxItems / labels / title / draggable',
  },
  {
    name: 'xCard',
    type: 'Card 视觉容器 builder',
    description: '链式构造 Card 分组：title / column / children（children 由对象字面量补充）',
  },
  {
    name: '链式方法',
    type: '.label() .required() .placeholder() .defaultValue() .options() .build()',
    description: '常见链式配置方法，build() 产出 SchemaNode',
  },
]

// XFormSchemaIndex —— useSchemaIndex 返回
export const schemaIndexItems: XFormApiItem[] = [
  { name: 'byName', type: 'Map<string, SchemaNode>', description: 'name → 节点映射（O(1) 查表）' },
  { name: 'fieldNames', type: 'string[]', description: '全部字段名（DFS 顺序，不含 ignore）' },
  { name: 'allNames', type: 'string[]', description: '含 ignore 字段（用于 server error 映射）' },
  {
    name: 'crossRules',
    type: 'Map<target, RuleItem[]>',
    description: '目标字段 → 跨字段规则列表（跨字段 watch 启动用）',
  },
  {
    name: 'reverseIndex',
    type: 'Map<dep, target[]>',
    description: '依赖字段 → 受影响的目标字段（反向触发）',
  },
  {
    name: 'dependsOnMap',
    type: 'Map<target, deps[]>',
    description: '目标字段 → 它依赖的字段（正向链）',
  },
]

// XFormServerError —— 相关实例方法
export const serverErrorMethods: XFormApiItem[] = [
  {
    name: 'validateFromServer',
    type: '(response) => number',
    description: '服务端响应映射：success=true 清空全部错误；errors 写入字段红字',
  },
  {
    name: 'setFieldError',
    type: '(name, message, state?) => void',
    description: '手动写入字段错误（后端 422 场景）',
  },
  {
    name: 'setFieldValidating',
    type: '(name) => void',
    description: '标记字段为校验中（loading 图标）',
  },
  { name: 'clearValidate', type: '() => void', description: '清除全部字段校验状态' },
]

// XFormBeforeChange —— beforeChange 拦截器
export const beforeChangeItems: XFormApiItem[] = [
  {
    name: 'beforeChange',
    type: '(item, newVal, oldVal) => unknown | Promise',
    description: '字段值写入 model 前拦截（XFormProps 级，按 item.name 分派）',
  },
  {
    name: '同步返回非 undefined',
    type: 'unknown',
    description: '返回值替换新值写入 model（如自动格式化）',
  },
  {
    name: 'Promise resolve',
    type: 'unknown',
    description: 'resolve 值写入 model（异步转换 / 校验后放行）',
  },
  {
    name: 'Promise reject',
    type: '—',
    description: '跳过更新，model 保持旧值（输入框回弹）',
  },
  {
    name: '返回 undefined',
    type: '—',
    description: '放行原值（默认行为）',
  },
]

// XFormEvents —— node.on 字段事件
export const onEventItems: XFormApiItem[] = [
  {
    name: 'node.on.<事件名>',
    type: 'Function | {{ fn }}',
    description: '字段级事件：键为组件事件名（change / input / blur…）',
  },
  {
    name: '函数形式',
    type: '(value, ...args) => void',
    description: '推荐：闭包可直接读写真实 model（联动清空 / 字数统计）',
  },
  {
    name: '表达式形式',
    type: '{{ (m, ...args) => ... }}',
    description: '沙箱隔离：m 为 model 只读副本；危险标识符（window / fetch…）被安全扫描拦截',
  },
]

// XFormDirectives —— DirectiveConfig 节点指令
export const directivesItems: XFormApiItem[] = [
  {
    name: 'directive',
    type: 'Directive 对象',
    required: true,
    description: '带钩子的 Vue 指令定义（mounted / updated…），直接写在 schema 中',
  },
  { name: 'value', type: 'unknown', description: '指令绑定值（binding.value）' },
  { name: 'arg', type: 'string', description: '指令参数（binding.arg）' },
  {
    name: 'modifiers',
    type: 'Record<string, boolean>',
    description: '修饰符（binding.modifiers，如 { strong: true }）',
  },
]

// XFormDirectives —— componentProps 全局默认 props
export const componentPropsItems: XFormApiItem[] = [
  {
    name: 'componentProps',
    type: 'Record<string, Record<string, unknown>>',
    description: '按组件名注入默认 props（XFormProps 级）',
  },
  {
    name: '合并规则',
    type: '—',
    description: '与内置默认（clearable 等）合并；节点级 props 优先级最高，可覆盖全局默认',
  },
  {
    name: '生效范围',
    type: '—',
    description: '仅 string component 生效；直接传 Component 对象时由组件自身控制',
  },
]

// XFormDirectives —— rules 命名引用
export const ruleRefItems: XFormApiItem[] = [
  {
    name: 'rules prop',
    type: 'Record<string, RuleItem>',
    description: '校验规则命名表（XFormProps 级），按名字复用跨表单规则',
  },
  {
    name: 'node.rules 字符串',
    type: 'string',
    description: '查命名表：命中取对应 RuleItem；未命中退化为 required',
  },
]

// XFormGrid —— 栅格配置速查
export const gridItems: XFormApiItem[] = [
  {
    name: 'column',
    type: 'number',
    description: '每行固定 N 列，所有字段等宽（span = 24 / N）——最简配置',
  },
  {
    name: 'row',
    type: 'RowConfig',
    description: '行配置：gutter 列间距 / type / align / justify；顶层或容器节点均可',
  },
  {
    name: 'col',
    type: 'boolean | ColConfig',
    description: '节点级列配置：span 自由分配列宽 / offset / push / pull；col: false 不包栅格',
  },
  {
    name: 'row + col.span 组合',
    type: '—',
    description: '顶层 row + 节点级 col.span：自由组合列宽（如 6 + 6 + 12、24 整行）',
  },
  {
    name: '布局容器节点',
    type: '无 name 节点 + row / column',
    description: '渲染为纯 ElRow + ElCol 容器，可分区组织字段（按业务块分组）',
  },
  {
    name: '⚠️ 混用限制',
    type: '—',
    description:
      '顶层 column 会把节点锁进固定 span 的 ElCol，节点级 col.span 无法突破——不等宽布局用 row + col.span',
  },
]

// XFormBase —— RuleItem 常用字段
export const ruleItems: XFormApiItem[] = [
  {
    name: 'required',
    type: 'boolean',
    description: '必填校验（rules 写字符串 "required" 等价）',
  },
  {
    name: 'pattern',
    type: 'RegExp | string',
    description: '正则校验（如订单号格式 /^ORD-\\d{6}$/）',
  },
  {
    name: 'min / max',
    type: 'number | string',
    description: '长度 / 数值范围校验',
  },
  {
    name: 'message',
    type: 'string',
    description: '校验失败提示文案',
  },
  {
    name: 'validator',
    type: '(rule, value, cb) => void',
    description: '自定义校验函数（async-validator 回调式，cb(Error?) 报告结果）',
  },
  {
    name: 'type',
    type: 'string',
    description: '内置类型校验：string / email / url / number 等',
  },
  {
    name: 'trigger',
    type: "'blur' | 'change' | 'manual'",
    description: '校验触发时机',
  },
]

// XFormMinimumDemo —— 最小示例三要素
export const minimumItems: XFormApiItem[] = [
  {
    name: 'schema',
    type: 'SchemaNode',
    required: true,
    description: '表单结构声明（component / name / label / rules）',
  },
  {
    name: 'model',
    type: 'Record<string, unknown>',
    description: 'reactive() 包装的数据对象（校验 / 默认值 / reaction 依赖）',
  },
  {
    name: 'defaultValue',
    type: 'unknown',
    description: '挂载时自动填充到 model（仅字段未定义时）',
  },
]

// XFormI18n —— i18n 接入要点
export const i18nItems: XFormApiItem[] = [
  {
    name: 'label（函数式）',
    type: "(t) => t('form.email')",
    required: true,
    description: 'label 支持 XFormLabelFn：渲染期以注入的 t 求值（identity.ts）',
  },
  {
    name: 't（XFormProps）',
    type: 'XFormTranslateFn',
    description: '翻译函数注入：vue-i18n 的 t / 字典闭包均可；未注入时函数式 label 收 identity',
  },
  {
    name: '语言切换',
    type: '换 t 引用 / vue-i18n locale',
    description: 't 在 render effect 内求值：vue-i18n 场景 locale 变化自动重渲，无需重建 schema',
  },
]

// XFormNested —— Card 分组布局
export const nestedItems: XFormApiItem[] = [
  {
    name: 'Card 容器分组',
    type: "component: 'Card'",
    description: '每个 Card 节点带 column + row + props，内部字段自动栅格化',
  },
  {
    name: 'slots.header',
    type: 'SchemaSlot',
    description: 'ElCard 标题插槽（注意是 header，不是 title / extra）',
  },
  {
    name: '嵌套 children',
    type: 'SchemaNode[]',
    description: 'FormItem 内嵌 Input + 原生标签（a / span）等混合内容',
  },
  {
    name: 'column',
    type: 'number',
    description: '每行 N 列（2 / 3 等宽分配）',
  },
]

// XFormSlots —— 插槽三种形式
export const slotTypeItems: XFormApiItem[] = [
  {
    name: 'SchemaNode 形式',
    type: 'SchemaNode | SchemaNode[]',
    description: '按 schema 渲染子内容',
  },
  {
    name: '字符串形式',
    type: 'string',
    description: '纯文本内容（走 schema 渲染）',
  },
  {
    name: '函数形式',
    type: '(scope?) => VNode',
    description: 'render function / JSX 产物；scoped slot 接收 scope 参数',
  },
]

// XFormModelWarn —— model prop 三种形态
export const modelWarnItems: XFormApiItem[] = [
  {
    name: 'model 未传',
    type: '—',
    description: 'dev 模式 console.warn；校验 / 默认值 / reaction / dirty 追踪全部失效',
  },
  {
    name: 'reactive({})',
    type: '—',
    description: '合法但未声明字段，提交为空',
  },
  {
    name: 'reactive({ email: "" })',
    type: '—',
    description: '对照正常用法：字段需在 model 中预声明',
  },
]

// XFormLargeSchema —— 性能观察要点
export const largeSchemaItems: XFormApiItem[] = [
  {
    name: '字段规模',
    type: '100+ 字段',
    description: '模拟生产中后台长表单',
  },
  {
    name: 'mount 耗时',
    type: '控制台输出',
    description: '首次渲染挂载时间（DevTools Performance 可复核）',
  },
  {
    name: '输入响应',
    type: '控制台输出',
    description: '字段输入到 UI 更新的耗时',
  },
  {
    name: 'reaction 开销',
    type: '控制台输出',
    description: '反应式联动触发重渲染耗时',
  },
]

// XFormInvalidComponent —— 组件名解析规则
export const invalidComponentItems: XFormApiItem[] = [
  {
    name: 'EL 短名',
    type: "'Input'",
    description: '合法（DEFAULT_COMPONENT_MAP 命中）',
  },
  {
    name: 'EL 全名',
    type: "'ElInput'",
    description: '合法（自动识别 ElXxx 写法）',
  },
  {
    name: '原生 HTML 标签',
    type: "'a' / 'span'（全小写）",
    description: '合法（直接原生渲染）',
  },
  {
    name: '拼写错误',
    type: "'Inpurt'",
    description: 'dev 控制台 warn + Debug Banner 红条',
  },
  {
    name: '未注册自定义组件',
    type: "'MyInput'",
    description: '需在 components prop 注册后才合法',
  },
]

// XFormCrossFieldReverse —— 反向触发机制
export const reverseCrossItems: XFormApiItem[] = [
  {
    name: 'dependsOn',
    type: 'string | string[]',
    description: '声明依赖字段（lodash 路径）',
  },
  {
    name: '反向触发',
    type: '—',
    description: '依赖字段变化时自动重算所有 dependsOn 包含它的规则（无需手动 watch）',
  },
  {
    name: '触发时机',
    type: 'blur / change',
    description: '与正向 trigger 一致；空值跳过（交给 required 处理）',
  },
]

// XFormAsyncValidator —— 异步校验
export const asyncValidatorItems: XFormApiItem[] = [
  {
    name: '异步 validator',
    type: '(rule, value, cb) => void',
    description: 'async-validator 回调式：远程接口返回后调用 cb(Error?)',
  },
  {
    name: '异步 crossValidator',
    type: '(...) => Promise<true | string>',
    description: '跨字段异步校验，validate() 会 await',
  },
  {
    name: 'loading 图标',
    type: '—',
    description: '异步校验期间 form-item 显示 loading（setFieldValidating）',
  },
]

// XFormScrollToError —— 校验失败自动滚动
export const scrollToErrorItems: XFormApiItem[] = [
  {
    name: 'scrollToError',
    type: 'boolean',
    default: 'false',
    description:
      '校验失败自动滚动到第一个错误字段（透传 ElForm）：字段规则失败滚到第一个 .el-form-item.is-error，跨字段失败滚到第一个 cross 错误字段',
  },
  {
    name: 'scrollIntoViewOptions',
    type: 'ScrollIntoViewOptions | boolean',
    default: 'true',
    description: '滚动行为透传（如 { behavior: "smooth", block: "center" }）',
  },
  {
    name: 'scrollToField(name)',
    type: '实例方法',
    description: '手动滚动到指定字段（透传 ElForm.scrollToField，依赖 formItem 的 prop 注册）',
  },
]

// XFormDirty —— 相关实例方法
export const dirtyMethods: XFormApiItem[] = [
  { name: 'isDirty', type: '() => boolean', description: '是否有未保存修改（相对基线）' },
  { name: 'getDirtyFields', type: '() => string[]', description: '全部 dirty 字段路径列表' },
  { name: 'isTouched', type: '(name) => boolean', description: '指定字段是否被修改过' },
  {
    name: 'resetDirty',
    type: '() => void',
    description: '把当前状态标记为新基线（提交后归零 / 加载后初始化）',
  },
]

export const validateFieldItems: XFormApiItem[] = [
  {
    name: 'validateField(name)',
    type: '(name: string | string[]) => Promise<boolean>',
    description:
      '逐字段校验（透传 ElForm.validateField）：成功 true；校验失败 / el-form 未绑定 false（失败时错误已由 el-form-item 展示，未绑定 console.error 不静默通过）',
  },
  {
    name: 'resetFields(names?)',
    type: '(names?: string | string[]) => void',
    description:
      '重置字段：不传 names 全量重置（清空所有值与 externalErrors）；传 names 部分重置——只清指定字段的值与对应服务端错误，其他字段及红字保留',
  },
  {
    name: 'setFieldError(name, message, state?)',
    type: '实例方法',
    description: '手动写入字段错误（服务端 422 场景）——本 demo 用它模拟双字段红字',
  },
]

// XFormExpression —— {{ fn }} 动态脚本五类挂载位
export const expressionItems: XFormApiItem[] = [
  {
    name: '顶层 readonly / disabled',
    type: 'string',
    description:
      "'{{ (m) => m.locked }}' 整表只读/禁用：computed 追踪 model，表达式随依赖自动重算（hidden > readonly > edit 优先级不变）",
  },
  {
    name: 'node.reaction.*',
    type: 'ReactionValue<T>',
    description:
      'hidden / disabled / label / props / rules 均可接 {{ fn }}，求值结果写入节点对应字段（apply-reaction-fields）',
  },
  {
    name: 'node.on.<事件名>',
    type: '{{ (m, ...args) => void }}',
    description:
      '沙箱事件处理器：首参永远是 model 只读副本，第二个起才是组件事件参数——写成 (m, v) 两参占位缺一不可',
  },
  {
    name: 'node.permission',
    type: "{{ (m) => 'view' | 'edit' | 'hidden' }}",
    description: '权限三态动态求值：admin 编辑 / viewer 只读纯文本（view 态跳过校验）',
  },
  {
    name: 'expressionFunctions 注册名',
    type: 'Record<string, Function>',
    description:
      '白名单函数被表达式按名字直接引用（本页 pushLog / toCurrency）；模块级注册多实例共享，函数表变更全量重编译',
  },
]

// XFormExpression —— 沙箱上下文与安全边界
export const expressionSandboxItems: XFormApiItem[] = [
  {
    name: 'model 入参',
    type: 'toSafeDto 只读副本',
    description:
      '深净化副本：剔除函数/原型链、过滤 __proto__ 等危险键、循环引用保护；在表达式里写 m.xxx 不回写真实表单',
  },
  {
    name: '无参形态 {{ () => ... }}',
    type: '—',
    description:
      '箭头函数语法完全合法，但收不到任何参数——适合不依赖 model 的固定输出；需要读值必须显式声明形参',
  },
  {
    name: '非法表达式',
    type: '—',
    description: '编译失败 console.error 并缓存 null，运行时静默跳过（不抛错、不阻塞渲染）',
  },
  {
    name: '编译缓存',
    type: 'Map ≤500 条',
    description: '同一字符串复用编译产物；白名单函数表变更后旧缓存整体失效（fnsVersion）',
  },
  {
    name: '选型建议',
    type: '—',
    description:
      '读 model 做联动判断/动态文案 → {{ }} 表达式；需回写真实 model 或对接埋点 SDK → 原生函数形式闭包',
  },
]

// XFormValidationDebounce —— schema.debounceValidation + RuleItem.debounceMs
export const debounceItems: XFormApiItem[] = [
  {
    name: '顶层 schema.debounceValidation',
    type: 'number',
    default: '0',
    description:
      '跨字段校验全局默认 debounce 时延（毫秒）：0 = 实时（每键触发），>0 = 停止变化 delay ms 后跑一次',
  },
  {
    name: 'rules[i].debounceMs',
    type: 'number',
    description:
      '字段级覆盖：0 = 强制实时，>0 = 自定义 delay。未设置则继承 schema.debounceValidation',
  },
  {
    name: '作用范围',
    type: '仅 crossValidator',
    description:
      '仅对跨字段校验函数生效；字段内 async-validator 规则（required/pattern/email）的触发由 trigger 控制（change/blur/manual）',
  },
  {
    name: '远程搜索',
    type: '—',
    description:
      '不属于校验范畴；asyncOptions 自身职责（建议另开 task 在 use-async-options 加 debounce 字段）',
  },
  {
    name: 'async crossValidator',
    type: 'Promise<true | string>',
    description:
      '异步跨字段校验（如远程查重）继承本次 debounce：依赖字段停止变化 delay ms 后才发起远程请求',
  },
  {
    name: '与 trigger 关系',
    type: '—',
    description:
      'trigger: manual 完全跳过反向触发；trigger: change + debounceValidation > 0 时按 delay 调度；trigger: blur 不影响（走 el-form 原生）',
  },
]

// XFormGlobalDisabled —— 顶层 schema.disabled 字段速查
export const globalDisabledItems: XFormApiItem[] = [
  {
    name: '顶层 schema.disabled',
    type: 'ReactionValue<boolean>',
    description:
      '写在顶层 schema 上 = 整体禁用整个表单（透传 el-form disabled，与 labelPosition 同模式）',
  },
  {
    name: '字面量 / 函数 / {{ fn }} 表达式',
    type: 'boolean | (m) => boolean | FunctionExpression',
    description: '三种写法等价；不支持 reaction 对象写法（顶层字段不是 ReactionConfig）',
  },
  {
    name: '字段级 props.disabled',
    type: 'boolean',
    description: '节点 props.disabled 优先级高于顶层 schema.disabled；可单独锁定某些字段',
  },
  {
    name: 'permission: hidden',
    type: "ReactionValue<'view' | 'edit' | 'hidden'>",
    description: '最高优先级；hidden 字段不渲染 DOM，不受顶层 disabled 影响',
  },
  {
    name: '校验行为',
    type: '—',
    description: 'el-form 自动跳过 disabled 字段的校验（async-validator 行为）',
  },
]

// XFormGlobalReadonly —— 顶层 schema.readonly 字段速查
export const globalReadonlyItems: XFormApiItem[] = [
  {
    name: '顶层 schema.readonly',
    type: 'ReactionValue<boolean>',
    description:
      '写在顶层 schema 上 = 所有字段按 view 态纯文本展示（复用 permission: view 渲染链路，不包 form-item、不走校验）',
  },
  {
    name: '字面量 / 函数 / {{ fn }} 表达式',
    type: 'boolean | (m) => boolean | FunctionExpression',
    description: '三种写法等价；与 XFormExpression Section ① 演示的 readonly 表达式形态一致',
  },
  {
    name: '与全局 disabled 区别',
    type: '—',
    description:
      'disabled 字段仍渲染控件但不可编辑；readonly 字段渲染为纯文本（view 态），跳过校验',
  },
  {
    name: '字段级 permission',
    type: "ReactionValue<'view' | 'edit' | 'hidden'>",
    description:
      'permission: edit 始终可编辑（覆盖顶层 readonly）；permission: view 始终纯文本；permission: hidden 不渲染',
  },
  {
    name: '优先级',
    type: 'hidden > readonly(view) > edit',
    description: '隐藏 > 只读 > 可编辑；字段级 permission: edit 可强制覆盖顶层 readonly',
  },
]

// XFormReactionDeps —— reaction.deps 三动机
export const reactionDepsItems: XFormApiItem[] = [
  {
    name: 'reaction.deps',
    type: 'string[]',
    description:
      'lodash 路径数组，精确监听依赖字段；声明后 watch 从 deep watch 整棵 model 降级为浅比较指定路径',
  },
  {
    name: 'A 模式：无 deps',
    type: '—',
    description:
      '默认行为，deep watch 整棵 model；任意字段变化都会触发 reaction；大表单下成本与精度双输；reaction 内写 model 任何字段会自触发',
  },
  {
    name: 'B 模式：写 deps',
    type: 'string[]',
    description:
      '精确路径浅比较；仅 deps 命中路径变化触发 reaction；函数内写 model 安全（除非写入了 deps 路径内字段）',
  },
  {
    name: 'deps 与反应式副作用',
    type: '_effect 字段',
    description:
      'use-reaction 第 14-34 行 applyReactionFields 是直接赋值 node[field]；用 _effect 字段承载副作用（返回 undefined）让 isEqual 跳过写入',
  },
  {
    name: '预算兜底',
    type: 'MAX_CHAIN_PER_FLUSH = 50',
    description:
      '无 deps 时 reaction 写自身依赖构成环 → use-reaction 单 flush 内最多执行 50 次 → console.error 后跳过，把「卡死」降级为「可诊断错误」',
  },
  {
    name: '选型决策',
    type: '—',
    description:
      '计算字段 + 写 model 副作用 → 必写 deps；只读 model 做条件判断 → 写 deps 更稳；极简 demo 函数体内引用追踪够用 → 不写',
  },
]

// XFormReactionAdvanced —— reaction 进阶字段速查
export const reactionAdvancedItems: XFormApiItem[] = [
  {
    name: 'reaction.deps',
    type: 'string[]',
    description:
      'lodash 路径数组，精确监听依赖字段；声明后 watch 从 deep watch 整棵 model 降级为浅比较指定路径，性能与精度双提升',
  },
  {
    name: '反应式 props / label / placeholder',
    type: 'ReactionValue<...>',
    description:
      '任意 node 字段都可反应式覆盖；注意 use-reaction 是直接赋值非合并，reaction.props 返回完整 props 对象（不要只返回差异字段）',
  },
  {
    name: '反应式 rules',
    type: 'ReactionValue<RuleItem[]>',
    description:
      '与 reaction 联动校验：值变化 → 自动重算规则（必填/正则/长度等）；也可单独用 {{ fn }} 表达式直接写在 node.rules 字段',
  },
  {
    name: 'reaction._effect 副作用模式',
    type: '() => undefined',
    description:
      '约定：使用 reaction 内 _effect 字段承载副作用函数，返回 undefined 让 isEqual 跳过写入节点字段；与 deps 配合避免自触发循环',
  },
  {
    name: '数组行内嵌 reaction',
    type: 'kind: array + itemSchema.reaction',
    description:
      'use-reaction 递归注册 itemSchema 子树；行内 deps 用相对路径（不写 array.rows.0.qty），lodash get 在行 model 子树生效',
  },
  {
    name: '与 on.change 协同',
    type: 'on.change 闭包',
    description:
      '显式副作用入口：上级字段 on.change 闭包写 model 清空下级字段，比 reaction 监听更可预测（每次必触发，不依赖 deps 配置）',
  },
]
// XFormUpload —— Upload 字段配置速查
export const uploadItems: XFormApiItem[] = [
  {
    name: 'component',
    type: "'Upload'",
    required: true,
    description: '声明为 ElUpload 组件',
  },
  {
    name: 'modelProp',
    type: "'fileList'",
    description: '绑定 ElUpload 的 file-list（默认 modelValue 不适用，必须显式指定）',
  },
  {
    name: 'props.action',
    type: 'string',
    description: '上传地址；demo 中配合 httpRequest 使用可无需真实后端',
  },
  {
    name: 'props.accept',
    type: 'string',
    description: '接受的文件类型，如 image/* 或 .pdf,.doc',
  },
  {
    name: 'props.multiple',
    type: 'boolean',
    default: 'false',
    description: '是否允许多选文件',
  },
  {
    name: 'props.limit',
    type: 'number',
    description: '最大允许上传文件数',
  },
  {
    name: 'props.drag',
    type: 'boolean',
    default: 'false',
    description: '是否启用拖拽上传',
  },
  {
    name: 'props.listType',
    type: "'text' | 'picture' | 'picture-card'",
    default: "'text'",
    description: '文件列表展示类型',
  },
  {
    name: 'props.autoUpload',
    type: 'boolean',
    default: 'true',
    description: 'false 时选择文件后不会自动上传，可随表单提交统一处理',
  },
  {
    name: 'props.beforeUpload',
    type: '(rawFile: UploadRawFile) => boolean | Promise<boolean>',
    description: '上传前钩子，可拦截大小/格式不符的文件',
  },
  {
    name: 'props.httpRequest',
    type: '(options: UploadRequestOptions) => Promise<void>',
    description: '自定义上传行为，适合对接项目统一封装的请求方法',
  },
  {
    name: 'props.fileList / v-model:fileList',
    type: 'UploadUserFile[]',
    description: '已上传文件列表，用于回显；配合 modelProp: "fileList" 实现双向绑定',
  },
  {
    name: 'slots.tip',
    type: 'string | SchemaNode | (scope) => VNode',
    description: 'ElUpload 的提示文案插槽',
  },
]

export const detailFillItems: XFormApiItem[] = [
  {
    name: 'Object.assign(model, detail)',
    type: '—',
    description:
      '整体一次写入：字段同帧落位，不经过组件 change 事件——node.on 的「联动清空」不会误伤回填数据',
  },
  {
    name: 'resetDirty()',
    type: '() => void',
    description:
      '首载挂载时拍空基线；原地切换订单 / 保存成功后必须手动重拍，否则 isDirty 把服务端差异误报为用户修改',
  },
  {
    name: 'clearValidate()',
    type: '() => void',
    description:
      'assign 后清除上次交互残留的红字（el-form-item 错误状态不随 model 值覆盖自动消失）',
  },
  {
    name: 'asyncOptions.deps 回填时序',
    type: 'string | string[]',
    description:
      '级联场景 city/district 同步写入后，区域 options 才随 deps watch 异步就绪——期间 Select 短暂显示裸 id，就绪后自动变名称',
  },
  {
    name: 'reaction.hidden + 必填回填',
    type: 'ReactionValue<boolean>',
    description:
      '隐藏字段的值静默保留在 model 中；hidden 必填不阻塞提交校验，重新显示后必填恢复生效',
  },
  {
    name: '数组字段批量回填',
    type: 'model.items = Row[]',
    description:
      'detail.items N 条直接写入 model，ArrayNode 渲染 N 行；array.initialLength 仅在字段未定义时生效',
  },
]

// XFormBeforeChange —— 3 层 beforeChange 拦截器
export const beforeChangePropsItems: XFormApiItem[] = [
  {
    name: 'beforeChange (XFormProps 第 1 层)',
    type: 'BeforeChangeFn: (item, newVal, oldVal, allValues?, ctx?) => unknown | Promise',
    description: '全局 Props beforeChange 钩子——横切关注点（埋点 / 全局拦截）',
  },
  {
    name: 'beforeChangeRules (XFormProps 第 2 层)',
    type: 'BeforeChangeRule[]',
    description: '动态命名空间规则数组；按 pattern 匹配字段路径后 handler 串行执行',
  },
  {
    name: 'SchemaNode.beforeChange (第 3 层)',
    type: 'BeforeChangeFn',
    description:
      '字段级 beforeChange——业务内聚性最高；数组元素字段直接写在 array.children[i].field 上',
  },
  {
    name: 'BeforeChangeCtx',
    type: '{ name, setFieldValue, setFieldError, abort }',
    description:
      '钩子上下文——允许字段级 beforeChange 联动修改其他字段（setFieldValue）、显示红字（setFieldError）、取消写入（abort）',
  },
  {
    name: 'item.name',
    type: 'string',
    description: '当前字段名，第 1 层按此分派到具体字段逻辑',
  },
  {
    name: '同步返回非 undefined',
    type: 'unknown',
    description: '返回值替换新值写入 model（自动格式化、单位换算）',
  },
  {
    name: '同步返回 oldVal',
    type: 'unknown',
    description: '保持旧值，model 不变（输入框回弹——典型拒绝场景）',
  },
  {
    name: 'Promise resolve',
    type: 'unknown',
    description: '异步校验后放行（如远程风控接口返回通过）',
  },
  {
    name: 'Promise reject',
    type: '—',
    description: '跳过更新，model 保持旧值；ctx.setFieldValue 已产生的副作用保留',
  },
  {
    name: '返回 undefined',
    type: '—',
    description: '放行原值（默认行为）',
  },
]

// XFormZod —— zodSchema + validateWithZod()
export const zodItems: XFormApiItem[] = [
  {
    name: 'zodSchema (XFormProps)',
    type: 'ZodType',
    description: '集中声明业务校验规则（z.object / z.string / z.number ...）',
  },
  {
    name: 'validateWithZod()',
    type: '() => Promise<{ success, errors: [{ path, message }] }>',
    description: '异步 zod 校验：success=true 通过；errors 含字段路径与错误信息',
  },
  {
    name: '与 el-form 校验关系',
    type: '—',
    description:
      '两者互补：el-form 字段规则（必填/正则）走 rules；zod 覆盖复杂业务（年龄区间 / 密码强度 / 跨字段）',
  },
  {
    name: '失败展示',
    type: '—',
    description: 'validateWithZod 不自动写 form 红字——返回值供业务侧自行 toast / 红字 / 高亮',
  },
]

// XFormCustomComponent —— components prop
export const customComponentItems: XFormApiItem[] = [
  {
    name: 'components (XFormProps)',
    type: 'Record<string, Component>',
    description:
      '注册业务自定义组件：key=schema.component 字符串，value=Vue 组件（h() 或 SFC 均可）',
  },
  {
    name: '查找优先级',
    type: '—',
    description:
      'components prop → element-plus 内置（ElInput / Input） → 原生 HTML 标签（div / span）',
  },
  {
    name: 'v-model 兼容',
    type: '—',
    description:
      '自定义组件按 props.modelValue + emit("update:modelValue") 实现可被 XForm 自动双向绑定',
  },
  {
    name: '类型推导',
    type: 'Module Augmentation',
    description:
      '扩展 ComponentPropsRegistry 后 SchemaNodeFor<"MyTagSelector"> 自动推导 props 类型',
  },
]

// XFormIgnore —— ignore 字段
export const ignoreItems: XFormApiItem[] = [
  {
    name: 'ignore',
    type: 'boolean',
    default: 'false',
    description: '节点跳过渲染（不创建 DOM、不参与校验、不参与 getNames）',
  },
  {
    name: 'model 中的值',
    type: '—',
    description: '已写入 model 的字段值静默保留——配合 defaultValue 可作"传给后端的隐藏字段"',
  },
  {
    name: '与 hidden 区别',
    type: '—',
    description: 'hidden: 渲染但 display:none，参与校验；ignore: 完全不渲染，跳过校验',
  },
  {
    name: '服务端错误映射',
    type: '—',
    description: 'validateFromServer 写入 ignore 字段 → 静默丢弃（不显示红字、不阻塞提交）',
  },
]

// XFormCustomFormItem —— formItem 字段
export const customFormItemItems: XFormApiItem[] = [
  {
    name: 'formItem: false',
    type: 'boolean',
    description: '不包 form-item 包装，直接渲染裸组件（适合作为展示型 UI 块）',
  },
  {
    name: 'formItem: { component }',
    type: 'string | Component',
    description: '用自定义组件替代默认 ElFormItem 包装（如换 FormItemPlus / FormItemPro）',
  },
  {
    name: 'formItem.props',
    type: 'Record<string, unknown>',
    description: '透传给自定义 formItem 组件的 props（如 labelWidth / required / rules ...）',
  },
  {
    name: 'formItem.slots',
    type: 'Record<string, SchemaNode>',
    description: '自定义 formItem 的具名插槽（如 label 插槽渲染 icon）',
  },
  {
    name: 'formItem.directives',
    type: 'DirectiveConfig[]',
    description: '挂在 formItem 包装节点上的指令',
  },
]

// XFormLabelLayout —— 顶层 schema 布局字段
export const labelLayoutItems: XFormApiItem[] = [
  {
    name: 'labelPosition (顶层 + 字段级)',
    type: "'left' | 'right' | 'top'",
    default: "'left'",
    description:
      'label 位置：顶层配置为表单整体；字段级配置可 override 顶层（element-plus el-form-item 原生支持）',
  },
  {
    name: 'labelWidth (顶层 + 字段级)',
    type: 'string | number',
    description:
      'label 宽度（如 "120px" 或 120）；顶层配置透传 el-form，字段级配置透传 el-form-item override 顶层',
  },
  {
    name: '字段级 override 顶层',
    type: '—',
    description:
      '字段级声明 labelPosition / labelWidth 后该字段独立渲染；未声明时 el-form-item 自动继承 el-form 顶层配置（element-plus 原生行为）',
  },
  {
    name: '与 XFormProps.labelPosition 区别',
    type: '—',
    description: 'XFormProps.labelPosition 不存在；只支持 schema 顶层 + 字段级字段',
  },
]

// XFormReactionStrategy —— reaction.strategy 三种调度策略速查
export const reactionStrategyItems: XFormApiItem[] = [
  {
    name: 'sync（默认）',
    type: "'sync'",
    default: "'sync'",
    description: '依赖变化立即同步执行 reaction 函数（一般联动）',
  },
  {
    name: 'debounce',
    type: "'debounce'",
    description: '依赖停止变化 delay ms 后执行一次（远程搜索等高频输入）',
  },
  {
    name: 'throttle',
    type: "'throttle'",
    description: 'delay ms 内最多执行一次（实时保存等）',
  },
  {
    name: 'delay',
    type: 'number',
    description: 'debounce / throttle 延迟 ms（strategy ≠ sync 且 > 0 时生效）',
  },
  {
    name: 'strategy 生效条件',
    type: 'reactionConfig 含动态值',
    description:
      'use-reaction 第 106-108 行 hasDynamic 判定：reactionConfig 必须含函数 / {{ }} 表达式才会启用 watch 路径，strategy 才生效；全部字面量时 strategy 被忽略（仅一次性求值）',
  },
]

// XFormArrayApi —— addItem / removeItem / moveItem 实例方法
export const arrayApiItems: XFormApiItem[] = [
  {
    name: 'addItem(name, initial?)',
    type: '(name: string, initial?: object) => Promise<void>',
    description: '在数组节点末尾追加一行（initial 缺省时用 schema 默认空值）',
  },
  {
    name: 'removeItem(name, index)',
    type: '(name: string, index: number) => Promise<void>',
    description: '删除指定行；触发校验 + reaction 重算',
  },
  {
    name: 'moveItem(name, from, to)',
    type: '(name: string, from: number, to: number) => Promise<void>',
    description: '行位置调整；与 array.draggable 拖拽结果一致（drop handler 内部调用）',
  },
  {
    name: '与 UI 按钮关系',
    type: '—',
    description:
      'UI 操作按钮（上移/下移/删除/新增）内部即调上述方法——外部按钮可直接调用实现相同行为',
  },
  {
    name: 'min/max 边界',
    type: '—',
    description:
      'addItem 不受 maxItems 限制（业务侧自行控制）；removeItem 受 minItems 限制（已达下限时拒绝）',
  },
]

// XFormValidateDetail —— validate() vs validateDetail() 对比 API
export const validateDetailItems: XFormApiItem[] = [
  {
    name: 'validate()',
    type: '() => Promise<boolean>',
    description: '校验表单整体是否通过（true = 全部通过；false = 有错），适合快速布尔判断',
  },
  {
    name: 'validateDetail()',
    type: '() => Promise<ValidateResult>',
    description: '校验并返回完整错误结构（含 keyPath + message），适合需要展示错误详情的场景',
  },
  {
    name: 'ValidateResult.isValid',
    type: 'boolean',
    description:
      '是否全部通过（等价于 validate() 返回值，便于在不破坏既有 validate() 调用点的前提下获取详细结构）',
  },
  {
    name: 'ValidateResult.errors',
    type: 'Array<{ keyPath: (string | number)[]; message: string }>',
    description:
      '错误详情数组：keyPath 是字段路径（字符串=字段名，数字=数组下标，支持嵌套），message 是错误信息',
  },
]

// XFormPropsAdvanced —— 4 个未覆盖的 XFormProps 高级字段
export const propsAdvancedItems: XFormApiItem[] = [
  {
    name: 'permissionResolver',
    type: '(perm: string) => "view" | "edit" | "hidden"',
    description: '权限码 → 三态映射（业务侧注入 useAuth().hasPerm 模拟）',
  },
  {
    name: 'componentProps',
    type: 'Record<string, Record<string, unknown>>',
    description: '按组件名注入默认 props（节点级可覆盖）',
  },
  {
    name: 'reactionBudget',
    type: 'number',
    default: '50',
    description: '单 flush 内 reaction 最大执行次数（循环联动兜底）',
  },
  {
    name: 'expressionFunctions',
    type: 'Record<string, (...args) => unknown>',
    description: '白名单函数表（沙箱表达式按名直接引用）',
  },
]

// XFormRenderRecovery —— SchemaField 容错降级速查
export const renderRecoveryItems: XFormApiItem[] = [
  {
    name: 'safeRender try/catch',
    type: '—',
    description:
      'SchemaField.vue 渲染 renderFn 时用 try/catch 包裹，throw 时降级到 <div class="x-form-render-error">',
  },
  {
    name: '降级占位 UI',
    type: '<div data-xform-error="<name>">',
    description: '红色虚线框 + 字段名 + 错误提示文案（不依赖 el-message 减少耦合）',
  },
  {
    name: 'dev 留痕',
    type: 'console.error',
    description:
      '仅 import.meta.env.DEV 时输出 [XForm][SchemaField] render failed for node "<name>" + 原始 Error 对象',
  },
  {
    name: 'prod 静默',
    type: '—',
    description: '生产环境不输出 console，仅显示占位 UI（节省性能开销 + 避免敏感信息泄露）',
  },
  {
    name: '影响范围',
    type: '单字段',
    description: '失败仅影响当前字段，同 schema 其他字段正常渲染，整张 XForm 不会崩溃',
  },
]

// XFormAsyncAutocomplete —— Autocomplete asyncOptions 差异点
export const autocompleteAsyncItems: XFormApiItem[] = [
  {
    name: '注入协议',
    type: 'fetchSuggestions',
    description:
      'Autocomplete 无 options prop：asyncOptions 经 ElAutocomplete 原生 fetchSuggestions 协议注入（resolveAsyncOptionsProp 对 Autocomplete 返回 null）',
  },
  {
    name: 'source(query)',
    type: '(query: string) => Promise<T[]>',
    description: '每键入一字符触发一次，query 为当前输入关键词；Select 形态 source() 无参',
  },
  {
    name: 'B2 竞态令牌',
    type: '—',
    description:
      'fetcher 内序号令牌：旧响应后到时被丢弃（落地前校验），快速连打时下拉不闪回旧结果；过期 reject 静默',
  },
  {
    name: 'transform',
    type: '(raw: T[]) => { value: unknown }[]',
    description:
      'Autocomplete suggestion 必须有 value 字段；transform 在令牌校验后执行——只处理未过期响应',
  },
  {
    name: 'onError',
    type: '(err) => void',
    description: '过期响应的错误不触发 onError（静默）；最新响应的错误正常回调',
  },
]

// XFormArrayCrossField —— 行内 cross 语义（A1 修复点）
export const arrayCrossItems: XFormApiItem[] = [
  {
    name: 'dependsOn（行内相对）',
    type: 'string | string[]',
    description:
      "写在 array.itemSchema 的规则里时按行解析：'price' 取 rows[i].price（行内相对优先）；行内无此字段时回退顶层 model.price（绝对路径）",
  },
  {
    name: 'crossValidator 形参',
    type: '(value, ...deps) => true | string',
    description:
      'deps 顺序与 dependsOn 数组一致——本 demo (value, price, discount)；返回 string 作为行内红字文案',
  },
  {
    name: '反向触发',
    type: '—',
    description:
      '改行内 price/discount → 同 row 的 finalPrice 自动重算（依赖字段变化触发目标字段校验，无需失焦）',
  },
  {
    name: '批量路径',
    type: 'validate() 触发',
    description:
      '点保存时全部行的 cross 规则一次性校验；相对路径未加行前缀时取到顶层 undefined 会误报（A1 修复前缺陷）',
  },
]

// XFormErrorToastSlot —— toastContainer slot 替换速查
export const errorToastSlotItems: XFormApiItem[] = [
  {
    name: '<slot name="toastContainer">',
    type: 'Vue named slot',
    description: 'XForm 模板新增插槽，业务可完整接管错误 toast 容器',
  },
  {
    name: 'slot props',
    type: '{ events: FormErrorEvent[] }',
    description:
      '注入 errorBus 当前事件列表（响应式原始数组，含 dismissed 标记，消费方自行过滤/去重）',
  },
  {
    name: '默认 fallback',
    type: '<XFormErrorToast>',
    description: '未传 slot 时仍走默认 XFormErrorToast 容器（向后兼容）',
  },
  {
    name: '常见替换实现',
    type: '—',
    description:
      'element-plus ElNotification / ElMessage / Sonner / 自建 ToastList / 业务埋点上报点',
  },
  {
    name: 'dismiss 边界',
    type: 'errorBus.dismiss(id) 不可达',
    description:
      'slot 契约仅注入 events，消费方拿不到 errorBus 实例 —— 单向接管即可（errorBus 内部 MAX_EVENTS 截断，无泄漏）；dismiss 回写仅默认容器内部接线',
  },
]
