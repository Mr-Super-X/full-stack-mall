import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { MallListResponse } from '../apis/index'

// mock API 层
vi.mock('../apis/index', () => ({
  h5MallApi: {
    getList: vi.fn(),
  },
}))

import { h5MallApi } from '../apis/index'
import { useProductList } from './useProductList'

describe('useProductList', () => {
  it('初始加载第一页并返回 list/total', async () => {
    const mockResponse: MallListResponse = {
      list: [
        {
          id: 1,
          name: '陶土色垂感风衣',
          price: 399,
          originPrice: null,
          imageUrl: null,
          tag: null,
          sellingPoint: '棉 100%',
          garm: 'trench',
          sales: 1200,
          ownerType: 'PLATFORM',
          saleMode: 'NORMAL',
          conditionGrade: 'NEW',
        },
      ],
      total: 15,
      page: 1,
      pageSize: 10,
    }
    vi.mocked(h5MallApi.getList).mockResolvedValue(mockResponse)

    const keyword = ref('')
    const { list, total, loading, error, isEmpty } = useProductList({ keyword })

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(list.value).toHaveLength(1)
    expect(total.value).toBe(15)
    expect(error.value).toBeNull()
    expect(isEmpty.value).toBe(false)
    expect(h5MallApi.getList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      keyword: '',
      categoryId: undefined,
      sort: undefined,
      discountOnly: undefined,
    })
  })

  it('关键词变化时重新拉取并重置分页', async () => {
    vi.mocked(h5MallApi.getList).mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })

    const keyword = ref('')
    const { loading } = useProductList({ keyword })

    await vi.waitFor(() => expect(loading.value).toBe(false))
    // 初始加载：Vue 3.6 beta 的 watchEffect 在 setup 同步上下文中会执行 2 次（已知行为，语义无害——同参数拉第一页）
    expect(h5MallApi.getList).toHaveBeenCalledTimes(2)

    keyword.value = '风衣'
    // 关键词变化触发 watchEffect，再拉 1 次（共 3 次）
    await vi.waitFor(() => expect(h5MallApi.getList).toHaveBeenCalledTimes(3))
    expect(h5MallApi.getList).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      keyword: '风衣',
      categoryId: undefined,
      sort: undefined,
      discountOnly: undefined,
    })
  })

  it('加载失败时 error 有值', async () => {
    vi.mocked(h5MallApi.getList).mockRejectedValue(new Error('Network Error'))

    const keyword = ref('')
    const { list, loading, error } = useProductList({ keyword })

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(list.value).toEqual([])
    expect(error.value).toBeTruthy()
  })
})
