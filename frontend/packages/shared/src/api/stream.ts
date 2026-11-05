import { Session } from '../utils/storage.ts'

/**
 * 流式响应（SSE / NDJSON）。
 *
 * 设计要点：
 * - 基于 fetch + ReadableStream（不用 EventSource 因为它不支持自定义 header）
 * - Auth 走 Authorization header（与现有 http.ts 一致）
 * - 自动识别 SSE 格式（每行 `data: ...`）和纯 NDJSON（每行一个 JSON）
 * - 调用方通过 onMessage 回调接收每条消息；onError 捕获流错误
 * - 返回的 handle.cancel() 可主动终止流
 *
 * @example SSE 流（AI chat 等场景）
 * ```ts
 * const handle = requestStream<ChatChunk>({
 *   url: '/ai/chat/stream',
 *   method: 'POST',
 *   data: { prompt: 'hi' },
 *   onMessage: (chunk) => console.log(chunk),
 *   onError: (err) => console.error(err),
 * })
 * // 主动终止：handle.cancel()
 * ```
 *
 * @example NDJSON 流（换行分隔的 JSON）
 * ```ts
 * const handle = requestStream<LogEvent>({
 *   url: '/logs/stream',
 *   format: 'ndjson',  // 显式指定
 *   onMessage: (event) => handleEvent(event),
 * })
 * ```
 *
 * @see [`src/api/http.ts`](./http.ts) `withCredentials` 等通用配置参考
 * @group 网络基建：流式响应
 */

const getAPIBaseURL = () => import.meta.env.VITE_API_BASE_URL ?? ''

export type StreamFormat = 'sse' | 'ndjson' | 'auto'

export interface StreamOptions<T> {
  /** 相对路径或完整 URL（baseURL 与现有 http.ts 一致） */
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
  /** SSE / NDJSON / auto（默认 auto：检测首行 `data:`） */
  format?: StreamFormat
  onMessage: (data: T) => void
  onError?: (err: unknown) => void
  /** 外部 signal：与 handle.cancel() 联动 */
  signal?: AbortSignal
  /** 自定义 fetch 注入（默认全局 fetch） */
  fetchImpl?: typeof fetch
}

export interface StreamHandle {
  /** 主动终止流；调用后 onMessage 不会再触发 */
  cancel: () => void
  /** Promise：流完成（成功或失败）后 resolve */
  done: Promise<void>
}

/**
 * 发起流式请求。
 * 失败时通过 onError 回调 + done.reject 通知；不抛异常。
 */
export function requestStream<T>(options: StreamOptions<T>): StreamHandle {
  const controller = new AbortController()
  // 合并外部 signal：任一 abort 都会终止流
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const baseURL = getAPIBaseURL()
  const fullURL = options.url.startsWith('http') ? options.url : `${baseURL}${options.url}`

  const headers: Record<string, string> = {
    Accept: options.format === 'ndjson' ? 'application/x-ndjson' : 'text/event-stream',
  }
  const token = Session.get<string>('token')
  if (token) headers.Authorization = `Bearer ${token}`

  const promise = (async () => {
    let response: Response
    try {
      response = await fetchImpl(fullURL, {
        method: options.method ?? 'GET',
        headers,
        // fetch 不接受 undefined，仅在有 body 时传递
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      })
    } catch (err) {
      options.onError?.(err)
      throw err
    }

    if (!response.ok) {
      const err = new Error(`Stream request failed: ${response.status}`)
      options.onError?.(err)
      throw err
    }

    if (!response.body) {
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // 按行解析
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const rawLine of lines) {
          const line = rawLine.trimEnd()
          if (!line) continue
          parseAndDispatch<T>(line, options)
        }
      }
      // 处理流结束后的残余 buffer
      if (buffer.trim()) {
        parseAndDispatch<T>(buffer, options)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        options.onError?.(err)
        throw err
      }
    }
  })()

  return {
    cancel: () => controller.abort(),
    done: promise.then(
      () => undefined,
      () => undefined
    ),
  }
}

/**
 * 单行解析：根据 format 分发到 SSE / NDJSON 处理。
 * SSE 格式：每行 `data: <json>`，多行 `data:` 合并为单个事件（这里简化为每行一个事件）
 * NDJSON 格式：每行一个 JSON
 */
function parseAndDispatch<T>(line: string, options: StreamOptions<T>): void {
  try {
    let payload: string
    if (options.format === 'ndjson') {
      payload = line
    } else if (options.format === 'sse') {
      if (!line.startsWith('data:')) return
      payload = line.slice(5).trim()
      if (payload === '[DONE]') return // SSE 结束标记
    } else {
      // auto：检测首字符是否为 `data:`
      if (line.startsWith('data:')) {
        payload = line.slice(5).trim()
        if (payload === '[DONE]') return
      } else {
        payload = line
      }
    }
    if (!payload) return
    const data = JSON.parse(payload) as T
    options.onMessage(data)
  } catch (err) {
    // 解析失败：记录但不中断流（容忍单条脏数据）
    options.onError?.(err)
  }
}
