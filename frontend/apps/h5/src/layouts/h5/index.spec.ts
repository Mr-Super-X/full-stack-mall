/**
 * layouts/h5 布局壳测试（T8 FOUC 回归 + T12 组件冒烟）。
 *
 * 核心防线（T8）：activateRem 必须在本组件 setup 顶层同步执行——
 * 父 setup → 子 setup 的执行顺序保证探针组件 setup 中读到的 html fontSize
 * 已是激活值；若实现退回 onMounted 激活，探针会读到空字符串（浏览器默认前状态），
 * 即"首帧 16px 再跳变"的 FOUC 复发信号。
 *
 * 测试隔离：rem.ts 的 snapshot/recalcTimer 是模块级单例，用例间必须
 * deactivateRem() 复位（与 rem.spec.ts 同一纪律）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import H5Layout from './index.vue'
import { deactivateRem, H5_REM_RESIZE_DELAY } from './config/rem'

function mockViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
}

/** setup 探针：记录子组件 setup 执行瞬间的 html fontSize（T8 核心断言数据来源） */
const probeReadAtSetup = ref('')

const Probe = defineComponent({
  name: 'SetupProbe',
  setup() {
    probeReadAtSetup.value = document.documentElement.style.fontSize
    return () => null
  },
})

describe('layouts/h5 — 布局壳激活链路', () => {
  beforeEach(() => {
    deactivateRem() // 复位模块级单例（用例间隔离）
    document.documentElement.style.cssText = ''
    mockViewportWidth(1024) // 宽屏：fontSize 54px + 限宽 540px 居中
    probeReadAtSetup.value = ''
  })

  afterEach(() => {
    deactivateRem()
    document.documentElement.style.cssText = ''
  })

  it('T8 回归：子组件 setup 瞬间 html fontSize 已激活（setup 顶层同步写入，无 FOUC）', () => {
    mount(H5Layout, { global: { components: { RouterView: Probe } } })
    expect(probeReadAtSetup.value).toBe('54px')
  })

  it('挂载后 html fontSize = min(视口,540)/10，宽屏限宽居中', () => {
    const wrapper = mount(H5Layout, { global: { components: { RouterView: Probe } } })
    expect(wrapper.classes()).toContain('vv-h5-layout')
    const style = document.documentElement.style
    expect(style.fontSize).toBe('54px')
    expect(style.width).toBe('540px')
    expect(style.margin).toBe('0px auto') // CSSOM 序列化：length 0 规范要求带 px
  })

  it('卸载后快照恢复，html 零残留（对 default/portal 零污染契约）', () => {
    document.documentElement.style.fontSize = '16px' // 模拟进入前已有内联值
    const wrapper = mount(H5Layout, { global: { components: { RouterView: Probe } } })
    expect(document.documentElement.style.fontSize).toBe('54px')

    wrapper.unmount()
    expect(document.documentElement.style.fontSize).toBe('16px')
    expect(document.documentElement.style.width).toBe('')
    expect(document.documentElement.style.margin).toBe('')
  })

  it('视口 resize：300ms 防抖窗口内不重算，窗口后 fontSize 按新视口重算', () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(H5Layout, { global: { components: { RouterView: Probe } } })
      expect(document.documentElement.style.fontSize).toBe('54px') // min(1024,540)/10

      mockViewportWidth(375)
      window.dispatchEvent(new Event('resize'))
      // 防抖窗口内保持旧值（resize 高频触发不抖动）
      expect(document.documentElement.style.fontSize).toBe('54px')

      vi.advanceTimersByTime(H5_REM_RESIZE_DELAY)
      expect(document.documentElement.style.fontSize).toBe('37.5px') // 375/10
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
