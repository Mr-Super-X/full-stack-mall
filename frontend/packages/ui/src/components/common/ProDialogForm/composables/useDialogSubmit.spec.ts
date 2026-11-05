/**
 * useDialogSubmit 单测。
 *
 * 覆盖:
 * 1. 校验失败:formRef.validate() 返回 false → 不调用 onSubmit
 * 2. 校验失败:formRef 为 null → 直接 return
 * 3. 提交成功:onSubmit resolve → onSuccess 触发
 * 4. 提交失败:onSubmit reject → onSubmitFailed 触发,不 throw
 * 5. 防重复提交:submitLoading 期间二次调用被拦截
 * 6. loading 复位:成功/失败后 submitLoading 都会被 finally 复位
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useDialogSubmit } from './useDialogSubmit'
import type { XFormExpose } from '../../../form-schema/types.ts'

// mock formRef
function makeFormRef(overrides: Partial<XFormExpose> = {}): XFormExpose {
  return {
    validate: vi.fn(() => Promise.resolve(true)),
    resetFields: vi.fn(),
    ...overrides,
  } as unknown as XFormExpose
}

interface HarnessRefs {
  submitLoading: { value: boolean }
  handleSubmit: () => Promise<void>
}

function makeHarness(options: {
  formRef: XFormExpose | null
  onSubmit: () => Promise<unknown>
  onSuccess?: () => void
  onSubmitFailed?: (err: unknown) => void
}) {
  const result: { current: HarnessRefs | null } = { current: null }
  const Harness = defineComponent({
    setup() {
      const { submitLoading, handleSubmit } = useDialogSubmit({
        formRef: () => options.formRef,
        onSubmit: options.onSubmit,
        onSuccess: options.onSuccess ?? vi.fn(),
        onSubmitFailed: options.onSubmitFailed ?? vi.fn(),
      })
      result.current = { submitLoading, handleSubmit }
      return () => h('button', { onClick: () => handleSubmit() })
    },
  })
  return { Harness, result }
}

describe('useDialogSubmit', () => {
  it('formRef 为 null 时 handleSubmit 直接 return,不调用 onSubmit', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    const onSuccess = vi.fn()
    const { Harness, result } = makeHarness({
      formRef: null,
      onSubmit,
      onSuccess,
    })
    const wrapper = mount(Harness)
    await result.current!.handleSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('校验失败:validate() 返回 false → 不调用 onSubmit', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    const formRef = makeFormRef({ validate: vi.fn(() => Promise.resolve(false)) })
    const onSuccess = vi.fn()
    const { Harness, result } = makeHarness({ formRef, onSubmit, onSuccess })
    const wrapper = mount(Harness)
    await result.current!.handleSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('提交成功:onSubmit resolve → onSuccess 触发 + loading 复位', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    const onSuccess = vi.fn()
    const formRef = makeFormRef()
    const { Harness, result } = makeHarness({ formRef, onSubmit, onSuccess })
    const wrapper = mount(Harness)
    await result.current!.handleSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current!.submitLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('提交失败:onSubmit reject → onSubmitFailed 触发,loading 复位,不 throw', async () => {
    const submitError = new Error('提交失败')
    const onSubmit = vi.fn(() => Promise.reject(submitError))
    const onSubmitFailed = vi.fn()
    const onSuccess = vi.fn()
    const formRef = makeFormRef()
    const { Harness, result } = makeHarness({ formRef, onSubmit, onSuccess, onSubmitFailed })
    const wrapper = mount(Harness)
    // 不应抛出(若 throw 会导致测试失败)
    await result.current!.handleSubmit()
    expect(onSubmitFailed).toHaveBeenCalledWith(submitError)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current!.submitLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('防重复提交:submitLoading 期间二次调用被拦截', async () => {
    let resolveOnSubmit: () => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveOnSubmit = resolve
        })
    )
    const formRef = makeFormRef()
    const { Harness, result } = makeHarness({ formRef, onSubmit })
    const wrapper = mount(Harness)
    // 第一次调用(不 await,保持 submitLoading=true)
    const first = result.current!.handleSubmit()
    await nextTick()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(result.current!.submitLoading.value).toBe(true)

    // 第二次调用应被拦截
    await result.current!.handleSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)

    // 复位
    resolveOnSubmit()
    await first
    expect(result.current!.submitLoading.value).toBe(false)
    wrapper.unmount()
  })
})
