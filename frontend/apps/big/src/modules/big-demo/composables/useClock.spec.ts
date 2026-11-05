/**
 * useClock 单测：初始值格式 / 1s 步进 / scope 销毁后定时器清理。
 *
 * fake timers 会同时 mock Date（dayjs 随之推进），advanceTimersByTime
 * 即可驱动时间变化；scope.stop() 后时钟必须冻结（清理断言）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useClock } from './useClock'

describe('useClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始即返回当前时间字符串（YYYY-MM-DD HH:mm:ss）', () => {
    const scope = effectScope()
    const clock = scope.run(() => useClock())
    expect(clock?.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    scope.stop()
  })

  it('每 1s 步进更新', () => {
    const scope = effectScope()
    const clock = scope.run(() => useClock())
    const before = clock?.value
    vi.advanceTimersByTime(1000)
    expect(clock?.value).not.toBe(before)
    scope.stop()
  })

  it('scope 销毁后定时器清理（时间冻结）', () => {
    const scope = effectScope()
    const clock = scope.run(() => useClock())
    scope.stop()
    const frozen = clock?.value
    vi.advanceTimersByTime(5000)
    expect(clock?.value).toBe(frozen)
  })
})
