import type { AxiosRequestConfig } from 'axios'

/**
 * 取消控制器：把 AbortController 抽象为业务可读的对象。
 *
 * 用法：
 *   const ctrl = createAbort()
 *   request({ url, signal: ctrl.signal })
 *   // 后续：
 *   ctrl.abort('用户取消')
 */
/**
 * 取消控制器句柄：把 AbortController 抽象为业务可读的对象。
 *
 * @group 网络基建：取消控制
 */
export interface AbortHandle {
  signal: AbortSignal
  /** 主动取消；reason 会写入 signal.reason */
  abort: (reason?: string) => void
}

export function createAbort(reason?: string): AbortHandle {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    abort: (r?: string) => controller.abort(r ?? reason),
  }
}

/**
 * 把 AbortHandle 注入到 axios config。
 * 业务侧可直接 `request({ url, ...withAbort(handle) })`。
 */
export function withAbort(handle: AbortHandle): Pick<AxiosRequestConfig, 'signal'> {
  return { signal: handle.signal }
}

/**
 * 把外部 AbortSignal 与本地 AbortHandle 合并：
 * 任一信号触发都会中止本地 controller，便于"路由切换 + 组件卸载"双触发。
 */
export function linkAbort(external: AbortSignal | undefined, local: AbortHandle): AbortSignal {
  if (!external) return local.signal
  const forward = () => local.abort('linked-abort')
  if (external.aborted) {
    forward()
  } else {
    external.addEventListener('abort', forward, { once: true })
  }
  return local.signal
}
