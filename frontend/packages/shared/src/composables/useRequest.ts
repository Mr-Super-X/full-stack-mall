import { computed, ref, watch } from 'vue'
import type { Ref, ComputedRef, WatchSource } from 'vue'

/**
 * 三态请求封装 composable。
 *
 * 参考 VueUse useFetch（Vue 3 数据获取最流行封装，~6M 下载/月）设计：
 * - cancel() + re-fetch 自动 abort（防止快速重复点击竞态）
 * - statusCode ref（UI 友好）
 * - initialData 选项（SSR / 缓存预填）
 * - watch 选项（对齐 Vue watch API；deps 作为别名保留）
 * - 错误标志：isAborted / isTimeout / isNetworkError
 *
 * 业务侧典型用法（参考 AsyncState 组件）：
 * ```ts
 * const { data, loading, error, isEmpty, refresh } = useRequest(
 *   () => equipmentApi.getList({ page: 1, pageSize: 20 })
 * )
 * ```
 *
 * 关键词变化自动重拉：
 * ```ts
 * const keyword = ref('')
 * useRequest(
 *   () => equipmentApi.getList({ keyword: keyword.value }),
 *   { watch: [keyword] }
 * )
 * ```
 *
 * SSR / 缓存预填：
 * ```ts
 * const { data } = useRequest(
 *   () => userApi.getById(id.value),
 *   { initialData: { id: 0, name: '加载中...' } }
 * )
 * ```
 *
 * 主动取消（如切换路由时）：
 * ```ts
 * const { cancel, aborted } = useRequest(...)
 * onUnmounted(() => cancel())
 * ```
 *
 * @see [`src/components/common/AsyncState.vue`](../components/common/AsyncState.vue) 配套 UI 组件
 * @group 请求组合式 API
 */

/**
 * 增强的 Error 子类（运行时挂在原始 error 上，访问 flags）
 */
export interface UseRequestError extends Error {
  /** 当前请求被 cancel() 主动中止 */
  isAborted?: boolean
  /** 请求超时（axios code === 'ECONNABORTED'） */
  isTimeout?: boolean
  /** 网络错误（axios code === 'ERR_NETWORK' 等） */
  isNetworkError?: boolean
}

export interface UseRequestOptions<T, P extends unknown[]> {
  /** 是否立即执行（默认 true；在 onMounted 时运行，SSR 安全） */
  immediate?: boolean
  /** 预填数据（SSR 场景或缓存预热；initialData.value 不会触发 loading） */
  initialData?: T
  /** 成功回调（接收数据和 execute 参数） */
  onSuccess?: (data: T, ...args: P) => void
  /** 失败回调 */
  onError?: (err: UseRequestError) => void
  /**
   * 依赖项：值变化时自动重新执行。
   * 与 Vue watch API 对齐（推荐）；旧名 `deps` 仍可使用。
   */
  watch?: WatchSource[]
  /** @deprecated 使用 `watch` 替代 */
  deps?: WatchSource[]
}

export interface UseRequestReturn<T, P extends unknown[]> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<UseRequestError | null>
  /** non-loading + non-error + data===null 时为 true（配合 AsyncState 组件） */
  isEmpty: ComputedRef<boolean>
  /** HTTP 状态码（请求完成后填充；cancel 时为 null） */
  statusCode: Ref<number | null>
  /** 最近一次执行是否被 cancel() 主动中止 */
  aborted: Ref<boolean>
  execute: (...args: P) => Promise<void>
  refresh: (...args: P) => Promise<void>
  /** 主动取消当前 in-flight 请求（不会中断底层 HTTP，仅丢弃结果，解决频繁中断http请求线程导致卡顿） */
  cancel: () => void
}

/**
 * 识别 axios 风格错误码，补充 flags 到 error 对象。
 * 非 axios 错误会原样返回（仅当 error 是 Error 实例时挂载 flags）。
 */
function classifyError(err: unknown, wasAborted: boolean): UseRequestError {
  const base: UseRequestError =
    err instanceof Error ? (err as UseRequestError) : new Error(String(err))

  if (wasAborted) {
    base.isAborted = true
    return base
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    if (code === 'ECONNABORTED') base.isTimeout = true
    if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      base.isNetworkError = true
    }
  }

  return base
}

export function useRequest<T, P extends unknown[] = []>(
  fetcher: (...args: P) => Promise<T>,
  options: UseRequestOptions<T, P> = {}
): UseRequestReturn<T, P> {
  const data = ref<T | null>(options.initialData ?? null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<UseRequestError | null>(null)
  const statusCode = ref<number | null>(null)
  const aborted = ref(false)
  // isEmpty 仅在非 loading、非 error 时基于 data === null 判定
  const isEmpty = computed(() => !loading.value && !error.value && data.value === null)

  // 当前 in-flight 请求的 AbortController（用于 cancel）
  let currentController: AbortController | null = null

  async function execute(...args: P): Promise<void> {
    // 取消上一次未完成的请求（防竞态）
    if (currentController) {
      currentController.abort()
    }
    const controller = new AbortController()
    currentController = controller

    loading.value = true
    error.value = null
    aborted.value = false
    statusCode.value = null

    try {
      const result = await fetcher(...args)
      // 如果当前 controller 已被 cancel() 替换，丢弃结果
      if (currentController !== controller) return
      // 如果该 controller 已 abort（用户主动取消），丢弃结果
      if (controller.signal.aborted) {
        aborted.value = true
        // 主动取消：构造一个轻量错误供 UI 显示（含 isAborted 标志）
        const cancelErr: UseRequestError = new Error('Request aborted')
        cancelErr.isAborted = true
        error.value = cancelErr
        return
      }
      data.value = result
      statusCode.value = 200 // 业务层未抛错即视为成功
      options.onSuccess?.(result, ...args)
    } catch (err) {
      if (currentController !== controller) return
      if (controller.signal.aborted) {
        aborted.value = true
        // 主动取消：构造一个轻量错误供 UI 显示
        const cancelErr: UseRequestError = new Error('Request aborted')
        cancelErr.isAborted = true
        error.value = cancelErr
        return
      }
      const wrapped = classifyError(err, false)
      error.value = wrapped
      options.onError?.(wrapped)
    } finally {
      if (currentController === controller) {
        currentController = null
        loading.value = false
      }
    }
  }

  function cancel(): void {
    if (currentController) {
      currentController.abort()
    }
  }

  // 初始执行
  if (options.immediate !== false) {
    execute(...([] as unknown as P))
  }

  // watch 监听：值变化时重新执行
  // watch 选项优先；旧名 `deps` 作为别名保留
  // Vue watch 的数组 source 自动处理 Ref / ComputedRef / getter 混合
  const watchSources = options.watch ?? options.deps
  if (watchSources && watchSources.length > 0) {
    watch(watchSources, () => {
      void execute(...([] as unknown as P))
    })
  }

  return {
    data,
    loading,
    error,
    isEmpty,
    statusCode,
    aborted,
    execute,
    refresh: execute,
    cancel,
  }
}
