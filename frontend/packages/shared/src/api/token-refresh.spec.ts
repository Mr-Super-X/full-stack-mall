import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock axios BEFORE importing token-refresh
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

import axios from 'axios'
import {
  refreshSession,
  configureTokenRefresh,
  _resetRefreshing,
  _getCurrentConfig,
} from './token-refresh'

const mockAxiosPost = axios.post as ReturnType<typeof vi.fn>

beforeEach(() => {
  _resetRefreshing()
  mockAxiosPost.mockReset()
  // 重置为默认配置：让默认 refresh（含 baseURL fallback）生效，
  // 个别测试按需覆盖
  configureTokenRefresh({
    url: '/auth/refresh',
  })
})

describe('refreshSession（基础，httpOnly 模式）', () => {
  it('成功 refresh 即视为凭证续期（无需返回 token）', async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: { code: 200, message: 'ok' } })
    await expect(refreshSession()).resolves.toBeUndefined()
    expect(mockAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('refresh 接口地址使用默认 /auth/refresh 且携带 cookie', async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: { code: 200 } })
    await refreshSession()
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.anything(),
      expect.objectContaining({ withCredentials: true })
    )
  })
})

describe('refreshSession（失败处理）', () => {
  it('refresh 接口 reject 时抛错，refreshingPromise 清空', async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error('network error'))
    await expect(refreshSession()).rejects.toThrow('network error')
    // 验证下次调用可重新发起（refreshingPromise 已清空）
    mockAxiosPost.mockResolvedValueOnce({ data: { code: 200 } })
    await expect(refreshSession()).resolves.toBeUndefined()
    expect(mockAxiosPost).toHaveBeenCalledTimes(2)
  })
})

describe('refreshSession（并发去重）', () => {
  it('5 个并发调用只发一次 refresh 请求', async () => {
    let callCount = 0
    mockAxiosPost.mockImplementation(async () => {
      callCount++
      // 模拟 50ms 延迟，让所有调用进入等待
      await new Promise((resolve) => setTimeout(resolve, 50))
      return { data: { code: 200 } }
    })

    await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ])

    expect(callCount).toBe(1)
  })

  it('并发调用失败后，下一次调用可以重新发起', async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error('fail'))
    await expect(refreshSession()).rejects.toThrow()
    mockAxiosPost.mockResolvedValueOnce({ data: { code: 200 } })
    await expect(refreshSession()).resolves.toBeUndefined()
    expect(mockAxiosPost).toHaveBeenCalledTimes(2)
  })
})

describe('configureTokenRefresh（自定义配置）', () => {
  it('修改 url 后使用新 URL', async () => {
    configureTokenRefresh({ url: '/custom/refresh' })
    mockAxiosPost.mockResolvedValueOnce({ data: { code: 200 } })
    await refreshSession()
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/custom/refresh'),
      expect.anything(),
      expect.any(Object)
    )
  })

  it('自定义 refresh 函数完全接管请求逻辑', async () => {
    const customRefresh = vi.fn().mockResolvedValue(undefined)
    configureTokenRefresh({
      url: '/ignored',
      refresh: customRefresh,
    })
    await refreshSession()
    expect(customRefresh).toHaveBeenCalledTimes(1)
    // 验证 axios.post 没被调用（自定义 refresh 接管）
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('自定义 refresh 失败时错误向上传播', async () => {
    configureTokenRefresh({
      refresh: vi.fn().mockRejectedValue(new Error('custom refresh failed')),
    })
    await expect(refreshSession()).rejects.toThrow('custom refresh failed')
  })
})

describe('_getCurrentConfig', () => {
  it('返回当前生效的配置（只读）', () => {
    const config = _getCurrentConfig()
    expect(config.url).toBe('/auth/refresh')
    expect(typeof config.refresh).toBe('function')
  })
})
