/**
 * 版本检测插件（@vv/shared 单源）——生产页面资源更新检测。
 *
 * 文件角色：可插拔 Vue 插件，与 errorHandler / webVitals / remAdaptation 同体系
 * （createAppPlugins 工厂第 4 装配项，6 app 默认拥有）。双机制（启用面不同，R3-E3）：
 *   - 主动轮询：定时 fetch version.json（构建侧 version-check-vite 插件生成，
 *     见 packages/config/src/version-check-vite.ts）比对 buildId——prod 缺省需注入
 *     onUpdate 消费方才启动（无人消费的信号不采集，见 shouldEnable 头注）
 *   - 被动兜底：ChunkLoadError 监听（轮询间隔内用户刚好点到已被新版本删除的
 *     懒加载 chunk 的场景）——零网络零定时器成本，无条件装配（不受 shouldEnable 约束）
 *
 * 设计要点：
 *   - 零 UI 依赖（@vv/shared 不引入 Element Plus）：通知经 onUpdate 回调注入，
 *     与 webVitals 的 options.report 同范式
 *   - 纯函数层（shouldEnable / isChunkLoadErrorMessage / parseVersionPayload /
 *     createVersionPoller）独立导出供单测；default export 只是薄装配
 *   - 基线存模块级变量，不落 localStorage——避免基线跨版本残留致「永远不提示」
 *   - dev 默认不启动轮询（HMR 即热更新；enabled:true 可强制调试）；
 *     prod 缺省需注入 onUpdate 才启动轮询（ChunkLoadError 兜底不受此约束，仍无条件装配）
 *   - 全部错误静默降级（网络抖动 / 404 / 解析失败均不抛），绝不影响业务
 *
 * @see [`../../config/src/version-check-vite.ts`](../../config/src/version-check-vite.ts) 构建侧 version.json 生成
 * @see [`./index.ts`](./index.ts) createAppPlugins 装配入口
 * @group 插件：版本检测
 */
import type { App } from 'vue'

/** onUpdate 回调载荷（chunk-error 触发时无版本信息，id 可空） */
export interface VersionInfo {
  /** 旧版本基线；chunk-error 触发时为 null */
  oldId: string | null
  /** 新版本 buildId；chunk-error 时为 null */
  newId: string | null
  /** 触发源：轮询比对 / chunk 懒加载失败兜底 */
  source: 'poll' | 'chunk-error'
}

/** 版本检测插件 options（PluginsOptions.versionCheck 透传入） */
export interface VersionCheckOptions {
  /** 轮询间隔（ms）。缺省 5min */
  intervalMs?: number
  /**
   * 发现版本更新时回调（业务注入通知实现，如 ElNotification）。
   * prod 缺省不注入 = 插件不启动（无人消费的信号不采集）；
   * dev 强制开启（enabled:true）时缺省 console.warn。
   * chunk-error 兜底缺省也回落到此回调（source: 'chunk-error'，id 为 null）
   */
  onUpdate?: (info: VersionInfo) => void
  /** ChunkLoadError 兜底独立回调。缺省回落到 onUpdate */
  onChunkError?: (err: Error) => void
  /** 强制启用（dev 模式调试用；prod 无需传） */
  enabled?: boolean
  /** version.json 请求路径。缺省 `${import.meta.env.BASE_URL}version.json` */
  path?: string
}

/** 缺省轮询间隔：5min（后台系统发版频率低，平衡及时性与负载） */
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

/**
 * 轮询启用裁决（ChunkLoadError 兜底不受此约束，2026-10-29 R3-E3）：
 * DEV 缺省关闭（HMR 即热更新，dev server 无 version.json），
 * enabled:true 强制开（dev 调试路径）、enabled:false 强制关。
 * prod 缺省需注入 onUpdate 回调才启动（2026-10-28 /autoplan R2-CEO-3）：
 * 缺省 defaultOnUpdate 在 prod 是 noop——无回调即「采集了也无人消费」，
 * 6 app 默认装配曾致 5/6 app 每 tab 每 5min 轮询 version.json 后丢弃结果
 * （纯死负载）。有消费方才采集，注入 onUpdate 即启用信号。
 * 抽成纯函数以便测试（install 传入 import.meta.env.DEV）。
 */
export function shouldEnable(dev: boolean, options?: VersionCheckOptions): boolean {
  if (options?.enabled === true) return true
  if (options?.enabled === false) return false
  if (dev) return false
  return typeof options?.onUpdate === 'function'
}

/** ChunkLoadError 4 种浏览器 message 形态（i 标志忽略大小写） */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

/** 判断错误 message 是否 chunk 懒加载失败（兜底监听匹配用） */
export function isChunkLoadErrorMessage(message: string): boolean {
  return CHUNK_ERROR_RE.test(message)
}

/**
 * 解析 version.json 响应体：合法返回 buildId，任何异常（JSON 非法 / 缺字段 /
 * 非字符串）返回 null——调用方视 null 为「本次无效，等下一轮」，不抛错。
 */
export function parseVersionPayload(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return null
    const buildId = (parsed as Record<string, unknown>).buildId
    return typeof buildId === 'string' && buildId.length > 0 ? buildId : null
  } catch {
    return null
  }
}

/** createVersionPoller 入参（fetchImpl 注入点：install 传全局 fetch，测试传 mock） */
export interface PollerOptions {
  /** version.json 请求路径（不含 cache-busting query） */
  path: string
  intervalMs: number
  onUpdate: (info: VersionInfo) => void
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
}

/** 轮询器句柄（install 持有；测试直调 pollOnce 免定时器） */
export interface VersionPoller {
  start: () => void
  stop: () => void
  /** 单次轮询（visible 恢复时立即补一次也用） */
  pollOnce: () => Promise<void>
  /** 当前基线（测试断言用） */
  getBaseline: () => string | null
}

/**
 * 创建轮询器：基线首次建立 → 后续比对 buildId，变化即 onUpdate 并同步基线
 * （防同一新版本重复触发）。全部错误静默（try-catch 包裹），网络层永不抛。
 */
export function createVersionPoller(opts: PollerOptions): VersionPoller {
  let baseline: string | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function pollOnce(): Promise<void> {
    try {
      // AbortSignal.timeout（2026-10-28 /autoplan E10）：fetch 无超时——version.json
      // 服务挂起（非拒绝）时每轮累积一个挂起连接，占满同源连接槽后业务请求被排队。
      // 10s 远超静态文件合理响应时长，超时即本次跳过等下一轮
      const res = await opts.fetchImpl(`${opts.path}?_t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return
      const buildId = parseVersionPayload(await res.text())
      if (buildId === null) return
      if (baseline === null) {
        baseline = buildId
        return
      }
      if (buildId !== baseline) {
        const oldId = baseline
        baseline = buildId
        opts.onUpdate({ oldId, newId: buildId, source: 'poll' })
      }
    } catch {
      // 网络抖动 / 中间件异常：本次跳过，等下一轮
    }
  }

  return {
    start() {
      if (timer !== null) return
      timer = setInterval(() => {
        void pollOnce()
      }, opts.intervalMs)
    },
    stop() {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    },
    pollOnce,
    getBaseline: () => baseline,
  }
}

/** 默认 onUpdate：dev console.warn，prod noop（与 webVitals defaultReporter 同风格） */
function defaultOnUpdate(info: VersionInfo): void {
  if (!import.meta.env.DEV) return
  console.warn('[VersionCheck] 检测到资源更新：', info)
}

export default {
  /**
   * Vue 插件 install：装配轮询器 + visibilitychange 节能 + ChunkLoadError 兜底。
   *
   * @example 业务注入通知（ElNotification 等）经 main.ts 的 PluginsOptions.versionCheck 传入
   */
  install(app: App, options: VersionCheckOptions = {}): void {
    const onUpdate = options.onUpdate ?? defaultOnUpdate

    // ChunkLoadError 兜底无条件装配（2026-10-29 /autoplan Round 3 R3-E3）：
    // 被动监听零网络零定时器成本，不适用「无人消费的信号不采集」原则（该原则只约束
    // 主动轮询）——R2 缺省关（shouldEnable 拦截整个 install）曾致 5/6 app 部署后旧
    // chunk 命中白屏无提示（Round 3 R3-F3 / B4）。
    const chunkHandler =
      options.onChunkError ??
      ((_err: Error) =>
        onUpdate({
          oldId: null,
          newId: null,
          source: 'chunk-error',
        }))
    const onWindowError = (event: ErrorEvent): void => {
      try {
        const msg = event.message ?? ''
        if (isChunkLoadErrorMessage(msg)) {
          chunkHandler(event.error instanceof Error ? event.error : new Error(msg))
        }
      } catch {
        /* 兜底层自身异常吞掉 */
      }
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      try {
        const reason: unknown = event.reason
        if (reason instanceof Error && isChunkLoadErrorMessage(reason.message)) {
          chunkHandler(reason)
        }
      } catch {
        /* 兜底层自身异常吞掉 */
      }
    }
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onRejection)

    // 主动轮询：prod 缺省需注入 onUpdate 消费方才启动（shouldEnable 头注，R2-CEO-3）
    let poller: ReturnType<typeof createVersionPoller> | null = null
    let onVisibility: (() => void) | null = null
    if (shouldEnable(import.meta.env.DEV, options)) {
      poller = createVersionPoller({
        path: options.path ?? `${import.meta.env.BASE_URL}version.json`,
        intervalMs: options.intervalMs ?? DEFAULT_INTERVAL_MS,
        onUpdate,
        fetchImpl: fetch,
      })

      // 页面 hidden 暂停定时器、visible 恢复并立即补一次（后台 tab 不浪费请求）
      onVisibility = (): void => {
        if (!poller) return
        if (document.hidden) {
          poller.stop()
        } else {
          poller.start()
          void poller.pollOnce()
        }
      }
      document.addEventListener('visibilitychange', onVisibility)

      poller.start()
      void poller.pollOnce()
    }

    // teardown（2026-10-28 /autoplan R2-E6）：app 卸载时停轮询 + 摘全部监听器——
    // 共享基建应有卸载路径（SPA 单例下概率低，但 6 app 复用场景的语义完整性要求）
    app.onUnmount(() => {
      poller?.stop()
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onRejection)
    })
  },
}
