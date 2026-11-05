/**
 * 全局 AbortController 单例 + signal 合并工具。
 *
 * 用途：logout 等需要"一次性取消所有在途请求"的场景。
 * 单例 signal 注入 http.ts 请求拦截器，logout 时统一 abort()。
 *
 * @see [`src/api/http.ts`](./http.ts) 拦截器注入点
 * @group 网络基建：取消控制
 */

class GlobalAbortController {
  private controller = new AbortController()

  get signal(): AbortSignal {
    return this.controller.signal
  }

  /** 若当前 signal 已 aborted，创建新 controller；否则 no-op */
  reset(): void {
    if (this.controller.signal.aborted) {
      this.controller = new AbortController()
    }
  }

  /** 幂等：已 aborted 时再次调用不会抛错 */
  abort(reason?: string): void {
    if (!this.controller.signal.aborted) {
      this.controller.abort(reason)
    }
  }
}

export const globalAbort = new GlobalAbortController()

/**
 * 合并多个 AbortSignal，任一触发即中止。
 * - 全 undefined：返回永不 abort 的占位 signal（避免 AbortSignal.any([]) 抛错）
 * - 单个：透传
 * - 多个：AbortSignal.any() 合并
 *
 * 注：axios 的 `InternalAxiosRequestConfig.signal` 是 `GenericAbortSignal`（结构子集，
 * 缺少 reason/throwIfAborted）。chainSignals 返回标准 AbortSignal，调用方需 `as unknown as`
 * 双向转。运行时完全兼容，仅 TS 类型层不可推导。
 */
export function chainSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const filtered = signals.filter((s): s is AbortSignal => s !== undefined)
  if (filtered.length === 0) {
    return new AbortController().signal
  }
  if (filtered.length === 1) return filtered[0]!
  return AbortSignal.any(filtered)
}
