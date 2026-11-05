/**
 * 并发请求调度器（并发闸门）：worker-pool 按序消费任务队列，限制同时执行的请求数。
 *
 * 典型场景：大文件分片上传——切片数组经本调度器限流并发，避免一次性铺开拖垮带宽/服务端。
 *
 * 设计要点：
 * - worker-pool 模型：启动 min(limit, 任务数) 个 worker 按索引顺序领取任务，
 *   任务启动顺序与输入顺序一致，结果数组按输入索引保序返回
 * - 失败不中断：单任务失败（含重试耗尽）记录为 rejected，其余任务继续；
 *   调用方按 index 检查 status 决定补救策略（坏分片单独重传等）
 * - 取消语义：`signal` 触发后关闭闸门——未领取的任务不再执行，整体 reject；
 *   已领取的任务是否中断由其内部是否响应该 signal 决定（调度器不代劳）
 * - 重试复用 withRetry（默认策略：4xx 不重试，网络/5xx/超时才重试）
 *
 * 用法（分片上传）：
 *   const results = await runConcurrent(chunks, (chunk) => uploadChunk(chunk), {
 *     limit: 3,
 *     retry: 2,
 *     onProgress: (done, total) => (progress.value = done / total),
 *   })
 *   const failed = results.filter((r) => r.status === 'rejected')
 *
 * @see [`src/api/retry.ts`](./retry.ts) withRetry 重试策略
 * @see [`src/api/cancel.ts`](./cancel.ts) createAbort / linkAbort 取消句柄
 * @group 网络基建：并发调度
 */

import { withRetry } from './retry'
import type { RetryOptions } from './retry'

/**
 * 单任务结算结果：与输入索引对齐，调用方据 status 分流处理。
 *
 * 可辨识联合（fulfilled/rejected 两分支字段互斥）：调用方 narrow 后 value/reason
 * 精确存在，无需对 undefined 二次防御。
 */
export type ConcurrentTaskResult<R> =
  | { status: 'fulfilled'; value: R; index: number }
  | { status: 'rejected'; reason: unknown; index: number }

export interface ConcurrentOptions {
  /** 最大并发数，默认 3；<1 / NaN / 非有限数一律归一为 1 */
  limit?: number
  /**
   * 取消信号：触发后关闭闸门——未领取的任务不再执行，整体以 AbortError reject；
   * 已领取任务的中断由其内部自行响应该 signal（如透传给 request config）。
   * 注意：retry 退避的 sleep 不响应 signal，取消的最坏延迟 = 剩余退避总时长。
   */
  signal?: AbortSignal
  /** 单任务失败重试次数（不含首次），默认 0 不重试；透传 withRetry，默认 4xx 不重试 */
  retry?: number
  /** 首次重试前的延迟毫秒数（仅 retry > 0 时生效），默认 300，透传 withRetry.baseDelay */
  retryDelay?: number
  /**
   * 每个任务 settle（成功或失败）后回调，累计计数从 1 到 total；
   * 取消后已领取任务仍会跑完并触发本回调；回调异常会传播并中断队列，请保证回调健壮。
   */
  onProgress?: (settled: number, total: number) => void
}

/** 归一并发数：默认 3，NaN / 非有限 / <1 一律视为 1（对齐 retry.ts 的 clamp 风格） */
function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 3
  if (!Number.isFinite(limit)) return 1
  return Math.max(1, Math.floor(limit))
}

/** 构造取消错误：Error 实例直接透传；DOMException（无参 abort 的默认 reason，非 Error 子类）保留其 message；其余包装为 AbortError */
function toAbortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  if (reason instanceof Error) return reason
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    return reason as Error
  }
  const err = new Error(typeof reason === 'string' ? reason : 'The operation was aborted')
  err.name = 'AbortError'
  return err
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw toAbortError(signal)
}

/**
 * 并发执行一组任务并返回保序结算结果。
 *
 * - 失败不中断：单任务失败记 rejected，其余继续；调用方按 index 分流处理
 * - 取消：signal 触发后未领取任务不再执行，整体 reject AbortError（含取消发生在末任务运行期间的情况）
 * - 边界：空数组立即返回 []；limit 非法值归一为 1，小数向下取整；结果数组与输入索引对齐
 *
 * 用法详见文件头注释（分片上传示例）。
 */
export async function runConcurrent<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
  options: ConcurrentOptions = {}
): Promise<Array<ConcurrentTaskResult<R>>> {
  const total = items.length
  // 空数组短路：不启动 worker、不触发 onProgress
  if (total === 0) return []

  const limit = normalizeLimit(options.limit)
  const signal = options.signal
  // 预取消：零启动即拒绝，task 一次都不会被调用
  throwIfAborted(signal)

  const results: Array<ConcurrentTaskResult<R>> = new Array(total)
  let nextIndex = 0
  let settledCount = 0

  const runTask = async (index: number): Promise<void> => {
    let result: ConcurrentTaskResult<R>
    try {
      // nextIndex < total 的循环守卫保证索引必命中（as 断言：noUncheckedIndexedAccess 表达不了的运行时不变量）
      const exec = () => task(items[index] as T, index)
      if (options.retry && options.retry > 0) {
        // exactOptionalPropertyTypes：retryDelay 未传时不写 baseDelay 键，默认值留给 withRetry 单源
        const retryOpts: RetryOptions =
          options.retryDelay !== undefined
            ? { retries: options.retry, baseDelay: options.retryDelay }
            : { retries: options.retry }
        result = { status: 'fulfilled', value: await withRetry(exec, retryOpts), index }
      } else {
        result = { status: 'fulfilled', value: await exec(), index }
      }
    } catch (err) {
      result = { status: 'rejected', reason: err, index }
    }
    results[index] = result
    settledCount += 1
    // 刻意放在 try/catch 之外：进度回调异常视为调用方 bug，响亮传播而非静默吞掉
    options.onProgress?.(settledCount, total)
  }

  const worker = async (): Promise<void> => {
    while (nextIndex < total) {
      // 闸门：signal 触发后拒绝领取新任务（已领取的当前任务仍跑完）
      throwIfAborted(signal)
      const index = nextIndex
      nextIndex += 1
      await runTask(index)
    }
  }

  // allSettled 而非 all：取消时须等全部 worker 收尾再抛错，
  // 否则首个 rejection 之后其余 worker 的 AbortError 会成为 unhandled rejection
  const workers: Array<Promise<void>> = []
  for (let i = 0; i < Math.min(limit, total); i += 1) {
    workers.push(worker())
  }
  const settled = await Promise.allSettled(workers)
  const firstRejection = settled.find((s) => s.status === 'rejected')
  if (firstRejection) throw firstRejection.reason
  // 末道闸门：取消可能发生在「最后一个任务的执行期间」——此时所有 worker 已正常
  // 收尾（while 条件先于下一轮检查退出），须在此补查 signal，否则取消被静默吞掉
  throwIfAborted(signal)

  // 正常完成路径：全部索引已被各 worker 恰好填充一次（abort 路径在上面的 throw 提前退出）
  return results
}
