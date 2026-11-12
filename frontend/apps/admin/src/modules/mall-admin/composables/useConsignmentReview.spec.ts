import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../apis/consignments', () => ({
  adminConsignmentApi: {
    list: vi.fn(),
    review: vi.fn(),
  },
}))

import { adminConsignmentApi } from '../apis/consignments'
import { useConsignmentReview } from './useConsignmentReview'

const SAMPLE_ITEM = {
  id: 7,
  brand: 'Chanel',
  title: '中古 CF 黑金牛皮',
  categoryId: 1,
  conditionGrade: 'GOOD',
  size: '中号',
  images: ['https://example.com/1.jpg'],
  description: null,
  expectedPrice: 12000,
  platformPrice: null,
  commissionRate: null,
  status: 'SUBMITTED',
  rejectReason: null,
  listedProductId: null,
  createTime: '2026-11-09T10:00:00',
}

describe('useConsignmentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('status 默认 SUBMITTED（待审核队列）', () => {
    const { status } = useConsignmentReview()
    expect(status.value).toBe('SUBMITTED')
  })

  it('approve 发送定价 + 佣金率', async () => {
    vi.mocked(adminConsignmentApi.review).mockResolvedValue({
      ...SAMPLE_ITEM,
      status: 'PRICED',
      platformPrice: 12800,
      commissionRate: 15,
    } as never)
    const { approve } = useConsignmentReview()

    await approve(7, 12800, 15)

    expect(adminConsignmentApi.review).toHaveBeenCalledWith(7, {
      approve: true,
      platformPrice: 12800,
      commissionRate: 15,
    })
  })

  it('reject 发送驳回原因', async () => {
    vi.mocked(adminConsignmentApi.review).mockResolvedValue({
      ...SAMPLE_ITEM,
      status: 'REJECTED',
      rejectReason: '图片不清晰',
    } as never)
    const { reject } = useConsignmentReview()

    await reject(7, '图片不清晰')

    expect(adminConsignmentApi.review).toHaveBeenCalledWith(7, {
      approve: false,
      rejectReason: '图片不清晰',
    })
  })

  it('review 错误向上抛（视图层 toast）', async () => {
    vi.mocked(adminConsignmentApi.review).mockRejectedValue(new Error('非法状态迁移'))
    const { approve } = useConsignmentReview()

    await expect(approve(7, 12800, 15)).rejects.toThrow('非法状态迁移')
  })
})
