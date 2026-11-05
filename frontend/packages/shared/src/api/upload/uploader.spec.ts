/**
 * createUploader 状态机与编排语义：全链路迁移、断点续传幂等、暂停/取消、失败不中断、重入守卫。
 *
 * adapter 用内存假实现（模拟服务端已收分片与失败注入）；hasher 恒注入，避开 WebCrypto 依赖。
 */
import { describe, expect, it, vi } from 'vitest'
import { createUploader, UploadCancelledError, UploadPausedError } from './uploader'
import type { UploadAdapter, UploadedPartMeta } from './types'

interface FakeAdapterOpts {
  /** 第一次 init 返回的「服务端已收分片」 */
  initUploaded?: UploadedPartMeta[]
  /** 重试也必然失败的分片编号 */
  failParts?: number[]
  /** uploadPart 挂起闸门（pause/cancel 测试用）：传入 deferred，由测试控制放行 */
  gate?: { promise: Promise<void> }
  /** init 挂起闸门：race signal——abort 时以普通 Error reject（模拟 axios 1.18 取消形态：
   *  CanceledError 不透传 UploadPausedError，引擎须经 ctrl.signal.reason 回判终态） */
  initGate?: { promise: Promise<void> }
  /** complete 挂起闸门（同 initGate 语义） */
  completeGate?: { promise: Promise<void> }
}

/** 模拟 axios 的 signal 响应：外部放行或 abort 任一先到即 settle（aborted 形态为普通 Error） */
function raceSignal(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return promise
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }),
  ])
}

function createFakeAdapter(opts: FakeAdapterOpts = {}) {
  const calls = { init: 0, uploadPart: [] as number[], complete: 0, abort: 0 }
  const adapter: UploadAdapter = {
    async init(_input, signal) {
      calls.init += 1
      await raceSignal(opts.initGate?.promise ?? Promise.resolve(), signal)
      return { uploadId: 'fake-upload-id', uploadedParts: [...(opts.initUploaded ?? [])] }
    },
    async uploadPart(_uploadId, chunk, meta, ctx) {
      calls.uploadPart.push(meta.partNumber)
      // gate 挂在非首片：首片立即完成——测试可构造「部分完成 + 后续挂起」的时序
      if (opts.gate && meta.partNumber > 0) {
        await opts.gate.promise
      }
      ctx.onProgress?.(chunk.size)
      if (opts.failParts?.includes(meta.partNumber)) {
        throw new Error(`part ${meta.partNumber} failed`)
      }
      return { partNumber: meta.partNumber, etag: `etag-${meta.partNumber}` }
    },
    async complete(_uploadId, parts, signal) {
      calls.complete += 1
      await raceSignal(opts.completeGate?.promise ?? Promise.resolve(), signal)
      return {
        fileUrl: '/files/fake-upload-id/bin',
        fileId: 'fake-upload-id',
        size: parts.length,
      }
    },
    async abort() {
      calls.abort += 1
    },
  }
  return { adapter, calls }
}

/** 11 字节文件按 4 字节切片 = 3 片（4/4/3） */
const makeFile = () => new File(['x'.repeat(11)], 't.bin', { type: 'application/octet-stream' })
const fastHasher = () => Promise.resolve('fake-hash')

describe('createUploader', () => {
  it('全链路：hashing→checking→uploading→merging→done，终态 fileUrl 就位', async () => {
    const { adapter, calls } = createFakeAdapter()
    const uploader = createUploader({
      adapter,
      chunkSize: 4,
      hashFile: fastHasher,
    })
    const states: string[] = []
    uploader.subscribe((s) => states.push(s.state))

    const result = await uploader.upload(makeFile())

    expect(result.fileUrl).toBe('/files/fake-upload-id/bin')
    expect(calls.uploadPart).toEqual([0, 1, 2])
    expect(calls.complete).toBe(1)
    const snap = uploader.snapshot()
    expect(snap.state).toBe('done')
    expect(snap.progress).toBe(1)
    expect(snap.doneParts).toEqual([0, 1, 2])
    expect(snap.fileHash).toBe('fake-hash')
    // 状态序列含全阶段（emit 粒度下允许多次同名，断言相对顺序）
    expect(states).toContain('hashing')
    expect(states.indexOf('checking')).toBeGreaterThan(states.indexOf('hashing'))
    expect(states.indexOf('uploading')).toBeGreaterThan(states.indexOf('checking'))
    expect(states.indexOf('merging')).toBeGreaterThan(states.indexOf('uploading'))
    expect(states[states.length - 1]).toBe('done')
  })

  it('断点续传：init 返回已收分片时只传缺失', async () => {
    const { adapter, calls } = createFakeAdapter({
      initUploaded: [
        { partNumber: 0, etag: 'etag-0' },
        { partNumber: 2, etag: 'etag-2' },
      ],
    })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    await uploader.upload(makeFile())

    expect(calls.uploadPart).toEqual([1])
    expect(uploader.snapshot().doneParts).toEqual([0, 1, 2])
  })

  it('complete 收到全部分片 meta（含服务端已收）且按编号升序', async () => {
    const received: UploadedPartMeta[][] = []
    const { adapter } = createFakeAdapter({
      initUploaded: [{ partNumber: 2, etag: 'etag-2' }],
    })
    const spyAdapter: UploadAdapter = {
      ...adapter,
      complete: async (id, parts) => {
        received.push([...parts])
        return adapter.complete(id, parts)
      },
    }
    const uploader = createUploader({ adapter: spyAdapter, chunkSize: 4, hashFile: fastHasher })

    await uploader.upload(makeFile())

    expect(received[0]).toEqual([
      { partNumber: 0, etag: 'etag-0' },
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
    ])
  })

  it('失败不中断：重试耗尽的分片记 failedParts，其余完成，整体 error', async () => {
    const { adapter, calls } = createFakeAdapter({ failParts: [1] })
    const uploader = createUploader({ adapter, chunkSize: 4, partRetry: 0, hashFile: fastHasher })

    await expect(uploader.upload(makeFile())).rejects.toThrow('1 个分片重试耗尽')
    const snap = uploader.snapshot()
    expect(snap.state).toBe('error')
    expect(snap.failedParts).toEqual([1])
    expect(snap.doneParts).toEqual([0, 2])
    expect(calls.complete).toBe(0) // 未进入合并
  })

  it('error 后重跑即续传：第二次 init 返回已收分片，只补失败分片', async () => {
    let round = 0
    let stored: UploadedPartMeta[] = []
    const adapter: UploadAdapter = {
      async init() {
        round += 1
        return { uploadId: 'fake-upload-id', uploadedParts: [...stored] }
      },
      async uploadPart(_id, _chunk, meta) {
        if (round === 1 && meta.partNumber === 1) throw new Error('part 1 failed')
        stored = [
          ...stored.filter((p) => p.partNumber !== meta.partNumber),
          { partNumber: meta.partNumber, etag: `etag-${meta.partNumber}` },
        ]
        return { partNumber: meta.partNumber, etag: `etag-${meta.partNumber}` }
      },
      async complete(_id, parts) {
        return {
          fileUrl: '/files/fake-upload-id/bin',
          fileId: 'fake-upload-id',
          size: parts.length,
        }
      },
      async abort() {},
    }
    const uploader = createUploader({ adapter, chunkSize: 4, partRetry: 0, hashFile: fastHasher })

    await expect(uploader.upload(makeFile())).rejects.toThrow('重试耗尽')
    const result = await uploader.upload(makeFile())

    expect(result.fileUrl).toBe('/files/fake-upload-id/bin')
    expect(uploader.snapshot().state).toBe('done')
  })

  it('pause：中止在途分片，状态 paused，不触碰服务端 abort', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const { adapter, calls } = createFakeAdapter({ gate: { promise: gate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    // 等分片进入在途（init 完成后）
    await vi.waitFor(() => {
      expect(uploader.snapshot().state).toBe('uploading')
    })
    uploader.pause()
    release()
    await expect(run).rejects.toBeInstanceOf(UploadPausedError)
    expect(uploader.snapshot().state).toBe('paused')
    expect(calls.abort).toBe(0) // 暂停不清理服务端，可续传
  })

  it('cancel：中止在途分片 + 通知服务端清理，状态 cancelled', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const { adapter, calls } = createFakeAdapter({ gate: { promise: gate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => {
      expect(uploader.snapshot().state).toBe('uploading')
    })
    const cancelPromise = uploader.cancel()
    release()
    await expect(run).rejects.toBeInstanceOf(UploadCancelledError)
    await cancelPromise
    expect(uploader.snapshot().state).toBe('cancelled')
    expect(calls.abort).toBe(1)
  })

  it('运行期间重入守卫：第二次 upload 直接抛错', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const { adapter } = createFakeAdapter({ gate: { promise: gate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => {
      expect(uploader.snapshot().state).toBe('uploading')
    })
    expect(() => uploader.upload(makeFile())).toThrow('上传进行中')
    release()
    await run.catch(() => {})
  })

  it('idle 态 cancel：直接落 cancelled（无在途请求）', async () => {
    const { adapter } = createFakeAdapter()
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })
    await uploader.cancel()
    expect(uploader.snapshot().state).toBe('cancelled')
  })

  it('init 在途 pause：axios 取消形态（reason 不透传）经 ctrl.signal.reason 回判落 paused', async () => {
    let release!: () => void
    const initGate = new Promise<void>((res) => (release = res))
    const { adapter, calls } = createFakeAdapter({ initGate: { promise: initGate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('checking'))
    uploader.pause()
    release()
    await expect(run).rejects.toThrow('aborted')
    expect(uploader.snapshot().state).toBe('paused')
    expect(calls.abort).toBe(0) // 暂停不清理服务端
  })

  it('init 在途 cancel：落 cancelled（init 未完成无 uploadId，无服务端可清理）', async () => {
    let release!: () => void
    const initGate = new Promise<void>((res) => (release = res))
    const { adapter, calls } = createFakeAdapter({ initGate: { promise: initGate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('checking'))
    const cancelPromise = uploader.cancel()
    release()
    await expect(run).rejects.toThrow('aborted')
    await cancelPromise
    expect(uploader.snapshot().state).toBe('cancelled')
    expect(calls.abort).toBe(0) // uploadId 尚未建立，cleanupRemote 空转
  })

  it('complete 在途 cancel：落 cancelled 且补做服务端清理（uploadId 已就位）', async () => {
    let release!: () => void
    const completeGate = new Promise<void>((res) => (release = res))
    const { adapter, calls } = createFakeAdapter({ completeGate: { promise: completeGate } })
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('merging'))
    const cancelPromise = uploader.cancel()
    release()
    await expect(run).rejects.toThrow('aborted')
    await cancelPromise
    expect(uploader.snapshot().state).toBe('cancelled')
    expect(calls.abort).toBe(1)
  })

  it('paused 进度不回退（tracker 保留已传字节）；paused 后 cancel 补清理服务端', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    // concurrency=1：part0 完成（4/11 字节），part1 挂起在途
    const { adapter, calls } = createFakeAdapter({ gate: { promise: gate } })
    const uploader = createUploader({ adapter, chunkSize: 4, concurrency: 1, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().doneParts).toEqual([0]))
    uploader.pause()
    release()
    await expect(run).rejects.toBeInstanceOf(UploadPausedError)

    const pausedSnap = uploader.snapshot()
    expect(pausedSnap.state).toBe('paused')
    // part0 完成于暂停前（4B），part1 是「已领取任务跑完」的取消语义（再 +4B）：
    // 8/11——核心防回归是不回退 stageProgress（worker hasher 场景会错显 100%）
    expect(pausedSnap.progress).toBeCloseTo(8 / 11, 2)

    await uploader.cancel()
    expect(uploader.snapshot().state).toBe('cancelled')
    expect(calls.abort).toBe(1)
  })

  it('cancel 对 done 态无效：fileUrl 已交付，不翻 cancelled、不触碰服务端', async () => {
    const { adapter, calls } = createFakeAdapter()
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })
    await uploader.upload(makeFile())

    await uploader.cancel()
    expect(uploader.snapshot().state).toBe('done')
    expect(calls.abort).toBe(0)
  })

  it('fractional chunkSize 归一：init 协议值与切片边界共用 floor 值', async () => {
    let receivedChunkSize = 0
    const { adapter } = createFakeAdapter()
    const spyAdapter: UploadAdapter = {
      ...adapter,
      init: (input) => {
        receivedChunkSize = input.chunkSize
        return adapter.init(input)
      },
    }
    const uploader = createUploader({ adapter: spyAdapter, chunkSize: 4.9, hashFile: fastHasher })
    await uploader.upload(makeFile())
    expect(receivedChunkSize).toBe(4) // 4.9 → floor 4，与 planChunks 切片边界一致
  })

  it('续传进度补偿：服务端已收分片的字节计入 tracker，进度从断点续起', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const { adapter } = createFakeAdapter({
      initUploaded: [
        { partNumber: 0, etag: 'etag-0' },
        { partNumber: 1, etag: 'etag-1' },
      ],
      gate: { promise: gate }, // 挂住缺失的 part2，冻结在 uploading 态观察进度
    })
    const uploader = createUploader({ adapter, chunkSize: 4, concurrency: 1, hashFile: fastHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('uploading'))
    // part0(4B) + part1(4B) 已补偿，part2 在途 0 → 8/11，而非从 0 重涨
    expect(uploader.snapshot().progress).toBeCloseTo(8 / 11, 2)
    release()
    await run
    expect(uploader.snapshot().progress).toBe(1)
  })

  it('hashing 阶段进度实时；进入 checking 时 stageProgress 归零（不残留 100%）', async () => {
    let releaseHash!: () => void
    const hashGate = new Promise<void>((res) => (releaseHash = res))
    let releaseInit!: () => void
    const initGate = new Promise<void>((res) => (releaseInit = res))
    const { adapter } = createFakeAdapter({ initGate: { promise: initGate } })
    const gatedHasher = async (
      _file: File,
      ctx: { signal: AbortSignal; onProgress?: (loaded: number, total: number) => void }
    ): Promise<string> => {
      ctx.onProgress?.(5, 10)
      await hashGate
      return 'fake-hash'
    }
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: gatedHasher })

    const run = uploader.upload(makeFile())
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('hashing'))
    expect(uploader.snapshot().progress).toBeCloseTo(0.5)

    releaseHash()
    await vi.waitFor(() => expect(uploader.snapshot().state).toBe('checking'))
    expect(uploader.snapshot().progress).toBe(0) // 归零下 checking，而非残留 hashing 末帧 100%
    releaseInit()
    await run
  })

  it('listener 异常隔离：抛错的订阅者不打断上传，其余订阅者照常收到快照', async () => {
    const { adapter } = createFakeAdapter()
    const uploader = createUploader({ adapter, chunkSize: 4, hashFile: fastHasher })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const healthyListener = vi.fn()

    uploader.subscribe(() => {
      throw new Error('listener bug')
    })
    uploader.subscribe(healthyListener)

    await uploader.upload(makeFile())
    const doneSnaps = healthyListener.mock.calls.filter(
      (c) => (c[0] as { state: string }).state === 'done'
    )
    expect(doneSnaps.length).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('subscribe 回调异常'),
      expect.any(Error)
    )
    errorSpy.mockRestore()
  })

  it('空文件（fileSize=0）init 被拒时 error 态进度恒 0（tracker 空任务恒 1 不外泄）', async () => {
    const rejectingAdapter: UploadAdapter = {
      async init() {
        throw new Error('fileSize 必须为正数')
      },
      async uploadPart() {
        throw new Error('unreachable')
      },
      async complete() {
        throw new Error('unreachable')
      },
      async abort() {},
    }
    const uploader = createUploader({
      adapter: rejectingAdapter,
      chunkSize: 4,
      hashFile: fastHasher,
    })

    await expect(uploader.upload(new File([], 'empty.bin'))).rejects.toThrow('fileSize')
    const snap = uploader.snapshot()
    expect(snap.state).toBe('error')
    expect(snap.progress).toBe(0)
  })
})
