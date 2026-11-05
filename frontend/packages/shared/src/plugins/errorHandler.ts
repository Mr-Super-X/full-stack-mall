/**
 * 全局错误处理插件（@vv/shared 单源）。
 *
 * 文件角色：Vue 应用全局错误接管的跨 app 单源实现（原 apps/{admin,auth,portal,h5,docs}
 * 的 plugins/errorHandler.ts 五份逐字拷贝，P6 收敛于此——消 ~340 行重复 +
 * 4 app 零测试盲区：spec 随包单源，6 app 同受益）。
 *
 * 接管 3 类错误：
 * 1. Vue 组件错误（app.config.errorHandler）
 * 2. window 全局 JS 错误（window.addEventListener('error')）
 * 3. 未捕获的 Promise 拒绝（unhandledrejection）
 *
 * 设计要点：
 * - install 模式：与 directives 一致，方便 main.ts 统一注册
 * - options.report：预留 Sentry/自建日志服务扩展点（未传时仅 console 输出）
 * - logToConsole：dev 默认 true / prod 默认 false
 * - 错误规范化：非 Error 实例包装为 Error（统一类型）
 * - 与 safeAsync 工具集成：install 时同步注入 report 函数，
 *   让 safeAsync 包装的非 HTTP 错误也走同一上报通道
 *
 * 用法（各 app 经 plugins/index.ts 的 createAppPlugins 工厂间接注册）：
 * ```ts
 * app.use(errorHandlerPlugin, {
 *   report: (err, ctx) => Sentry.captureException(err, { tags: ctx })
 * })
 * ```
 *
 * @see [`../utils/safeAsync.ts`](../utils/safeAsync.ts) _bindErrorHandler 注入桥
 * @see [`./index.ts`](./index.ts) createAppPlugins 插件统一注册工厂
 * @group 插件：错误处理
 */
import type { App } from 'vue'
import type { ErrorHandlerOptions, ErrorSource } from './errorHandler.d'
import { _bindErrorHandler } from '../utils/safeAsync.ts'

/**
 * Chromium 布局观测的已知良性噪声：ResizeObserver 在一帧内收到过多通知时
 * 会抛出该错误，EP 的 el-scrollbar / 弹层动画场景高频触发，无堆栈、无实际损害。
 * 过滤以免污染错误上报（Sentry 等），详见 https://stackoverflow.com/q/49384120
 */
const BENIGN_ERROR_PATTERNS = [/ResizeObserver loop completed with undelivered notifications/]

/** 判断错误是否属于已知良性噪声（不进入上报通道） */
function isBenignError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return BENIGN_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/** window 级监听引用（模块级持有）——install 幂等摘除用，防 HMR/重复 install 叠加泄漏 */
type WindowErrorHandler = (event: ErrorEvent) => void
type RejectionHandler = (event: PromiseRejectionEvent) => void
let windowErrorHandler: WindowErrorHandler | null = null
let unhandledRejectionHandler: RejectionHandler | null = null

/** 摘除 window 级监听（install 前置调用，幂等） */
function uninstallWindowListeners(): void {
  if (windowErrorHandler) {
    window.removeEventListener('error', windowErrorHandler)
    windowErrorHandler = null
  }
  if (unhandledRejectionHandler) {
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
    unhandledRejectionHandler = null
  }
}

export default {
  install(app: App, options: ErrorHandlerOptions = {}): void {
    const { report, logToConsole = import.meta.env.DEV } = options

    // 幂等守卫（2026-10-28 运行时审计 P1）：window 监听为模块级副作用，install 叠加
    // （HMR / 重复 app.use）时匿名函数无法摘除会累积泄漏——先摘旧再挂新
    uninstallWindowListeners()

    // 将 report 函数桥接到 safeAsync 模块，使两类错误走同一上报通道
    _bindErrorHandler(options)

    /** 错误统一规范化与上报 */
    const handle = (err: unknown, source: ErrorSource, extra?: unknown): void => {
      const error = err instanceof Error ? err : new Error(String(err))
      if (logToConsole) {
        // dev 环境 console.error 输出原始错误（含 stack）
        console.error(`[${source}]`, error, extra)
      }
      report?.(error, { source, extra })
    }

    // 1. Vue 组件错误
    app.config.errorHandler = (err, _instance, info) => {
      handle(err, 'vue', info)
    }

    // 2. window 全局 JS 错误（具名引用持有，供 uninstallWindowListeners 摘除）
    windowErrorHandler = (event) => {
      const err = event.error ?? event.message
      // 良性噪声直接丢弃：不 console.error 也不上报（避免污染监控）
      if (isBenignError(err)) return
      handle(err, 'window.error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }
    window.addEventListener('error', windowErrorHandler)

    // 3. 未捕获的 Promise 拒绝
    unhandledRejectionHandler = (event) => {
      handle(event.reason, 'unhandledrejection')
    }
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)
  },
}
