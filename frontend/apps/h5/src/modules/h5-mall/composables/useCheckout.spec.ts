import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useCheckout } from './useCheckout'
import { h5AddressApi } from '../apis/address'
import { h5OrderApi } from '../apis/orders'

// mock 模块 API 层（vi.mock 说明符与被测模块的 import 说明符一致，§1.6.2）
vi.mock('../apis/address', () => ({
  h5AddressApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../apis/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../apis/orders')>()
  return {
    ...actual,
    h5OrderApi: {
      ...actual.h5OrderApi,
      create: vi.fn(),
      pay: vi.fn(),
      payStatus: vi.fn(),
    },
  }
})

const mockAddresses = [
  { id: 2, receiverName: '张三', phone: '13800000002', province: '浙江省', city: '杭州市', district: '西湖区', detail: '天目里 1 号', isDefault: false },
  { id: 5, receiverName: '李四', phone: '13800000005', province: '浙江省', city: '杭州市', district: '余杭区', detail: '文一西路 969 号', isDefault: true },
]

const mockOrder = {
  id: 100,
  orderNo: 'NO202611100001',
  type: 'NORMAL',
  status: 'PENDING',
  payAmount: 250,
  expiredAt: null,
  createTime: '2026-11-10T10:00:00',
  paymentNo: 'PAY100',
  items: [],
  address: null,
}

describe('useCheckout（结算：地址 + 下单 + 支付）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('创建即拉取地址列表；defaultAddress 取 isDefault，否则第一条', async () => {
    vi.mocked(h5AddressApi.list).mockResolvedValue(mockAddresses)

    const { addresses, defaultAddress, loading } = useCheckout()
    expect(loading.value).toBe(true)
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(addresses.value).toEqual(mockAddresses)
    expect(defaultAddress.value?.id).toBe(5)

    vi.mocked(h5AddressApi.list).mockResolvedValue([{ ...mockAddresses[0], isDefault: false }])
    const c2 = useCheckout()
    await vi.waitFor(() => expect(c2.loading.value).toBe(false))
    expect(c2.defaultAddress.value?.id).toBe(2)
  })

  it('CART 模式下单传 cartItemIds，返回订单（含支付单号）', async () => {
    vi.mocked(h5AddressApi.list).mockResolvedValue(mockAddresses)
    vi.mocked(h5OrderApi.create).mockResolvedValue(mockOrder)

    const { createOrder } = useCheckout()
    const order = await createOrder({ addressId: 5, source: 'CART', cartItemIds: [1, 2] })

    expect(h5OrderApi.create).toHaveBeenCalledWith({ addressId: 5, source: 'CART', cartItemIds: [1, 2] })
    expect(order.paymentNo).toBe('PAY100')
  })

  it('DIRECT 模式下单传 productItemId（寄卖直购）', async () => {
    vi.mocked(h5AddressApi.list).mockResolvedValue(mockAddresses)
    vi.mocked(h5OrderApi.create).mockResolvedValue(mockOrder)

    const { createOrder } = useCheckout()
    await createOrder({ addressId: 5, source: 'DIRECT', productItemId: 99 })

    expect(h5OrderApi.create).toHaveBeenCalledWith({ addressId: 5, source: 'DIRECT', productItemId: 99 })
  })

  it('startPay 返回收银台地址；pollPayStatus 返回支付状态', async () => {
    vi.mocked(h5AddressApi.list).mockResolvedValue([])
    vi.mocked(h5OrderApi.pay).mockResolvedValue({ paymentNo: 'PAY100', payUrl: '/api/mall/payments/fake/checkout?...', status: 'PAYING' })
    vi.mocked(h5OrderApi.payStatus).mockResolvedValue({ paymentNo: 'PAY100', payUrl: null, status: 'SUCCESS' })

    const { startPay, pollPayStatus } = useCheckout()
    const payUrl = await startPay('PAY100')
    expect(payUrl).toContain('/fake/checkout')
    expect(h5OrderApi.pay).toHaveBeenCalledWith('PAY100')

    const status = await pollPayStatus('PAY100')
    expect(status).toBe('SUCCESS')
    expect(h5OrderApi.payStatus).toHaveBeenCalledWith('PAY100')
  })
})
