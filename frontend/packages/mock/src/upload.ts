/**
 * 分片上传演示 mock（apps/docs 的 ApiUpload demo 消费，引擎契约见
 * packages/shared/src/api/upload/types.ts 的 UploadAdapter）。
 *
 * 本文件同时是后端实现的可运行参考——协议基线、校验清单与幂等语义
 * 见 packages/shared/src/api/upload/BACKEND.md（后端接口指导文档）。
 *
 * 协议（四接口）：
 * - POST   /mock/demo-upload/uploads/init           初始化；fileHash 幂等复用 = 断点续传
 * - PUT    /mock/demo-upload/uploads/:id/parts/:n   分片二进制；编号/大小校验 + 内容级幂等
 * - POST   /mock/demo-upload/uploads/:id/complete   齐全校验 + 模拟合并延迟 → fileUrl
 * - DELETE /mock/demo-upload/uploads/:id            取消清理（幂等，不存在也 200）
 *
 * 服务端校验清单（对照分片上传协议要求）：
 * - 分片编号：整数且 ∈ [0, totalChunks)
 * - 分片大小：非末片必须 === chunkSize；末片必须 === fileSize − chunkSize × (totalChunks − 1)
 * - 完整性：complete 时编号全覆盖 + 拼接总长 === fileSize（缺失列表回给客户端）
 * - 重复提交：PUT 同编号内容一致 → 幂等返同 ETag；内容不一致 → 409
 *
 * 内存防护：分片字节存内存（演示量级），session 30min 过期 + 超 64 个清最旧。
 *
 * 同 net-tools.ts 先例：rawResponse 挂起式延迟仅 dev 生效（约束见 _utils.ts respondAfter
 * 头注）；prod 等价版见 mockProdServer.ts 的 prodUploadMocks——mockjs XHR 劫持承载不了
 * 二进制 body（Blob 被字符串化为 "[object Blob]"），字节级完整性/内容幂等校验 prod 豁免，
 * 状态机/齐全校验/会话复用两处手工对齐。dev 加载走 viteMockServe 目录扫描，
 * 不进 src/index.ts 聚合（check-mock-wiring 只比对 index.ts 的 import 清单）。
 */

import type { MockMethod } from 'vite-plugin-mock'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { readBody, readRawBody, respondAfter } from './_utils'

interface UploadSession {
  fileHash: string
  fileName: string
  fileSize: number
  chunkSize: number
  totalChunks: number
  /** partNumber → 分片字节（dev 版真实存储；prod 版只记编号） */
  parts: Map<number, Buffer>
  /** partNumber → ETag（分片字节的内容指纹） */
  etags: Map<number, string>
  createdAt: number
  status: 'active' | 'completed'
  fileUrl: string | null
}

/** session 表：uploadId → 会话（内存态，重启即失——演示可接受） */
const sessions = new Map<string, UploadSession>()
let uploadSeq = 0
const SESSION_GC_MS = 30 * 60 * 1000
const MAX_SESSIONS = 64
const INIT_LATENCY_MS = 200
const MERGE_LATENCY = { min: 800, max: 1500 } as const
const PART_LATENCY = { min: 300, max: 700 } as const

/** ETag：分片字节 SHA-1 的 base64url 前 24 位（内容指纹，非安全场景够用） */
function partEtag(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('base64url').slice(0, 24)
}

function randomLatency(range: { min: number; max: number }): number {
  return range.min + Math.floor(Math.random() * (range.max - range.min))
}

/** 会话的已收分片 meta 列表（init 响应的 uploadedParts） */
function uploadedPartsOf(session: UploadSession): Array<{ partNumber: number; etag: string }> {
  return [...session.etags.entries()]
    .map(([partNumber, etag]) => ({ partNumber, etag }))
    .sort((a, b) => a.partNumber - b.partNumber)
}

/** 过期清理 + 数量上限清最旧（每次 init 时调用） */
function gcSessions(): void {
  const now = Date.now()
  sessions.forEach((session, id) => {
    if (session.createdAt + SESSION_GC_MS < now) sessions.delete(id)
  })
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0]
    if (!oldest) break
    sessions.delete(oldest[0])
  }
}

/**
 * 解析 /mock/demo-upload/uploads/{uploadId}[/parts/{partNumber} | /complete]。
 * 路径参数从 req.url 自行提取（rawResponse 模式不依赖路由匹配的 params）。
 * 三种形态：裸 id（DELETE）、/parts/N（PUT 分片）、/complete（POST 合并）。
 */
function parseUploadUrl(
  req: IncomingMessage
): { uploadId: string; partNumber?: number; complete?: boolean } | null {
  const path = (req.url ?? '').split('?')[0] ?? ''
  const matched = path.match(/^\/mock\/demo-upload\/uploads\/([^/]+)(?:\/(parts\/\d+|complete))?$/)
  if (!matched) return null
  const uploadId = matched[1]!
  const suffix = matched[2]
  if (suffix === undefined) return { uploadId }
  if (suffix === 'complete') return { uploadId, complete: true }
  return { uploadId, partNumber: Number(suffix.slice('parts/'.length)) }
}

/** 取 active 会话；不存在或已 completed 返回 null（由调用方回 404） */
function activeSessionOf(uploadId: string): UploadSession | null {
  const session = sessions.get(uploadId)
  return session && session.status === 'active' ? session : null
}

export default [
  {
    url: '/mock/demo-upload/uploads/init',
    method: 'post',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readBody(req)
      const fileName = typeof body.fileName === 'string' ? body.fileName : ''
      const fileHash = typeof body.fileHash === 'string' ? body.fileHash : ''
      const fileSize = Number(body.fileSize)
      const chunkSize = Number(body.chunkSize)
      const totalChunks = Number(body.totalChunks)

      if (!fileName || !fileHash) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: 'fileName / fileHash 不能为空',
          data: null,
        })
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: 'fileSize 必须为正数',
          data: null,
        })
      }
      if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: 'chunkSize 必须为正数',
          data: null,
        })
      }
      const expectedChunks = Math.ceil(fileSize / chunkSize)
      if (!Number.isInteger(totalChunks) || totalChunks !== expectedChunks) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: `totalChunks(${totalChunks}) 与实际分片数(${expectedChunks})不一致`,
          data: null,
        })
      }

      gcSessions()
      // fileHash 幂等：同哈希的 active 会话直接复用（= 断点续传入口）
      for (const [id, session] of sessions) {
        if (session.fileHash !== fileHash || session.status !== 'active') continue
        const sameMeta =
          session.fileSize === fileSize &&
          session.chunkSize === chunkSize &&
          session.totalChunks === totalChunks
        if (!sameMeta) {
          return respondAfter(req, res, 0, 200, {
            code: 409,
            message: '同文件哈希但元数据不一致（fileSize/chunkSize/totalChunks）',
            data: null,
          })
        }
        return respondAfter(req, res, INIT_LATENCY_MS, 200, {
          code: 200,
          message: 'ok（复用会话，断点续传）',
          data: { uploadId: id, uploadedParts: uploadedPartsOf(session) },
        })
      }

      uploadSeq += 1
      const uploadId = `up-${Date.now().toString(36)}-${uploadSeq}`
      sessions.set(uploadId, {
        fileHash,
        fileName,
        fileSize,
        chunkSize,
        totalChunks,
        parts: new Map(),
        etags: new Map(),
        createdAt: Date.now(),
        status: 'active',
        fileUrl: null,
      })
      return respondAfter(req, res, INIT_LATENCY_MS, 200, {
        code: 200,
        message: 'ok',
        data: { uploadId, uploadedParts: [] },
      })
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId/parts/:partNumber',
    method: 'put',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const parsed = parseUploadUrl(req)
      if (!parsed || parsed.partNumber === undefined) {
        return respondAfter(req, res, 0, 200, { code: 400, message: 'URL 非法', data: null })
      }
      const { uploadId, partNumber } = parsed
      const session = activeSessionOf(uploadId)
      if (!session) {
        return respondAfter(req, res, 0, 200, {
          code: 404,
          message: `上传任务 ${uploadId} 不存在或已合并`,
          data: null,
        })
      }
      if (!Number.isInteger(partNumber) || partNumber < 0 || partNumber >= session.totalChunks) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: `分片编号越界：${partNumber}（合法区间 [0, ${session.totalChunks})）`,
          data: null,
        })
      }

      const buf = await readRawBody(req)
      // 大小校验：非末片必须恰为 chunkSize；末片必须恰为文件尾剩余字节
      const expectedSize =
        partNumber < session.totalChunks - 1
          ? session.chunkSize
          : session.fileSize - session.chunkSize * (session.totalChunks - 1)
      if (buf.length !== expectedSize) {
        return respondAfter(req, res, 0, 200, {
          code: 400,
          message: `分片 ${partNumber} 大小 ${buf.length} 与期望 ${expectedSize} 不符`,
          data: null,
        })
      }

      const etag = partEtag(buf)
      const existing = session.etags.get(partNumber)
      if (existing !== undefined) {
        // 幂等重传：内容一致返同 ETag；不一致说明客户端或网络异常 → 409
        return existing === etag
          ? respondAfter(req, res, randomLatency(PART_LATENCY), 200, {
              code: 200,
              message: 'ok（幂等重传）',
              data: { partNumber, etag },
            })
          : respondAfter(req, res, 0, 200, {
              code: 409,
              message: `分片 ${partNumber} 内容冲突（已存 ETag 与重传字节不一致）`,
              data: null,
            })
      }

      session.parts.set(partNumber, buf)
      session.etags.set(partNumber, etag)
      return respondAfter(req, res, randomLatency(PART_LATENCY), 200, {
        code: 200,
        message: 'ok',
        data: { partNumber, etag },
      })
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId/complete',
    method: 'post',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const parsed = parseUploadUrl(req)
      if (!parsed?.complete) {
        return respondAfter(req, res, 0, 200, { code: 400, message: 'URL 非法', data: null })
      }
      const session = sessions.get(parsed.uploadId)
      if (!session) {
        return respondAfter(req, res, 0, 200, {
          code: 404,
          message: `上传任务 ${parsed.uploadId} 不存在`,
          data: null,
        })
      }
      // complete 幂等：已合并的直接返既有结果（客户端重试安全）
      if (session.status === 'completed') {
        return respondAfter(req, res, 0, 200, {
          code: 200,
          message: 'ok（已完成，幂等返回）',
          data: {
            fileUrl: session.fileUrl,
            fileId: parsed.uploadId,
            size: session.fileSize,
          },
        })
      }

      const missing: number[] = []
      for (let n = 0; n < session.totalChunks; n += 1) {
        if (!session.etags.has(n)) missing.push(n)
      }
      if (missing.length > 0) {
        return respondAfter(req, res, 0, 200, {
          code: 409,
          message: `分片未齐全，缺失 #${missing.join(', #')}`,
          data: { missing },
        })
      }
      // 完整性：拼接总长 === fileSize（单片大小已在 PUT 时校验，此处兜底总长）
      let totalLen = 0
      session.parts.forEach((buf) => {
        totalLen += buf.length
      })
      if (totalLen !== session.fileSize) {
        return respondAfter(req, res, 0, 200, {
          code: 500,
          message: `拼接总长 ${totalLen} 与 fileSize ${session.fileSize} 不符`,
          data: null,
        })
      }

      // 模拟合并耗时（客户端 merging 状态可见）；客户端断连则放弃写结果（头注契约）
      let clientGone = false
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, randomLatency(MERGE_LATENCY))
        req.on('close', () => {
          clearTimeout(timer)
          clientGone = true
          resolve()
        })
      })
      if (res.writableEnded || clientGone) return

      session.status = 'completed'
      session.fileUrl = `/mock/demo-upload/files/${parsed.uploadId}/${encodeURIComponent(session.fileName)}`
      return respondAfter(req, res, 0, 200, {
        code: 200,
        message: 'ok',
        data: { fileUrl: session.fileUrl, fileId: parsed.uploadId, size: session.fileSize },
      })
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId',
    method: 'delete',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const parsed = parseUploadUrl(req)
      if (!parsed) {
        return respondAfter(req, res, 0, 200, { code: 400, message: 'URL 非法', data: null })
      }
      // DELETE 幂等：不存在也 200（客户端取消语义不依赖服务端是否真有残留）
      const existed = sessions.delete(parsed.uploadId)
      return respondAfter(req, res, 0, 200, {
        code: 200,
        message: existed ? '已清理' : '任务不存在（幂等）',
        data: null,
      })
    },
  },
] satisfies MockMethod[]
