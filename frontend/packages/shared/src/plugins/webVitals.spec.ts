import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { App } from 'vue'
import type { Metric } from 'web-vitals'

const { mockOnLCP, mockOnINP, mockOnCLS, mockOnTTFB } = vi.hoisted(() => ({
  mockOnLCP: vi.fn(),
  mockOnINP: vi.fn(),
  mockOnCLS: vi.fn(),
  mockOnTTFB: vi.fn(),
}))

vi.mock('web-vitals', () => ({
  onLCP: mockOnLCP,
  onINP: mockOnINP,
  onCLS: mockOnCLS,
  onTTFB: mockOnTTFB,
}))

// 单源后 consoleBadge 与插件同包，mock 走相对路径（原 app 侧 mock '@vv/shared'）
vi.mock('../utils/consoleBadge.ts', () => ({ showBadge: vi.fn() }))

import webVitals from './webVitals.ts'

const app = {} as App

beforeEach(() => {
  mockOnLCP.mockReset()
  mockOnINP.mockReset()
  mockOnCLS.mockReset()
  mockOnTTFB.mockReset()
})

describe('webVitals 插件', () => {
  it('默认注册全部 4 项指标', () => {
    webVitals.install(app, {})
    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnINP).toHaveBeenCalledTimes(1)
    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnTTFB).toHaveBeenCalledTimes(1)
  })

  it('metrics 子集只注册指定指标', () => {
    webVitals.install(app, { metrics: ['LCP', 'CLS'] })
    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnINP).not.toHaveBeenCalled()
    expect(mockOnTTFB).not.toHaveBeenCalled()
  })

  it('自定义 report 直通到每个指标注册函数', () => {
    const report = vi.fn()
    webVitals.install(app, { report, metrics: ['LCP'] })
    const [cb] = mockOnLCP.mock.calls[0] as [(m: Metric) => void]
    cb({ name: 'LCP', value: 1200, rating: 'good' } as Metric)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ name: 'LCP', value: 1200 }))
  })

  it('单项指标注册失败不阻塞其他指标', () => {
    mockOnINP.mockImplementationOnce(() => {
      throw new Error('INP unsupported')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    webVitals.install(app, {})

    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnTTFB).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
