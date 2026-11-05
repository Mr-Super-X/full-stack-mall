/**
 * 指数退避重试包装（可插拔）。
 *
 * 设计要点：
 * - 仅对幂等方法（GET/HEAD/OPTIONS）或显式 `idempotent: true` 的请求生效
 * - 默认重试 2 次（共 3 次调用），baseDelay 300ms，backoff 2
 * - 4xx 业务错误与主动取消（ApiError.canceled）不重试（仅网络/5xx/超时）
 * - 退避 sleep 不可取消：取消在下次 fn() 调用时生效（axios 对已 abort 的 signal 立即 reject）
 *
 * 用法：
 *   const data = await withRetry(
 *     () => request<LoginResult>({ url, method: 'post', idempotent: true }),
 *     { retries: 2, baseDelay: 300 }
 *   )
 *
 * @see [`src/api/http.ts`](./http.ts) `idempotent` config 字段透传
 * @group 网络基建：重试
 */
import { isApiError } from './types/error'

export interface RetryOptions {
  /** 额外重试次数（不含首次），默认 2 */
  retries?: number
  /** 首次重试前的延迟毫秒数，默认 300 */
  baseDelay?: number
  /** 退避基数，默认 2（第 n 次重试延迟 = baseDelay * backoff^(n-1)） */
  backoff?: number
  /** 网络/超时错误的判定函数，默认仅 5xx / 网络错误重试（4xx 与主动取消不重试） */
  shouldRetry?: (err: unknown, attempt: number) => boolean
}

const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options'])

function defaultShouldRetry(err: unknown): boolean {
  // 主动取消不重试：取消后应立即终止，退避 sleep 会延迟 logout/组件卸载流程约 1s
  if (isApiError(err) && err.canceled) return false
  // ApiError 携带 status 时：仅 5xx + 网络错误重试
  if (isApiError(err) && err.status !== undefined) {
    return err.status >= 500
  }
  // 业务码形态（mockjs 劫持等恒 HTTP 200、status undefined 的场景）：4xx 是确定性
  // 失败（参数错/冲突/未齐全），与 HTTP 形态的 4xx 不重试对齐；5xx 业务码仍可重试
  if (isApiError(err) && err.code >= 400 && err.code < 500) return false
  // 非 ApiError 视为网络/超时/序列化错误，允许重试
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 判断调用是否可重试：根据 method 与可选 idempotent 标志。
 * 调用方可在 request config 中追加 `idempotent: true` 覆盖。
 */
export function isIdempotent(
  method: string | undefined,
  config: { idempotent?: boolean } = {}
): boolean {
  if (config.idempotent === true) return true
  if (config.idempotent === false) return false
  return method !== undefined && IDEMPOTENT_METHODS.has(method.toLowerCase())
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = Math.max(0, opts.retries ?? 2)
  const baseDelay = Math.max(0, opts.baseDelay ?? 300)
  const backoff = Math.max(1, opts.backoff ?? 2)
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= retries || !shouldRetry(err, attempt)) break
      const delay = baseDelay * Math.pow(backoff, attempt)
      await sleep(delay)
    }
  }
  throw lastErr
}
