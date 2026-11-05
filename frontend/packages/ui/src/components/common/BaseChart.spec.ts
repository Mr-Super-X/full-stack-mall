/**
 * BaseChart 单测
 *
 * Mock 策略：
 * 1. vi.mock('echarts') 替整个 echarts 模块——jsdom 无 canvas，原生 init 必然失败；
 * 2. globalThis.ResizeObserver 替全局——BaseChart 初始化时创建观察器，
 *    jsdom 默认未提供，必须兜底否则 onMounted 抛错。
 *
 * 关键陷阱：vi.fn().mockReturnValue() 不能作为 constructor 使用。
 * BaseChart 里 `new ResizeObserver(cb)` 要求 mock 必须是 class（new 可调用），
 * 但 observe / disconnect 等方法必须共享 vi.fn() 实例以便 vi.clearAllMocks()
 * 在 beforeEach 中能正确清零计数。因此采用 class + 字段共享 vi.fn() 的折中写法。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// hoist：vi.mock 工厂闭包外可访问；class 必须在 hoist 内创建以引用共享 vi.fn()
const mocks = vi.hoisted(() => {
  const echartsInstance = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    clear: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
  const resizeObserverInstance = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }
  // class 形式：BaseChart 用 `new ResizeObserver(cb)` 调用，必须可构造
  // 字段共享 vi.fn() 引用，确保所有实例的调用都累加到同一个 mock 上
  class ResizeObserverMock {
    observe = resizeObserverInstance.observe
    disconnect = resizeObserverInstance.disconnect
    unobserve = resizeObserverInstance.unobserve
  }
  return {
    echartsInstance,
    resizeObserverInstance,
    ResizeObserverMock,
    initMock: vi.fn(() => echartsInstance),
  }
})

vi.mock('echarts', () => ({
  init: mocks.initMock,
}))

// jsdom 未实现 ResizeObserver；BaseChart 在 onMounted 必创建观察器，必须兜底
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = mocks.ResizeObserverMock

import BaseChart from './BaseChart.vue'

const baseOption = {
  tooltip: {},
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: {},
  series: [{ type: 'bar', data: [10, 20, 30] }],
}

describe('BaseChart', () => {
  beforeEach(() => {
    // 清零所有 vi.fn() 调用历史（包含 echartsInstance / resizeObserverInstance 上的方法）
    vi.clearAllMocks()
    // initMock 必须重新绑定返回值，因为 clearAllMocks 会清掉 mockReturnValue 配置
    mocks.initMock.mockReturnValue(mocks.echartsInstance)
  })

  describe('挂载初始化', () => {
    it('挂载后渲染带 BEM 命名空间的根节点', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      expect(wrapper.classes()).toContain('vv-base-chart')
    })

    it('挂载时调用 echarts.init 并 setOption（强制 notMerge）', () => {
      mount(BaseChart, { props: { option: baseOption } })
      expect(mocks.initMock).toHaveBeenCalledTimes(1)
      expect(mocks.echartsInstance.setOption).toHaveBeenCalledWith(baseOption, {
        notMerge: true,
      })
    })

    it('默认 autoResize=true 时挂载会创建 ResizeObserver 并 observe 容器', () => {
      mount(BaseChart, { props: { option: baseOption } })
      expect(mocks.resizeObserverInstance.observe).toHaveBeenCalledTimes(1)
    })

    it('loading=true 时挂载立即触发 showLoading', () => {
      mount(BaseChart, { props: { option: baseOption, loading: true } })
      expect(mocks.echartsInstance.showLoading).toHaveBeenCalledTimes(1)
    })

    it('loading=false 时挂载不调用 showLoading', () => {
      mount(BaseChart, { props: { option: baseOption, loading: false } })
      expect(mocks.echartsInstance.showLoading).not.toHaveBeenCalled()
    })
  })

  describe('响应式 props 监听', () => {
    it('option 变更触发 setOption（notMerge: true），传入新值', async () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      const newOption = {
        series: [{ type: 'line', data: [1, 2, 3] }],
      }
      await wrapper.setProps({ option: newOption })
      await nextTick()
      expect(mocks.echartsInstance.setOption).toHaveBeenLastCalledWith(newOption, {
        notMerge: true,
      })
    })

    it('loading 从 false → true 触发 showLoading', async () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption, loading: false } })
      await wrapper.setProps({ loading: true })
      await nextTick()
      expect(mocks.echartsInstance.showLoading).toHaveBeenCalled()
    })

    it('loading 从 true → false 触发 hideLoading', async () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption, loading: true } })
      await wrapper.setProps({ loading: false })
      await nextTick()
      expect(mocks.echartsInstance.hideLoading).toHaveBeenCalled()
    })

    it('theme 变更走「dispose + 重建」路径', async () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption, theme: 'light' } })
      expect(mocks.initMock).toHaveBeenCalledTimes(1)

      await wrapper.setProps({ theme: 'dark' })
      await nextTick()

      expect(mocks.echartsInstance.dispose).toHaveBeenCalled()
      expect(mocks.initMock).toHaveBeenCalledTimes(2)
      // 重建后 setOption 必须再次执行，否则图表空白
      expect(mocks.echartsInstance.setOption).toHaveBeenCalledTimes(2)
    })

    it('autoResize 关闭时不会创建 ResizeObserver', () => {
      mount(BaseChart, { props: { option: baseOption, autoResize: false } })
      expect(mocks.resizeObserverInstance.observe).not.toHaveBeenCalled()
    })

    it('autoResize 从 true 切到 false 触发 disconnect', async () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption, autoResize: true } })
      await wrapper.setProps({ autoResize: false })
      await nextTick()
      expect(mocks.resizeObserverInstance.disconnect).toHaveBeenCalled()
    })

    it('autoResize 从 false 切到 true 触发 observe', async () => {
      const wrapper = mount(BaseChart, {
        props: { option: baseOption, autoResize: false },
      })
      await wrapper.setProps({ autoResize: true })
      await nextTick()
      expect(mocks.resizeObserverInstance.observe).toHaveBeenCalled()
    })
  })

  describe('defineExpose 暴露的方法', () => {
    it('getInstance 返回原始 echarts 实例', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      const exposed = wrapper.vm as unknown as {
        getInstance: () => typeof mocks.echartsInstance | null
      }
      expect(exposed.getInstance()).toBe(mocks.echartsInstance)
    })

    it('resize() 转发到实例.resize', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      const exposed = wrapper.vm as unknown as { resize: () => void }
      exposed.resize()
      expect(mocks.echartsInstance.resize).toHaveBeenCalled()
    })

    it('clear() 转发到实例.clear', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      const exposed = wrapper.vm as unknown as { clear: () => void }
      exposed.clear()
      expect(mocks.echartsInstance.clear).toHaveBeenCalled()
    })
  })

  describe('卸载清理（三步走）', () => {
    it('卸载时 dispose 触发 ECharts 实例销毁', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      wrapper.unmount()
      expect(mocks.echartsInstance.dispose).toHaveBeenCalledTimes(1)
    })

    it('卸载时 disconnect ResizeObserver', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      wrapper.unmount()
      expect(mocks.resizeObserverInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    it('卸载后 getInstance 返回 null（实例已清空）', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      wrapper.unmount()
      const exposed = wrapper.vm as unknown as {
        getInstance: () => typeof mocks.echartsInstance | null
      }
      expect(exposed.getInstance()).toBeNull()
    })

    it('卸载后再次调用 resize / clear 是静默 no-op（不会 throw）', () => {
      const wrapper = mount(BaseChart, { props: { option: baseOption } })
      wrapper.unmount()
      const exposed = wrapper.vm as unknown as {
        resize: () => void
        clear: () => void
      }
      // 卸载后 vm 已销毁，但调用方法不应抛错（使用 optional chaining）
      expect(() => exposed.resize?.()).not.toThrow()
      expect(() => exposed.clear?.()).not.toThrow()
    })
  })
})
