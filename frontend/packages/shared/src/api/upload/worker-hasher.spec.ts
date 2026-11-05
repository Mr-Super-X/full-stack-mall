/**
 * createWorkerHasher：Worker 生命周期三路径（done / error / abort）+ 进度转发 + 构造参数。
 *
 * jsdom 无 Worker 实现：stub 全局 Worker 类（捕获实例供测试派发消息 / 断言 terminate），
 * 每个用例后恢复原始全局。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkerHasher } from './worker-hasher'
import type { HashWorkerOutMessage } from './hash.worker'

class FakeWorker {
  static last: FakeWorker | null = null
  onmessage: ((e: MessageEvent<HashWorkerOutMessage>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  terminated = false
  readonly posted: unknown[] = []

  constructor(
    public readonly url: URL,
    public readonly options: WorkerOptions
  ) {
    FakeWorker.last = this
  }

  postMessage(msg: unknown): void {
    this.posted.push(msg)
  }

  terminate(): void {
    this.terminated = true
  }

  /** 测试驱动：模拟 worker 向消费方回发消息 */
  emit(msg: HashWorkerOutMessage): void {
    this.onmessage?.({ data: msg } as MessageEvent<HashWorkerOutMessage>)
  }
}

const originalWorker = globalThis.Worker

afterEach(() => {
  globalThis.Worker = originalWorker
  FakeWorker.last = null
})

const makeFile = () => new File(['abc'], 't.bin')

describe('createWorkerHasher', () => {
  it('done：progress 转发后 resolve 哈希，terminate 并摘掉 abort 监听', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const ctrl = new AbortController()
    const onProgress = vi.fn()
    const promise = createWorkerHasher()(makeFile(), {
      signal: ctrl.signal,
      onProgress,
    })

    const worker = FakeWorker.last!
    worker.emit({ type: 'progress', loaded: 1, total: 3 })
    expect(onProgress).toHaveBeenCalledWith(1, 3)

    worker.emit({ type: 'done', hash: 'deadbeef' })
    await expect(promise).resolves.toBe('deadbeef')
    expect(worker.terminated).toBe(true)

    // abort 监听已随 cleanup 移除：事后 abort 不影响已 settle 的 promise
    ctrl.abort()
  })

  it('error 消息：reject 且 terminate（生命周期兜底路径）', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const promise = createWorkerHasher()(makeFile(), {
      signal: new AbortController().signal,
    })

    FakeWorker.last!.emit({ type: 'error', message: 'digest failed' })
    await expect(promise).rejects.toThrow('digest failed')
    expect(FakeWorker.last!.terminated).toBe(true)
  })

  it('abort：reject signal.reason（引擎据此区分 pause/cancel 终态）并 terminate', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const ctrl = new AbortController()
    const promise = createWorkerHasher()(makeFile(), { signal: ctrl.signal })

    const worker = FakeWorker.last!
    ctrl.abort(new Error('用户取消'))
    await expect(promise).rejects.toThrow('用户取消')
    expect(worker.terminated).toBe(true)
  })

  it('传入时已 aborted：预检立即 reject 不悬挂（与 defaultFileHasher 的 throwIfAborted 对称）', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const ctrl = new AbortController()
    ctrl.abort(new Error('already aborted'))

    await expect(createWorkerHasher()(makeFile(), { signal: ctrl.signal })).rejects.toThrow(
      'already aborted'
    )
    // 预检路径同样 terminate 新建的 worker（onAbort → cleanup）
    expect(FakeWorker.last!.terminated).toBe(true)
  })

  it('构造参数：module 类型 + 同目录 worker 入口 URL（vite 构建期打包约定）', () => {
    vi.stubGlobal('Worker', FakeWorker)
    createWorkerHasher()(makeFile(), { signal: new AbortController().signal })

    expect(FakeWorker.last!.options.type).toBe('module')
    expect(String(FakeWorker.last!.url)).toContain('hash.worker')
  })
})
