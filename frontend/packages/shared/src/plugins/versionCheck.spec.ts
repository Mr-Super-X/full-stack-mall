import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_INTERVAL_MS,
  createVersionPoller,
  isChunkLoadErrorMessage,
  parseVersionPayload,
  shouldEnable,
} from './versionCheck.ts'
import versionCheckPlugin from './versionCheck.ts'

/** 构造 mock fetch：返回固定 buildId 的 version.json 响应 */
const makeFetch = (buildId: string, ok = true) =>
  vi.fn(
    async () =>
      ({
        ok,
        text: async () => JSON.stringify({ buildId, builtAt: '2026-10-28T00:00:00.000Z' }),
      }) as unknown as Response
  )

/** 构造最小 mock App：install 的 teardown 挂 app.onUnmount（R2-E6），空对象会 TypeError */
const makeApp = () => ({ onUnmount: vi.fn() }) as unknown as App

describe('versionCheck — shouldEnable（dev 默认禁用 + prod 无回调不启动裁决）', () => {
  it('DEV=true 缺省不启用（HMR 即热更新）', () => {
    expect(shouldEnable(true, undefined)).toBe(false)
  })

  it('DEV=true + enabled:true 强制启用（dev 调试路径）', () => {
    expect(shouldEnable(true, { enabled: true })).toBe(true)
  })

  it('DEV=false 缺省且无 onUpdate 不启用（无人消费的信号不采集，/autoplan R2-CEO-3）', () => {
    expect(shouldEnable(false, undefined)).toBe(false)
    expect(shouldEnable(false, {})).toBe(false)
  })

  it('DEV=false + onUpdate 注入即启用（注入回调 = 启用信号）', () => {
    expect(shouldEnable(false, { onUpdate: () => {} })).toBe(true)
  })

  it('DEV=false + enabled:true 无回调也强制启用（显式优先，调试/自建采集）', () => {
    expect(shouldEnable(false, { enabled: true })).toBe(true)
  })

  it('enabled:false 任何环境禁用', () => {
    expect(shouldEnable(false, { enabled: false, onUpdate: () => {} })).toBe(false)
  })
})

describe('versionCheck — isChunkLoadErrorMessage（4 种浏览器 message 形态）', () => {
  it.each([
    ['ChunkLoadError（webpack 风格）', 'ChunkLoadError: Loading chunk 123 failed'],
    [
      'Failed to fetch dynamically imported module（vite/原生 ESM）',
      'TypeError: Failed to fetch dynamically imported module: https://x/js/index-a.js',
    ],
    ['Importing a module script failed（Safari）', 'Importing a module script failed.'],
    [
      'error loading dynamically imported module（Firefox）',
      'error loading dynamically imported module: ./js/index-b.js',
    ],
  ])('匹配 %s', (_label, msg) => {
    expect(isChunkLoadErrorMessage(msg)).toBe(true)
  })

  it('不匹配普通错误（不误报）', () => {
    expect(isChunkLoadErrorMessage('TypeError: Cannot read properties of undefined')).toBe(false)
    expect(isChunkLoadErrorMessage('')).toBe(false)
  })
})

describe('versionCheck — parseVersionPayload', () => {
  it('合法载荷返回 buildId', () => {
    expect(parseVersionPayload('{"buildId":"abc","builtAt":"2026-10-28T00:00:00Z"}')).toBe('abc')
  })

  it('JSON 非法返回 null（静默跳过）', () => {
    expect(parseVersionPayload('not-json')).toBeNull()
  })

  it('缺 buildId 字段返回 null', () => {
    expect(parseVersionPayload('{"builtAt":"2026-10-28T00:00:00Z"}')).toBeNull()
  })

  it('buildId 非字符串返回 null', () => {
    expect(parseVersionPayload('{"buildId":123}')).toBeNull()
  })
})

describe('versionCheck — createVersionPoller（fake timers）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makePoller = (buildId: string, onUpdate = vi.fn()) => {
    const fetchImpl = makeFetch(buildId)
    const poller = createVersionPoller({
      path: '/admin/version.json',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate,
      fetchImpl,
    })
    return { poller, fetchImpl, onUpdate }
  }

  it('首次 poll 建立基线，不调 onUpdate', async () => {
    const { poller, onUpdate } = makePoller('v1')
    await poller.pollOnce()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(poller.getBaseline()).toBe('v1')
  })

  it('基线相同不调；buildId 变化触发 onUpdate（source=poll，基线同步更新）', async () => {
    const onUpdate = vi.fn()
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate,
      fetchImpl,
    })
    await poller.pollOnce()
    await poller.pollOnce()
    expect(onUpdate).not.toHaveBeenCalled()

    fetchImpl.mockImplementation(
      async () =>
        ({
          ok: true,
          text: async () => JSON.stringify({ buildId: 'v2' }),
        }) as unknown as Response
    )
    await poller.pollOnce()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ oldId: 'v1', newId: 'v2', source: 'poll' })
    expect(poller.getBaseline()).toBe('v2')

    // 基线已更新：同 newId 不再触发
    await poller.pollOnce()
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('start 后定时器按 intervalMs 自动轮询', async () => {
    const { poller, fetchImpl } = makePoller('v1')
    poller.start()
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('自定义 intervalMs 生效', async () => {
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: 1000,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('fetch reject 静默不抛（网络抖动等下一轮）', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await expect(poller.pollOnce()).resolves.toBeUndefined()
  })

  it('res.ok=false 静默跳过（404 等）', async () => {
    const fetchImpl = makeFetch('v1', false)
    const p2 = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await p2.pollOnce()
    expect(p2.getBaseline()).toBeNull()
  })

  it('请求带 cache:no-store 与 cache-busting query（防 gh-pages CDN 缓存）', async () => {
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/admin/version.json',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await poller.pollOnce()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('/admin/version.json?_t=')).toBe(true)
    expect(init.cache).toBe('no-store')
  })

  it('stop 后定时器不再触发', async () => {
    const { poller, fetchImpl } = makePoller('v1')
    poller.start()
    poller.stop()
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('versionCheck — install 装配', () => {
  it('DEV 缺省不启动轮询（advance 后 fetch 未调）', async () => {
    vi.useFakeTimers()
    const fetchImpl = makeFetch('v1')
    vi.stubGlobal('fetch', fetchImpl)
    // vitest 下 import.meta.env.DEV === true，等价于 dev 缺省路径
    versionCheckPlugin.install(makeApp(), { path: '/admin/version.json', intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('enabled:true 启动 + install 立即采基线一次', async () => {
    vi.useFakeTimers()
    const fetchImpl = makeFetch('v1')
    vi.stubGlobal('fetch', fetchImpl)
    const onUpdate = vi.fn()
    versionCheckPlugin.install(makeApp(), {
      path: '/admin/version.json',
      intervalMs: 1000,
      enabled: true,
      onUpdate,
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // 基线已建：同 buildId 的下一轮不触发
    await vi.advanceTimersByTimeAsync(1000)
    expect(onUpdate).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('chunk-error 兜底：ErrorEvent 匹配 4 形态之一时触发 onChunkError', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install(makeApp(), { enabled: true, onChunkError })
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'ChunkLoadError: Loading chunk 9 failed' })
    )
    expect(onChunkError).toHaveBeenCalledTimes(1)
    expect(onChunkError.mock.calls[0]![0]).toBeInstanceOf(Error)
  })

  it('chunk-error 兜底：普通错误不误报', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install(makeApp(), { enabled: true, onChunkError })
    window.dispatchEvent(new ErrorEvent('error', { message: 'TypeError: unrelated' }))
    expect(onChunkError).not.toHaveBeenCalled()
  })

  it('unhandledrejection：reason 为 chunk 加载失败 Error 时触发', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install(makeApp(), { enabled: true, onChunkError })
    const err = new Error('Failed to fetch dynamically imported module: ./js/x.js')
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', { reason: err, promise: Promise.resolve() })
    )
    expect(onChunkError).toHaveBeenCalledTimes(1)
  })

  it('onChunkError 缺省回落 onUpdate（source=chunk-error，id 为 null）', () => {
    const onUpdate = vi.fn()
    versionCheckPlugin.install(makeApp(), { enabled: true, onUpdate })
    window.dispatchEvent(new ErrorEvent('error', { message: 'ChunkLoadError: failed' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({
      oldId: null,
      newId: null,
      source: 'chunk-error',
    })
  })

  // T1（2026-10-29 /autoplan Round 3 R3-E3 回归网）：R2 缺省关曾拦截整个 install，
  // 5/6 app 的 chunk-error 兜底随轮询一起失效（R3-F3）。若未来有人把兜底塞回
  // shouldEnable 分支，本用例变红。
  it('缺省禁用轮询时 chunk-error 兜底仍装配（被动兜底不受 shouldEnable 约束）', async () => {
    vi.useFakeTimers()
    const fetchImpl = makeFetch('v1')
    vi.stubGlobal('fetch', fetchImpl)
    const onChunkError = vi.fn()
    // 缺省无 enabled / onUpdate = 轮询禁用路径（dev 缺省或 prod 无消费方同态）
    versionCheckPlugin.install(makeApp(), { path: '/admin/version.json', onChunkError })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchImpl).not.toHaveBeenCalled() // 轮询仍禁用（R2-CEO-3 语义保持）
    window.dispatchEvent(new ErrorEvent('error', { message: 'ChunkLoadError: failed' }))
    expect(onChunkError).toHaveBeenCalledTimes(1) // 兜底无条件装配
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
