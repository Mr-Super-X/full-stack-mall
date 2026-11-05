/**
 * 分片上传编排引擎（状态机）：hash → init → 并发传缺失分片 → complete。
 *
 * 状态迁移：
 * ```
 * idle ──upload()──▶ hashing ──▶ checking ──▶ uploading ──▶ merging ──▶ done
 *                      │            │             │            │
 *                      └─error      └─error       ├─error（分片重试耗尽，failedParts 保因）
 *                                                 ├─paused（pause()：在途中止，服务端保留）
 *                                                 └─cancelled（cancel()：在途中止 + 服务端清理）
 * paused / error ──upload()──▶ hashing（重跑即续传：init 幂等，已收分片自动跳过）
 * ```
 *
 * 设计要点：
 * - 幂等重跑：upload(file) 在 paused / error 后重入安全——服务端 init 按 fileHash 复用
 *   session 并回已收分片，缺失集 = 全集 − 已收；并集去重（Map by partNumber）防竞态双写
 * - 取消语义：内部 AbortController，pause 与 cancel 共用——区别在 abort reason，
 *   catch 里按 reason 类型落终态（UploadPausedError / UploadCancelledError）；
 *   在途分片请求的 signal 透传 adapter，axios 层立即 ERR_CANCELED
 * - 失败不中断：分片走 runConcurrent（单分片失败记 rejected 保因，队列继续）；
 *   全部 settle 后仍有 rejected → error 态 + failedParts，页面可再次 upload() 只补缺
 * - 运行期间重入守卫：activeRun 非 null 时 upload() 直接抛错
 *
 * @group 网络基建：分片上传
 */

import { runConcurrent } from '../concurrent'
import { defaultFileHasher } from './hash'
import { DEFAULT_CHUNK_SIZE, normalizeChunkSize, planChunks } from './chunk'
import { UploadProgressTracker } from './progress'
import type {
  CompleteUploadResult,
  Uploader,
  UploaderConfig,
  UploaderListener,
  UploaderSnapshot,
  UploadedPartMeta,
  UploadAdapter,
  UploadState,
  ChunkPlan,
} from './types'

/** 暂停信号：abort reason 透传（runConcurrent 的 toAbortError 对 Error 实例原样透传） */
export class UploadPausedError extends Error {
  constructor() {
    super('上传已暂停')
    this.name = 'UploadPausedError'
  }
}

/** 取消信号：abort reason 透传给引擎 catch 分支 */
export class UploadCancelledError extends Error {
  constructor() {
    super('上传已取消')
    this.name = 'UploadCancelledError'
  }
}

/** 内部可变运行态（snapshot 每次 emit 时从这里派生不可变副本） */
interface RuntimeState {
  state: UploadState
  uploadId: string | null
  fileHash: string | null
  fileName: string | null
  fileSize: number
  totalChunks: number
  chunkPlan: ChunkPlan[]
  /** 已确认完成的分片编号（服务端已收 ∪ 本轮成功） */
  doneParts: Set<number>
  /** 全部分片 meta（含服务端已收），按 partNumber 去重，complete 时升序输出 */
  partMetas: Map<number, string>
  failedParts: number[]
  fileUrl: string | null
  error: string | null
  /** hashing 阶段进度（0~1）；uploading 阶段改由 tracker 计算 */
  stageProgress: number
}

/** 归一 error 文案：ApiError / Error / 未知形态统一为可展示字符串 */
function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 按 partNumber 升序展开 meta 表 → complete 入参 */
function sortedMetas(partMetas: ReadonlyMap<number, string>): UploadedPartMeta[] {
  return [...partMetas.entries()]
    .map(([partNumber, etag]) => ({ partNumber, etag }))
    .sort((a, b) => a.partNumber - b.partNumber)
}

interface RunPartsCtx {
  adapter: UploadAdapter
  uploadId: string
  file: File
  chunkPlan: ChunkPlan[]
  totalChunks: number
  partRetry: number
  concurrency: number
  signal: AbortSignal
  tracker: UploadProgressTracker
  onTick: () => void
  /** 单分片确认完成即回调（doneParts 即时提交——分片格 UI 依赖实时性；
   *  批量等全部 settle 会让格子全程灰色直到最后一刻） */
  onPartDone: (meta: UploadedPartMeta) => void
}

interface RunPartsOutcome {
  /** 重试耗尽的分片编号（全部 settle 后一次性给出，error 态展示用） */
  failed: number[]
}

/**
 * 并发上传缺失分片：runConcurrent 闸门 + 单分片重试（retry 透传 withRetry，4xx 不重试）。
 * 覆盖式字节进度（tracker），单分片失败仅记 rejected 不中断队列。
 */
async function runMissingParts(missing: number[], ctx: RunPartsCtx): Promise<RunPartsOutcome> {
  const failed: number[] = []
  const results = await runConcurrent(
    missing,
    async (partNumber) => {
      const plan = ctx.chunkPlan[partNumber]!
      const blob = ctx.file.slice(plan.start, plan.end)
      ctx.tracker.beginPart(partNumber)
      try {
        const meta = await ctx.adapter.uploadPart(
          ctx.uploadId,
          blob,
          { partNumber, totalChunks: ctx.totalChunks },
          {
            signal: ctx.signal,
            onProgress: (loaded) => {
              ctx.tracker.setLoaded(partNumber, loaded)
              ctx.onTick()
            },
          }
        )
        ctx.tracker.markDone(partNumber, plan.size)
        ctx.onPartDone(meta)
        return meta
      } catch (err) {
        ctx.tracker.clearPart(partNumber)
        throw err
      }
    },
    {
      limit: ctx.concurrency,
      signal: ctx.signal,
      retry: ctx.partRetry,
      onProgress: ctx.onTick,
    }
  )
  results.forEach((r) => {
    if (r.status === 'rejected') failed.push(r.index)
  })
  failed.sort((a, b) => a - b)
  return { failed }
}

export function createUploader(config: UploaderConfig): Uploader {
  const adapter = config.adapter
  // 归一后使用：init 协议的 chunkSize 与 planChunks 切片边界共用同一值（fractional 配置防分裂）
  const chunkSize = normalizeChunkSize(config.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const concurrency = config.concurrency ?? 3
  const partRetry = config.partRetry ?? 2
  const hashFile = config.hashFile ?? defaultFileHasher

  const listeners = new Set<UploaderListener>()
  let activeCtrl: AbortController | null = null
  let activeRun: Promise<CompleteUploadResult> | null = null
  let tracker: UploadProgressTracker | null = null

  const state: RuntimeState = {
    state: 'idle',
    uploadId: null,
    fileHash: null,
    fileName: null,
    fileSize: 0,
    totalChunks: 0,
    chunkPlan: [],
    doneParts: new Set(),
    partMetas: new Map(),
    failedParts: [],
    fileUrl: null,
    error: null,
    stageProgress: 0,
  }

  /** 当前总进度：done/merging 恒 1；uploading/paused/error 由 tracker 字节计算
   *  （paused/error 必须保留 tracker 进度——否则上传 40% 暂停后回退 stageProgress
   *    造成进度跳变：worker hasher 恒 1 显示 100%、默认 hasher 恒 0 显示 0；
   *    空文件（fileSize=0）tracker 空任务恒 1 的防 NaN 语义不外泄——进度恒 0）；
   *  其余（idle/hashing/checking/cancelled）看阶段进度 */
  function currentProgress(): number {
    if (state.state === 'done' || state.state === 'merging') return 1
    if (state.fileSize === 0) return 0
    if (
      tracker &&
      (state.state === 'uploading' || state.state === 'paused' || state.state === 'error')
    ) {
      return tracker.progress
    }
    return state.stageProgress
  }

  function snapshot(): UploaderSnapshot {
    return {
      state: state.state,
      progress: currentProgress(),
      uploadId: state.uploadId,
      fileUrl: state.fileUrl,
      fileName: state.fileName,
      fileSize: state.fileSize,
      fileHash: state.fileHash,
      doneParts: [...state.doneParts].sort((a, b) => a - b),
      runningParts: tracker?.runningParts ?? [],
      failedParts: [...state.failedParts],
      error: state.error,
    }
  }

  function emit(): void {
    const snap = snapshot()
    // 订阅者是观察者：listener 异常不得反噬引擎（中断 onProgress 回调 / 状态推进）；
    // 响亮记录而非静默吞掉——listener 自身 bug 应在开发期暴露
    listeners.forEach((fn) => {
      try {
        fn(snap)
      } catch (err) {
        console.error('[upload] subscribe 回调异常（已隔离，不影响上传流程）', err)
      }
    })
  }

  /** 每轮 upload 起步的重置：运行态清零，保留订阅与 adapter 配置 */
  function resetForRun(file: File): void {
    state.state = 'hashing'
    state.uploadId = null
    state.fileHash = null
    state.fileName = file.name
    state.fileSize = file.size
    state.chunkPlan = planChunks(file.size, chunkSize)
    state.totalChunks = state.chunkPlan.length
    state.doneParts = new Set()
    state.partMetas = new Map()
    state.failedParts = []
    state.fileUrl = null
    state.error = null
    state.stageProgress = 0
    tracker = new UploadProgressTracker(file.size)
  }

  /** 取消收尾：尽力通知服务端清理（失败静默——cleanup 尽力而为，不影响终态） */
  async function cleanupRemote(uploadId: string | null): Promise<void> {
    if (!uploadId) return
    try {
      await adapter.abort(uploadId)
    } catch {
      /* 静默：cancel 的终态不取决于清理是否成功 */
    }
  }

  async function doUpload(file: File): Promise<CompleteUploadResult> {
    resetForRun(file)
    const ctrl = new AbortController()
    activeCtrl = ctrl
    emit()
    try {
      // 1. hashing（进度经 hasher 回调写入 stageProgress）
      state.fileHash = await hashFile(file, {
        signal: ctrl.signal,
        onProgress: (loaded, total) => {
          state.stageProgress = total > 0 ? loaded / total : 0
          emit()
        },
      })
      // hashing 阶段结束，stageProgress 语义归还——否则 checking 期间停留 100%
      state.stageProgress = 0
      emit()

      // 2. checking：init 按 fileHash 幂等——同哈希复用 session 并返回已收分片
      state.state = 'checking'
      emit()
      const init = await adapter.init(
        {
          fileName: file.name,
          fileSize: file.size,
          fileHash: state.fileHash,
          chunkSize,
          totalChunks: state.totalChunks,
        },
        ctrl.signal
      )
      state.uploadId = init.uploadId
      init.uploadedParts.forEach((p) => {
        state.doneParts.add(p.partNumber)
        state.partMetas.set(p.partNumber, p.etag)
        // 续传补偿：服务端已收分片的字节计入 tracker——否则刷新续传后进度从 0 重涨，
        // 违背「断点续传从断点续起」的进度语义
        const plan = state.chunkPlan[p.partNumber]
        if (plan) tracker!.markDone(p.partNumber, plan.size)
      })

      // 3. uploading：只传缺失分片；并发 + 单分片重试由 runConcurrent 承担
      const missing = state.chunkPlan
        .map((p) => p.partNumber)
        .filter((n) => !state.doneParts.has(n))
      state.state = 'uploading'
      emit()
      if (missing.length > 0) {
        const { failed } = await runMissingParts(missing, {
          adapter,
          uploadId: init.uploadId,
          file,
          chunkPlan: state.chunkPlan,
          totalChunks: state.totalChunks,
          partRetry,
          concurrency,
          signal: ctrl.signal,
          tracker: tracker!,
          onTick: emit,
          onPartDone: (meta) => {
            state.doneParts.add(meta.partNumber)
            state.partMetas.set(meta.partNumber, meta.etag)
          },
        })
        if (failed.length > 0) {
          state.failedParts = failed
          throw new Error(`${failed.length} 个分片重试耗尽（#${failed.join(', #')}）`)
        }
      }

      // 4. merging：全部 meta 升序提交；服务端校验齐全后合并
      state.state = 'merging'
      emit()
      const result = await adapter.complete(
        init.uploadId,
        sortedMetas(state.partMetas),
        ctrl.signal
      )
      state.fileUrl = result.fileUrl
      state.state = 'done'
      emit()
      return result
    } catch (err) {
      // 终态判定双路覆盖：引擎自身抛的 UploadPausedError（hashing 的 hasher 透传 /
      // runConcurrent 闸门）与 axios 取消形态（ApiError{canceled:true}——axios 1.18 对
      // abort 恒 reject CanceledError，不透传 signal.reason，init/complete 在途的 pause/cancel
      // 只能经 ctrl.signal.reason 回判，否则误落 error 且 cancel 漏掉服务端清理）
      const reason = ctrl.signal.reason
      if (err instanceof UploadPausedError || reason instanceof UploadPausedError) {
        state.state = 'paused'
      } else if (err instanceof UploadCancelledError || reason instanceof UploadCancelledError) {
        state.state = 'cancelled'
        await cleanupRemote(state.uploadId)
      } else {
        state.state = 'error'
        state.error = toMessage(err)
      }
      emit()
      throw err
    } finally {
      activeCtrl = null
    }
  }

  return {
    upload(file: File): Promise<CompleteUploadResult> {
      if (activeRun) throw new Error('上传进行中：请先 pause() 或 cancel()')
      // async IIFE 包住 doUpload：finally 在 promise settle 后才清 activeRun——
      // 若直接 return doUpload(file) 后接 finally，finally 会同步执行，重入守卫形同虚设
      const run = (async (): Promise<CompleteUploadResult> => {
        try {
          return await doUpload(file)
        } finally {
          activeRun = null
        }
      })()
      activeRun = run
      return run
    },
    pause(): void {
      activeCtrl?.abort(new UploadPausedError())
    },
    async cancel(): Promise<void> {
      if (activeCtrl) {
        activeCtrl.abort(new UploadCancelledError())
        await activeRun?.catch(() => {})
      } else if (state.state !== 'cancelled' && state.state !== 'done') {
        // 无在途请求：paused/error 可能仍持有 uploadId（服务端 session 未清理），
        // cancel 契约要求清理；done 已完成且 fileUrl 有效，翻 cancelled 会误导调用方
        if (state.uploadId) await cleanupRemote(state.uploadId)
        state.state = 'cancelled'
        emit()
      }
    },
    snapshot,
    subscribe(listener: UploaderListener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
