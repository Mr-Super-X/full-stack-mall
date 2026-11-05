/**
 * 请求 ID 生成与透传工具。
 *
 * 设计要点：
 * - 每个请求生成唯一 ID（X-Request-ID header）
 * - 响应拦截器读取后端回传的 X-Request-ID 用于日志串联
 * - 生产环境排查问题时可在浏览器控制台 + 后端日志按 ID 关联
 *
 * @see [`src/api/http.ts`](./http.ts) 拦截器读写 X-Request-ID
 * @group 网络基建：请求追踪
 */

const REQUEST_ID_HEADER = 'X-Request-ID'

/**
 * 生成请求 ID（浏览器原生 crypto.randomUUID()）。
 * 不可用时降级到时间戳+随机数兜底。
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 透传 ID：从后端响应读取 X-Request-ID；
 * 若缺失则用传入的 fallback（请求拦截器刚生成的 ID）。
 */
export function readRequestId(responseHeaders: Record<string, unknown>, fallback: string): string {
  const raw = responseHeaders[REQUEST_ID_HEADER]
  if (Array.isArray(raw)) return (raw[0] as string | undefined) ?? fallback
  if (typeof raw === 'string' && raw.length > 0) return raw
  return fallback
}

export { REQUEST_ID_HEADER }
