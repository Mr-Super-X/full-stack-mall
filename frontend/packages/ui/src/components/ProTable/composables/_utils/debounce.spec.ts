import { describe, it, expect, vi } from 'vitest'
import { debounceFn } from './debounce'

describe('debounceFn', () => {
  it('多次 invoke 在 delay 内只触发最后一次', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { invoke } = debounceFn(fn, 300)
    invoke('a')
    invoke('b')
    invoke('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
    vi.useRealTimers()
  })

  it('cancel 取消挂起的执行', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { invoke, cancel } = debounceFn(fn, 300)
    invoke()
    cancel()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('delay <= 0 仍走 setTimeout 异步（一致行为：delay=0 与 delay>0 行为统一）', async () => {
    // setTimeout(fn, 0) 仍异步 —— 与 v3.2 防抖设计一致（不区分同步/异步路径）
    const fn = vi.fn()
    const { invoke } = debounceFn(fn, 0)
    invoke('x')
    expect(fn).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fn).toHaveBeenCalledWith('x')
  })

  it('多个独立 debounceFn 互不干扰', () => {
    vi.useFakeTimers()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const d1 = debounceFn(fn1, 100)
    const d2 = debounceFn(fn2, 200)
    d1.invoke()
    d2.invoke()
    vi.advanceTimersByTime(100)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn2).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
