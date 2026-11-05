/**
 * OverflowText 溢出检测与 tooltip 联动测试。
 *
 * jsdom 无布局引擎（clientWidth/scrollWidth 恒 0）也无 ResizeObserver——
 * 用 Object.defineProperty 打桩宽度属性 + stubGlobal 注入 mock ResizeObserver
 * 并手动触发回调，模拟浏览器感知到元素宽度变化。
 *
 * @see [`./OverflowText.vue`](./OverflowText.vue) 被测组件
 * @group 布局：Default
 */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OverflowText from './OverflowText.vue'

/** mock ResizeObserver：记录最近实例，测试手动 trigger 驱动检测回调 */
class MockResizeObserver {
  static last: MockResizeObserver | undefined
  private readonly cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
    MockResizeObserver.last = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(el: Element) {
    this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

function mountText(text = '很长的菜单标题文字超出栏宽被截断') {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  return mount(OverflowText, { props: { text } })
}

/** 打桩根 span 的布局宽度：clientWidth 可视宽 / scrollWidth 内容宽 */
function stubWidths(wrapper: ReturnType<typeof mount>, clientWidth: number, scrollWidth: number) {
  const el = wrapper.find('span.vv-overflow-text').element as HTMLElement
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  return el
}

describe('OverflowText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('初始不溢出：jsdom 下宽均 0，tooltip disabled（不弹干扰提示）', () => {
    const wrapper = mountText()
    const tooltip = wrapper.findComponent({ name: 'ElTooltip' })
    expect(tooltip.props('disabled')).toBe(true)
    expect(tooltip.props('content')).toBe('很长的菜单标题文字超出栏宽被截断')
  })

  it('溢出后触发 RO 回调 → tooltip 启用；恢复不溢出 → 再次禁用', async () => {
    const wrapper = mountText()
    const tooltip = wrapper.findComponent({ name: 'ElTooltip' })

    const el = stubWidths(wrapper, 100, 260) // 内容超出可视宽
    MockResizeObserver.last!.trigger(el)
    await wrapper.vm.$nextTick()
    expect(tooltip.props('disabled')).toBe(false)

    stubWidths(wrapper, 300, 260) // 栏加宽后文字完整
    MockResizeObserver.last!.trigger(wrapper.find('span.vv-overflow-text').element)
    await wrapper.vm.$nextTick()
    expect(tooltip.props('disabled')).toBe(true)
  })

  it('tooltip 内容即 text prop（与显示文本同源）', () => {
    const wrapper = mountText('用户与权限管理')
    expect(wrapper.findComponent({ name: 'ElTooltip' }).props('content')).toBe('用户与权限管理')
    expect(wrapper.find('span.vv-overflow-text').text()).toBe('用户与权限管理')
  })

  it('卸载时 disconnect 释放观察', () => {
    const wrapper = mountText()
    const spy = vi.spyOn(MockResizeObserver.last!, 'disconnect')
    wrapper.unmount()
    expect(spy).toHaveBeenCalledOnce()
  })
})
