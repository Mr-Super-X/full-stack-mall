import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useDeadlineCountdown } from './useDeadlineCountdown'

describe('useDeadlineCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('距 target 90 秒显示 00:01:30 且未结束', () => {
    const scope = effectScope()
    const { remaining, ended } = scope.run(() =>
      useDeadlineCountdown(new Date('2026-11-10T12:01:30'))
    )!

    expect(remaining.value).toBe('00:01:30')
    expect(ended.value).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe('00:01:29')

    scope.stop()
  })

  it('超过 target 后 ended=true 且 remaining 归零', () => {
    const scope = effectScope()
    const { remaining, ended } = scope.run(() =>
      useDeadlineCountdown(new Date('2026-11-10T12:00:01'))
    )!

    vi.advanceTimersByTime(2000)
    expect(ended.value).toBe(true)
    expect(remaining.value).toBe('00:00:00')

    scope.stop()
  })

  it('接受 ISO 字符串 target', () => {
    const scope = effectScope()
    const { remaining } = scope.run(() => useDeadlineCountdown('2026-11-10T12:00:59'))!

    expect(remaining.value).toBe('00:00:59')

    scope.stop()
  })

  it('作用域销毁后停止计时（值冻结）', () => {
    const scope = effectScope()
    const { remaining } = scope.run(() =>
      useDeadlineCountdown(new Date('2026-11-10T12:01:00'))
    )!

    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe('00:00:59')

    scope.stop()
    vi.advanceTimersByTime(5000)
    expect(remaining.value).toBe('00:00:59')
  })
})
