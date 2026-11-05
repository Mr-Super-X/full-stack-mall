/**
 * BigChart 单测
 *
 * Mock 策略：vi.mock('echarts') 替整个模块——jsdom 无 canvas，原生 init 必然失败；
 * 与 BaseChart.spec.ts 同一范式（组件头注释亦说明 jsdom 下原生 init 必失败的原因）。
 *
 * 核心被测行为：devicePixelRatio 补偿的钳制上限（/autoplan Phase 3 E-ARCH-1，T7）。
 * jsdom 的 window.devicePixelRatio 恒为 1，按用例用 Object.defineProperty 覆写
 * （configurable: true 保证用例间可重定义）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, readonly, ref, type Ref } from 'vue'
import { BIG_SCALE_STATE_KEY, type BigScaleState } from '@/layouts/big/config/scale'

const mocks = vi.hoisted(() => {
  const echartsInstance = {
    setOption: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    echartsInstance,
    initMock: vi.fn(() => echartsInstance),
  }
})

vi.mock('echarts', () => ({
  init: mocks.initMock,
}))

import BigChart from './BigChart.vue'

const baseOption = {
  xAxis: { type: 'category', data: ['A', 'B'] },
  series: [{ type: 'bar', data: [1, 2] }],
}

/** jsdom 无 DPR 概念，按用例覆写 window.devicePixelRatio */
function mockDevicePixelRatio(value: number): void {
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true })
}

/** 构造 provide 给 layout 的 scale 状态（fallback 之外的注入路径） */
function provideScaleState(scale: number): { [BIG_SCALE_STATE_KEY]: Readonly<Ref<BigScaleState>> } {
  return {
    [BIG_SCALE_STATE_KEY]: readonly(
      ref({ scale, offsetX: 0, offsetY: 0, designWidth: 1920, designHeight: 1080 })
    ),
  }
}

/** 取 initMock 最后一次调用传入的 devicePixelRatio 参数 */
function lastInitDpr(): number {
  const lastCall = mocks.initMock.mock.calls.at(-1)
  const opts = lastCall?.[2] as { devicePixelRatio?: number } | undefined
  return opts?.devicePixelRatio ?? NaN
}

describe('BigChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.initMock.mockReturnValue(mocks.echartsInstance)
    mockDevicePixelRatio(1)
  })

  describe('挂载初始化', () => {
    it('挂载后渲染 BEM 根节点，init 立即执行并 setOption', () => {
      const wrapper = mount(BigChart, { props: { option: baseOption } })
      expect(wrapper.classes()).toContain('vv-big-chart')
      expect(mocks.initMock).toHaveBeenCalledTimes(1)
      expect(mocks.echartsInstance.setOption).toHaveBeenCalledWith(baseOption)
    })

    it('无 provide 走 FALLBACK（scale=1）：dpr=1 时有效像素比 = 1', () => {
      mount(BigChart, { props: { option: baseOption } })
      expect(lastInitDpr()).toBe(1)
    })

    it('dpr=2 × scale=1 未超上限：有效像素比 = 2', () => {
      mockDevicePixelRatio(2)
      const wrapper = mount(BigChart, {
        props: { option: baseOption },
        global: { provide: provideScaleState(1) },
      })
      expect(wrapper.classes()).toContain('vv-big-chart')
      expect(lastInitDpr()).toBe(2)
    })

    it('dpr=2 × scale=2 = 4 超上限：钳制为 MAX_EFFECTIVE_DPR(2.5)，防 4K 大屏 GPU 显存失控', () => {
      mockDevicePixelRatio(2)
      mount(BigChart, {
        props: { option: baseOption },
        global: { provide: provideScaleState(2) },
      })
      expect(lastInitDpr()).toBe(2.5)
    })

    it('dpr=3 × scale=1 = 3 超上限：同样钳制为 2.5', () => {
      mockDevicePixelRatio(3)
      mount(BigChart, {
        props: { option: baseOption },
        global: { provide: provideScaleState(1) },
      })
      expect(lastInitDpr()).toBe(2.5)
    })
  })

  describe('响应式更新', () => {
    it('option 变更触发 setOption(notMerge)，不重建实例', async () => {
      const wrapper = mount(BigChart, { props: { option: baseOption } })
      const newOption = { series: [{ type: 'line', data: [3, 4] }] }
      await wrapper.setProps({ option: newOption })
      await nextTick()
      expect(mocks.initMock).toHaveBeenCalledTimes(1)
      expect(mocks.echartsInstance.setOption).toHaveBeenLastCalledWith(newOption, true)
    })

    it('scale 变化 → dispose + 150ms 防抖重建，重建后重新 setOption', async () => {
      vi.useFakeTimers()
      try {
        const state = ref<BigScaleState>({
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          designWidth: 1920,
          designHeight: 1080,
        })
        mount(BigChart, {
          props: { option: baseOption },
          global: { provide: { [BIG_SCALE_STATE_KEY]: readonly(state) } },
        })
        expect(mocks.initMock).toHaveBeenCalledTimes(1)

        state.value = { ...state.value, scale: 2 }
        await nextTick()
        // 防抖窗口内不重建（连续变化只重建最后一次）
        expect(mocks.initMock).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(150)
        expect(mocks.echartsInstance.dispose).toHaveBeenCalledTimes(1)
        expect(mocks.initMock).toHaveBeenCalledTimes(2)
        // 重建后必须重新 setOption，否则图表空白
        expect(mocks.echartsInstance.setOption).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('scale 防抖窗口内连续变化：多次触发合并为一次重建', async () => {
      vi.useFakeTimers()
      try {
        const state = ref<BigScaleState>({
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          designWidth: 1920,
          designHeight: 1080,
        })
        mount(BigChart, {
          props: { option: baseOption },
          global: { provide: { [BIG_SCALE_STATE_KEY]: readonly(state) } },
        })
        expect(mocks.initMock).toHaveBeenCalledTimes(1)

        // 150ms 窗口内连续 3 次变化：每次只重排防抖定时器，不重建
        for (const s of [1.4, 1.8, 2]) {
          state.value = { ...state.value, scale: s }
          await nextTick()
        }
        expect(mocks.initMock).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(150)
        expect(mocks.echartsInstance.dispose).toHaveBeenCalledTimes(1)
        expect(mocks.initMock).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('卸载清理', () => {
    it('卸载时 dispose 销毁实例，无悬挂重建', () => {
      const wrapper = mount(BigChart, { props: { option: baseOption } })
      wrapper.unmount()
      expect(mocks.echartsInstance.dispose).toHaveBeenCalledTimes(1)
      expect(mocks.initMock).toHaveBeenCalledTimes(1)
    })
  })
})
