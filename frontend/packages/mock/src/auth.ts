import type { MockMethod } from 'vite-plugin-mock'
import type { IncomingMessage, ServerResponse } from 'node:http'
// 类型挂钩（2026-10-26 测试审计 #2）：登录/profile 响应体与 api 层 LoginResult /
// UserProfile 绑定——改契约时编译器即时报错（import type 编译期擦除，无运行时依赖）
import type { LoginResult, UserProfile } from '@vv/shared'
// readBody 自本文件抽取到 _utils（2026-10-26 stream mock 接入，与 auth 同款手动解析语义共享）
import { readBody } from './_utils'
// 演示账号单源（/autoplan E12）：dev/prod 两形态口令自此同点修改，不再人肉双写
import { MOCK_PASSWORD, MOCK_USERNAME } from './credentials'

// httpOnly cookie 模拟（2026-08-12 改造）：
// 凭证由"后端"（本 mock）通过 Set-Cookie: HttpOnly 下发，前端 JS 不可读，
// 与生产后端契约一致。profile/logout/refresh 通过校验 cookie 模拟真实凭证验证。
//
// 注意：rawResponse 需手动解析 body / 序列化响应（vite-plugin-mock 不代为处理）。
// 延迟用 setTimeout 模拟（timeout 配置项对 rawResponse 不生效）。

const TOKEN_COOKIE = 'token'
const MOCK_PERMISSIONS = ['dashboard:view', 'user:view', 'user:edit', 'orders:view', 'reports:view']

/** 写 Set-Cookie 头（HttpOnly；maxAge=0 表示删除） */
function setTokenCookie(res: ServerResponse, value: string, maxAge?: number): void {
  const parts = [`${TOKEN_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`)
  res.setHeader('Set-Cookie', parts.join('; '))
}

/** 校验请求是否携带凭证 cookie */
function hasTokenCookie(req: IncomingMessage): boolean {
  const cookie = req.headers.cookie ?? ''
  return cookie.split(';').some((c) => c.trim().startsWith(`${TOKEN_COOKIE}=`))
}

function sendJson(res: ServerResponse, body: unknown, statusCode = 200): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = statusCode
  res.end(JSON.stringify(body))
}

/** 模拟网络延迟后执行 handler。
 *  ⚠️ 2026-10-23 竞态修复：本函数必须**同步**调用 handler（原 setTimeout 延迟实现已废弃）。
 *  原因：rawResponse 在 async 函数（login）里 await readBody 后调度 setTimeout 即返回，
 *  connect 中间件认为 handler 完成、vite 走 SPA fallback 404——而 res.end 还在 setTimeout
 *  里没执行（「资源不存在」根因，auth dev server 实测 invoke 日志有但前端 404）。
 *  vite-plugin-mock 的 rawResponse 要求 res 在 handler 同步期内完结；模拟延迟交给
 *  response 普通函数的 timeout 字段（rawResponse 不支持 timeout，故这里去掉延迟，
 *  功能等价——mock 延迟本就非必须）。 */
function withDelay(handler: () => void, _ms: number): void {
  handler()
}

export default [
  {
    url: '/mock/auth/login',
    method: 'post',
    rawResponse: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readBody(req)
      withDelay(() => {
        if (body.username === MOCK_USERNAME && body.password === MOCK_PASSWORD) {
          // 登录成功：凭证走 Set-Cookie（HttpOnly），响应体不再携带 token
          setTokenCookie(res, `mock-jwt-${Date.now()}`)
          sendJson(res, {
            code: 200,
            message: 'ok',
            // satisfies 挂钩 LoginResult：mock 响应契约与 api 层类型同源
            data: { profile: { id: 1, name: 'Admin' } } satisfies LoginResult,
          })
        } else {
          sendJson(res, { code: 401, message: '账号或密码错误', data: null })
        }
      }, 200)
    },
  },
  {
    url: '/mock/auth/profile',
    method: 'get',
    rawResponse: (req: IncomingMessage, res: ServerResponse) => {
      withDelay(() => {
        if (hasTokenCookie(req)) {
          sendJson(res, {
            code: 200,
            message: 'ok',
            data: { id: 1, name: 'Admin', permissions: MOCK_PERMISSIONS } satisfies UserProfile,
          })
        } else {
          // 无凭证 cookie → 401，触发前端守卫清标记跳登录
          sendJson(res, { code: 401, message: '登录已过期', data: null })
        }
      }, 100)
    },
  },
  {
    url: '/mock/auth/logout',
    method: 'post',
    rawResponse: (req: IncomingMessage, res: ServerResponse) => {
      withDelay(() => {
        // 登出：Max-Age=0 让浏览器删除凭证 cookie
        setTokenCookie(res, '', 0)
        sendJson(res, { code: 200, message: 'ok', data: null })
      }, 100)
    },
  },
  {
    url: '/mock/auth/refresh',
    method: 'post',
    rawResponse: (req: IncomingMessage, res: ServerResponse) => {
      withDelay(() => {
        if (hasTokenCookie(req)) {
          // 续期成功：Set-Cookie 新凭证（前端无需读取）
          setTokenCookie(res, `mock-jwt-refreshed-${Date.now()}`)
          sendJson(res, { code: 200, message: 'ok', data: null })
        } else {
          sendJson(res, { code: 401, message: '凭证已失效', data: null })
        }
      }, 100)
    },
  },
] as MockMethod[]
