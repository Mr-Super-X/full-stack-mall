/**
 * useDialogSubmit —— 提交逻辑封装(防重复 + loading + 错误归一化)
 *
 * 设计点:
 * 1. 防重复 submit 标志 + try/finally,异常情况下也能复位 loading。
 * 2. 不 throw err:避免冒泡到全局 errorHandler → 500 重定向,改由 onSubmitFailed 回调接管。
 * 3. formRef 用 getter(() => formRef.value) 而非直接 ref,解耦 Vue 响应式 + 单测时可直接传 mock。
 * 4. onSubmit 用 getter 而非闭包 props.onSubmit(model),确保响应式追踪:父组件 model 变化时仍可重新调用。
 *
 * @see [`../ProDialogForm.vue`](../ProDialogForm.vue) 消费方
 * @group 通用组件:ProDialogForm
 */
import { ref, type Ref } from 'vue'
import type { XFormExpose } from '../../../form-schema/types.ts'

export interface UseDialogSubmitOptions {
  /** 取 XForm 实例的 getter */
  formRef: () => XFormExpose | null | undefined
  /** 调用方提供的异步提交函数(getter 形式,响应式追踪) */
  onSubmit: () => Promise<unknown>
  /** 提交成功回调(关闭弹窗 + emit success) */
  onSuccess: () => void
  /** 提交失败回调(emit submitFailed) */
  onSubmitFailed: (err: unknown) => void
}

export interface UseDialogSubmitReturn {
  /** 按钮 loading 状态(true 时禁用 + 转圈) */
  submitLoading: Ref<boolean>
  /** 提交函数 —— validate 失败时直接 return,submitLoading 期间二次调用被拦截 */
  handleSubmit: () => Promise<void>
}

export function useDialogSubmit(options: UseDialogSubmitOptions): UseDialogSubmitReturn {
  const { formRef, onSubmit, onSuccess, onSubmitFailed } = options

  const submitLoading = ref(false)

  async function handleSubmit(): Promise<void> {
    const ref = formRef()
    if (!ref) return

    // 1. 校验 —— 失败时由 XForm 内部 scrollToError + 字段红字处理
    const valid = await ref.validate()
    if (!valid) return

    // 2. 防重复提交(兜底防护:即便按钮被绕过/程序化触发也能阻断)
    if (submitLoading.value) return
    submitLoading.value = true

    try {
      // 3. 异步提交
      await onSubmit()
      // 4. 成功:通知父组件(关闭弹窗 + emit success)
      onSuccess()
    } catch (err) {
      // 5. 失败:通知父组件 —— 不 throw err
      onSubmitFailed(err)
    } finally {
      // 6. 无论成功失败,loading 复位保证下次可点击
      submitLoading.value = false
    }
  }

  return { submitLoading, handleSubmit }
}
