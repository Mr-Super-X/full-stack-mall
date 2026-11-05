import type { MockMethod } from 'vite-plugin-mock'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readBody } from './_utils'

/**
 * AI chat SSE 流式 mock（requestStream 的演示数据源，apps/docs StreamRequest demo 消费）。
 *
 * 技术机制（vite-plugin-mock@3.0.2 dev 中间件）：rawResponse 的返回 Promise 被
 * `await` 挂起（dist/index.mjs 第 92-94 行），Promise 不 settle 中间件不返回、
 * connect 不继续——res 全程受控，可定时 write chunk 模拟流式推送。
 *
 * ⚠️ 两个必须遵守的约束（auth.ts setTimeout 404 事故同因）：
 * 1. 整个推送期必须挂起在 await 的 Promise 内部——定时器回调里 res.end() 后才
 *    resolve；「调度后提前 return」会触发 vite SPA fallback 404（中间件已完成，
 *    res 被 fallback 中间件覆写）。
 * 2. 客户端断连（fetch abort / 关闭页面）必须监听 req 'close' 清定时器 + 补
 *    res.end()——否则 Promise 永不 settle，中间件挂起 + 定时器泄漏。
 *
 * 已知边界：本文件仅 dev 可用。prod（gh-pages）createProdMockServer 是 mockjs
 * XHR 劫持（不拦 fetch），stream.ts 的 fetch 请求直接穿透到静态服务器 404；
 * 且 rawResponse 在 client 侧被静默忽略（同 auth.ts）。故 prod 不接线，由
 * check-mock-wiring 的 PROD_INLINE_EXEMPT 豁免（豁免语义见该脚本）。
 */

/** 单 chunk 推送间隔（ms）——模拟 LLM token 输出的节奏感 */
const CHUNK_INTERVAL_MS = 120

/** 预置回复：按 token 粒度切成独立 chunk，客户端累积渲染为打字机效果 */
const MOCK_REPLY_CHUNKS = [
  '你好！',
  '我是企业门户 AI 助手。',
  '\n\n',
  '这是一个由 mock 逐段推送的 SSE 流式响应，',
  '用来演示 requestStream 的接收 / 累积 / 取消能力。',
  '\n\n',
  '你可以点击「停止生成」测试 handle.cancel()，',
  '或在网络面板观察 Content-Type: text/event-stream 的逐 chunk 到达。',
]

/** SSE 帧序列化：每帧以空行结尾（data 行 + \n\n） */
function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

/** 校验凭证 cookie（复刻 auth.ts 语义；SSE 端点演示不强制鉴权，仅记录日志） */
function hasTokenCookie(req: IncomingMessage): boolean {
  const cookie = req.headers.cookie ?? ''
  return cookie.split(';').some((c) => c.trim().startsWith('token='))
}

export default [
  {
    url: '/mock/ai/chat/stream',
    method: 'post',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readBody(req)
      const prompt = typeof body.prompt === 'string' ? body.prompt : ''

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      // nginx 语义的缓冲禁用指令：dev 的 node 网关不缓冲（流式 pipe），写上也无害，
      // 提示「此端点是流式契约」给未来可能切回 nginx 的部署形态
      res.setHeader('X-Accel-Buffering', 'no')
      // 立即把响应头推给客户端（首个 chunk 前的元信息）
      res.flushHeaders()

      // 挂起式推送：定时器跑在 Promise 内部，期间中间件 await 不返回
      await new Promise<void>((resolve) => {
        let index = 0
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          clearInterval(timer)
          // 断连场景 res 可能已不可写，end 失败也允许（resolve 优先，勿挂起中间件）
          try {
            if (!res.writableEnded) res.end()
          } finally {
            resolve()
          }
        }
        // 客户端断连（fetch abort / 关页面）：清定时器 + 补 end + resolve，
        // 双保险——即便定时器还在等下一轮，finish 的 settled 幂等挡住重复
        req.on('close', finish)

        const timer = setInterval(() => {
          if (index < MOCK_REPLY_CHUNKS.length) {
            res.write(sseFrame({ content: MOCK_REPLY_CHUNKS[index]! }))
            index += 1
            return
          }
          // 流结束标记：SSE 惯例 [DONE]（stream.ts 解析器识别后静默跳过）
          res.write('data: [DONE]\n\n')
          finish()
        }, CHUNK_INTERVAL_MS)
      })

      // 日志仅 dev 可见：prompt 回显 + 凭证携带情况（便于排查 httpOnly 携带链路）
      console.log(
        `[mock:stream] /mock/ai/chat/stream prompt="${prompt.slice(0, 40)}" cookie=${hasTokenCookie(req) ? 'yes' : 'no'}`
      )
    },
  },
] as MockMethod[]
