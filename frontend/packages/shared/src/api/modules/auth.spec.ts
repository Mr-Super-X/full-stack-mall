/**
 * authApi schema 契约单测（P1 API 契约单源试点）。
 *
 * 覆盖：
 * 1. loginResultSchema / userProfileSchema 合法值通过 + 保留额外字段（.passthrough 前向兼容）
 * 2. 缺必需字段 / 字段类型错误拒绝（ApiError code=500，不 toast）
 * 3. login 的 url/method/data 原样透传
 * 4. fetchProfile({ silent: true }) 的 silent 原样透传给 HTTP 层
 *
 * mock 策略：mock 顶层 validator——auth.ts 经 requestValidated 调 request，
 * 直接 mock validator 模块可同时拦截 request 返回与 schema 校验，避免触真实 axios。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../types/error'

// auth.ts 经 requestValidated -> request；mock validator 模块即拦截整条链路
vi.mock('../validator', () => ({
  requestValidated: vi.fn(),
}))

import { requestValidated } from '../validator'
import { authApi, loginResultSchema, userProfileSchema } from './auth'

const mockRequestValidated = vi.mocked(requestValidated)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('auth schema 契约（P1 契约单源）', () => {
  it('loginResultSchema 合法值通过并保留额外字段（passthrough 前向兼容）', () => {
    const value = { profile: { id: 1, name: 'Admin', avatar: 'a.png' } }
    const parsed = loginResultSchema.parse(value)
    expect(parsed.profile.id).toBe(1)
    expect(parsed.profile.name).toBe('Admin')
    expect((parsed.profile as Record<string, unknown>).avatar).toBe('a.png')
    // 顶层额外字段也保留（passthrough 不裁剪未知键）
    const withTrace = { ...value, traceId: 't-1' }
    expect((loginResultSchema.parse(withTrace) as Record<string, unknown>).traceId).toBe('t-1')
  })

  it('userProfileSchema 缺 permissions 拒绝；字段类型错误拒绝', () => {
    expect(() => userProfileSchema.parse({ id: 1, name: 'A' })).toThrow()
    expect(() => userProfileSchema.parse({ id: '1', name: 'A', permissions: [] })).toThrow()
  })

  it('schema 校验失败抛 ApiError code=500 且不 toast', async () => {
    mockRequestValidated.mockRejectedValue(
      new ApiError({ code: 500, message: '数据格式异常：profile: Required' })
    )
    await expect(authApi.login({ username: 'a', password: 'b' })).rejects.toMatchObject({
      code: 500,
    })
  })
})

describe('authApi 透传契约（行为零变化）', () => {
  it('login 的 url/method/data 原样透传', async () => {
    mockRequestValidated.mockResolvedValue({ profile: { id: 1, name: 'Admin' } })
    const data = { username: 'admin', password: '123456' }
    await authApi.login(data)
    expect(mockRequestValidated).toHaveBeenCalledWith(expect.anything(), {
      url: '/auth/login',
      method: 'post',
      data,
    })
  })

  it('fetchProfile({ silent: true }) 的 silent 原样透传', async () => {
    mockRequestValidated.mockResolvedValue({ id: 1, name: 'Admin', permissions: [] })
    await authApi.fetchProfile({ silent: true })
    expect(mockRequestValidated).toHaveBeenCalledWith(expect.anything(), {
      url: '/auth/profile',
      method: 'get',
      silent: true,
    })
  })
})
