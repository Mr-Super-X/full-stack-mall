import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock 模块内 API 层（@api/http 经 request 由 apis/consignments.ts 消费）
vi.mock('../apis/consignments', () => ({
  adminConsignmentApi: {
    list: vi.fn(),
    review: vi.fn(),
  },
}))

import { adminConsignmentApi } from '../apis/consignments'
import { useConsignmentReview } from './useConsignmentReview'

const mockList = vi.mocked(adminConsignmentApi.list)
const mockReview = vi.mocked(adminConsignmentApi.review)

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

  it('load_defaultStatus_SUBMITTED_andMapsList', async () => {
    mockList.mockResolvedValue([SAMPLE_ITEM])
    const { list, loading, status, load } = useConsignmentReview()

    await load()

    expect(mockList).toHaveBeenCalledWith('SUBMITTED')
    expect(list.value).toEqual([SAMPLE_ITEM])
    expect(status.value).toBe('SUBMITTED')
    expect(loading.value).toBe(false)
  })

  it('load_statusSwitch_refetches', async () => {
    mockList.mockResolvedValue([])
    const { load } = useConsignmentReview()

    await load('PRICED')

    expect(mockList).toHaveBeenCalledWith('PRICED')
  })

  it('approve_sendsPayloadAndReloads', async () => {
    mockList.mockResolvedValue([SAMPLE_ITEM])
    mockReview.mockResolvedValue({ ...SAMPLE_ITEM, status: 'PRICED', platformPrice: 12800, commissionRate: 15 })
    const { approve } = useConsignmentReview()

    await approve(7, 12800, 15)

    expect(mockReview).toHaveBeenCalledWith(7, { approve: true, platformPrice: 12800, commissionRate: 15 })
    expect(mockList).toHaveBeenCalled()
  })

  it('reject_sendsReasonAndReloads', async () => {
    mockList.mockResolvedValue([])
    mockReview.mockResolvedValue({ ...SAMPLE_ITEM, status: 'REJECTED', rejectReason: '图片不清晰' })
    const { reject } = useConsignmentReview()

    await reject(7, '图片不清晰')

    expect(mockReview).toHaveBeenCalledWith(7, { approve: false, rejectReason: '图片不清晰' })
    expect(mockList).toHaveBeenCalled()
  })

  it('review_error_propagatesAndNoReload', async () => {
    mockList.mockResolvedValue([])
    mockReview.mockRejectedValue(new Error('非法状态迁移'))
    const { approve } = useConsignmentReview()

    await expect(approve(7, 12800, 15)).rejects.toThrow('非法状态迁移')
    expect(mockList).not.toHaveBeenCalled()
  })
})
