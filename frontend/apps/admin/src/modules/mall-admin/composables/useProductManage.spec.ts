import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../apis/products', () => ({
  adminProductApi: {
    page: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

import { adminProductApi } from '../apis/products'
import { useProductManage } from './useProductManage'

describe('useProductManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('status/keyword 初值为全部语义（空串）', () => {
    const { status, keyword } = useProductManage()
    expect(status.value).toBe('')
    expect(keyword.value).toBe('')
  })

  it('create 透传 payload 到 API 层', async () => {
    vi.mocked(adminProductApi.create).mockResolvedValue({} as never)
    const { create } = useProductManage()
    const payload = {
      categoryId: 2,
      name: '陶土色垂感风衣',
      items: [{ size: 'M', price: 199, stock: 5 }],
    }

    await create(payload)

    expect(adminProductApi.create).toHaveBeenCalledWith(payload)
  })

  it('update 透传 id 与 PATCH payload', async () => {
    vi.mocked(adminProductApi.update).mockResolvedValue({} as never)
    const { update } = useProductManage()

    await update(9, { status: 0 })

    expect(adminProductApi.update).toHaveBeenCalledWith(9, { status: 0 })
  })

  it('create 错误向上抛（视图层 toast）', async () => {
    vi.mocked(adminProductApi.create).mockRejectedValue(new Error('类目不存在'))
    const { create } = useProductManage()

    await expect(
      create({ categoryId: 99, name: 'x', items: [{ price: 1, stock: 1 }] })
    ).rejects.toThrow('类目不存在')
  })
})
