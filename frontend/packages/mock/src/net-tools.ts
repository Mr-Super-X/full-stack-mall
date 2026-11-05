import type { MockMethod } from 'vite-plugin-mock'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readBody, respondAfter } from './_utils'

/**
 * 网络基建演示 mock（apps/docs 的 ApiConcurrent / ApiRetry / ApiMerge 三个 demo 消费）。
 *
 * 演示目标：让 Network 面板可观察真实 XHR——
 * - 并发瀑布：POST /mock/demo-net/shard × N 同刻发起，随机延迟 300~700ms
 * - 重试序列：GET /mock/demo-net/retry 按 failTimes 先返失败后成功，退避间隔可见
 * - 合并去重：GET /mock/demo-net/merge 窗口内多次同参触发仅 1 次真实请求（服务端计数）
 *
 * ⚠️ 延迟仅 dev 生效：rawResponse 挂起式延迟在 prod（mockjs XHR 劫持）被静默忽略
 * （同 stream.ts 先例）。prod 等价版见 mockProdServer.ts 内联 prodNetToolsMocks
 * （response 函数形态，无延迟；计数/状态机逻辑两处手工对齐，同 auth 先例）。
 * dev 加载走 viteMockServe 目录扫描（同 dict.ts，不进 src/index.ts 聚合——
 * check-mock-wiring 只比对 index.ts 的 import 清单，本文件不参与）。
 *
 * rawResponse 两个必须遵守的约束见 _utils.ts 的 respondAfter 头注（挂起式延迟 + 断连清理），
 * 本文件与 stream.ts 的 rawResponse 调用方共用。
 */

/** 分片上传随机延迟区间（ms）——模拟真实网络抖动，Network 瀑布可见 */
const SHARD_LATENCY = { min: 300, max: 700 } as const
/** 重试接口固定延迟（ms）：仅让请求真实落地，退避间隔由 withRetry 制造 */
const RETRY_LATENCY_MS = 80
/** 合并接口固定延迟（ms） */
const MERGE_LATENCY_MS = 60

/** retry 状态机：按 url 全串（含 nonce query）计数失败次数——demo 每次执行换 nonce 保证独立 */
const retryCounters = new Map<string, number>()

/** merge 真实请求计数器（demo 带 reset=1 归零重开一轮） */
let mergeRequestCount = 0

function parseQuery(req: IncomingMessage): URLSearchParams {
  return new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
}

export default [
  {
    url: '/mock/demo-net/shard',
    method: 'post',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readBody(req)
      const index = typeof body.index === 'number' ? body.index : -1
      const shouldFail = body.fail === true
      const latency =
        SHARD_LATENCY.min + Math.floor(Math.random() * (SHARD_LATENCY.max - SHARD_LATENCY.min))
      await respondAfter(
        req,
        res,
        latency,
        shouldFail ? 500 : 200,
        shouldFail
          ? { code: 500, message: `shard ${index} network error`, data: null }
          : { code: 200, message: 'ok', data: { index } }
      )
    },
  },
  {
    url: '/mock/demo-net/retry',
    method: 'get',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const query = parseQuery(req)
      const failTimes = Number(query.get('failTimes') ?? '0')
      const failStatus = Number(query.get('status') ?? '500')
      // 每轮演示独立计数：demo 带 t=nonce，key 全串含 nonce（两次执行互不复用失败额度）
      const key = req.url ?? ''
      const attempted = retryCounters.get(key) ?? 0
      retryCounters.set(key, attempted + 1)
      // Map 无限增长防护：key 含 nonce 不重复命中，超阈值整体清空（演示场景量级极小）
      if (retryCounters.size > 500) retryCounters.clear()

      const stillFailing = attempted < failTimes
      await respondAfter(
        req,
        res,
        RETRY_LATENCY_MS,
        stillFailing ? failStatus : 200,
        stillFailing
          ? { code: failStatus, message: `attempt ${attempted + 1} failed`, data: null }
          : { code: 200, message: 'ok', data: 'request-ok' }
      )
    },
  },
  {
    url: '/mock/demo-net/merge',
    method: 'get',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const query = parseQuery(req)
      if (query.get('reset') === '1') mergeRequestCount = 0
      mergeRequestCount += 1
      await respondAfter(req, res, MERGE_LATENCY_MS, 200, {
        code: 200,
        message: 'ok',
        data: { count: mergeRequestCount },
      })
    },
  },
] satisfies MockMethod[]
