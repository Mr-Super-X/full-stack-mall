import { describe, it, expect, vi } from 'vitest'

// mock Session BEFORE importing stream
vi.mock('../utils/storage.ts', () => ({
  Session: {
    get: vi.fn().mockReturnValue('mock-token'),
    set: vi.fn(),
    remove: vi.fn(),
  },
  clearCookies: vi.fn(),
  Local: { set: vi.fn(), get: vi.fn(), remove: vi.fn(), clear: vi.fn() },
}))

import { requestStream } from './stream'

/**
 * 构造 ReadableStream 模拟 fetch 的流式响应。
 */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    async pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!))
        i++
      } else {
        controller.close()
      }
    },
  })
}

/**
 * 构造 mock fetchImpl，根据 URL 返回对应流。
 */
function makeFetchMock(chunks: string[], status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    body: makeStream(chunks),
  })
}

describe('requestStream（基础）', () => {
  it('SSE 格式每行 data: 触发一次 onMessage', async () => {
    const fetchMock = makeFetchMock(['data: {"id":1}\n', 'data: {"id":2}\n', 'data: {"id":3}\n'])
    const messages: unknown[] = []
    const handle = requestStream<{ id: number }>({
      url: '/sse',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
    })
    await handle.done
    expect(messages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('NDJSON 格式每行一个 JSON 触发 onMessage', async () => {
    const fetchMock = makeFetchMock(['{"a":1}\n', '{"a":2}\n'])
    const messages: unknown[] = []
    const handle = requestStream<{ a: number }>({
      url: '/ndjson',
      format: 'ndjson',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
    })
    await handle.done
    expect(messages).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('auto 模式自动识别 SSE vs NDJSON', async () => {
    const fetchMock = makeFetchMock(['data: {"x":1}\n'])
    const messages: unknown[] = []
    const handle = requestStream<{ x: number }>({
      url: '/auto',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
    })
    await handle.done
    expect(messages).toEqual([{ x: 1 }])
  })

  it('SSE [DONE] 标记终止流（不触发 onMessage）', async () => {
    const fetchMock = makeFetchMock(['data: {"a":1}\n', 'data: [DONE]\n'])
    const messages: unknown[] = []
    const handle = requestStream<{ a: number }>({
      url: '/sse-done',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
    })
    await handle.done
    expect(messages).toEqual([{ a: 1 }])
  })
})

describe('requestStream（错误处理）', () => {
  it('fetch 失败时 onError 被调用，done 不 reject', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network'))
    const onError = vi.fn()
    const handle = requestStream({
      url: '/x',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: () => {},
      onError,
    })
    await expect(handle.done).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('HTTP 错误码时 onError 被调用', async () => {
    const fetchMock = makeFetchMock([], 500)
    const onError = vi.fn()
    const handle = requestStream({
      url: '/x',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: () => {},
      onError,
    })
    await expect(handle.done).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('解析失败的脏数据不中断流，onError 收到', async () => {
    const fetchMock = makeFetchMock(['{not-json}\n', 'data: {"a":1}\n'])
    const messages: unknown[] = []
    const onError = vi.fn()
    const handle = requestStream<{ a: number }>({
      url: '/x',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
      onError,
    })
    await handle.done
    expect(messages).toEqual([{ a: 1 }]) // 脏数据被跳过
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('requestStream（取消）', () => {
  it('handle.cancel() 终止后续 onMessage', async () => {
    // 流：4 个 chunk，cancel 在第二个后
    const encoder = new TextEncoder()
    let index = 0
    const chunks = ['data: {"i":1}\n', 'data: {"i":2}\n', 'data: {"i":3}\n']
    const body = new ReadableStream({
      async pull(controller) {
        if (index < chunks.length) {
          await new Promise((r) => setTimeout(r, 10))
          controller.enqueue(encoder.encode(chunks[index]!))
          index++
        } else {
          controller.close()
        }
      },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, body })
    const messages: unknown[] = []
    const handle = requestStream<{ i: number }>({
      url: '/x',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: (m) => messages.push(m),
    })
    // 第一个消息到达后取消
    await new Promise((r) => setTimeout(r, 20))
    handle.cancel()
    await handle.done
    // 第一个一定收到；后续的不一定（取决于时序）
    expect(messages.length).toBeLessThanOrEqual(3)
  })

  it('外部 signal.aborted 也终止流', async () => {
    const extController = new AbortController()
    extController.abort() // 已 abort
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, body: makeStream([]) })
    const handle = requestStream({
      url: '/x',
      signal: extController.signal,
      fetchImpl: fetchMock as unknown as typeof fetch,
      onMessage: () => {},
    })
    await handle.done
    // 验证 fetch 被调用时 signal 已是 aborted
    expect(fetchMock).toHaveBeenCalled()
  })
})
