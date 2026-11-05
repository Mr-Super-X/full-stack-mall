import { describe, it, expect } from 'vitest'
import { globalAbort, chainSignals } from './global-abort'

describe('chainSignals', () => {
  it('无信号时返回永不中止的占位 signal', () => {
    const s = chainSignals()
    expect(s.aborted).toBe(false)
  })
  it('单个 undefined 被过滤', () => {
    const s = chainSignals(undefined)
    expect(s.aborted).toBe(false)
  })
  it('多个 undefined 全部被过滤', () => {
    const s = chainSignals(undefined, undefined, undefined)
    expect(s.aborted).toBe(false)
  })
  it('单个 signal 透传', () => {
    const c = new AbortController()
    const s = chainSignals(c.signal)
    expect(s).toBe(c.signal)
  })
  it('undefined + signal 等价于单 signal', () => {
    const c = new AbortController()
    const s = chainSignals(undefined, c.signal)
    expect(s).toBe(c.signal)
  })
  it('多 signal 合并：任一触发即中止', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    const s = chainSignals(c1.signal, c2.signal)
    expect(s.aborted).toBe(false)
    c1.abort()
    expect(s.aborted).toBe(true)
  })
  it('多 signal 合并：另一信号触发也中止', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    const s = chainSignals(c1.signal, c2.signal)
    c2.abort('second')
    expect(s.aborted).toBe(true)
    expect(s.reason).toBe('second')
  })
})

describe('globalAbort', () => {
  it('初始未中止', () => {
    expect(globalAbort.signal.aborted).toBe(false)
  })
  it('abort() 后 signal.aborted = true', () => {
    const reason = 'logout-test-' + Date.now()
    globalAbort.abort(reason)
    expect(globalAbort.signal.aborted).toBe(true)
    expect(globalAbort.signal.reason).toBe(reason)
    globalAbort.reset()
  })
  it('reset() 后 signal 重新可观察', () => {
    globalAbort.abort('temp')
    globalAbort.reset()
    expect(globalAbort.signal.aborted).toBe(false)
    expect(globalAbort.signal.reason).toBe(undefined)
  })
  it('reset() 在未 aborted 时保持原 signal 引用', () => {
    const before = globalAbort.signal
    globalAbort.reset()
    expect(globalAbort.signal).toBe(before)
  })
  it('重复 abort() 不会抛错', () => {
    globalAbort.abort('first')
    expect(() => globalAbort.abort('second')).not.toThrow()
    globalAbort.reset()
  })
})
