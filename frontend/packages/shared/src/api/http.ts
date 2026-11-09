/**
 * HTTP 客户端核心：axios 实例 + 拦截器链 + 业务侧统一入口 `request<T>()`。
 *
 * 设计要点：
 * - 单一来源：所有 API url 都不带 /api 前缀，由 baseURL 统一拼装（避免 /api/api 双拼）
 * - 拦截器职责单一（2026-10-27 事件化改造）：响应错误只归一化为 ApiError + 发
 *   error-events 事件 + 抛错——不直接 toast。反馈决策权交给订阅方（@vv/ui
 *   useNetworkBanner：业务错误 toast 兜底、网络类错误聚合横幅、config.silent
 *   探测请求全程静默）；401 不 emit（refresh 重试链在 request 层处理，避免误报）
 * - 业务码解包与 data 提取下沉到 `request<T>()`，拦截器签名天然满足 AxiosInterceptorFulfilled 类型
 *   （AxiosResponse -> AxiosResponse），避免使用 `as any` / `as never` 逃类型
 * - 认证模式（2026-08-12 httpOnly 改造）：凭证 token 由后端 Set-Cookie: HttpOnly 下发，
 *   前端 JS 不可读；请求靠 `withCredentials` 让浏览器自动携带 cookie，不再注入 Bearer header
 * - 所有抛出错误归一为 `ApiError`，调用方 `err instanceof ApiError` 即可 narrowing
 * - 可选能力（cancel/retry/merge/pageAdapter/cache/request-id/token-refresh）拆到独立模块，
 *   `request<T>` 保持简单，业务层零迁移
 *
 * @see [`src/api/token-refresh.ts`](./token-refresh.ts) 401 自动续期
 * @see [`src/api/page-adapter.ts`](./page-adapter.ts) 分页自动适配
 * @see [`src/api/cache.ts`](./cache.ts) GET 内存缓存
 * @group 网络基建：核心
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type GenericAbortSignal,
} from 'axios'
import { ElMessage } from 'element-plus'
// 显式 import 不经 AutoImport resolver 的 importStyle 注入，消息样式须自行携带
import 'element-plus/es/components/message/style/css'
import { BusinessCode } from '../enums/httpEnum.ts'
import { Session } from '../utils/storage.ts'
import type { ApiResponse } from './types/api.d'
import { ApiError } from './types/error'
import { resolveHttpStatusMessage } from './http-errors'
import { emitHttpError, emitHttpRecoveredIfApplicable } from './error-events'
// 拦截器层 toast/兜底文案走 i18n.global.t（无 setup 上下文；2026-10-29 逻辑层硬编码清零）
import { i18n } from '../locales/index.ts'
import { globalAbort, chainSignals } from './global-abort'
import {
  buildBackendPageQuery,
  adaptBackendPage,
  _getRequestFieldMap,
  _getResponseFieldMap,
} from './page-adapter'
import { generateRequestId, REQUEST_ID_HEADER } from './request-id'
import { cacheGet, cacheSet, buildCacheKey } from './cache'
import { refreshSession, _getCurrentConfig } from './token-refresh'
import { getAppRouter } from '../app-router.ts'
import { redirectToAuthLogin } from '../auth/redirect.ts'
// LOGIN_URL 单源自 api/modules/auth.ts（security-reviewer 审查项：防硬编码双写，后端契约
// 变更漏匹配会让登录失败 bug 静默复发）
import { LOGIN_URL } from './modules/auth.ts'

/**
 * 扩展 AxiosRequestConfig：标记分页列表请求 / 内存缓存（一次性的可插拔能力）。
 *
 * 设计要点：
 * - 业务模块调用 request<T> 时，对列表接口加 usePageAdapter: true 即可
 * - http.ts 请求拦截器自动从 params 抽 page/pageSize 调 buildBackendPageQuery 注入
 * - http.ts request<T> 自动把后端响应包装为 Pagination<T>
 * - 对 GET 接口加 cache: { ttl } 可启用内存缓存（TTL 内相同请求不重复发）
 * - 默认（不传标记）行为零变化
 *
 * 字段映射由 page-adapter.ts 模块级 configurePaginationAdapter() 配置，
 * 一次设置全局生效，零业务改动。
 *
 * @example 列表请求（自动转换）
 * ```ts
 * const page = await request<Pagination<EquipmentItem>>({
 *   url: '/equipment/list',
 *   method: 'get',
 *   params: { page: 1, pageSize: 20, keyword: 'x' },
 *   usePageAdapter: true,
 * })
 * ```
 *
 * @example GET 缓存
 * ```ts
 * const page = await request<Pagination<EquipmentItem>>({
 *   url: '/equipment/list',
 *   method: 'get',
 *   params: { page: 1, pageSize: 20 },
 *   usePageAdapter: true,
 *   cache: { ttl: 30 },  // 30 秒内不重复请求
 * })
 * ```
 *
 * @example 非列表请求（不传标记，行为不变）
 * ```ts
 * const user = await request<User>({ url: '/user/1', method: 'get' })
 * ```
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 标记为分页列表请求（仅对列表接口生效）。
     * 设为 true 后请求/响应自动按 page-adapter 约定转换；非列表请求不传此字段。
     */
    usePageAdapter?: boolean
    /**
     * GET 请求内存缓存（TTL 秒）。
     * 设计：单位为秒，与 Redis EXPIRE / HTTP cache-control 一致。
     */
    cache?: {
      ttl: number
      key?: string
    }
    /**
     * 内部标记：token-refresh 重试机制使用，避免无限循环。
     * 业务模块不应设置此字段。
     */
    _retried?: boolean
    /**
     * 静默探测标记（2026-10-27 事件化改造）：登录态探测/预取类请求设为 true 后，
     * 拦截器跳过错误事件广播——调用方 .catch 照常收到 ApiError 自行降级，
     * 但全局反馈层（toast/网络横幅）不感知。行业标准 silent/skipNotify 语义
     * （对齐 vue-element-admin errorHandle / Ant Design Pro skipErrorHandler）。
     */
    silent?: boolean | undefined
  }
}

const getAPIBaseURL = () => import.meta.env.VITE_API_BASE_URL

const instance: AxiosInstance = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 15000,
  // httpOnly 凭证：跨域时浏览器自动携带 cookie；后端 CORS 需配 Access-Control-Allow-Credentials
  withCredentials: true,
})

// ────────────────────────────────────────────────────────────────────
// 请求拦截器辅助函数（按职责拆分；interceptor 本身只做编排）
// ────────────────────────────────────────────────────────────────────

/**
 * 合并请求 signal 与 globalAbort signal：logout 时 globalAbort.abort() 会取消所有在途请求。
 */
function applyAbortSignal(config: AxiosRequestConfig): void {
  config.signal = chainSignals(
    config.signal as unknown as AbortSignal | undefined,
    globalAbort.signal as AbortSignal | undefined
  ) as GenericAbortSignal
}

/**
 * 分页请求自动转换：抽出 page/pageSize 调 buildBackendPageQuery 注入。
 */
function applyPageAdapterParams(config: AxiosRequestConfig): void {
  if (!config.usePageAdapter || !config.params || typeof config.params !== 'object') {
    return
  }
  const rawParams = config.params as Record<string, unknown>
  const page = typeof rawParams.page === 'number' ? rawParams.page : undefined
  const pageSize = typeof rawParams.pageSize === 'number' ? rawParams.pageSize : undefined
  const { page: _p, pageSize: _ps, ...rest } = rawParams
  config.params = {
    ...buildBackendPageQuery(
      {
        ...(page !== undefined ? { page } : {}),
        ...(pageSize !== undefined ? { pageSize } : {}),
      },
      _getRequestFieldMap()
    ),
    ...rest,
  }
}

/**
 * 注入 X-Request-ID header。
 */
function applyRequestIdHeader(config: AxiosRequestConfig): void {
  if (!config.headers) return
  const id = generateRequestId()
  const headers = config.headers as { set?: unknown }
  if (typeof headers.set === 'function') {
    ;(headers as { set: (k: string, v: string) => void }).set(REQUEST_ID_HEADER, id)
  } else {
    ;(config.headers as Record<string, string>)[REQUEST_ID_HEADER] = id
  }
}

instance.interceptors.request.use((config) => {
  applyAbortSignal(config)
  applyPageAdapterParams(config)
  applyRequestIdHeader(config)
  // dev 模式调试日志（2026-07-24 审计补齐）：拦截器链逐步追踪，
  // 排查"哪个阶段抛错 / pageAdapter 是否正确转换"
  if (import.meta.env.DEV) {
    console.debug('[HTTP][req]', {
      method: (config.method ?? 'get').toUpperCase(),
      url: config.url,
      params: config.params,
      usePageAdapter: config.usePageAdapter,
      cache: config.cache,
      signal: !!config.signal,
    })
  }
  return config
})

// ────────────────────────────────────────────────────────────────────
// 响应拦截器辅助函数
// ────────────────────────────────────────────────────────────────────

/**
 * 构造 ApiError：body 缺失时走 fallback。
 */
const buildApiError = (
  body: ApiResponse<unknown> | null | undefined,
  response: AxiosResponse<ApiResponse<unknown>>,
  fallbackMessage: string
): ApiError =>
  new ApiError({
    code: body?.code ?? -1,
    message: body?.message || fallbackMessage,
    // 业务码错误（HTTP 200 + body.code≠200）显式回填 HTTP status——否则 status=undefined，
    // 会被 isNetworkLevelError(undefined)=true 误判网络级弹「网络连接异常」横幅
    // （真后端把 404 包成 code:500 时，/menu 等业务错误误报网络异常，2026-11-09 实测根因）
    status: response.status,
    url: response.config.url,
  })

/**
 * 401 业务码：纯抛 ApiError；不做 toast/logout/redirect。
 *
 * 副作用由 request<T>() 包裹层统一处理：
 * - 成功 refresh + retry → 静默重发
 * - refresh 失败 → performLogout() + 抛出原 ApiError
 *
 * 这样能避免"直接调用 handleUnauthorized 时与 retry 流程副作用不一致"。
 */
function handleUnauthorized(
  body: ApiResponse<unknown>,
  response: AxiosResponse<ApiResponse<unknown>>
): never {
  // 后端未返回 message 时按 401 语义兜底（正常后端总会带 message，此层为防御兜底——2026-10-29 i18n 化）
  throw buildApiError(body, response, body.message || i18n.global.t('error.http.401'))
}

/**
 * 其他业务错误：emit 错误事件 + 抛 ApiError。
 * 事件由订阅方（@vv/ui useNetworkBanner）决定 toast 兜底——业务码错误属业务级，
 * 走 ElMessage.error 默认通道，与拦截器事件化改造前的用户可见行为一致。
 */
function handleGenericError(
  body: ApiResponse<unknown> | null | undefined,
  response: AxiosResponse<ApiResponse<unknown>>
): never {
  // 后端 message 兜底（防御层）：业务错误正常带后端 message，无 message 时按通用客户端失败文案
  const message = body?.message || i18n.global.t('error.http.clientFallback')
  const apiError = buildApiError(body, response, message)
  emitHttpError(apiError)
  throw apiError
}

/**
 * 登出副作用：toast + 清登录标记 + 整页跳统一登录应用（apps/auth）。
 * 由 refresh 失败流程调用（凭证彻底失效，无法续期）。
 *
 * P4 变更：不再 `router.push('/login')`（auth 独立后消费方 app 内无登录路由），
 * 改 `redirectToAuthLogin` 整页跳转；其中断信号（AUTH_REDIRECTING throw）在本层吞掉——
 * 保持调用方 request<T>() 抛出原 ApiError 的既有契约（见 http.spec.ts）。
 *
 * router 实例经 DI 读取（getAppRouter，P1-3 包化改造）：静态 import app 侧 router
 * 会形成 http → router → guards → store → api 的包间循环依赖；app 启动时已
 * registerAppRouter（守卫在 createRouter 之后才执行，时序安全）。
 * 子路径部署的 origin/前缀由 VITE_AUTH_ORIGIN env 注入（见 ../auth/redirect.ts）。
 * 凭证 cookie（HttpOnly）前端删不掉，由后端 logout/refresh 失效处理；
 * 前端只清无敏感信息的登录标记。
 */
async function performLogout(): Promise<void> {
  // 无本地登录标记 = 本就未登录（2026-10-30 实测 bug：全公开 app（portal）登录态探测请求
  // 401 时被整页踢去登录页——探测方没有可清的会话，清标记/跳登录是破坏公开页的多余动作）。
  // 语义修正：仅在有标记（会话曾建立）时才走完整登出连锁；无标记静默返回，由调用方按
  // 「未登录」自行处理（如 portal 头部保持登录按钮态）。有标记场景（凭证真过期）行为不变。
  if (!Session.get('auth')) return
  ElMessage.error(i18n.global.t('auth.sessionExpired'))
  Session.remove('auth')
  try {
    redirectToAuthLogin(getAppRouter().currentRoute.value.fullPath)
  } catch {
    // AUTH_REDIRECTING 中断信号：整页跳转已发起，吞掉以保持原 ApiError 契约
  }
}

// 业务码 → 副作用处理器查表。
const BUSINESS_CODE_HANDLERS: Record<
  number,
  (body: ApiResponse<unknown>, response: AxiosResponse<ApiResponse<unknown>>) => never
> = {
  [BusinessCode.UNAUTHORIZED]: handleUnauthorized,
}

const onResponseFulfilled = (
  response: AxiosResponse<ApiResponse<unknown>>
): AxiosResponse<ApiResponse<unknown>> => {
  // 网络恢复信号：末次错误后的首个 2xx 到达即网络已通（与业务码无关——
  // 后端能返回业务码错误也说明网络活着），通知横幅通道收尾。常态零开销（时间戳比较）。
  emitHttpRecoveredIfApplicable()

  const body = response.data
  if (response.status === 200 && body?.code === BusinessCode.SUCCESS) return response
  const handler = BUSINESS_CODE_HANDLERS[body?.code ?? -1]
  if (handler) return handler(body, response)
  return handleGenericError(body, response)
}

const onResponseRejected = (error: {
  code?: string
  response?: AxiosResponse
  config?: { url?: string; silent?: boolean }
  message?: string
}): never => {
  const status = error.response?.status
  const message = resolveHttpStatusMessage(status)
  const apiError = new ApiError({
    code: status ?? -1,
    message,
    status,
    url: error.config?.url,
    // 取消标记：status undefined + code -1 的取消错误与网络错误同形态，
    // 无标记会被 withRetry 默认策略误判为可重试——logout/卸载被退避 sleep 延迟约 1s
    canceled: error.code === 'ERR_CANCELED',
    cause: error,
  })

  // ── 事件化反馈的三级过滤（2026-10-27；过滤顺序即判定优先级）──
  // ① 主动取消（logout 的 globalAbort / 组件卸载 signal）不是错误：静默抛错。
  //    修正事件化前的既有误报——取消请求的 error.response 为 undefined，
  //    会被当成「网络异常」弹 toast（logout 瞬间整页跳走，误报长期未被察觉）。
  if (error.code === 'ERR_CANCELED') {
    throw apiError
  }
  // ② silent 探测请求：调用方自行 catch 降级，全局反馈层（toast/横幅）不感知。
  if (error.config?.silent) {
    throw apiError
  }
  // ③ 401 不 emit：request<T>() 层的 refresh 重试链会处理（重试成功则零反馈；
  //    refresh 失败由 performLogout 弹「会话过期」并整页跳登录）。事件化前的
  //    拦截器在此弹「请先登录」toast，refresh 成功也会误报一次——本过滤顺带修正。
  if (status !== 401) {
    // dev 模式调试日志（2026-07-24 审计补齐）：记录网络/超时/状态码异常
    if (import.meta.env.DEV) {
      console.debug('[HTTP][resp][error]', {
        url: error.config?.url,
        status,
        message,
      })
    }
    emitHttpError(apiError)
  }
  throw apiError
}

instance.interceptors.response.use(onResponseFulfilled, onResponseRejected)

// ────────────────────────────────────────────────────────────────────
// request<T>()：业务侧统一入口（含 token-refresh 重试 + 缓存 + 分页适配）
// ────────────────────────────────────────────────────────────────────

/**
 * 检查 URL 是否指向 refresh 端点（避免 refresh 自身 401 触发循环）。
 */
function isRefreshRequestUrl(url: string | undefined): boolean {
  if (!url) return false
  const refreshUrl = _getCurrentConfig().url
  return url.endsWith(refreshUrl) || url.includes(refreshUrl)
}

/**
 * 检查 URL 是否指向登录端点（2026-10-28 bug 修复，security-reviewer 审查通过）。
 *
 * 为什么登录端点要豁免 401 refresh 链：密码错误的 401（业务码）没有可 refresh 的凭证，
 * refresh 必失败 → 误走 performLogout 跳登录页；且 performLogout 仅靠 Session 登录标记
 * 守卫，无法区分「真会话过期」与「上次登录残留标记」——已登录用户输错密码时守卫放行，
 * 整页跳 /auth/login?redirect=<当前路由> 并吞掉「账号或密码错误」toast（本次 bug 根因）。
 * 豁免后：登录 401 纯抛 ApiError，由 Login.vue catch 弹提示。
 *
 * 匹配口径：只用 endsWith 精确后缀。config.url 恒为相对路径 '/auth/login'；不模仿
 * isRefreshRequestUrl 的 includes（宽松口径是 refresh 端点既有形态）——includes 会误豁免
 * '/auth/login-status' 等已认证接口，导致其真凭证过期失去静默续期（security-reviewer HIGH 项）。
 */
function isLoginRequestUrl(url: string | undefined): boolean {
  if (!url) return false
  return url.endsWith(LOGIN_URL)
}

/**
 * 基础请求：返回 `body.data` 字段对应的强类型 T，错误归一为 ApiError。
 *
 * 包含以下自动能力：
 * - 401 自动 refresh + retry（除非 refresh 端点本身）
 * - GET 缓存（TTL 秒内同 key 请求不重复发）
 * - 分页自动适配（usePageAdapter: true）
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const method = (config.method ?? 'get').toLowerCase()

  // 缓存命中：直接返回（仅 GET）
  if (config.cache && method === 'get') {
    const key = config.cache.key ?? buildCacheKey(method, config.url ?? '', config.params)
    const cached = cacheGet<T>(key)
    if (cached !== null) return cached
  }

  try {
    const res = await instance.request<ApiResponse<unknown>, AxiosResponse<ApiResponse<unknown>>>(
      config
    )
    let data = res.data.data
    if (config.usePageAdapter) {
      data = adaptBackendPage(data as Record<string, unknown>, _getResponseFieldMap()) as unknown
    }

    if (config.cache && method === 'get') {
      const key = config.cache.key ?? buildCacheKey(method, config.url ?? '', config.params)
      cacheSet(key, data, config.cache.ttl)
    }

    return data as T
  } catch (err) {
    // 401 自动 refresh + retry（仅一次）：
    // refreshSession 成功后新凭证已由后端 Set-Cookie 写入，重发原请求自动携带
    if (
      err instanceof ApiError &&
      (err.code === 401 || err.code === BusinessCode.UNAUTHORIZED) &&
      !config._retried &&
      !isRefreshRequestUrl(config.url) &&
      !isLoginRequestUrl(config.url)
    ) {
      try {
        await refreshSession()
        config._retried = true
        // 递归调用：_retried=true 防止无限循环
        return await request<T>(config)
      } catch {
        // refresh 失败：登出 + 抛出原 ApiError
        await performLogout()
      }
    }
    throw err
  }
}

/**
 * axios 原始实例导出：仅供需要自定义拦截器或流式进度的特殊场景。
 * 普通业务应使用 request<T>()。
 */
export default instance
