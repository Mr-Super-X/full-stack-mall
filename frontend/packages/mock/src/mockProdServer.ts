/**
 * 生产环境 mock 接线（gh-pages 纯静态托管用）。
 *
 * vite-plugin-mock@3.0.2 为纯 dev-server 插件（2.9.x 的 prodEnabled 已移除），
 * 生产构建需经 client 侧 createProdMockServer 手动注册——浏览器端 mockjs 劫持 XHR，
 * 使无后端的静态产物具备完整 demo 数据。
 *
 * 挂接点：src/main.ts 条件分支（仅 VITE_USE_MOCK==='true' 的动态 import），
 * 常规生产构建（'false'）整分支被 tree-shake，产物不含 mock。
 *
 * 模块清单说明：2 个 data 直引模块（menu/user）+ 2 个内联 prod 版
 * （prodAuthMocks / prodDictMocks——字典静态展开，client wrapper 不支持路径参数）
 * + 1 个内联 prod 版网络基建演示（prodNetToolsMocks——response 函数形态；
 * dev 版 net-tools.ts 走 rawResponse 延迟，client 侧不支持，两处逻辑手工对齐）。
 * src/index.ts 只聚合 auth/user/menu（dev 模式 viteMockServe 按目录扫描不受此限）。
 * pro-table/ 下 11 个文件是具名导出 xxxRequestApi（ProTableRequestApi 组件直连数据源，
 * 无 XHR 依赖），无需接线。
 *
 * 已知限制：mock/auth.ts 的 login/profile/logout/refresh 用 rawResponse（Node req/res 语义），
 * client 侧 createProdMockServer 只消费 response 函数（client.mjs 解构 4 字段，rawResponse 被
 * 静默忽略）——更深层原因是 rawResponse 模拟的 Set-Cookie HttpOnly 凭证流依赖真实网络栈，
 * mockjs 伪造响应写不进 cookie 也校验不了。故本文件内联 prod 版 auth（response 形态，无 cookie
 * 语义），供 VITE_DEMO_NO_AUTH 演示模式（守卫跳过登录校验但仍拉 profile）消费。
 * 演示账号（admin/123456）单源在 ./credentials（E12，两形态 import 消费）；权限码字面量
 * 与 mock/auth.ts MOCK_PERMISSIONS 保持同步（两处无运行时共享，由 check:mock-wiring 机械守护）。
 * 拦截窗口时序问题已根治：main.ts 阻塞式挂接（createApp 后、app.use(router) 前
 * await setupProdMockServer——router install 即触发初始导航，挂接晚于 use 则守卫请求穿透）。
 * @trigger 新增 mock 路由模块时须同步登记本文件与 src/index.ts（dev 聚合入口），两处清单不许分叉
 * @see src/main.ts 入口挂接
 * @see @vv/shared router-guards/login.ts —— VITE_DEMO_NO_AUTH 演示模式守卫
 */
import type { MockMethod } from 'vite-plugin-mock'
import { createProdMockServer } from 'vite-plugin-mock/client'

import { DICT_DATA } from './dict-data'
// 演示账号单源（/autoplan E12）：口令自此与 dev 形态（auth.ts）同点修改
import { MOCK_PASSWORD, MOCK_USERNAME } from './credentials'
import menu from './menu'
import user from './user'

/**
 * prod 版 auth mock（response 函数形态，无 cookie 语义）。
 * dev 版（mock/auth.ts）用 rawResponse 模拟 Set-Cookie 凭证流，浏览器端无法模拟，见文件头注。
 */
const prodAuthMocks: MockMethod[] = [
  {
    url: '/mock/auth/login',
    method: 'post',
    response: ({ body }: { body: { username?: string; password?: string } }) =>
      body.username === MOCK_USERNAME && body.password === MOCK_PASSWORD
        ? { code: 200, message: 'ok', data: { profile: { id: 1, name: 'Admin' } } }
        : { code: 401, message: '账号或密码错误', data: null },
  },
  {
    url: '/mock/auth/profile',
    method: 'get',
    response: () => ({
      code: 200,
      message: 'ok',
      data: {
        id: 1,
        name: 'Admin',
        // 与 mock/auth.ts MOCK_PERMISSIONS 保持同步（两处无运行时共享，手工对齐）
        permissions: ['dashboard:view', 'user:view', 'user:edit', 'orders:view', 'reports:view'],
      },
    }),
  },
  {
    url: '/mock/auth/logout',
    method: 'post',
    response: () => ({ code: 200, message: 'ok', data: null }),
  },
  {
    url: '/mock/auth/refresh',
    method: 'post',
    response: () => ({ code: 200, message: 'ok', data: null }),
  },
]

/**
 * prod 版字典 mock——静态展开为逐条 url 注册。
 * 不能复用 dev 版 /mock/dict/:code 动态路由：client wrapper 不从路径提取参数
 * （query 仅来自 querystring，:code 恒 undefined → 防御分支 400）。
 * 静态注册后每条 url 的 code 由闭包固化，数据直返 DICT_DATA[code]。
 */
const prodDictMocks: MockMethod[] = Object.entries(DICT_DATA).map(([code, list]) => ({
  url: `/mock/dict/${code}`,
  method: 'get',
  response: () => ({ code: 200, message: 'ok', data: list }),
}))

/**
 * prod 版网络基建演示 mock（response 函数形态）——client wrapper 不支持 rawResponse，
 * 延迟无法模拟（Network 瀑布在 gh-pages 挤在一起）；计数/失败状态机逻辑与 dev 版
 * （net-tools.ts）等价，两处手工对齐（同 auth 先例）。接口形态：失败走业务码
 * （mockjs 劫持恒 HTTP 200），demo 页 withRetry 按业务码判定重试。
 */
const prodRetryCounters = new Map<string, number>()
let prodMergeCount = 0

const prodNetToolsMocks: MockMethod[] = [
  {
    url: '/mock/demo-net/shard',
    method: 'post',
    response: ({ body }: { body: { index?: number; fail?: boolean } }) =>
      body.fail === true
        ? { code: 500, message: `shard ${body.index ?? -1} network error`, data: null }
        : { code: 200, message: 'ok', data: { index: body.index ?? -1 } },
  },
  {
    url: '/mock/demo-net/retry',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      const failTimes = Number(query['failTimes'] ?? '0')
      const failStatus = Number(query['status'] ?? '500')
      const key = query['t'] ?? ''
      const attempted = prodRetryCounters.get(key) ?? 0
      prodRetryCounters.set(key, attempted + 1)
      return attempted < failTimes
        ? { code: failStatus, message: `attempt ${attempted + 1} failed`, data: null }
        : { code: 200, message: 'ok', data: 'request-ok' }
    },
  },
  {
    url: '/mock/demo-net/merge',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      if (query['reset'] === '1') prodMergeCount = 0
      prodMergeCount += 1
      return { code: 200, message: 'ok', data: { count: prodMergeCount } }
    },
  },
]

/**
 * prod 版分片上传 mock——状态机与 dev 版（upload.ts）手工对齐（同 net-tools 先例），
 * 差异仅在 mockjs XHR 劫持的能力边界：
 * - PUT 二进制 body 被字符串化为 "[object Blob]"，字节级大小/内容幂等校验豁免，
 *   ETag 退化为 `etag-{partNumber}` 固定派生，幂等语义靠 parts 集合天然去重保留
 * - 无合并延迟（mockjs timeout 恒 0），merging 状态一闪而过
 * 动态路由 dev/prod 同用 path-to-regexp 编译（client.mjs 实证），可匹配；
 * client wrapper 不传 params，路径段从 options.url 自行解析。
 */
interface ProdUploadSession {
  fileHash: string
  fileName: string
  fileSize: number
  chunkSize: number
  totalChunks: number
  parts: Set<number>
  createdAt: number
  status: 'active' | 'completed'
  fileUrl: string | null
}

const prodUploadSessions = new Map<string, ProdUploadSession>()
let prodUploadSeq = 0

/** prod 版 GC：与 dev 版（upload.ts gcSessions）同口径——30min 过期 + 64 上限清最旧 */
function gcProdUploadSessions(): void {
  const now = Date.now()
  prodUploadSessions.forEach((session, id) => {
    if (session.createdAt + 30 * 60 * 1000 < now) prodUploadSessions.delete(id)
  })
  while (prodUploadSessions.size >= 64) {
    const oldest = [...prodUploadSessions.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    )[0]
    if (!oldest) break
    prodUploadSessions.delete(oldest[0])
  }
}

function parseProdUploadUrl(
  url: string
): { uploadId: string; partNumber?: number; complete?: boolean } | null {
  const path = url.split('?')[0] ?? ''
  const matched = path.match(/^\/mock\/demo-upload\/uploads\/([^/]+)(?:\/(parts\/\d+|complete))?$/)
  if (!matched) return null
  const uploadId = matched[1]!
  const suffix = matched[2]
  if (suffix === undefined) return { uploadId }
  if (suffix === 'complete') return { uploadId, complete: true }
  return { uploadId, partNumber: Number(suffix.slice('parts/'.length)) }
}

const prodUploadMocks: MockMethod[] = [
  {
    url: '/mock/demo-upload/uploads/init',
    method: 'post',
    response: ({ body }: { body: Record<string, unknown> }) => {
      const fileName = typeof body.fileName === 'string' ? body.fileName : ''
      const fileHash = typeof body.fileHash === 'string' ? body.fileHash : ''
      const fileSize = Number(body.fileSize)
      const chunkSize = Number(body.chunkSize)
      const totalChunks = Number(body.totalChunks)
      if (!fileName || !fileHash)
        return { code: 400, message: 'fileName / fileHash 不能为空', data: null }
      if (!Number.isFinite(fileSize) || fileSize <= 0)
        return { code: 400, message: 'fileSize 必须为正数', data: null }
      if (!Number.isFinite(chunkSize) || chunkSize <= 0)
        return { code: 400, message: 'chunkSize 必须为正数', data: null }
      const expectedChunks = Math.ceil(fileSize / chunkSize)
      if (!Number.isInteger(totalChunks) || totalChunks !== expectedChunks) {
        return {
          code: 400,
          message: `totalChunks 与实际分片数(${expectedChunks})不一致`,
          data: null,
        }
      }
      // fileHash 幂等复用（断点续传）
      for (const [id, session] of prodUploadSessions) {
        if (session.fileHash !== fileHash || session.status !== 'active') continue
        const sameMeta =
          session.fileSize === fileSize &&
          session.chunkSize === chunkSize &&
          session.totalChunks === totalChunks
        if (!sameMeta) return { code: 409, message: '同文件哈希但元数据不一致', data: null }
        return {
          code: 200,
          message: 'ok（复用会话，断点续传）',
          data: {
            uploadId: id,
            uploadedParts: [...session.parts]
              .sort((a, b) => a - b)
              .map((partNumber) => ({ partNumber, etag: `etag-${partNumber}` })),
          },
        }
      }
      prodUploadSeq += 1
      const uploadId = `up-${prodUploadSeq}`
      gcProdUploadSessions()
      prodUploadSessions.set(uploadId, {
        fileHash,
        fileName,
        fileSize,
        chunkSize,
        totalChunks,
        parts: new Set(),
        createdAt: Date.now(),
        status: 'active',
        fileUrl: null,
      })
      return { code: 200, message: 'ok', data: { uploadId, uploadedParts: [] } }
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId/parts/:partNumber',
    method: 'put',
    response: ({ url }: { url: string }) => {
      const parsed = parseProdUploadUrl(url)
      if (!parsed || parsed.partNumber === undefined)
        return { code: 400, message: 'URL 非法', data: null }
      const session = prodUploadSessions.get(parsed.uploadId)
      if (!session || session.status !== 'active') {
        return { code: 404, message: `上传任务 ${parsed.uploadId} 不存在或已合并`, data: null }
      }
      const { partNumber } = parsed
      if (!Number.isInteger(partNumber) || partNumber < 0 || partNumber >= session.totalChunks) {
        return { code: 400, message: `分片编号越界：${partNumber}`, data: null }
      }
      // 字节级校验 prod 豁免（mockjs 承载不了二进制 body）；集合 add 天然幂等
      session.parts.add(partNumber)
      return { code: 200, message: 'ok', data: { partNumber, etag: `etag-${partNumber}` } }
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId/complete',
    method: 'post',
    response: ({ url }: { url: string }) => {
      const parsed = parseProdUploadUrl(url)
      if (!parsed?.complete) return { code: 400, message: 'URL 非法', data: null }
      const session = prodUploadSessions.get(parsed.uploadId)
      if (!session) return { code: 404, message: `上传任务 ${parsed.uploadId} 不存在`, data: null }
      if (session.status === 'completed') {
        return {
          code: 200,
          message: 'ok（已完成，幂等返回）',
          data: { fileUrl: session.fileUrl, fileId: parsed.uploadId, size: session.fileSize },
        }
      }
      const missing: number[] = []
      for (let n = 0; n < session.totalChunks; n += 1) {
        if (!session.parts.has(n)) missing.push(n)
      }
      if (missing.length > 0) {
        return { code: 409, message: `分片未齐全，缺失 #${missing.join(', #')}`, data: { missing } }
      }
      session.status = 'completed'
      session.fileUrl = `/mock/demo-upload/files/${parsed.uploadId}/${encodeURIComponent(session.fileName)}`
      return {
        code: 200,
        message: 'ok',
        data: { fileUrl: session.fileUrl, fileId: parsed.uploadId, size: session.fileSize },
      }
    },
  },
  {
    url: '/mock/demo-upload/uploads/:uploadId',
    method: 'delete',
    response: ({ url }: { url: string }) => {
      const parsed = parseProdUploadUrl(url)
      if (!parsed) return { code: 400, message: 'URL 非法', data: null }
      prodUploadSessions.delete(parsed.uploadId)
      return { code: 200, message: 'ok', data: null }
    },
  },
]

/** 全量 mock 路由清单（data 直引模块 + prod 版 auth/dict 内联 + 网络基建演示内联） */
const mockModules: MockMethod[] = [
  ...prodAuthMocks,
  ...prodDictMocks,
  ...prodNetToolsMocks,
  ...prodUploadMocks,
  ...menu,
  ...user,
]

/**
 * 注册生产 mock（浏览器端 mockjs XHR 劫持）。
 * 仅在 VITE_USE_MOCK==='true' 的产物中由 main.ts 调用；
 * 返回 Promise——main.ts 在 createApp 后、app.use(router) 前顶层 await 本函数，
 * 保证 mockjs 加载完成、劫持激活后才安装 router（router install 即触发初始导航，
 * 守卫的 profile 拉取必然在劫持之后发出），彻底消除「启动请求穿过拦截窗口
 * 打到静态服务器」的时序 bug（2026-10-20 两轮 preview 目检实锤：mount 前
 * await 仍不够——守卫链与 main.ts 后续语句并行执行，SPA fallback 返回 HTML）。
 */
export function setupProdMockServer(): Promise<void> {
  return createProdMockServer(mockModules)
}
