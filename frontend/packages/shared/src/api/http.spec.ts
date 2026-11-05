import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BusinessCode } from '../enums/httpEnum.ts'
import { ApiError, isApiError } from './types/error'
import { Session } from '../utils/storage.ts'
import type { AxiosResponse } from 'axios'
import type { ApiResponse } from './types/api.d'
import { globalAbort } from './global-abort'

/**
 * 通过 mock axios 把 http.ts 拦截器逻辑剥离出来验证。
 *
 * 关键点：每个 axios.create() 调用会触发 mock 工厂返回新对象。
 * http.ts 在模块加载时调用一次 axios.create()，我们捕获那个实例的
 * request mock 以验证 request<T>() 是否正确转发；拦截器 handler
 * 也通过同一组 mock 工厂的闭包写入 capturedInterceptors。
 *
 * 因此测试直接使用 `httpModule.default`（即 http.ts 内部持有的 instance），
 * 避免再调用 axios.create() 创建另一个不同对象。
 */

const requestHandlers = new Map<unknown, { onFulfilled: (cfg: unknown) => unknown }>()
const responseHandlers = new Map<
  unknown,
  {
    onFulfilled: (resp: AxiosResponse<ApiResponse<unknown>>) => AxiosResponse<ApiResponse<unknown>>
    onRejected: (err: unknown) => never
  }
>()

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    ...actual,
    default: {
      create: () => {
        const requestMock = vi.fn()
        const instanceKey = Symbol('axios-instance')
        return {
          interceptors: {
            request: {
              use: (onFulfilled: (cfg: unknown) => unknown) => {
                requestHandlers.set(instanceKey, { onFulfilled })
              },
            },
            response: {
              use: (
                onFulfilled: (
                  resp: AxiosResponse<ApiResponse<unknown>>
                ) => AxiosResponse<ApiResponse<unknown>>,
                onRejected: (err: unknown) => never
              ) => {
                responseHandlers.set(instanceKey, { onFulfilled, onRejected })
              },
            },
          },
          request: requestMock,
        }
      },
    },
  }
})

// httpOnly 模式：refreshSession 由 token-refresh 模块提供，mock 掉以控制 401 流程
const { mockRefreshSession, mockRouterPush, mockRedirectToAuthLogin } = vi.hoisted(() => ({
  mockRefreshSession: vi.fn(),
  mockRouterPush: vi.fn().mockResolvedValue(undefined),
  // P4 跨应用登录协议：performLogout 改整页跳 apps/auth（mock 不 throw，
  // 模拟 performLogout 内部 catch 中断信号后的正常返回路径）
  mockRedirectToAuthLogin: vi.fn(),
}))

vi.mock('./token-refresh', () => ({
  refreshSession: mockRefreshSession,
  _getCurrentConfig: () => ({ url: '/auth/refresh', refresh: vi.fn() }),
}))

// performLogout 经 DI 读取 app router 实例（P1-3 包化改造，见 ../app-router.ts）；
// P4 起取 currentRoute.fullPath 作为登录后回跳目标
vi.mock('../app-router.ts', () => ({
  getAppRouter: () => ({ push: mockRouterPush, currentRoute: { value: { fullPath: '/x' } } }),
}))

vi.mock('../auth/redirect.ts', () => ({
  redirectToAuthLogin: mockRedirectToAuthLogin,
}))

// 必须在 mock 之后；动态 import 让 mock 生效
const httpModule = await import('./http')
const { request } = httpModule
const httpInstance = httpModule.default

// 从最近注册的拦截器中取 handler（http.ts 模块加载时调用一次 axios.create）
const getRequestHandler = () => {
  const handlers = Array.from(requestHandlers.values())
  const last = handlers[handlers.length - 1]
  if (!last) throw new Error('request handler not registered; http.ts failed to load')
  return last
}
const getResponseHandler = () => {
  const handlers = Array.from(responseHandlers.values())
  const last = handlers[handlers.length - 1]
  if (!last) throw new Error('response handler not registered; http.ts failed to load')
  return last
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  mockRefreshSession.mockReset()
  mockRouterPush.mockReset().mockResolvedValue(undefined)
  mockRedirectToAuthLogin.mockReset()
  vi.clearAllMocks()
})

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('ApiError', () => {
  it('构造时设置字段', () => {
    const e = new ApiError({ code: 500, message: 'srv', status: 500, url: '/x' })
    expect(e.name).toBe('ApiError')
    expect(e.code).toBe(500)
    expect(e.status).toBe(500)
    expect(e.url).toBe('/x')
    expect(e.message).toBe('srv')
    expect(e).toBeInstanceOf(Error)
  })

  it('isApiError 类型守卫', () => {
    expect(isApiError(new ApiError({ code: 1, message: 'x' }))).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isApiError('x')).toBe(false)
  })
})

describe('http.ts 拦截器契约', () => {
  describe('请求拦截器', () => {
    it('httpOnly 模式：不注入 Authorization header（凭证由 cookie 自动携带）', () => {
      const handler = getRequestHandler()
      const headers = new Map<string, string>()
      handler.onFulfilled({ headers })
      expect(headers.get('Authorization')).toBeUndefined()
    })

    it('请求拦截器合并 globalAbort signal：abort 后 cfg.signal 也中止', () => {
      const handler = getRequestHandler()
      const ctrl = new AbortController()
      const cfg: { headers: Map<string, string>; signal?: AbortSignal } = {
        headers: new Map<string, string>(),
      }
      handler.onFulfilled(cfg)
      // 通过触发 globalAbort 验证合并后的 signal 是否同步中止
      // 这里用 cfg.signal.aborted 直接断言，不再依赖类型层面的 abort
      expect(cfg.signal?.aborted).toBe(false)
      globalAbort.abort('http-spec-test')
      expect(cfg.signal?.aborted).toBe(true)
      ctrl.abort()
      globalAbort.reset()
    })
  })

  describe('响应拦截器 — 业务码', () => {
    it('HTTP 200 + 业务码 200 时透传响应', () => {
      const handler = getResponseHandler()
      const response = {
        status: 200,
        data: { code: BusinessCode.SUCCESS, message: 'ok', data: { id: 1 } },
        config: { url: '/x' },
      }
      const result = handler.onFulfilled(response as AxiosResponse<ApiResponse<unknown>>)
      expect(result).toBe(response)
    })

    it('HTTP 非 200（如 201）即使业务码 200 也视为失败', () => {
      const handler = getResponseHandler()
      let captured: unknown
      try {
        handler.onFulfilled({
          status: 201,
          data: { code: BusinessCode.SUCCESS, message: 'created', data: { id: 1 } },
          config: { url: '/x' },
        } as AxiosResponse<ApiResponse<unknown>>)
      } catch (e) {
        captured = e
      }
      expect(isApiError(captured)).toBe(true)
      if (isApiError(captured)) {
        expect(captured.message).toBe('created')
        expect(captured.code).toBe(BusinessCode.SUCCESS)
      }
    })

    it('业务码 UNAUTHORIZED 时仅抛 ApiError（side effects 由 request<T> 包裹层处理）', () => {
      const handler = getResponseHandler()

      let captured: unknown
      try {
        handler.onFulfilled({
          status: 200,
          data: { code: BusinessCode.UNAUTHORIZED, message: 'expired', data: null },
          config: { url: '/x' },
        } as AxiosResponse<ApiResponse<unknown>>)
      } catch (e) {
        captured = e
      }

      expect(isApiError(captured)).toBe(true)
      if (isApiError(captured)) {
        expect(captured.code).toBe(BusinessCode.UNAUTHORIZED)
        expect(captured.url).toBe('/x')
      }
      // 拦截器层不做 side effects（不跳转、不清标记、不 refresh）——留给 request<T> 决定
      expect(mockRouterPush).not.toHaveBeenCalled()
      expect(mockRefreshSession).not.toHaveBeenCalled()
    })

    it('业务码失败时抛 ApiError 并保留 message', () => {
      const handler = getResponseHandler()
      let captured: unknown
      try {
        handler.onFulfilled({
          status: 200,
          data: { code: 5001, message: '业务异常', data: null },
          config: { url: '/x' },
        } as AxiosResponse<ApiResponse<unknown>>)
      } catch (e) {
        captured = e
      }
      expect(isApiError(captured)).toBe(true)
      if (isApiError(captured)) {
        expect(captured.code).toBe(5001)
        expect(captured.message).toBe('业务异常')
      }
    })
  })

  describe('响应拦截器 — HTTP 错误', () => {
    it('401 走 "请先登录" 文案', () => {
      const handler = getResponseHandler()
      let captured: unknown
      try {
        handler.onRejected({ response: { status: 401 }, config: { url: '/x' } })
      } catch (e) {
        captured = e
      }
      expect(isApiError(captured)).toBe(true)
      if (isApiError(captured)) {
        expect(captured.status).toBe(401)
        expect(captured.code).toBe(401)
        expect(captured.message).toBe('请先登录')
      }
    })

    it('500 走 "服务器错误" 文案', () => {
      const handler = getResponseHandler()
      let captured: unknown
      try {
        handler.onRejected({ response: { status: 500 }, config: { url: '/x' } })
      } catch (e) {
        captured = e
      }
      if (isApiError(captured)) expect(captured.message).toBe('服务器错误')
    })

    it('网络异常（无 response）走通用文案', () => {
      const handler = getResponseHandler()
      let captured: unknown
      try {
        handler.onRejected({ config: { url: '/x' } })
      } catch (e) {
        captured = e
      }
      if (isApiError(captured)) {
        expect(captured.status).toBeUndefined()
        expect(captured.message).toBe('网络异常，请稍后重试')
      }
    })
  })

  describe('request<T>()', () => {
    it('转发到 instance.request 并在 then 中解包 body.data', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      // 模拟成功响应：拦截器透传后，request<T> 需要 .then(res => res.data.data)
      requestMock.mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: { id: 1 } },
      })

      const result = await request<{ id: number }>({ url: '/x' })
      expect(requestMock).toHaveBeenCalledWith({ url: '/x' })
      expect(result).toEqual({ id: 1 })
    })

    it('401 时自动 refreshSession 并重发原请求（httpOnly：无需更新 header）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      // 第一次：401（业务码 UNAUTHORIZED）
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: BusinessCode.UNAUTHORIZED, message: 'expired', url: '/x' })
      )
      // 第二次（refresh 成功后重发）：成功
      requestMock.mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: { id: 2 } },
      })
      mockRefreshSession.mockResolvedValueOnce(undefined)

      const result = await request<{ id: number }>({ url: '/x' })

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ id: 2 })
      // 未触发登出
      expect(mockRouterPush).not.toHaveBeenCalled()
      expect(mockRedirectToAuthLogin).not.toHaveBeenCalled()
    })

    it('refresh 失败时清登录标记并整页跳 apps/auth 登录页（performLogout，P4）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: 'unauthorized', status: 401, url: '/x' })
      )
      mockRefreshSession.mockRejectedValueOnce(new Error('refresh failed'))
      // 前置登录标记：2026-10-30 语义修正后 performLogout 仅在「有标记（会话曾建立）」时
      // 走完整登出连锁——无标记的 401（如全公开 app 的登录态探测）静默（见下方反向用例）
      Session.set('auth', '1')

      await expect(request({ url: '/x' })).rejects.toThrow('unauthorized')

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(mockRedirectToAuthLogin).toHaveBeenCalledWith('/x')
      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('refresh 失败且无登录标记时静默（不跳登录不清标记——全公开 app 探测场景，2026-10-30 bug 回归锁）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: 'unauthorized', status: 401, url: '/x' })
      )
      mockRefreshSession.mockRejectedValueOnce(new Error('refresh failed'))
      // 无 Session.set('auth') 前置——模拟 portal 等全公开 app 未登录用户的登录态探测

      await expect(request({ url: '/x' })).rejects.toThrow('unauthorized')

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(mockRedirectToAuthLogin).not.toHaveBeenCalled()
      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('refresh 端点自身的 401 不触发 refresh（防循环）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: 'unauthorized', status: 401, url: '/auth/refresh' })
      )

      await expect(request({ url: '/auth/refresh', method: 'post' })).rejects.toThrow()

      expect(mockRefreshSession).not.toHaveBeenCalled()
    })

    // ── 登录端点豁免 refresh 链（2026-10-28 bug 修复，security-reviewer 审查通过）──
    // 根因：密码错误的业务码 401 没有可 refresh 的凭证，refresh 必失败 → 误走 performLogout
    // 跳登录页；performLogout 仅靠 Session 标记守卫，已登录用户输错密码时守卫放行（残留标记），
    // 整页跳 /auth/login?redirect=<当前路由> 并吞掉「账号或密码错误」toast。豁免后登录 401 纯抛。

    it('登录端点 401 + 有残留登录标记 + 无凭证 → 不调 refresh、不跳登录、纯抛原 ApiError（本次 bug 核心回归）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: '账号或密码错误', status: 401, url: '/auth/login' })
      )
      // 已登录用户输错密码：残留 auth 标记（上次登录留下），但凭证 cookie 已失效
      Session.set('auth', '1')

      await expect(
        request({ url: '/auth/login', method: 'post', data: { username: 'a', password: 'wrong' } })
      ).rejects.toThrow('账号或密码错误')

      // 关键断言：不 refresh、不弹「会话过期」、不跳登录页——由 Login.vue catch 弹「账号或密码错误」
      expect(mockRefreshSession).not.toHaveBeenCalled()
      expect(mockRedirectToAuthLogin).not.toHaveBeenCalled()
      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('登录端点 401 + 无标记 → 直接抛（干净态不退化）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: '账号或密码错误', url: '/auth/login' })
      )
      // 无 Session.set 前置——干净未登录态

      await expect(request({ url: '/auth/login', method: 'post' })).rejects.toThrow(
        '账号或密码错误'
      )

      expect(mockRefreshSession).not.toHaveBeenCalled()
      expect(mockRedirectToAuthLogin).not.toHaveBeenCalled()
    })

    it('登录端点 401 + 已登录（cookie 有效）→ 不 refresh 不重发，直接抛（security-reviewer 要求覆盖）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: '账号或密码错误', url: '/auth/login' })
      )
      Session.set('auth', '1')
      // 凭证 cookie 有效（mock 不区分，这里只断言不 refresh 不重发——只调了一次 request）

      await expect(request({ url: '/auth/login', method: 'post' })).rejects.toThrow(
        '账号或密码错误'
      )

      expect(mockRefreshSession).not.toHaveBeenCalled()
      expect(requestMock).toHaveBeenCalledTimes(1) // 不重发
      expect(mockRedirectToAuthLogin).not.toHaveBeenCalled()
    })

    it('业务接口（/user/profile）401 + 有标记 → 仍走 refresh 续期链（真过期兜底不破）', async () => {
      const requestMock = httpInstance.request as ReturnType<typeof vi.fn>
      requestMock.mockReset()
      // 第一次业务接口 401 → refresh 成功 → 重发成功
      requestMock.mockRejectedValueOnce(
        new ApiError({ code: 401, message: 'expired', status: 401, url: '/user/profile' })
      )
      requestMock.mockResolvedValueOnce({ data: { code: 0, message: 'ok', data: { id: 1 } } })
      mockRefreshSession.mockResolvedValueOnce(undefined)
      Session.set('auth', '1')

      const result = await request({ url: '/user/profile' })

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ id: 1 })
    })
  })
})
