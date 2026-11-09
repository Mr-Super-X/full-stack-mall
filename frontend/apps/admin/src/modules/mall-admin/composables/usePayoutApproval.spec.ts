import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock 模块内 API 层（@api/http 经 request 由 apis/payouts.ts 消费）
vi.mock('../apis/payouts', () => ({
  adminPayoutApi: {
    list: vi.fn(),
    confirm: vi.fn(),
    pay: vi.fn(),
  },
}))

import { adminPayoutApi } from '../apis/payouts'
import { usePayoutApproval } from './usePayoutApproval'

const mockList = vi.mocked(adminPayoutApi.list)
const mockConfirm = vi.mocked(adminPayoutApi.confirm)
const mockPay = vi.mocked(adminPayoutApi.pay)

const SAMPLE_PAYOUT = {
  id: 3,
  sellerId: 2,
  orderItemId: 9,
  sellerAmount: 578.0,
  commission: 102.0,
  status: 'PENDING',
  createTime: '2026-11-09T11:00:00',
}

describe('usePayoutApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('load_defaultStatus_PENDING', async () => {
    mockList.mockResolvedValue([SAMPLE_PAYOUT])
    const { list, loading, status, load } = usePayoutApproval()

    await load()

    expect(mockList).toHaveBeenCalledWith('PENDING')
    expect(list.value).toEqual([SAMPLE_PAYOUT])
    expect(status.value).toBe('PENDING')
    expect(loading.value).toBe(false)
  })

  it('load_tabSwitch_refetches', async () => {
    mockList.mockResolvedValue([])
    const { load } = usePayoutApproval()

    await load('CONFIRMED')
    expect(mockList).toHaveBeenCalledWith('CONFIRMED')

    await load('PAID')
    expect(mockList).toHaveBeenCalledWith('PAID')
  })

  it('confirm_success_reloads', async () => {
    mockList.mockResolvedValue([SAMPLE_PAYOUT])
    mockConfirm.mockResolvedValue({ ...SAMPLE_PAYOUT, status: 'CONFIRMED' })
    const { confirm } = usePayoutApproval()

    await confirm(3)

    expect(mockConfirm).toHaveBeenCalledWith(3)
    expect(mockList).toHaveBeenCalled()
  })

  it('pay_success_reloads', async () => {
    mockList.mockResolvedValue([])
    mockPay.mockResolvedValue({ ...SAMPLE_PAYOUT, status: 'PAID' })
    const { pay } = usePayoutApproval()

    await pay(3)

    expect(mockPay).toHaveBeenCalledWith(3)
    expect(mockList).toHaveBeenCalled()
  })

  it('confirm_stateIllegal400_propagatesAndRefreshes', async () => {
    // Review Focus #6：状态已变迁（并发/连点）时后端条件迁移返回 400——
    // 错误必须上抛（视图 toast）且仍触发一次 reload 对齐真态，不留「幻觉成功」
    mockList.mockResolvedValue([])
    mockConfirm.mockRejectedValue(new Error('PAYOUT_STATE_ILLEGAL'))
    const { confirm } = usePayoutApproval()

    await expect(confirm(3)).rejects.toThrow('PAYOUT_STATE_ILLEGAL')
    expect(mockList).toHaveBeenCalled()
  })
})
