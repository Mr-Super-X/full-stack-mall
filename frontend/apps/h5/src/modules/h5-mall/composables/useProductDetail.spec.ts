import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { MallProductDetail } from '../apis/index'

// mock API 层
vi.mock('../apis/index', () => ({
  h5MallApi: {
    getDetail: vi.fn(),
  },
}))

import { h5MallApi } from '../apis/index'
import { useProductDetail } from './useProductDetail'

describe('useProductDetail', () => {
  it('加载成功后返回 detail 数据', async () => {
    const mockDetail: MallProductDetail = {
      id: 14,
      name: '中古 Chanel CF 黑金牛皮',
      price: 12800,
      originPrice: null,
      imageUrl: 'https://picsum.photos/seed/mall-p14-1/750/750',
      tag: '寄卖',
      sellingPoint: '成色 GOOD',
      garm: 'bag',
      sales: 12,
      ownerType: 'CONSIGNMENT',
      saleMode: 'NORMAL',
      conditionGrade: 'GOOD',
      categoryId: 5,
      sellerId: 2,
      detailHtml: '<p>经典 CF 中号</p>',
      createTime: '2026-11-06T10:00:00',
      items: [
        {
          id: 33,
          size: null,
          color: '黑金',
          conditionGrade: 'GOOD',
          price: 12800,
          originPrice: null,
          stock: 1,
        },
      ],
      images: ['https://picsum.photos/seed/mall-p14-1/750/750'],
    }
    vi.mocked(h5MallApi.getDetail).mockResolvedValue(mockDetail)

    const id = ref(14)
    const { detail, loading, error, isEmpty } = useProductDetail(id)

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(detail.value).toEqual(mockDetail)
    expect(error.value).toBeNull()
    expect(isEmpty.value).toBe(false)
    expect(h5MallApi.getDetail).toHaveBeenCalledWith(14)
  })

  it('id 变化时重新拉取', async () => {
    vi.mocked(h5MallApi.getDetail).mockResolvedValue({} as MallProductDetail)

    const id = ref(14)
    const { loading } = useProductDetail(id)

    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(h5MallApi.getDetail).toHaveBeenCalledWith(14)

    id.value = 15
    await vi.waitFor(() => expect(h5MallApi.getDetail).toHaveBeenCalledWith(15))
  })

  it('404 时 error 有值且 isEmpty 为 false（区分"不存在"与"空"）', async () => {
    const notFoundError = new Error('商品不存在')
    ;(notFoundError as { code?: number }).code = 404
    vi.mocked(h5MallApi.getDetail).mockRejectedValue(notFoundError)

    const id = ref(999)
    const { detail, loading, error, isEmpty } = useProductDetail(id)

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(detail.value).toBeNull()
    expect(error.value).toBeTruthy()
    expect((error.value as { code?: number })?.code).toBe(404)
    expect(isEmpty.value).toBe(false) // 404 是错误态，不是空态
  })
})
