import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T20:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('未到截止时刻时倒计时到当日 22:00', () => {
    const scope = effectScope()
    const { remaining } = scope.run(() => useCountdown())!

    expect(remaining.value).toBe('02:00:00')
    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe('01:59:59')
    vi.advanceTimersByTime(60_000)
    expect(remaining.value).toBe('01:58:59')

    scope.stop()
  })

  it('已过截止时刻时指向次日 22:00', () => {
    vi.setSystemTime(new Date('2026-11-04T23:30:00'))
    const scope = effectScope()
    const { remaining } = scope.run(() => useCountdown())!

    // 23:30 → 次日 22:00 = 22h30m
    expect(remaining.value).toBe('22:30:00')
    scope.stop()
  })

  it('支持自定义截止小时', () => {
    vi.setSystemTime(new Date('2026-11-04T09:50:00'))
    const scope = effectScope()
    const { remaining } = scope.run(() => useCountdown(10))!

    expect(remaining.value).toBe('00:10:00')
    scope.stop()
  })

  it('作用域销毁后停止计时（不再写失效状态）', () => {
    const scope = effectScope()
    const { remaining } = scope.run(() => useCountdown())!

    vi.advanceTimersByTime(3000)
    expect(remaining.value).toBe('01:59:57')

    scope.stop()
    vi.advanceTimersByTime(5000)
    expect(remaining.value).toBe('01:59:57') // interval 已清理，值冻结
  })
})
