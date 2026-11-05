import axios from 'axios'

/**
 * 会话续期管理器（单例，httpOnly 模式）。
 *
 * 设计要点：
 * - 并发去重：同一时刻只发一个 refresh 请求；并发 401 共享结果
 * - httpOnly 凭证：refresh 成功后新 token 由后端 `Set-Cookie: HttpOnly` 自动写入，
 *   前端 JS 拿不到也无需拿到 token 字符串——`refreshSession` 只负责"让凭证续期"，
 *   续期成功后调用方直接重发原请求（cookie 自动携带新凭证）
 * - 配置化：endpoint + 自定义 refresh 函数可配（后端契约确定后调整）
 * - 失败传播：refresh 失败时抛出，由调用方（http.ts）决定后续行为（清标记 + 跳登录页）
 *
 * 注意：当前 refresh 接口契约暂未与后端确认，默认实现是占位。
 * 后端契约确定后，仅需修改 `configureTokenRefresh` 配置参数即可。
 *
 * @see [`src/api/http.ts`](./http.ts) `request<T>` 401 retry 调用点
 * @group 网络基建：会话续期
 */

const getAPIBaseURL = () => import.meta.env.VITE_API_BASE_URL

/**
 * 会话续期配置。
 *
 * 后端契约确定后调整：
 * - url：refresh 接口路径
 * - refresh：自定义请求函数（默认 axios POST + withCredentials）
 */
export interface TokenRefreshConfig {
  /** refresh 接口路径（相对于 baseURL） */
  url: string
  /** 自定义 refresh 函数（默认使用 axios POST；成功即视为凭证已续期） */
  refresh?: () => Promise<unknown>
}

const DEFAULT_CONFIG: Required<TokenRefreshConfig> = {
  url: '/auth/refresh',
  refresh: async () => {
    // baseURL 在 vitest jsdom 环境可能为 undefined，降级为空串避免路径拼接异常
    // url 使用 currentConfig.url（运行时读取）确保 configureTokenRefresh 改动生效
    // withCredentials：refresh 需携带旧 cookie（凭证），成功后后端 Set-Cookie 新凭证
    const baseURL = getAPIBaseURL() ?? ''
    await axios.post(
      `${baseURL}${currentConfig.url}`,
      {},
      {
        timeout: 15000,
        withCredentials: true,
      }
    )
  },
}

/**
 * 当前生效配置（模块级单例；通过 configureTokenRefresh 修改）
 */
let currentConfig: Required<TokenRefreshConfig> = {
  ...DEFAULT_CONFIG,
}

/**
 * 修改 refresh 适配器配置（应用启动时调用一次）。
 *
 * 注意：只覆盖显式提供的字段；undefined 值不会覆盖已有配置。
 */
export function configureTokenRefresh(config: Partial<TokenRefreshConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...(config.url !== undefined ? { url: config.url } : {}),
    ...(config.refresh !== undefined ? { refresh: config.refresh } : {}),
  }
}

/**
 * 单例刷新状态：保存正在进行的 refresh Promise（用于并发去重）
 */
let refreshingPromise: Promise<void> | null = null

/**
 * 让当前会话凭证续期：
 * - 若当前已有 refresh 在飞：等待其完成并复用结果
 * - 否则：发起新的 refresh 请求（成功后凭证已由后端 Set-Cookie 更新）
 *
 * 失败时抛出错误，调用方决定后续行为。
 *
 * 循环防护：http.ts 调用时检查 config.url 是否为 refresh 端点，是则跳过本函数。
 */
export async function refreshSession(): Promise<void> {
  if (!refreshingPromise) {
    refreshingPromise = doRefresh()
  }
  try {
    await refreshingPromise
  } catch (err) {
    // 失败时清空状态，让下次重试可以重新发起
    refreshingPromise = null
    throw err
  }
}

async function doRefresh(): Promise<void> {
  await currentConfig.refresh()
  // 成功完成后再清空 refreshingPromise（保证并发请求都能拿到结果）
  refreshingPromise = null
}

/** @internal 测试用：清空 refresh 状态 */
export function _resetRefreshing(): void {
  refreshingPromise = null
}

/** @internal 测试用：读取当前配置 */
export function _getCurrentConfig(): Readonly<Required<TokenRefreshConfig>> {
  return currentConfig
}
