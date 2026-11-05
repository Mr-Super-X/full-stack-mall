import { describe, it, expect } from 'vitest'
import { createAbort, withAbort, linkAbort } from './cancel'

describe('createAbort', () => {
  it('初始 signal 未触发', () => {
    const h = createAbort()
    expect(h.signal.aborted).toBe(false)
  })

  it('abort() 后 signal.aborted=true', () => {
    const h = createAbort()
    h.abort('user-cancel')
    expect(h.signal.aborted).toBe(true)
    expect(h.signal.reason).toBe('user-cancel')
  })

  it('使用构造默认 reason', () => {
    const h = createAbort('default-reason')
    h.abort()
    expect(h.signal.reason).toBe('default-reason')
  })
})

describe('withAbort', () => {
  it('返回包含 signal 的配置对象', () => {
    const h = createAbort()
    const cfg = withAbort(h)
    expect(cfg.signal).toBe(h.signal)
  })
})

describe('linkAbort', () => {
  it('external 为 undefined 时返回 local.signal', () => {
    const h = createAbort()
    expect(linkAbort(undefined, h)).toBe(h.signal)
  })

  it('external 已 aborted 立刻触发 local.abort', () => {
    const ext = new AbortController()
    ext.abort('ext-done')
    const h = createAbort()
    linkAbort(ext.signal, h)
    expect(h.signal.aborted).toBe(true)
  })

  it('external 后续 abort 时联动 local', () => {
    const ext = new AbortController()
    const h = createAbort()
    linkAbort(ext.signal, h)
    expect(h.signal.aborted).toBe(false)
    ext.abort('later')
    expect(h.signal.aborted).toBe(true)
  })
})
