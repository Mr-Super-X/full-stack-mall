import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import type { MallListResponse } from '../apis/index'

// mock API 层（说明符与 useProductList 的 import 路径一致，§1.6.2 语义路径同步）
vi.mock('../apis/index', () => ({
  h5MallApi: {
    getList: vi.fn(),
  },
}))

// 埋点 API mock：失败静默，测试中断言调用时机
vi.mock('../apis/search', () => ({
  h5SearchApi: {
    track: vi.fn().mockResolvedValue(null),
  },
}))

import { h5MallApi } from '../apis/index'
import { h5SearchApi } from '../apis/search'
import { useProductList } from './useProductList'

const emptyPage = { list: [], total: 0, page: 1, pageSize: 10 }

describe('useProductList', () => {
  // 调用计数跨用例清零（mockResolvedValue 只重设实现，不清历史）
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
      conditionGrade: undefined,
      priceMin: undefined,
      priceMax: undefined,
    })
  })

  it('关键词防抖：连续变化只触发一次重拉（末值生效）', async () => {
    vi.mocked(h5MallApi.getList).mockResolvedValue(emptyPage)

    const keyword = ref('')
    useProductList({ keyword })

    // 首次同步执行 1 次
    await vi.waitFor(() => expect(h5MallApi.getList).toHaveBeenCalledTimes(1))
    const callsBefore = vi.mocked(h5MallApi.getList).mock.calls.length

    // 300ms 防抖窗内连续改 3 次：只产生 1 次新请求（末值生效）
    keyword.value = '风'
    keyword.value = '风衣'
    keyword.value = '风衣女'
    await vi.waitFor(() => expect(h5MallApi.getList).toHaveBeenCalledTimes(callsBefore + 1), {
      timeout: 2000,
    })
    expect(h5MallApi.getList).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '风衣女' }),
    )
  })

  it('筛选参数（成色/价格区间）透传到列表接口', async () => {
    vi.mocked(h5MallApi.getList).mockResolvedValue(emptyPage)

    const conditionGrade = ref<undefined | 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'>(undefined)
    const priceMin = ref<number | undefined>(undefined)
    const priceMax = ref<number | undefined>(undefined)
    useProductList({ keyword: ref(''), conditionGrade, priceMin, priceMax })

    await vi.waitFor(() => expect(h5MallApi.getList).toHaveBeenCalled())

    conditionGrade.value = 'LIKE_NEW'
    priceMin.value = 100
    priceMax.value = 300
    await vi.waitFor(
      () =>
        expect(h5MallApi.getList).toHaveBeenLastCalledWith(
          expect.objectContaining({ conditionGrade: 'LIKE_NEW', priceMin: 100, priceMax: 300 }),
        ),
      { timeout: 2000 },
    )
  })

  it('搜索成功上报埋点（带结果数）', async () => {
    vi.mocked(h5MallApi.getList).mockResolvedValue({ ...emptyPage, total: 3 })

    useProductList({ keyword: ref('风衣') })
    await vi.waitFor(() =>
      expect(h5SearchApi.track).toHaveBeenCalledWith({ keyword: '风衣', resultCount: 3 }),
    )
  })

  it('空关键词不埋点', async () => {
    vi.mocked(h5MallApi.getList).mockResolvedValue(emptyPage)

    useProductList({ keyword: ref('') })
    await vi.waitFor(() => expect(h5MallApi.getList).toHaveBeenCalled())
    // 等待潜在防抖触发窗口过后仍无埋点
    await new Promise((r) => setTimeout(r, 400))
    expect(h5SearchApi.track).not.toHaveBeenCalled()
  })

  it('加载失败时 error 有值且埋点不上报', async () => {
    vi.mocked(h5MallApi.getList).mockRejectedValue(new Error('Network Error'))

    const keyword = ref('风衣')
    const { list, loading, error } = useProductList({ keyword })

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(list.value).toEqual([])
    expect(error.value).toBeTruthy()
    expect(h5SearchApi.track).not.toHaveBeenCalled()
  })
})
