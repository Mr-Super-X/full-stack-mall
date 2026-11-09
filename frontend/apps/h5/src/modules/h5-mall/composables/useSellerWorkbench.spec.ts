import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useSellerWorkbench } from './useSellerWorkbench'
import { h5SellerApi } from '../apis/seller'

// mock 模块 API 层（vi.mock 说明符与被测模块的 import 路径一致，§1.6.2）
vi.mock('../apis/seller', () => ({
  h5SellerApi: {
    myConsignments: vi.fn(),
    accept: vi.fn(),
    soldOrders: vi.fn(),
    ship: vi.fn(),
  },
}))

const mockConsignments = [
  {
    id: 1,
    brand: '拙衣',
    title: '陶土色垂感风衣',
    categoryId: 3,
    conditionGrade: 'LIKE_NEW',
    size: 'M',
    images: ['https://example.com/a.jpg'],
    description: '九成新',
    expectedPrice: 500,
    platformPrice: 399,
    commissionRate: 0.15,
    status: 'PRICED',
    rejectReason: null,
    listedProductId: null,
    createTime: '2026-11-09T10:00:00',
  },
]

const mockSoldOrders = [
  {
    id: 9,
    orderNo: 'NO202611090009',
    type: 'NORMAL',
    status: 'PAID',
    payAmount: 399,
    expiredAt: null,
    createTime: '2026-11-09T11:00:00',
    paymentNo: 'PAY009',
    items: [
      {
        productItemId: 21,
        price: 399,
        quantity: 1,
        sellerId: 2,
        title: '燕麦色针织开衫',
        imageUrl: null,
        conditionGrade: 'GOOD',
        size: 'L',
        color: null,
        brand: '拙衣',
        ownerType: 'CONSIGNMENT',
      },
    ],
    address: null,
  },
]

describe('useSellerWorkbench（卖家工作台）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('创建即默认拉取我的寄卖与售出订单（immediate）', async () => {
    vi.mocked(h5SellerApi.myConsignments).mockResolvedValue(mockConsignments)
    vi.mocked(h5SellerApi.soldOrders).mockResolvedValue(mockSoldOrders)

    const { consignments, soldOrders, loadingConsignments, loadingOrders } = useSellerWorkbench()
    expect(loadingConsignments.value).toBe(true)
    expect(loadingOrders.value).toBe(true)

    await vi.waitFor(() => expect(loadingConsignments.value).toBe(false))
    await vi.waitFor(() => expect(loadingOrders.value).toBe(false))
    expect(consignments.value).toEqual(mockConsignments)
    expect(soldOrders.value).toEqual(mockSoldOrders)
  })

  it('acceptPricing 成功后 reload 寄卖列表', async () => {
    vi.mocked(h5SellerApi.myConsignments).mockResolvedValue(mockConsignments)
    vi.mocked(h5SellerApi.soldOrders).mockResolvedValue([])
    vi.mocked(h5SellerApi.accept).mockResolvedValue({ ...mockConsignments[0], status: 'LISTED' })

    const { acceptPricing } = useSellerWorkbench()
    await vi.waitFor(() => expect(h5SellerApi.myConsignments).toHaveBeenCalledTimes(1))

    await acceptPricing(1)

    expect(h5SellerApi.accept).toHaveBeenCalledWith(1)
    expect(h5SellerApi.myConsignments).toHaveBeenCalledTimes(2)
  })

  it('acceptPricing 400（非 PRICED 等）上抛且仍 reload 对齐真态', async () => {
    vi.mocked(h5SellerApi.myConsignments).mockResolvedValue(mockConsignments)
    vi.mocked(h5SellerApi.soldOrders).mockResolvedValue([])
    vi.mocked(h5SellerApi.accept).mockRejectedValue(new Error('CONSIGNMENT_STATE_ILLEGAL'))

    const { acceptPricing } = useSellerWorkbench()
    await vi.waitFor(() => expect(h5SellerApi.myConsignments).toHaveBeenCalledTimes(1))

    await expect(acceptPricing(1)).rejects.toThrow('CONSIGNMENT_STATE_ILLEGAL')
    expect(h5SellerApi.myConsignments).toHaveBeenCalledTimes(2)
  })

  it('shipOrder 成功后 reload 售出订单', async () => {
    vi.mocked(h5SellerApi.myConsignments).mockResolvedValue([])
    vi.mocked(h5SellerApi.soldOrders).mockResolvedValue(mockSoldOrders)
    vi.mocked(h5SellerApi.ship).mockResolvedValue(undefined)

    const { shipOrder } = useSellerWorkbench()
    await vi.waitFor(() => expect(h5SellerApi.soldOrders).toHaveBeenCalledTimes(1))

    await shipOrder(9)

    expect(h5SellerApi.ship).toHaveBeenCalledWith(9)
    expect(h5SellerApi.soldOrders).toHaveBeenCalledTimes(2)
  })

  it('shipOrder 400 上抛且仍 reload 对齐真态', async () => {
    vi.mocked(h5SellerApi.myConsignments).mockResolvedValue([])
    vi.mocked(h5SellerApi.soldOrders).mockResolvedValue(mockSoldOrders)
    vi.mocked(h5SellerApi.ship).mockRejectedValue(new Error('ORDER_STATE_ILLEGAL'))

    const { shipOrder } = useSellerWorkbench()
    await vi.waitFor(() => expect(h5SellerApi.soldOrders).toHaveBeenCalledTimes(1))

    await expect(shipOrder(9)).rejects.toThrow('ORDER_STATE_ILLEGAL')
    expect(h5SellerApi.soldOrders).toHaveBeenCalledTimes(2)
  })
})
