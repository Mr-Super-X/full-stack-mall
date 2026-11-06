import { describe, expect, it, vi } from 'vitest'

import type { MallHomeContent } from '../apis/index'

// mock API 层：只验证 composable 三态流转与 data 形状，不碰真实 http
vi.mock('../apis/index', () => ({
  h5MallApi: {
    getHome: vi.fn(),
  },
}))

import { h5MallApi } from '../apis/index'
import { useMallHome } from './useMallHome'

describe('useMallHome', () => {
  it('加载成功后返回 home 数据且 loading 归位', async () => {
    const mockHome: MallHomeContent = {
      notice: '新客立减 ¥30',
      banners: [],
      categories: [],
      flash: { title: '限时甄选', items: [] },
      news: [],
      recommend: [],
    }
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)

    const { home, loading, error, isEmpty, refresh } = useMallHome()

    // 初始 loading（immediate 触发）
    expect(loading.value).toBe(true)
    expect(home.value).toBeNull()

    // 等待异步完成
    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(home.value).toEqual(mockHome)
    expect(error.value).toBeNull()
    expect(isEmpty.value).toBe(false)

    // refresh 可重拉
    await refresh()
    expect(h5MallApi.getHome).toHaveBeenCalledTimes(2)
  })

  it('加载失败时 error 有值且 home 保持 null', async () => {
    vi.mocked(h5MallApi.getHome).mockRejectedValue(new Error('Network Error'))

    const { home, loading, error, isEmpty } = useMallHome()

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(home.value).toBeNull()
    expect(error.value).toBeTruthy()
    expect(isEmpty.value).toBe(false) // 非 loading 非 error 时 data===null 才是空态
  })
})
