/**
 * 运行时安全执行工具。
 *
 * 替代方案：参考原内部项目 async-add-try-catch-plugin 实现
 *
 * 与 Babel 编译时方案对比：
 * - Babel 方案：编译时给每个 await 包 try/catch（重复覆盖 http.ts 拦截器已处理的 90% 错误）
 * - 本方案：运行时工具，业务侧显式选择 wrap；零编译复杂度、零行号错位
 *
 * 用法：
 * ```ts
 * const data = await safeAsync(() => JSON.parse(rawString), {
 *   source: 'parse-config',
 *   fallback: null,
 * })
 * // data 是 null（fallback）；错误已上报到 errorHandler
 * ```
 *
 * 与 errorHandler 插件集成：通过 errorHandler install 时调用
 * `_configureSafeAsync` 注入 reporter，业务侧无需关心。
 *
 * 包化（P1-3）：ErrorSource / ErrorContext / ErrorReporter 类型契约随本文件下沉
 * （原为 app 侧 plugins/errorHandler.d.ts 定义——shared 不反向依赖 app）；
 * app 侧 errorHandler.d.ts 改为 re-export 本文件的类型，消费方零改动。
 *
 * @see [`../../plugins/errorHandler.ts`](../../plugins/errorHandler.ts) 注入点（app 侧）
 * @group 错误兜底
 */

/**
 * 错误来源标识。
 *
 * - 已知值（errorHandler 内部使用）：'vue' | 'window.error' | 'unhandledrejection'
 * - 业务自定义：任意字符串（如 'parse-config'、'third-party-sdk'）
 *
 * 设为 string 而非 union 是为了支持 safeAsync 等工具自由传入上下文标签。
 */
export type ErrorSource = string

/** 错误上下文（透传给 report 回调） */
export interface ErrorContext {
  source: ErrorSource
  /** 附加信息（Vue 错误时是 lifecycle hook name 等） */
  extra?: unknown
}

/**
 * 错误上报回调签名。
 *
 * 生产环境对接 Sentry / 自建日志服务时实现此函数。
 */
export type ErrorReporter = (error: Error, context: ErrorContext) => void

let configuredReporter: ErrorReporter | undefined
let configuredDevLog: boolean = import.meta.env.DEV

/**
 * @internal errorHandler install 时注入 report 函数。
 * 业务侧不应直接调用。
 */
export function _configureSafeAsync(reporter: ErrorReporter | undefined, devLog: boolean): void {
  configuredReporter = reporter
  configuredDevLog = devLog
}

function reportError(err: unknown, source: ErrorSource, extra?: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err))
  if (configuredDevLog) {
    console.error(`[safeAsync:${source}]`, error, extra)
  }
  configuredReporter?.(error, { source, extra })
}

export interface SafeOptions<T> {
  /**
   * 错误来源标识，写入 report 的 ctx.source（用于日志聚合）。
   * 推荐格式：模块/动作，如 "parse-config"、"third-party-sdk"
   */
  source: ErrorSource
  /** 失败时返回的 fallback（必填；无 fallback 时业务应自己 try/catch） */
  fallback: T
  /** 额外上下文，会传给 report；可用于附加元信息 */
  extra?: unknown
}

/**
 * 包装 async 函数：出错时捕获 + 上报 + 返回 fallback。
 *
 * @example
 * ```ts
 * const safeParseConfig = safeAsync(
 *   () => fetch('/config.json').then(r => r.json()),
 *   { source: 'load-config', fallback: {} as Config }
 * )
 * const config = await safeParseConfig()
 * ```
 */
export function safeAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: SafeOptions<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args)
    } catch (err) {
      reportError(err, options.source, options.extra)
      return options.fallback
    }
  }
}

/**
 * 同步版本：同步函数出错时返回 fallback。
 *
 * @example
 * ```ts
 * const parseDate = trySafeSync(
 *   (s: string) => new Date(s),
 *   { source: 'parse-date', fallback: new Date(0) }
 * )
 * ```
 */
export function trySafeSync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: SafeOptions<TReturn>
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    try {
      return fn(...args)
    } catch (err) {
      reportError(err, options.source, options.extra)
      return options.fallback
    }
  }
}

/**
 * @internal 仅供 errorHandler install 内部调用，
 * 将 errorHandler 的 options.report 桥接到 safeAsync 模块。
 *
 * 入参为结构化类型（与 app 侧 plugins/errorHandler.d.ts 的 ErrorHandlerOptions 兼容），
 * 本包不反向 import app 侧类型。
 *
 * 业务侧不应直接调用；由 errorHandler 内部自动触发。
 */
export function _bindErrorHandler(
  options: {
    report?: ErrorReporter
    logToConsole?: boolean
  } = {}
): void {
  _configureSafeAsync(options.report, options.logToConsole ?? import.meta.env.DEV)
}
