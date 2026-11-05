/**
 * useXFormComposer —— XForm 顶层编排（composition root）
 *
 * 负责装配 11 个 composable + 渲染根闭包（renderToComponent）。
 * 子编排已抽离：渲染根→./use-render-root、dev 校验→./use-dev-runtime、
 * defaultValue→./apply-default-values、XFormExpose→./use-xform-expose。
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 *
 * 为什么 as never 而非 as any：仅用于把 props 引用"喂"给 el-form / el-form-item 的 props union
 * （XFormExpose 内部方法签名），运行时已通过单元测试验证，TS 层用 as never 标记受控逃逸点。
 *
 * @group 表单编排：编排入口
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { useSchemaRenderer } from './use-schema-renderer'
import { useSchemaIndex, flattenCrossRules } from './use-schema-index'
import { useFormErrorBus } from './use-form-error-bus'
import { useCurrentBreakpoint } from './use-current-breakpoint'
import { useFormInstance, type FieldErrorState } from './use-form-instance'
import { useCrossFieldTrigger } from './use-cross-field-trigger'
import { useFormDirty } from './use-form-dirty'
import { useServerError } from './use-server-error'
import { useFormValidation } from './use-form-validation'
import { useTopLevelFields } from './use-top-level-fields'
import { createExpressionScope } from './use-expression'
import { useExpressionFunctions } from './use-expression-functions'
import { useDevRuntime } from './use-dev-runtime'
import { useApplyDefaults } from './apply-default-values'
import { useXFormExpose } from './use-xform-expose'
import { useRenderRoot, type RenderFn } from './use-render-root'
import { useModelExpressionRerender } from './use-model-expression-rerender'
import { mergeRowResponsive } from './barrel'
import { DEFAULT_COMPONENT_PROPS } from '../adapters/element-plus-adapter'
import type { RowConfig, SchemaNode, XFormExpose, XFormProps } from '../types'

// ────────────────────────────────────────────────────────────────────────────
// 公共类型
// ────────────────────────────────────────────────────────────────────────────

/**
 * useXFormComposer 入参 —— 仅 props 一项（XForm setup 时调用）
 */
export interface UseXFormComposerOptions {
  props: XFormProps
}

/**
 * useXFormComposer 返回值 —— XForm 模板全部依赖项（顶层编排对外契约）
 *
 * - bem / elFormRef / renderToComponent: 模板根 class / el-form ref / 节点渲染闭包
 * - fieldErrors: 模板 :data-field-errors 显式绑定以建立响应式依赖（详见 XForm.vue 模板注释）
 * - topLevelXxx: 顶层 schema 字段派生的 computed（labelPosition / disabled / scrollToError 等）
 * - exposed / installDevDebugHook / errorBus: defineExpose 透传 / dev console hook / OSD 错误总线
 */
export interface UseXFormComposerReturn {
  /** XForm 模板根 class */
  bem: ReturnType<typeof createNamespace>
  /** XForm 模板绑定：<ElForm ref="elFormRef"> */
  elFormRef: Ref<ReturnType<typeof useFormInstance>['elFormRef']['value']>
  /** 传给 SchemaField 的渲染闭包 */
  renderToComponent: RenderFn
  /** 模板 :data-field-errors 显式绑定以建立响应式依赖（详见模板注释） */
  fieldErrors: Ref<Record<string, FieldErrorState>>
  /** XForm 模板 v-for 数据源 */
  topLevelNodes: ComputedRef<SchemaNode[]>
  topLevelRow: ComputedRef<RowConfig | undefined>
  topLevelColumn: ComputedRef<number | undefined>
  topLevelColSpan: ComputedRef<number>
  topLevelDisabled: ComputedRef<boolean>
  topLevelLabelWidth: ComputedRef<string | number>
  topLevelLabelPosition: ComputedRef<'left' | 'right' | 'top'>
  topLevelScrollToError: ComputedRef<boolean>
  topLevelScrollIntoViewOptions: ComputedRef<boolean | ScrollIntoViewOptions>
  mergedComponentProps: ComputedRef<Record<string, Record<string, unknown>>>
  /** 仅 dev 显示在 XFormDebugBanner */
  validateErrors: Ref<Array<{ keyPath: (string | number)[]; message: string }>>
  /** 仅 dev：表达式沙箱黑名单命中 */
  forbiddenErrors: Ref<string[]>
  /** 仅 dev：asyncOptions 位于不支持位置（formItem.slots / array.itemSchema 内） */
  asyncOptionsWarnings: Ref<string[]>
  /** dev = true / prod = false */
  showDebugBanner: Ref<boolean>
  /** XForm 通过 defineExpose 透传给 ref */
  exposed: XFormExpose
  /** XForm setup 末尾调一次，挂 window.__xform_debug */
  installDevDebugHook: () => void
  /** XForm 模板挂载 XFormErrorToast 消费 */
  errorBus: ReturnType<typeof import('./use-form-error-bus').useFormErrorBus>
  /** XFormDebugBanner @locate 回调：按字段名滚动定位（透传 useFormInstance） */
  scrollToField: (name: string) => void
}

// ────────────────────────────────────────────────────────────────────────────
// 顶层编排
// ────────────────────────────────────────────────────────────────────────────

/** useXFormComposer —— XForm 顶层编排（composition root） */
export function useXFormComposer(options: UseXFormComposerOptions): UseXFormComposerReturn {
  const { props } = options
  const bem = createNamespace('x-form')

  // 显式 deps 传递 —— composable 内 provide/inject 在 setup 嵌套中静默失效
  const errorBus = useFormErrorBus()

  // viewport 变化时响应式 ColConfig 自动拍平
  const currentBreakpoint = useCurrentBreakpoint()

  // H2 修复：表达式沙箱实例级化 —— 每实例独立函数表 + 编译缓存，
  // 消除「同页多 XForm 共享模块级表互相覆盖/清表」污染（审计 2026-09-09 浏览器实测确认）
  const exprScope = createExpressionScope()

  // 白名单函数表注册必须在 useSchemaRenderer 之前：schema watcher immediate 触发 reaction 求值时
  // 若 exprScope 函数表还未注册，沙箱 new Function 找不到白名单参数 → ReferenceError。
  // 跨实例竞争已消除（exprScope 实例私有，不再有「B 的 immediate 注册覆盖/清表毁掉 A」）
  useExpressionFunctions({ scope: exprScope, expressionFunctions: () => props.expressionFunctions })

  const { reactiveSchema, triggerRender } = useSchemaRenderer({
    schema: computed(() => props.schema),
    components: computed(() => props.components) as never,
    formData: computed(() => props.model ?? {}) as never,
    // 阶段 P2-3：reactionBudget 透传（默认 50 向后兼容）
    ...(props.reactionBudget !== undefined ? { reactionBudget: props.reactionBudget } : {}),
    // H2：reaction 管线（traverse → applyReactions → applyReactionFields）统一用实例沙箱
    resolveFunctionExpression: exprScope.resolveFunctionExpression,
  })

  // schema 元数据中央索引 —— 替代每次遍历 O(n) 的 getNames/collectCrossRuleFields
  // D(#6)：props.rules 命名规则注册表传入 —— 字符串命名 cross 规则（rules: 'myRule'）经
  // 注册表解析进索引，与批量路径 namedRules?.[r] 对齐（此前静默漏配反向触发）
  const schemaIndex = useSchemaIndex(
    () => reactiveSchema.value,
    () => props.rules
  )

  // model 依赖表达式（顶层 readonly/disabled / 字段 permission 的函数或 '{{ }}' 形态）
  // 的重渲兜底：沙箱深拷贝切断响应式追踪，这类表达式的宿主 computed 不会因 model
  // 字段 mutation 重算 —— 仅当 schema 含这类表达式时挂 watch(model) → bump modelEpoch
  // + triggerRender（按需，无这类表达式的纯 v-model 表单零开销）
  const modelExpressionEpoch = ref(0)
  useModelExpressionRerender({
    schema: reactiveSchema,
    model: computed(() => props.model) as never,
    triggerRender,
    onModelChange: () => modelExpressionEpoch.value++,
  })

  const {
    elFormRef,
    getRef,
    clearValidate,
    resetFields: instanceResetFields,
    setInitialValues,
    validateField,
    scrollToField,
    validateFormWithZod,
    addItem,
    removeItem,
    moveItem,
    setFieldError,
    setFieldValidating,
    externalErrors: fieldErrors,
  } = useFormInstance(
    () => props.model,
    () => props.zodSchema,
    errorBus
  )

  useApplyDefaults(props, setInitialValues)

  const {
    debounceValidation: topLevelDebounceMs,
    nodes: topLevelNodes,
    row: topLevelRow,
    column: topLevelColumn,
    colSpan: topLevelColSpan,
    disabled: topLevelDisabled,
    readonly: topLevelReadonly,
    labelWidth: topLevelLabelWidth,
    labelPosition: topLevelLabelPosition,
    scrollToError: topLevelScrollToError,
    scrollIntoViewOptions: topLevelScrollIntoViewOptions,
  } = useTopLevelFields({
    reactiveSchema: computed(() => reactiveSchema.value),
    model: computed(() => props.model),
    currentBreakpoint,
    resolveFunctionExpression: exprScope.resolveFunctionExpression,
    // useTopLevelFields deps 接受 string；mergeRowResponsive 真实签名是 specific union —— wrap 一层
    mergeRowResponsive: (row, bp) =>
      mergeRowResponsive(row, bp as 'xs' | 'sm' | 'md' | 'lg' | 'xl'),
    // scrollToError / scrollIntoViewOptions 的 props 兜底来源（schema 优先）
    props,
  })

  const crossFieldTrigger = useCrossFieldTrigger({
    // A1-反向：flattenCrossRules 拍平索引 + 透传 rowScoped 行模板标记（数组行内 cross 规则反向触发用）
    crossRules: () => flattenCrossRules(schemaIndex.crossRules.value),
    model: () => props.model,
    setFieldError,
    clearValidate,
    defaultDebounceMs: () => topLevelDebounceMs.value,
    // watchFallback（架构审查 #8）：schema 顶层 watchFallback 字段控制 deep watch 兜底开关
    // 未声明默认 true（向后兼容）；纯 v-model 表单可显式 false 省每键 isEqual 成本
    watchFallback:
      (reactiveSchema.value as { watchFallback?: boolean } | undefined)?.watchFallback ?? true,
  })

  /**
   * resetFields 包装 —— 在实例重置（清 externalErrors + el-form 官方重置 model）之后
   * 同 tick 调 crossFieldTrigger.onFormReset()：重拍 deps 快照使随后到达的兜底 watch
   * pass 空跑，并取消排队中的 debounce runner —— 对齐 el-form 官方「重置后不重新
   * 校验」的惯例（否则 crossValidator 会把重置回初始值的字段重新标红，如未成年场景）
   */
  function resetFields(names?: string | string[]): void {
    instanceResetFields(names)
    crossFieldTrigger.onFormReset()
  }

  const formDirty = useFormDirty({
    model: () => props.model,
    fieldNames: () => schemaIndex.fieldNames.value,
  })
  // 立即拍基线
  formDirty.resetDirty()

  // ⚠️ 曾在此处挂 watch(fieldErrors, () => triggerRender()) —— 2026-09-18 架构审查 #4
  // 实证为死代码（use-xform-composer.spec.ts「错误传播链路验证」）：
  // setFieldError 走 externalErrors.value[name] = {...} 键级写入，watch 的 ref 源
  // 监听不到 reactive 键 mutation，从未触发；渲染兜底由两条真实路径覆盖 ——
  // ① XForm.vue :data-field-errors="fieldErrorKeys"（Object.keys 派生，见 fieldErrorKeys computed）
  // ② render-form-item 每字段 render 期读取 fieldErrors[key] 建立响应式追踪
  // 故删除该 watch；若未来需要「错误变化强制整表单重渲」的场景，请改用 errorBus 订阅而非复活此 watch

  const serverError = useServerError({
    setFieldError,
    clearValidate,
    knownFields: () => schemaIndex.allNames.value,
  })

  // 校验编排
  const { validateForm, validateDetail, triggerCrossFieldValidator } = useFormValidation({
    reactiveSchema: computed(() => reactiveSchema.value),
    model: computed(() => props.model),
    rules: computed(() => props.rules),
    elFormRef,
    setFieldError,
    scrollToField,
    topLevelScrollToError,
    errorBus,
  })

  const mergedComponentProps = computed(() => ({
    ...DEFAULT_COMPONENT_PROPS,
    ...props.componentProps,
  }))

  const {
    validateErrors,
    forbiddenErrors,
    asyncOptionsWarnings,
    showDebugBanner,
    installDevDebugHook,
  } = useDevRuntime({
    props,
    errorBus,
    setFieldError,
    fieldErrors,
  })

  /** 节点渲染（外层：hidden / directives 包装） —— 由 useRenderRoot 维护 */
  const { renderToComponent } = useRenderRoot({
    props,
    fieldErrors,
    getExposed: () => exposed,
    clearValidate,
    elFormRef,
    errorBus,
    crossFieldTrigger,
    triggerCrossFieldValidator,
    arrayActions: { addItem, removeItem, moveItem },
    currentBreakpoint,
    topLevelReadonly,
    mergedComponentProps,
    // exactOptionalPropertyTypes: 条件展开避免传 undefined
    ...(props.permissionResolver ? { permissionResolver: props.permissionResolver } : {}),
    // H2：render 层（on 事件绑定 / permission 表达式）用实例沙箱
    resolveFunctionExpression: exprScope.resolveFunctionExpression,
    // dirty 标记（设计师审查 F13）：showDirtyMark 透传 + dirtyFieldsRef 响应式订阅（render-form-item 的 is-dirty class）
    // exactOptionalPropertyTypes: 条件展开避免传 undefined
    ...(props.showDirtyMark !== undefined ? { showDirtyMark: props.showDirtyMark } : {}),
    dirtyFields: formDirty.dirtyFieldsRef,
    // model 依赖表达式（permission 等 slot 闭包内求值）重渲 epoch —— useModelExpressionRerender 触发
    modelExpressionEpoch,
  })

  // 表达式沙箱（exprScope）已先于 useSchemaRenderer 创建并注册，见 setup 顶部说明

  function getNames(includesIgnore = false): string[] {
    return [...schemaIndex.getFieldNames(includesIgnore)]
  }

  const exposed: XFormExpose = useXFormExpose({
    getRef,
    clearValidate,
    resetFields,
    validateField,
    scrollToField,
    validateFormWithZod,
    setFieldError,
    setFieldValidating,
    addItem,
    removeItem,
    moveItem,
    validateForm,
    validateDetail,
    getNames,
    isDirty: formDirty.isDirty,
    getDirtyFields: formDirty.getDirtyFields,
    isTouched: formDirty.isTouched,
    resetDirty: formDirty.resetDirty,
    validateFromServer: serverError.validateFromServer,
  })

  return {
    bem,
    elFormRef,
    renderToComponent,
    fieldErrors,
    topLevelNodes,
    topLevelRow,
    topLevelColumn,
    topLevelColSpan,
    topLevelDisabled,
    topLevelLabelWidth,
    topLevelLabelPosition,
    topLevelScrollToError,
    topLevelScrollIntoViewOptions,
    mergedComponentProps,
    validateErrors,
    forbiddenErrors,
    asyncOptionsWarnings,
    showDebugBanner,
    exposed,
    installDevDebugHook,
    errorBus,
    scrollToField,
  }
}
