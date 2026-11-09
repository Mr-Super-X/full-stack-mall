import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useMyOrders } from './useMyOrders'
import { h5OrderApi } from '../apis/orders'

// mock 模块 API 层（vi.mock 说明符与被测模块的 import 路径一致，§1.6.2）
vi.mock('../apis/orders', () => ({
  h5OrderApi: {
    list: vi.fn(),
    confirm: vi.fn(),
  },
}))

const mockOrders = [
  {
    id: 1,
    orderNo: 'NO202611090001',
    type: 'NORMAL',
    status: 'SHIPPED',
    payAmount: 399,
    expiredAt: null,
    createTime: '2026-11-09T10:00:00',
    paymentNo: 'PAY001',
    items: [
      {
        productItemId: 11,
        price: 399,
        quantity: 1,
        sellerId: 2,
        title: '陶土色垂感风衣',
        imageUrl: null,
        conditionGrade: 'LIKE_NEW',
        size: 'M',
        color: null,
        brand: '拙衣',
        ownerType: 'CONSIGNMENT',
      },
    ],
    address: null,
  },
]

describe('useMyOrders（我的订单）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('创建即默认拉取订单列表（immediate）', async () => {
    vi.mocked(h5OrderApi.list).mockResolvedValue(mockOrders)

    const { list, loading } = useMyOrders()
    expect(loading.value).toBe(true)

    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(list.value).toEqual(mockOrders)
  })

  it('空数组应判 Empty 态（后端空列表返回 [] 而非 null）', async () => {
    vi.mocked(h5OrderApi.list).mockResolvedValue([])

    const { isEmpty, loading } = useMyOrders()
    expect(loading.value).toBe(true)

    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(isEmpty.value).toBe(true)
  })

  it('confirmReceipt 成功后 reload 列表对齐真态', async () => {
    vi.mocked(h5OrderApi.list).mockResolvedValue(mockOrders)
    vi.mocked(h5OrderApi.confirm).mockResolvedValue(undefined)

    const { confirmReceipt } = useMyOrders()
    await vi.waitFor(() => expect(h5OrderApi.list).toHaveBeenCalledTimes(1))

    await confirmReceipt(1)

    expect(h5OrderApi.confirm).toHaveBeenCalledWith(1)
    // 初始 load + confirm 后 reload = 2 次
    expect(h5OrderApi.list).toHaveBeenCalledTimes(2)
  })

  it('confirmReceipt 400 上抛且仍 reload 对齐真态（不留幻觉成功）', async () => {
    vi.mocked(h5OrderApi.list).mockResolvedValue(mockOrders)
    vi.mocked(h5OrderApi.confirm).mockRejectedValue(new Error('ORDER_STATE_ILLEGAL'))

    const { confirmReceipt } = useMyOrders()
    await vi.waitFor(() => expect(h5OrderApi.list).toHaveBeenCalledTimes(1))

    await expect(confirmReceipt(1)).rejects.toThrow('ORDER_STATE_ILLEGAL')
    // 失败也刷新：后端可能已被其它端改变状态，前端对齐真态
    expect(h5OrderApi.list).toHaveBeenCalledTimes(2)
  })
})
