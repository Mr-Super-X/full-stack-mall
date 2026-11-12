import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../apis/payouts', () => ({
  adminPayoutApi: {
    list: vi.fn(),
    confirm: vi.fn(),
    pay: vi.fn(),
  },
}))

import { adminPayoutApi } from '../apis/payouts'
import { usePayoutApproval } from './usePayoutApproval'

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

  it('status 默认 PENDING（待初审队列）', () => {
    const { status } = usePayoutApproval()
    expect(status.value).toBe('PENDING')
  })

  it('confirm 透传结算单 id', async () => {
    vi.mocked(adminPayoutApi.confirm).mockResolvedValue({
      ...SAMPLE_PAYOUT,
      status: 'CONFIRMED',
    } as never)
    const { confirm } = usePayoutApproval()

    await confirm(3)

    expect(adminPayoutApi.confirm).toHaveBeenCalledWith(3)
  })

  it('pay 透传结算单 id', async () => {
    vi.mocked(adminPayoutApi.pay).mockResolvedValue({
      ...SAMPLE_PAYOUT,
      status: 'PAID',
    } as never)
    const { pay } = usePayoutApproval()

    await pay(3)

    expect(adminPayoutApi.pay).toHaveBeenCalledWith(3)
  })

  it('confirm 错误向上抛（400 状态已变迁时视图 finally 刷新对齐真态——Review Focus #6 语义在视图层）', async () => {
    vi.mocked(adminPayoutApi.confirm).mockRejectedValue(new Error('PAYOUT_STATE_ILLEGAL'))
    const { confirm } = usePayoutApproval()

    await expect(confirm(3)).rejects.toThrow('PAYOUT_STATE_ILLEGAL')
  })
})
