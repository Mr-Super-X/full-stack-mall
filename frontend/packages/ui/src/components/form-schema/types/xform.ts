/**
 * XForm 组件对外契约 —— Props / Expose / Validate 入出参
 *
 * @group 类型系统
 */
import type { ComponentPublicInstance, Directive } from 'vue'
import type { ZodError, ZodType } from 'zod'

import type { RuleItem } from './rule'
import type { SchemaNode } from './schema-node'
import type { XFormTranslateFn } from './identity'

/**
 * beforeChange 钩子上下文 —— 允许在字段级钩子里联动修改其他字段 / 取消写入
 *
 * 由 build-vmodel-bindings 在每字段 v-model 事件触发时构造（每字段独立 ctx 实例）
 * - setFieldValue('district', null): 选城市时清空区字段（联动副作用）
 * - setFieldError('phone', '格式错误'): 显示红字不阻断写入
 * - abort(): 取消本次本字段写入，等价于返回 undefined
 */
export interface BeforeChangeCtx {
  readonly name: string
  setFieldValue(name: string, value: unknown): void
  setFieldError(name: string, message: string): void
  readonly abort: () => void
}

/** beforeChange 函数签名 —— 全局 Props / 字段级 / 命名空间 handler 三处共用 */
export type BeforeChangeFn = (
  item: SchemaNode,
  newValue: unknown,
  oldValue: unknown,
  allValues?: Record<string, unknown>,
  ctx?: BeforeChangeCtx
) => unknown | Promise<unknown>

/** beforeChange 函数签名 —— ctx 必填版本（业务常用，TS 类型推断更友好） */
export type BeforeChangeFnWithCtx = (
  item: SchemaNode,
  newValue: unknown,
  oldValue: unknown,
  allValues: Record<string, unknown>,
  ctx: BeforeChangeCtx
) => unknown | Promise<unknown>

/**
 * 动态命名空间拦截规则 —— 字段是动态生成（如数组列表）时按 pattern 匹配
 * - RegExp: 精确正则匹配（推荐 ^...$ 锚定）
 * - string: 字面量精确匹配（'*' 单层通配 / '**' 多层通配）
 * 多个规则匹配同一字段时按数组顺序全部串行执行
 */
export interface BeforeChangeRule {
  pattern: RegExp | string
  handler: BeforeChangeFn
}

/** XForm 组件 props */
export interface XFormProps {
  schema: SchemaNode | SchemaNode[]
  model?: Record<string, unknown>
  components?: Record<string, unknown>
  rules?: Record<string, RuleItem>
  directives?: Record<string, Directive>
  /**
   * i18n 翻译函数注入（架构审查 PM 发现 3，2026-09-18 落地）
   *
   * - 用于求值 SchemaNode.label 的函数式（XFormLabelFn）：label: (t) => t('form.email')
   * - XForm 不绑定具体 i18n 库（分层铁律：components/ 不得 import locales/）——
   *   调用方在 modules 层注入 vue-i18n 的 t 或自研字典查表函数
   * - 求值发生在 render effect 内：vue-i18n 的 t 借此建立 locale 依赖，
   *   语言切换自动重渲（无需重建 schema）
   * - 缺省 identity ((key) => key)：函数式 label 收到 key 原样返回（业务可完全闭包自译）
   *
   * @see ./identity.ts XFormLabelFn / XFormTranslateFn
   */
  t?: XFormTranslateFn
  /**
   * 全局 Props beforeChange（第 1 层：横切关注点）
   * - 返回新值 → 透传给下一层
   * - 返回 undefined → 放行原值给下一层
   * - Promise.resolve → 异步更新，等待结果后透传
   * - Promise.reject / 抛异常 → catch + warn + 中断后续写入
   *
   * 字段级拦截请用 SchemaNode.beforeChange；动态数组场景请用 beforeChangeRules
   */
  beforeChange?: BeforeChangeFn
  /**
   * 动态命名空间拦截（第 2 层：按 pattern 匹配字段路径）
   * 数组节点（items[i].phone）字段级配置繁琐，用规则数组简处理
   * 多个规则匹配同一字段时按数组顺序全部串行执行
   */
  beforeChangeRules?: BeforeChangeRule[]
  zodSchema?: ZodType
  /**
   * 白名单函数表：注册后 {{ }} 表达式可直接引用注册名
   * 如 { formatDate: (v) => dayjs(v).format('YYYY-MM-DD') } → {{ (m) => formatDate(m.date) }}
   * 注意：模块级注册（多实例共享），与黑名单扫描互补，非真正沙箱
   */
  expressionFunctions?: Record<string, (...args: never[]) => unknown>
  /**
   * 校验失败自动滚动到第一个错误字段（透传 element-plus ElForm.scrollToError）
   * - 字段规则失败：ElForm 原生滚动到第一个 .el-form-item.is-error
   * - 跨字段 crossValidator 失败：XForm 内部滚动到第一个错误字段（keyPath 末段）
   * - 默认 false（与 element-plus 原生默认一致，不静默改变既有 validate() 行为）
   */
  scrollToError?: boolean
  /**
   * 滚动行为选项（透传 element-plus ElForm.scrollIntoViewOptions，默认 true）
   * 如 { behavior: 'smooth', block: 'center' }
   */
  scrollIntoViewOptions?: ScrollIntoViewOptions | boolean
  /**
   * 按组件名注入默认 props，节点级 props 可覆盖。
   * 例如: { Input: { clearable: true }, Select: { clearable: true, filterable: true } }
   * 仅对 string component 生效;直接传 Component 对象时由组件自身控制。
   *
   * 注:XForm 内部已维护一份默认 DEFAULT_COMPONENT_PROPS（对支持 clearable 的 EL 组件默认开启 clearable）。
   * 该字段会与内置默认合并，用户传入的同名组件配置会按组件名覆盖内置默认值。
   */
  componentProps?: Record<string, Record<string, unknown>>
  /**
   * 权限码 → 字段状态 映射函数（阶段 2.3）
   *
   * 当节点 `permission` 字段是字符串字面量（如 `'user.edit'` / `'order.view'`）时，
   * XForm 调用此函数把权限码映射为 'view' / 'edit' / 'hidden' 三态之一。
   * 业务可注入 `useAuth().hasPerm` 的封装实现：
   *
   * ```ts
   * <XForm
   *   :permission-resolver="(perm) => hasPerm(perm) ? 'edit' : 'hidden'"
   *   :schema="schema"
   * />
   * ```
   *
   * 默认 identity —— 字符串字面量直接当作状态返回（`'view'` / `'edit'` / `'hidden'` 三选一）。
   * resolver 返回值若不在三态之一，降级为 `'edit'`（最安全的可见可编辑态）。
   * @see ./composables/use-field-permission.ts resolvePermission
   * @see SchemaNode.permission
   */
  permissionResolver?: (perm: string) => 'view' | 'edit' | 'hidden'
  /**
   * 开启错误浮窗 OSD（XFormErrorToast，右上角 toast 展示 errorBus 事件）
   *
   * - 默认 false（全环境含 dev 均不渲染浮窗）——错误主反馈始终是字段红字 + console 留痕，
   *   toast 是补充提醒，默认开启会对连续输入校验失败的场景造成弹窗噪音
   * - 传 true 开启：跨字段校验失败 / 表达式解析失败 / 服务端 422 回填等
   *   errorBus 事件以浮窗形式可见
   * - 与 DebugBanner 相互独立（showDebugBanner 只控制 schema 校验 + 安全扫描横幅）
   */
  showErrorToast?: boolean
  /**
   * 单批次 reaction 执行预算（阶段 P2-3 可配置化入口）
   *
   * 用途:reaction 函数允许写 model 副作用，deep watch 会再次触发 runner，
   * 一旦构成环（A→B→A）会无限刷入 Vue 调度队列，页面卡死且无报错。
   * 预算耗尽后本批次跳过 + console.error 告警（见 use-reaction.ts）。
   *
   * - 默认 50（与既有行为一致，向后兼容）
   * - 调大:大型 schema reaction 链较长时
   * - 调小:严格排查循环联动时
   *
   * @see ./composables/use-reaction.ts
   * @see ./composables/use-schema-renderer.ts（opts.reactionBudget 透传入口，createBudget 创建 budget 实例）
   * @see ./composables/use-xform-composer.ts（composer.ts:109 接收 props.reactionBudget 并条件展开传给 useSchemaRenderer）
   *
   * 不变量：
   * - 默认 50（与既有行为一致，向后兼容）
   * - 透传链路完整（spec 覆盖：use-reaction.spec.ts line 342 验证 budget.max 反映在 console.error 文案）
   */
  reactionBudget?: number
  /**
   * 表单密度尺寸（透传 ElForm.size），未传入时跟随全局 size（App 层默认 'default'）
   *
   * 场景（设计师审查 F9）：中后台常见"紧凑表格页内嵌紧凑筛选表单"，业务一处传入即可。
   * ElForm 通过 provide/formItemSize 注入所有后代 EP 组件（EP 的 useSize 优先取 form 注入），
   * 无需再包一层 ElConfigProvider。
   *
   * - 'large' / 'default' / 'small' 与 element-plus 语义一致
   * - schema 顶层节点不预留 size 字段（密度是表单级视觉决策，字段级不开放）
   *
   * @see ./components/XForm.vue（ElForm size 绑定处）
   */
  size?: 'large' | 'default' | 'small'
  /**
   * 字段级 dirty 视觉指示（设计师审查 F13）
   *
   * 开启后，被修改过的字段（getDirtyFields 返回的非空集合）对应的 form-item label
   * 会追加 `is-dirty` class，配合样式（`__label::after` 圆点）给用户"我改了哪里"的视觉线索。
   *
   * - 默认 false（不开启，避免侵入消费方现有视觉）
   * - 数据侧 getDirtyFields / isDirty / resetDirty 已就绪，本 prop 只接渲染层
   * - dirty 集合随 resetDirty() 调用自动清空（响应式）
   *
   * @see ./composables/use-form-dirty.ts（能力层）
   * @see ./components/XForm.vue（class 绑定处）
   */
  showDirtyMark?: boolean
}

/** XForm 组件实例方法 */
export interface XFormExpose {
  getRef(key: string): ComponentPublicInstance | HTMLElement | null
  getNames(includesIgnore?: boolean): string[]
  validate(): Promise<boolean>
  /** 详细校验：含 el-form 字段内规则错误 + 跨字段 crossValidator 错误（keyPath + message） */
  validateDetail(): Promise<ValidateResult>
  clearValidate(): void
  /** 重置字段（不传 names 全量重置；传 names 部分重置并同步清理对应服务端错误） */
  resetFields(names?: string | string[]): void
  /** 校验指定字段（透传 el-form validateField）：成功 true；失败/未绑定 false */
  validateField(name: string | string[]): Promise<boolean>
  scrollToField(name: string): void
  validateWithZod(): { success: boolean; errors: ZodError | null }
  /** 手动写入某个字段的错误信息（用于服务端 422 等场景） */
  setFieldError(
    name: string,
    message: string,
    state?: '' | 'validating' | 'success' | 'error'
  ): void
  /** 手动标记某个字段为校验中（el-form-item 显示 loading 图标） */
  setFieldValidating(name: string): void
  /** 数组节点操作：push 一项（仅 ArrayNode 用） */
  addItem(name: string, init?: Record<string, unknown>): void
  /** 数组节点操作：删除指定行（仅 ArrayNode 用） */
  removeItem(name: string, index: number): void
  /** 数组节点操作：行位置调整（仅 ArrayNode 用） */
  moveItem(name: string, from: number, to: number): void
  /** 阶段 2.2：dirty 状态 —— 任一字段与初始 snapshot 不同则为 dirty */
  isDirty(): boolean
  /** 阶段 2.2：返回所有 dirty 字段路径列表 */
  getDirtyFields(): string[]
  /** 阶段 2.2：指定字段是否被修改过 */
  isTouched(name: string): boolean
  /** 阶段 2.2：把当前状态标记为新基线（提交后归零 / 加载后初始化） */
  resetDirty(): void
  /**
   * 阶段 2.1：把后端响应映射到表单字段
   * - success=true：清空所有服务端错误（红字消失）
   * - success=false + errors：清空涉及字段的错误 + 写入新错误
   * - 仅传 errors 视为 success=false
   */
  validateFromServer(response: {
    success?: boolean
    errors?:
      Array<{ path?: string; field?: string; message?: string }> | Record<string, string | string[]>
  }): number
}

/** validate() 入参 */
export interface ValidateOptions {
  validateFirst?: boolean
  /**
   * 已知组件集 —— 用于组件名有效性校验（阶段 1.3）
   * - builtin: EL 内置组件短名集合 (Input/Select/...)
   * - user: 用户通过 XForm.components prop 注册的自定义组件名集合
   * 任一缺失：仅校验另一类（不传则跳过组件名校验，保持向后兼容）
   */
  knownComponents?: {
    builtin: Set<string>
    user?: Set<string>
  }
}

/** validate() 出参 */
export interface ValidateResult {
  isValid: boolean
  errors: Array<{ keyPath: (string | number)[]; message: string }>
}
