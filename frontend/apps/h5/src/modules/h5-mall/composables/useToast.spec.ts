import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('show 后可见并携带消息，duration 后自动消失', () => {
    const scope = effectScope()
    const { visible, message, show } = scope.run(() => useToast())!

    show('已加入购物袋')
    expect(visible.value).toBe(true)
    expect(message.value).toBe('已加入购物袋')

    vi.advanceTimersByTime(1800)
    expect(visible.value).toBe(false)

    scope.stop()
  })

  it('连续调用重置计时：自最后一次 show 起算', () => {
    const scope = effectScope()
    const { visible, show } = scope.run(() => useToast())!

    show('第一条')
    vi.advanceTimersByTime(1000)
    show('第二条')

    vi.advanceTimersByTime(1000)
    expect(visible.value).toBe(true) // 距第二条仅 1s，未到期

    vi.advanceTimersByTime(800)
    expect(visible.value).toBe(false) // 第二条满 1.8s，已隐藏

    scope.stop()
  })

  it('自定义 duration 生效', () => {
    const scope = effectScope()
    const { visible, show } = scope.run(() => useToast(500))!

    show('x')
    vi.advanceTimersByTime(499)
    expect(visible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible.value).toBe(false)

    scope.stop()
  })

  it('作用域销毁后清理挂起定时器（推进时间不抛错）', () => {
    const scope = effectScope()
    const { visible, show } = scope.run(() => useToast())!

    show('x')
    scope.stop()
    vi.advanceTimersByTime(5000)
    expect(visible.value).toBe(true)
  })
})
