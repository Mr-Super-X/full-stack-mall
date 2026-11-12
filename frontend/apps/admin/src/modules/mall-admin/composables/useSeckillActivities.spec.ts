import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../apis/seckill', () => ({
  adminSeckillApi: {
    page: vi.fn(),
    candidates: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
  },
}))

import { adminSeckillApi } from '../apis/seckill'
import { useSeckillActivities } from './useSeckillActivities'

describe('useSeckillActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('status 初值为全部', () => {
    const { status } = useSeckillActivities()
    expect(status.value).toBe('')
  })

  it('create 透传创建参数', async () => {
    vi.mocked(adminSeckillApi.create).mockResolvedValue({} as never)
    const { create } = useSeckillActivities()
    const payload = {
      productId: 16,
      seckillPrice: 299.4,
      seckillStock: 5,
      startTime: '2026-11-10T14:00:00',
      endTime: '2026-11-10T20:00:00',
      limitPerUser: 1,
    }

    await create(payload)

    expect(adminSeckillApi.create).toHaveBeenCalledWith(payload)
  })

  it('cancel 透传场次 id', async () => {
    vi.mocked(adminSeckillApi.cancel).mockResolvedValue(undefined as never)
    const { cancel } = useSeckillActivities()

    await cancel(9)

    expect(adminSeckillApi.cancel).toHaveBeenCalledWith(9)
  })

  it('cancel 错误向上抛（视图层 toast）', async () => {
    vi.mocked(adminSeckillApi.cancel).mockRejectedValue(new Error('仅 PENDING 可取消'))
    const { cancel } = useSeckillActivities()

    await expect(cancel(9)).rejects.toThrow('仅 PENDING 可取消')
  })
})
