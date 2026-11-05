// 类型挂钩（2026-10-26 测试审计 #2）：mock 数据与 @vv/shared api 层类型绑定——
// 改 UserItem 契约时编译器即时报错，杜绝「api 层演化、mock 静默偏离」。
// import type 编译期擦除，vite-plugin-mock 的 esbuild bundle 不含运行时依赖（同 pro-table 先例）
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UserItem } from '@vv/shared'

/** 读取请求 body JSON（rawResponse 模式下需手动解析，vite-plugin-mock 不代为处理） */
export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch {
        resolve({})
      }
    })
  })
}

/**
 * 读取原始二进制 body：分片上传等非 JSON 场景（readBody 只解析 JSON）。
 * error 事件按已收部分 resolve——客户端断连不应让 Promise 悬挂。
 */
export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', () => resolve(Buffer.concat(chunks)))
  })
}

/**
 * 挂起式延迟响应（rawResponse 专用）：定时器在 await 的 Promise 内触发，res.end 后 resolve。
 * 客户端断连（取消/关页面）时补 end 并清定时器，防中间件挂起与定时器泄漏。
 *
 * rawResponse 两个必须遵守的约束（调用方须知）：
 * 1. 定时器跑在 await 的 Promise 内部，res.end() 后才 resolve——「调度后提前 return」
 *    会触发 vite SPA fallback 404。
 * 2. 客户端断连必须监听 req 'close' 清定时器 + 补 res.end()——否则 Promise 永不 settle。
 */
export function respondAfter(
  req: IncomingMessage,
  res: ServerResponse,
  ms: number,
  status: number,
  payload: unknown
): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = (code: number, body: unknown): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!res.writableEnded) {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      }
      resolve()
    }
    const timer = setTimeout(() => finish(status, payload), ms)
    req.on('close', () => finish(200, { code: 200, message: 'client closed', data: null }))
  })
}

export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function paginate<T>(list: T[], page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize }
}

const NAMES = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']
const ROLES = ['admin', 'user', 'guest']
export function generateUsers(count: number): UserItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length] ?? `用户${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'user',
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }))
}
