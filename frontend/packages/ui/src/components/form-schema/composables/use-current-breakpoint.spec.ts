import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useCurrentBreakpoint } from './use-current-breakpoint'

describe('useCurrentBreakpoint()', () => {
  it('默认断点是 md(中位断点,SSR 安全)', () => {
    const bp = useCurrentBreakpoint()
    expect(bp.value).toBe('md')
  })

  it('返回 Ref 类型,外部可订阅', () => {
    const bp = useCurrentBreakpoint()
    expect(bp.value).toBeDefined()
    expect(['xs', 'sm', 'md', 'lg', 'xl']).toContain(bp.value)
  })
})

describe('useCurrentBreakpoint / resize 节流（⑦ 回归）', () => {
  const realWidth = window.innerWidth

  function mountProbe() {
    return mount(
      defineComponent({
        setup() {
          const bp = useCurrentBreakpoint()
          return () => h('div', String(bp.value))
        },
      })
    )
  }

  function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  }

  afterEach(() => {
    setWidth(realWidth)
    vi.useRealTimers()
  })

  it('resize 触发后不立即更新，节流 100ms 后结算', async () => {
    vi.useFakeTimers()
    const wrapper = mountProbe() // onMounted 里 update() 同步跑一次（首帧正确）
    setWidth(500) // < 768 → xs
    window.dispatchEvent(new Event('resize'))
    // 节流中：100ms 内仍显示挂载时的断点
    expect(wrapper.text()).not.toBe('xs')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('xs')
    wrapper.unmount()
  })

  it('卸载后移除监听并取消 trailing（不抛错、不再写已卸载组件的 ref）', () => {
    vi.useFakeTimers()
    const wrapper = mountProbe()
    wrapper.unmount()
    setWidth(500)
    expect(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(300)
    }).not.toThrow()
  })
})
