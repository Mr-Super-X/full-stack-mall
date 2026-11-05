import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mergeKey, shouldMerge, withMerge, _resetMerger } from './request-merger'
import type { MergeableConfig } from './request-merger'

describe('mergeKey', () => {
  it('不同 url 视为不同 key', () => {
    expect(mergeKey({ url: '/a', method: 'get' })).not.toBe(mergeKey({ url: '/b', method: 'get' }))
  })

  it('method 默认补 get', () => {
    expect(mergeKey({ url: '/a' })).toBe('get|/a||')
  })

  it('params 字段顺序无关（排序后哈希）', () => {
    expect(mergeKey({ url: '/a', method: 'get', params: { b: 2, a: 1 } })).toBe(
      mergeKey({ url: '/a', method: 'get', params: { a: 1, b: 2 } })
    )
  })

  it('data 也参与 key', () => {
    expect(mergeKey({ url: '/a', method: 'post', data: { x: 1 } })).not.toBe(
      mergeKey({ url: '/a', method: 'post' })
    )
  })

  it('Date 按时间戳参与 key：不同时间范围查询不被错误合并', () => {
    const keyA = mergeKey({ url: '/a', method: 'get', params: { start: new Date('2026-01-01') } })
    const keyB = mergeKey({ url: '/a', method: 'get', params: { start: new Date('2026-06-01') } })
    expect(keyA).not.toBeNull()
    expect(keyA).not.toBe(keyB)
  })

  it('FormData 负载返回 null：退化为不合并（错合并风险 > 漏合并损失）', () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x']))
    expect(mergeKey({ url: '/a', method: 'post', data: fd })).toBeNull()
  })

  it('循环引用返回 null：不合并且不向调用方抛错', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(mergeKey({ url: '/a', method: 'get', params: cyclic })).toBeNull()
  })
})

describe('shouldMerge', () => {
  it('默认只对 GET/HEAD 合并', () => {
    expect(shouldMerge({ url: '/a', method: 'get' })).toBe(50)
    expect(shouldMerge({ url: '/a', method: 'head' })).toBe(50)
    expect(shouldMerge({ url: '/a', method: 'post' })).toBe(0)
    expect(shouldMerge({ url: '/a', method: 'put' })).toBe(0)
    expect(shouldMerge({ url: '/a', method: 'patch' })).toBe(0)
    expect(shouldMerge({ url: '/a', method: 'delete' })).toBe(0)
  })

  it("merge: 'never' 强制关闭", () => {
    expect(shouldMerge({ url: '/a', method: 'get', merge: 'never' })).toBe(0)
  })

  it('merge: number 覆盖窗口时长', () => {
    expect(shouldMerge({ url: '/a', method: 'post', merge: 100 })).toBe(100)
  })
})

describe('withMerge', () => {
  beforeEach(() => _resetMerger())

  it('窗口内同参 GET 只发一次', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = withMerge(fn)
    const cfg = { url: '/a', method: 'get' }

    const [r1, r2, r3] = await Promise.all([wrapped(cfg), wrapped(cfg), wrapped(cfg)])

    expect(fn).toHaveBeenCalledTimes(1)
    expect(r1).toEqual({ ok: true })
    expect(r2).toEqual({ ok: true })
    expect(r3).toEqual({ ok: true })
  })

  it('POST 默认不合并（写请求安全）', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = withMerge(fn)

    await Promise.all([
      wrapped({ url: '/a', method: 'post', data: { x: 1 } }),
      wrapped({ url: '/a', method: 'post', data: { x: 1 } }),
    ])

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('窗口过后重新发起', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = withMerge(fn, { windowMs: 10 })
    const cfg = { url: '/a', method: 'get' }

    await wrapped(cfg)
    // advance timers past the cleanup delay
    vi.advanceTimersByTime(20)
    await wrapped(cfg)

    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('失败时所有等待方都收到同一个 rejection', async () => {
    const err = new Error('boom')
    const fn = vi.fn().mockRejectedValue(err)
    const wrapped = withMerge(fn)
    const cfg = { url: '/a', method: 'get' }

    const results = await Promise.allSettled([wrapped(cfg), wrapped(cfg)])

    expect(fn).toHaveBeenCalledTimes(1)
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('rejected')
    expect((results[0] as PromiseRejectedResult).reason).toBe(err)
  })

  it('settle 后窗口内同 key 失败结果被共享（缓存失败语义锁定）', async () => {
    const err = new Error('first-boom')
    const fn = vi.fn().mockRejectedValue(err)
    const wrapped = withMerge(fn, { windowMs: 50 })
    const cfg = { url: '/a', method: 'get' }

    // 第一波失败并已 settle
    await expect(wrapped(cfg)).rejects.toBe(err)
    // 窗口内（清理定时器未触发）第二波共享同一 rejection，不再发请求
    await expect(wrapped(cfg)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('调用方自传的 signal 被链接保留：abort 时底层请求同步收到取消', async () => {
    // 永不 settle 的底层请求，便于观测 signal 状态
    const fn = vi.fn((_cfg: MergeableConfig) => new Promise<{ ok: boolean }>(() => {}))
    const wrapped = withMerge(fn)
    const ctrl = new AbortController()

    const pending = wrapped({ url: '/a', method: 'get', signal: ctrl.signal })
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
    const receivedSignal = fn.mock.calls[0]?.[0]?.signal
    expect(receivedSignal?.aborted).toBe(false)

    ctrl.abort()
    // 修复前调用方 signal 被 controller.signal 覆盖，此处恒为 false
    expect(receivedSignal?.aborted).toBe(true)
    pending.catch(() => {})
  })
})
