/**
 * HTTP 错误事件层 —— 拦截器与全局错误反馈（toast / 网络横幅）之间的解耦桥。
 *
 * 背景（2026-10-27 生产 portal 502 Toast 事件驱动改造）：原 onResponseRejected 直接
 * ElMessage.error，有两个结构性缺陷——① 探测类请求（登录态探测/预取）的失败无法静默：
 * 生产无后端时门户一打开就弹「网关错误」Toast；② 后端宕机时用户连续操作触发 Toast 轰炸。
 * 行业标准做法（vue-element-admin errorHandle / Ant Design Pro skipErrorHandler / alova
 * silent）：拦截器只归一化错误 + 发事件，反馈决策权交给订阅方——业务错误默认 toast 兜底、
 * 网络类错误聚合为全局横幅节流去重、探测请求经 config.silent 全程静默。
 *
 * 事件模型：
 * - http:error —— 拦截器归一化后 emit（ApiError 为 payload；silent / ERR_CANCELED /
 *   401-将由重试链处理 的请求在拦截器侧过滤，不到达本层）
 * - http:recovered —— 末次错误后 RECOVERY_WINDOW_MS 内的首个成功响应 emit。
 *   常态成功请求零事件开销（仅一次时间戳比较）；窗口外的成功（错误已是历史）不发，
 *   避免无意义事件；窗口内成功 = 网络已通，立即恢复。
 *
 * 恢复窗口的另一面：持续故障 10s 内没有任何成功，窗口静默过期——下次成功不再发恢复
 * （横幅靠自身的 dismiss 冷却/常驻逻辑收尾，不依赖迟到的恢复信号）。
 *
 * @see [`./http.ts`](./http.ts) 唯一 emit 方（过滤规则同文件头注）
 * @see @vv/ui composables/useNetworkBanner.ts 订阅方（网络横幅聚合 + 业务错误 toast 兜底）
 * @group 网络基建：错误处理
 */

import type { ApiError } from './types/error'

/**
 * 网络类错误状态码集合：无状态（undefined=网络异常/超时）+ 网关三兄弟。
 * 设计：与 http-errors.ts 的状态文案表互补——这里只管「该进横幅通道还是 toast 通道」
 * 的归类判定，文案仍由 resolveHttpStatusMessage 负责（订阅方展示时取用）。
 */
const NETWORK_LEVEL_STATUSES = new Set([0, 502, 503, 504])

/**
 * 恢复信号窗口（ms）：末次错误后该窗口内的成功响应才发 recovered。
 * 取值对齐 http.ts 请求超时（15s）量级内的体验预期：故障持续期内恢复应即时感知，
 * 超过 10s 后的成功视为「早已恢复」的平凡事件。
 */
export const RECOVERY_WINDOW_MS = 10_000

/**
 * 判定网络级错误（聚合进横幅通道）还是业务级错误（toast 兜底通道）。
 *
 * @param status ApiError.status；undefined 表示无 HTTP 响应（网络异常/超时/DNS 失败）
 */
export function isNetworkLevelError(status: number | undefined): boolean {
  return status === undefined || NETWORK_LEVEL_STATUSES.has(status)
}

/** 错误事件负载 */
export interface HttpErrorEvent {
  error: ApiError
}

type ErrorListener = (event: HttpErrorEvent) => void
type RecoveredListener = () => void

const errorListeners = new Set<ErrorListener>()
const recoveredListeners = new Set<RecoveredListener>()

/** 末次错误时间戳（Date.now 语义；模块级状态，测试经 resetHttpErrorEvents 清零） */
let lastErrorAt = 0

/** 订阅 HTTP 错误事件；返回退订函数（组件卸载/测试清理用） */
export function onHttpError(listener: ErrorListener): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

/** 订阅网络恢复信号；返回退订函数 */
export function onHttpRecovered(listener: RecoveredListener): () => void {
  recoveredListeners.add(listener)
  return () => recoveredListeners.delete(listener)
}

/** 拦截器响应 reject 路径调用：广播错误事件并记录末次错误时间 */
export function emitHttpError(error: ApiError): void {
  lastErrorAt = Date.now()
  for (const listener of errorListeners) listener({ error })
}

/**
 * 拦截器响应 fulfill 路径调用：恢复窗口内的首个成功 → 清零窗口并广播恢复信号。
 * 窗口外成功静默清零（不发事件）——错误已是历史，无需打扰订阅方。
 */
export function emitHttpRecoveredIfApplicable(): void {
  if (lastErrorAt === 0) return
  const withinWindow = Date.now() - lastErrorAt <= RECOVERY_WINDOW_MS
  lastErrorAt = 0
  if (!withinWindow) return
  for (const listener of recoveredListeners) listener()
}

/** 测试专用：清零模块级时间戳与全部订阅（不暴露给生产路径） */
export function resetHttpErrorEvents(): void {
  lastErrorAt = 0
  errorListeners.clear()
  recoveredListeners.clear()
}
