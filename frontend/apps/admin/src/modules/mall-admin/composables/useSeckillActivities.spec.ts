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

  it('load 按 status 与页码请求并回填列表', async () => {
    vi.mocked(adminSeckillApi.page).mockResolvedValue({
      list: [
        {
          id: 1,
          productId: 16,
          productTitle: '复古做旧牛仔夹克',
          seckillPrice: 299.4,
          seckillStock: 5,
          soldCount: 0,
          startTime: '2026-11-10T12:00:00',
          endTime: '2026-11-17T12:00:00',
          limitPerUser: 1,
          status: 'PENDING',
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    })

    const { status, list, total, load } = useSeckillActivities()
    status.value = 'PENDING'
    await load(2)

    expect(adminSeckillApi.page).toHaveBeenCalledWith({ status: 'PENDING', page: 2, pageSize: 10 })
    expect(list.value).toHaveLength(1)
    expect(total.value).toBe(1)
  })

  it('create 成功后回第 1 页 reload', async () => {
    vi.mocked(adminSeckillApi.page).mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 10 })
    vi.mocked(adminSeckillApi.create).mockResolvedValue({} as never)

    const { create } = useSeckillActivities()
    await create({
      productId: 16,
      seckillPrice: 299.4,
      seckillStock: 5,
      startTime: '2026-11-10T14:00:00',
      endTime: '2026-11-10T20:00:00',
      limitPerUser: 1,
    })

    expect(adminSeckillApi.create).toHaveBeenCalledTimes(1)
    expect(adminSeckillApi.page).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    )
  })

  it('cancel 成功后 reload 当前页', async () => {
    vi.mocked(adminSeckillApi.page).mockResolvedValue({ list: [], total: 0, page: 3, pageSize: 10 })
    vi.mocked(adminSeckillApi.cancel).mockResolvedValue(undefined as never)

    const { load, cancel } = useSeckillActivities()
    await load(3)
    await cancel(9)

    expect(adminSeckillApi.cancel).toHaveBeenCalledWith(9)
    expect(adminSeckillApi.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 })
    )
  })
})
