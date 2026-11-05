/**
 * ProDialogForm 类型定义 —— Props / Emits / Expose
 *
 * @group 通用组件：ProDialogForm
 */
import type { RuleItem, SchemaNode, XFormExpose, XFormProps } from '../../form-schema/types.ts'

/**
 * ProDialogForm Props —— 弹窗表单组合组件
 *
 * 必填字段：modelValue / title / schema / model / onSubmit
 * 可选字段：width / rules / submitButtonText / cancelButtonText / resetOnClose
 *
 * 设计权衡：
 * - rules 顶层可选：XForm 的 rules 通常内联在 schema 节点里（`node.rules`），
 *   顶层 rules 仅作为「跨字段规则」或「全局规则」的统一入口；保留透传兼容 XForm 的 props 契约。
 * - model 用 `Record<string, unknown>` 而非泛型：避免外部类型与 XForm 内部 schema 推导耦合，
 *   XForm 内部会自行校验字段访问安全性。
 * - onSubmit 强制返回 Promise：保证异步语义对齐，按钮 loading 时机才能精准控制。
 *
 * @see [`./ProDialogForm.vue`](./ProDialogForm.vue) 组件本体
 * @see [`@/components/form-schema/types`](../../../form-schema/types/xform.ts) XFormProps
 */
export interface ProDialogFormProps {
  /** v-model 显隐（必填） */
  modelValue: boolean
  /** 弹窗标题（必填） */
  title: string
  /** 弹窗宽度，默认 '500px'；透传至底层 el-dialog */
  width?: string | number
  /** 表单 schema —— XForm 必填项，决定字段结构 + 校验规则 + UI 组件 */
  schema: SchemaNode | SchemaNode[]
  /** 表单数据对象 —— 与 XForm 的 `model` 一一对应；通常由父组件用 `reactive` 创建 */
  model: Record<string, unknown>
  /** 表单校验规则 —— 透传给 XForm 的 `rules`；通常内联在 schema 节点中，可省略 */
  rules?: Record<string, RuleItem>
  /**
   * XForm 扩展 props 透传 —— 弹窗场景使用 XForm 其余能力（components / zodSchema /
   * beforeChange / directives / componentProps / expressionFunctions / permissionResolver /
   * showErrorToast / scrollToError 等）的统一入口
   *
   * 同名键优先级：ProDialogForm 显式 props（schema / model / rules）> xformProps，
   * 避免扩展属性意外覆盖表单主数据契约
   */
  xformProps?: Partial<XFormProps>
  /**
   * 异步提交函数 —— 校验通过后由组件调用。
   *
   * 行为契约：
   * - resolve → 视为提交成功，组件自动关闭弹窗 + emit('success')
   * - reject / throw → 视为提交失败，弹窗保持打开，错误向上抛出
   *
   * 入参：当前 model 引用（同一对象，组件不克隆）—— 调用方可直接修改返回或就地修改
   */
  onSubmit: (model: Record<string, unknown>) => Promise<unknown>
  /** 自定义提交按钮文案，默认 '确 定' */
  submitButtonText?: string
  /** 自定义取消按钮文案，默认 '取 消' */
  cancelButtonText?: string
  /**
   * 关闭弹窗后是否自动重置表单（动画结束后调用 resetFields），默认 true
   *
   * false 场景：弹窗用于「编辑现有记录」且希望保留初始 model，
   * 由父组件在外层管理 model 生命周期。
   */
  resetOnClose?: boolean
}

/**
 * ProDialogForm Emits
 *
 * - update:modelValue：v-model 双向绑定，组件内任何关闭途径（确认/取消/X/ESC/遮罩）都会触发
 * - success：提交成功（onSubmit resolve）且弹窗已发起关闭时触发，父组件通常用于刷新列表
 * - submit-failed：提交失败（onSubmit reject/throw）时触发，**弹窗保持打开**，由父组件决定如何提示
 *
 * 时序说明：
 * - success / submit-failed 在 await onSubmit() 之后同步触发
 * - success 在 emit('update:modelValue', false) **之后**触发，父组件可在同一个 tick 内通过
 *   watch(modelValue) 联动刷新逻辑
 * - submit-failed **不**自动关闭弹窗，让用户修复后再次提交；**不**向上抛错到全局 errorHandler
 *   （避免触发未捕获 Promise rejection → 500 重定向）
 *
 * 为什么不让组件 throw 错误？
 * Vue 模板事件处理器（@click 等）调用 async 函数时，Promise reject 会冒泡到
 * app.config.errorHandler，项目的全局错误处理会跳转到 500 错误页。
 * 改用 emit('submit-failed') 让调用方完全控制错误处理（toast / 字段红字 / 静默），更符合封装原则。
 */
export type ProDialogFormEmits = {
  'update:modelValue': [value: boolean]
  /** 提交成功且弹窗关闭后触发（父组件通常用于刷新列表） */
  success: []
  /**
   * 提交失败时触发 —— onSubmit reject 或抛出错误时调用，弹窗保持打开。
   * 入参为 onSubmit 抛出的原始 error 对象（unknown 类型）。
   * 不监听此事件 = 不做任何提示（错误仅在控制台留痕）。
   */
  submitFailed: [error: unknown]
}

/**
 * ProDialogForm 暴露给父组件的方法 —— 透传 XFormExpose 全部 19 个方法
 *
 * 使用场景：父组件通过 ref 拿到 ProDialogForm 实例后，可直接调用 XForm 的能力，
 * 例如：在外部触发额外校验 / 手动 setFieldError（服务端 422 回填） / 滚动到指定字段 / 数组增删。
 *
 * 调用约定：当内部 XForm 未挂载时调用返回 undefined（或类型默认空值），
 * 父组件须自行处理竞态（建议 watch(formRef) 等 ref 就绪后再调用）。
 */
/**
 * validateFromServer 入参形状 —— 服务端 422/400 错误回填到表单字段。
 * 与 XFormExpose.validateFromServer 入参对齐,抽到此处便于 buildXFormExposeProxy 复用。
 *
 * @see [`@/components/form-schema/types/xform`](../../../form-schema/types/xform.ts) 原始定义
 * @group 通用组件:ProDialogForm
 */
export interface ValidateServerResponse {
  success?: boolean
  errors?:
    Array<{ path?: string; field?: string; message?: string }> | Record<string, string | string[]>
}

export type ProDialogFormExpose = XFormExpose
