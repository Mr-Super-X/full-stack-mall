/**
 * useFormValidation —— XForm 校验编排（el-form.validate + crossValidator + scrollToError）
 *
 * 公开契约（XFormExpose）：
 * - validate(): Promise<boolean> —— 字段规则失败直接 false；跑 crossValidator；失败 scrollToError
 * - validateDetail(): Promise<ValidateResult> —— 仅返回跨字段错误，不写 UI
 *
 * 不变量：
 * - 字段规则走 el-form.validate（官方路径）
 * - 跨字段：crossValidator 同步/异步都 await；失败写入对应 form-item 红字
 * - 滚动：字段失败由 el-form 原生 scrollToError；跨字段失败由 scrollToFirstError
 *
 * @see ./use-cross-field-rule-trigger.ts 委托实现 triggerCrossFieldValidator
 *
 * @group 表单编排：校验
 */
import { nextTick } from 'vue'
import { get } from 'lodash-es'
import { runCrossFieldValidation } from './use-validate'
import { useCrossFieldRuleTrigger } from './use-cross-field-rule-trigger'
import type { UseFormErrorBusReturn } from './use-form-error-bus'
import type { ValidateResult, RuleItem, SchemaNode } from '../types'
import { collectElFieldErrors } from '../utils/collect-el-field-errors'
import { runElFormValidate } from '../utils/run-el-form-validate'

/**
 * useFormValidation 入参 —— 由 useXFormComposer 装配
 *
 * 显式 deps 注入而非 composable 内 provide/inject（避免嵌套场景静默失效）。
 * @see ./use-xform-composer.ts createValidateValidation
 * @see ./use-form-instance.ts elFormRef / setFieldError 来源
 */
export interface UseFormValidationDeps {
  reactiveSchema: { value: SchemaNode | SchemaNode[] | string | undefined }
  model: { value: Record<string, unknown> | undefined }
  rules: { value: Record<string, RuleItem> | undefined }
  elFormRef: {
    value: {
      validate?: (callback?: (valid: boolean) => void) => Promise<boolean>
    } | null
  }
  setFieldError: (
    name: string,
    message: string,
    state?: '' | 'validating' | 'success' | 'error',
    /** 静默标志 — true 时不触发 OSD 上报（applyCrossErrors 汇总场景） */
    silent?: boolean
  ) => void
  scrollToField: (name: string) => void
  topLevelScrollToError: { value: boolean }
  /** 显式传递避免 provide/inject 在 composable 嵌套场景失效 */
  errorBus?: UseFormErrorBusReturn
}

/**
 * useFormValidation 返回值 —— 校验编排公开 API
 *
 * - validateForm: 完整校验（字段规则 + 跨字段 + OSD 上报）
 * - validateDetail: 仅跨字段结果，不写 UI
 * - triggerCrossFieldValidator: 字段事件触发跨字段校验（v-model 写入 + onBlur + onChange）
 * - firstCrossErrorField / applyCrossErrors / scrollToFirstError: 错误处理工具
 */
export interface UseFormValidationReturn {
  validateForm: () => Promise<boolean>
  validateDetail: () => Promise<ValidateResult>
  triggerCrossFieldValidator: (node: SchemaNode, eventType: 'blur' | 'change') => Promise<void>
  firstCrossErrorField: (result: ValidateResult) => string | null
  applyCrossErrors: (result: ValidateResult) => void
  scrollToFirstError: (fieldName: string | null) => void
}

/**
 * useFormValidation —— XForm 校验编排（el-form.validate + crossValidator + scrollToError）
 *
 * 跨字段执行语义（seq 竞态令牌 / 异常兜底 / 取值归一）统一收敛到
 * ./cross-rule-runner.ts；字段事件触发委托 ./use-cross-field-rule-trigger
 */
export function useFormValidation(deps: UseFormValidationDeps): UseFormValidationReturn {
  // 显式从 deps 传入（避免 composable 内 provide/inject 静默失效）
  const errorBus = deps.errorBus
  const {
    reactiveSchema,
    model,
    rules,
    elFormRef,
    setFieldError,
    scrollToField,
    topLevelScrollToError,
  } = deps

  // setFieldError 直接传引用，保留第 3 参数 state（spec 断言 3 参数调用）
  const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger({
    model,
    setFieldError,
  })

  /**
   * XForm 校验入口：先跑 el-form 字段内规则（失败直接 false），成功后跑跨字段校验
   * - 跨字段校验失败时把错误写入对应 form-item（用户在 UI 看到）
   * - 跨字段校验支持异步：crossValidator 返回 Promise<true | string> 时会自动 await
   * - el-form 未挂载时降级只跑跨字段校验（开发场景）
   * - scrollToError prop：字段规则失败由 ElForm 原生滚动（scrollToError 透传），
   *   跨字段失败由 scrollToFirstError 滚动到第一个 cross 错误字段
   */
  async function validateForm(): Promise<boolean> {
    const m = model.value
    if (!m) return true
    const ef = elFormRef.value
    if (!ef?.validate) {
      // el-form 未挂载时降级只跑跨字段校验（开发场景）
      const result = await runCrossFieldValidation(reactiveSchema.value, m, rules.value)
      applyCrossErrors(result)
      scrollToFirstError(firstCrossErrorField(result))
      return result.isValid
    }
    const efValidate = ef.validate
    // 字段规则失败时 ElForm 原生 scrollToError 已处理滚动（第一个 .el-form-item.is-error）
    const elValid = await runElFormValidate(efValidate)
    if (!elValid) {
      // el-form 内置规则失败（含 async-validator / validator callback 失败）也需 OSD 提示
      // 扫描 ef.fields 提取 is-error 字段名 + validateMessage + fieldValue
      const details = collectElFieldErrors(ef as unknown as { fields?: unknown[] }, {
        includeValue: true,
      })
      if (details.length > 0) {
        // el-form.validate() 失败 → 字段内规则（required/pattern/validator callback），
        // 不是 cross-field，code 用 EL_FORM_VALIDATION_FAILED 与跨字段区分
        // force: true —— 用户主动 validate() 调用场景，每次都应反馈（不被 5s 去重）
        // console 输出由 errorBus 内部统一处理（避免双重输出）
        errorBus?.report({
          severity: 'error',
          code: 'EL_FORM_VALIDATION_FAILED',
          message: `校验失败 ${details.length} 项（详见表单红字）`,
          fields: details.map((d) => d.field),
          details,
          source: 'useFormValidation/elForm',
          force: true,
        })
      }
      return false
    }
    const result = await runCrossFieldValidation(reactiveSchema.value, m, rules.value)
    applyCrossErrors(result)
    scrollToFirstError(firstCrossErrorField(result))
    return result.isValid
  }

  /** 取跨字段校验结果中第一个错误的字段名（keyPath 末段） */
  function firstCrossErrorField(result: ValidateResult): string | null {
    if (result.isValid) return null
    const first = result.errors[0]
    if (!first) return null
    const field = first.keyPath[first.keyPath.length - 1]
    return typeof field === 'string' ? field : null
  }

  /**
   * 跨字段校验失败滚动到第一个错误字段
   * - 字段规则失败的滚动由 ElForm 原生 scrollToError 处理，不走这里
   * - scrollToError 开关控制；nextTick 等红字渲染后再滚动
   */
  function scrollToFirstError(fieldName: string | null): void {
    if (!fieldName || !topLevelScrollToError.value) return
    void nextTick(() => {
      scrollToField(fieldName)
    })
  }

  /** 把跨字段校验失败的错误写入对应 el-form-item（用户在 UI 看到） */
  function applyCrossErrors(result: ValidateResult): void {
    if (result.isValid) return
    const details: Array<{ field: string; message: string; value?: unknown }> = []
    const m = model.value ?? {}
    for (const err of result.errors) {
      const fieldPath = err.keyPath[err.keyPath.length - 1]
      if (typeof fieldPath === 'string') {
        // silent: true 避免与 per-field OSD 重复 —— applyCrossErrors 用汇总 toast
        setFieldError(fieldPath, err.message, 'error', true)
        details.push({ field: fieldPath, message: err.message, value: get(m, fieldPath) })
      }
    }
    // console 输出由 errorBus 内部统一处理（避免双重输出）
    // user-facing 反馈（dev 弹 OSD，prod 静默）
    errorBus?.report({
      severity: 'error',
      code: 'CROSS_VALIDATION_FAILED',
      message: `跨字段校验失败 ${result.errors.length} 项`,
      fields: details.map((d) => d.field),
      details,
      source: 'useFormValidation',
    })
  }

  /**
   * 详细校验：同时收集 el-form 字段规则错误 + 跨字段错误
   *
   * 修复前只跑 runCrossFieldValidation → 必填字段错误收集不到 → errors=[] 与
   * validate() 返回 false 不一致 → demo toast 显示"校验失败：0 项错误"
   *
   * 实现：先跑 el-form.validate() 收集字段规则错误（keyPath=[字段名]），
   * 再跑 cross 收集跨字段错误（keyPath 来自 crossValidator），合并返回。
   */
  async function validateDetail(): Promise<ValidateResult> {
    const m = model.value
    if (!m) return { isValid: true, errors: [] }

    const errors: ValidateResult['errors'] = []

    // 收集 el-form 字段规则错误（required / pattern / validator callback）
    const ef = elFormRef.value
    const efValidate = ef?.validate
    if (efValidate) {
      const elValid = await runElFormValidate(efValidate)
      if (!elValid) {
        for (const d of collectElFieldErrors(ef as unknown as { fields?: unknown[] })) {
          errors.push({ keyPath: [d.field], message: d.message })
        }
      }
    }

    // 收集跨字段错误（async crossValidator await 在 runCrossFieldValidation 内部）
    const crossResult = await runCrossFieldValidation(reactiveSchema.value, m, rules.value)
    errors.push(...crossResult.errors)

    return { isValid: errors.length === 0, errors }
  }

  return {
    validateForm,
    validateDetail,
    triggerCrossFieldValidator,
    firstCrossErrorField,
    applyCrossErrors,
    scrollToFirstError,
  }
}
