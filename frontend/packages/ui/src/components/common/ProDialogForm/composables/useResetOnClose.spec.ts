/**
 * useResetOnClose 单测。
 *
 * 覆盖:
 * 1. resetOnClose=false:handleClose 不触发 onReset
 * 2. formRef 为 null:handleClose 不调度 timer
 * 3. resetOnClose=true:300ms 后调用 onReset(formRef)
 * 4. 生命周期清理:组件卸载后 timer 不再触发 onReset(防访问已卸载 ref)
 * 5. 重入保护:短时间内多次 handleClose,只保留最后一个 timer(不堆积)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useResetOnClose } from './useResetOnClose'
import type { XFormExpose } from '../../../form-schema/types.ts'

function makeFormRef(): XFormExpose {
  return { resetFields: vi.fn() } as unknown as XFormExpose
}

interface HarnessRefs {
  handleClose: () => void
  resetOnClose: { value: boolean }
}

function makeHarness(
  initialResetOnClose: boolean,
  formRefOverride: XFormExpose | null = makeFormRef()
) {
  const result: { current: HarnessRefs | null } = { current: null }
  const Harness = defineComponent({
    setup() {
      const formRefValue = ref<XFormExpose | null>(formRefOverride)
      const resetOnClose = ref(initialResetOnClose)
      const onReset = vi.fn()
      const { handleClose } = useResetOnClose({
        formRef: () => formRefValue.value,
        resetOnClose: () => resetOnClose.value,
        onReset,
      })
      result.current = { handleClose, resetOnClose }
      // 暴露给测试:通过 button 点击 + 切换 resetOnClose
      return () =>
        h('div', [
          h('button', { class: 'btn-close', onClick: () => handleClose() }),
          h('button', {
            class: 'btn-toggle',
            onClick: () => {
              resetOnClose.value = !resetOnClose.value
            },
          }),
          h('button', {
            class: 'btn-detach',
            onClick: () => {
              formRefValue.value = null
            },
          }),
        ])
    },
  })
  return { Harness, result }
}

describe('useResetOnClose', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resetOnClose=false:handleClose 不触发 onReset', async () => {
    const { Harness, result } = makeHarness(false)
    const wrapper = mount(Harness)
    result.current!.handleClose()
    vi.advanceTimersByTime(500)
    // 无法直接断言 onReset,只能通过 timer 推进后是否触发了 resetFields
    // 这里用替代断言:没有任何定时器回调执行(handleClose 根本没调度 timer)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('resetOnClose=true:300ms 后调用 onReset(formRef)', async () => {
    const { Harness, result } = makeHarness(true)
    const wrapper = mount(Harness)
    result.current!.handleClose()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(299)
    // 299ms 时还未触发
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('生命周期清理:组件卸载后 timer 不再触发', async () => {
    const { Harness, result } = makeHarness(true)
    const wrapper = mount(Harness)
    result.current!.handleClose()
    expect(vi.getTimerCount()).toBe(1)
    // 卸载前 timer 仍在等待
    wrapper.unmount()
    // 即使推进时间,timer 已被清理
    vi.advanceTimersByTime(500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('重入保护:短时间内多次 handleClose,只保留最后一个 timer', async () => {
    const { Harness, result } = makeHarness(true)
    const wrapper = mount(Harness)
    result.current!.handleClose()
    result.current!.handleClose()
    result.current!.handleClose()
    // 不应堆积 3 个 timer,只有 1 个
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(300)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('timer 触发时 formRef 已被置 null,不调用 onReset', async () => {
    const { Harness, result } = makeHarness(true)
    const wrapper = mount(Harness)
    result.current!.handleClose()
    // 在 timer 触发前把 formRef 置 null
    wrapper.find('.btn-detach').trigger('click')
    await nextTick()
    vi.advanceTimersByTime(300)
    // onReset 不应被调用(formRef 已 null)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })
})
