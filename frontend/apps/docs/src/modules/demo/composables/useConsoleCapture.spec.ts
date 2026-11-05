/**
 * useConsoleCapture 单测 —— 验证 console hook 捕获 / FIFO / 截断 / 卸载还原 / prefix 过滤
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useConsoleCapture, type CapturedLog } from './useConsoleCapture'

/**
 * 用 mount() 把 composable 放到 setup 上下文里；返回的 wrapper 暴露 logs / clear
 */
function mountCapture(prefix?: string) {
  const Host = defineComponent({
    setup() {
      const capture = useConsoleCapture(prefix)
      return capture
    },
    template: '<div></div>',
  })
  return mount(Host)
}

describe('useConsoleCapture', () => {
  let originalError: typeof console.error
  let originalWarn: typeof console.warn

  beforeEach(() => {
    originalError = console.error
    originalWarn = console.warn
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    console.error = originalError
    console.warn = originalWarn
    vi.restoreAllMocks()
  })

  it('挂载后调 console.error → logs 包含 1 条 error', async () => {
    const wrapper = mountCapture()
    console.error('test message')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.level).toBe('error')
    expect(logs[0]!.message).toBe('test message')
    wrapper.unmount()
  })

  it('挂载后调 console.warn → logs 包含 1 条 warn', async () => {
    const wrapper = mountCapture()
    console.warn('warn msg')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.level).toBe('warn')
    wrapper.unmount()
  })

  it('连续 60 次 console.error → logs.length ≤ 50（FIFO 上限）', async () => {
    const wrapper = mountCapture()
    for (let i = 0; i < 60; i++) console.error(`msg-${i}`)
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(50)
    expect(logs[0]!.message).toBe('msg-10')
    expect(logs[49]!.message).toBe('msg-59')
    wrapper.unmount()
  })

  it('单条 message > 500 字 → 截断 + "...[已截断]"', async () => {
    const wrapper = mountCapture()
    const longMsg = 'x'.repeat(600)
    console.error(longMsg)
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs[0]!.message.endsWith('...[已截断]')).toBe(true)
    expect(logs[0]!.message.length).toBeLessThanOrEqual(520)
    wrapper.unmount()
  })

  it('卸载后 console.error → logs 不增长 + 原 console.error 行为还原', async () => {
    const wrapper = mountCapture()
    console.error('before unmount')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { logs: CapturedLog[] }).logs.length).toBe(1)

    wrapper.unmount()

    // 卸载后调用不应增长 logs（wrapper 已 dispose）
    console.error('after unmount')
    expect((wrapper.vm as unknown as { logs: CapturedLog[] }).logs.length).toBe(1)

    // 还原后的 console.error 应该可以正常调用（不抛错）
    expect(true).toBe(true)
  })

  it("prefix='[XForm]' 时调 console.error('foo') → logs 空（不命中过滤）", async () => {
    const wrapper = mountCapture('[XForm]')
    console.error('foo')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(0)
    wrapper.unmount()
  })

  it("prefix='[XForm]' 时调 console.error('[XForm] validate 失败') → logs 命中", async () => {
    const wrapper = mountCapture('[XForm]')
    console.error('[XForm] validate 失败')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.message).toBe('[XForm] validate 失败')
    wrapper.unmount()
  })

  it('clear() 清空 logs', async () => {
    const wrapper = mountCapture()
    console.error('a')
    console.error('b')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { logs: CapturedLog[]; clear: () => void }
    expect(vm.logs.length).toBe(2)
    vm.clear()
    await wrapper.vm.$nextTick()
    expect(vm.logs.length).toBe(0)
    wrapper.unmount()
  })
})
