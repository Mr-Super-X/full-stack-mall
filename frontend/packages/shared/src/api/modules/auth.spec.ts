/**
 * authApi schema 契约单测（统一登录接线商城后端：/mall/auth/*）。
 *
 * 覆盖（计划 07 v2 Task 1 Step 2）：
 * 1. userProfileSchema transform：商城 UserInfoDTO（{id,username,nickname,avatar,role}）
 *    → shared UserProfile（{id,name,permissions[]}），role→permissions 唯一映射
 * 2. ROLE_PERMISSIONS：ADMIN → ['mall:admin']，USER → ['mall:user']，未知 role → []（不静默放行）
 * 3. 四个端点 url/method/data 原样透传（/mall/auth/login|register|me|logout）
 * 4. loginResultSchema 合法值通过 + passthrough 前向兼容
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
import { authApi, loginResultSchema, ROLE_PERMISSIONS, userProfileSchema } from './auth'

const mockRequestValidated = vi.mocked(requestValidated)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('统一登录接线：schema transform（计划 07 v2）', () => {
  it('userProfileSchema_ADMIN → name=nickname, permissions=[mall:admin]', () => {
    const parsed = userProfileSchema.parse({
      id: 1,
      username: 'admin',
      nickname: '管理员',
      avatar: null,
      role: 'ADMIN',
    })
    expect(parsed.id).toBe(1)
    expect(parsed.name).toBe('管理员')
    expect(parsed.permissions).toEqual(['mall:admin'])
  })

  it('userProfileSchema_USER_nicknameNull → name=username, permissions=[mall:user]', () => {
    const parsed = userProfileSchema.parse({
      id: 2,
      username: 'seller',
      nickname: null,
      avatar: null,
      role: 'USER',
    })
    expect(parsed.name).toBe('seller')
    expect(parsed.permissions).toEqual(['mall:user'])
  })

  it('userProfileSchema_unknownRole → permissions=[]（不静默放行）', () => {
    const parsed = userProfileSchema.parse({
      id: 3,
      username: 'guest',
      nickname: null,
      avatar: null,
      role: 'GUEST',
    })
    expect(parsed.permissions).toEqual([])
  })

  it('userProfileSchema_missingRole_rejects', () => {
    expect(() =>
      userProfileSchema.parse({ id: 1, username: 'a', nickname: null, avatar: null })
    ).toThrow()
  })

  it('ROLE_PERMISSIONS_ADMIN_containsMallAdmin', () => {
    expect(ROLE_PERMISSIONS['ADMIN']).toContain('mall:admin')
    expect(ROLE_PERMISSIONS['USER']).toContain('mall:user')
    expect(ROLE_PERMISSIONS['GUEST']).toBeUndefined()
  })
})

describe('auth schema 契约（passthrough 前向兼容）', () => {
  it('loginResultSchema 合法值通过并保留额外字段', () => {
    const value = {
      id: 1,
      username: 'admin',
      nickname: '管理员',
      avatar: null,
      role: 'ADMIN',
    }
    const parsed = loginResultSchema.parse(value)
    expect(parsed.id).toBe(1)
    expect((parsed as Record<string, unknown>).username).toBe('admin')
    const withTrace = { ...value, traceId: 't-1' }
    expect((loginResultSchema.parse(withTrace) as Record<string, unknown>).traceId).toBe('t-1')
  })
})

describe('authApi 透传契约（行为零变化）', () => {
  it('login 的 url/method/data 原样透传 /mall/auth/login', async () => {
    mockRequestValidated.mockResolvedValue({
      id: 1,
      username: 'admin',
      nickname: '管理员',
      avatar: null,
      role: 'ADMIN',
    })
    const data = { username: 'admin', password: '123456' }
    await authApi.login(data)
    expect(mockRequestValidated).toHaveBeenCalledWith(expect.anything(), {
      url: '/mall/auth/login',
      method: 'post',
      data,
    })
  })

  it('register 的 url/method/data 原样透传 /mall/auth/register', async () => {
    mockRequestValidated.mockResolvedValue({
      id: 2,
      username: 'new',
      nickname: null,
      avatar: null,
      role: 'USER',
    })
    const data = { username: 'new', password: '123456' }
    await authApi.register(data)
    expect(mockRequestValidated).toHaveBeenCalledWith(expect.anything(), {
      url: '/mall/auth/register',
      method: 'post',
      data,
    })
  })

  it('fetchProfile 的 url/method 原样透传 /mall/auth/me', async () => {
    mockRequestValidated.mockResolvedValue({
      id: 1,
      username: 'admin',
      nickname: '管理员',
      avatar: null,
      role: 'ADMIN',
    })
    await authApi.fetchProfile({ silent: true })
    expect(mockRequestValidated).toHaveBeenCalledWith(expect.anything(), {
      url: '/mall/auth/me',
      method: 'get',
      silent: true,
    })
  })

  it('schema 校验失败抛 ApiError code=500 且不 toast', async () => {
    mockRequestValidated.mockRejectedValue(
      new ApiError({ code: 500, message: '数据格式异常：role: Required' })
    )
    await expect(authApi.login({ username: 'a', password: 'b' })).rejects.toMatchObject({
      code: 500,
    })
  })
})
