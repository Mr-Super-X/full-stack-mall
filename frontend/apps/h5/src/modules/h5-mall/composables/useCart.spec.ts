import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useCart } from './useCart'
import { h5CartApi } from '../apis/cart'

// mock 模块 API 层（vi.mock 说明符与被测模块的 import 说明符一致，§1.6.2）
vi.mock('../apis/cart', () => ({
  h5CartApi: {
    list: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const mockItem = {
  id: 1,
  productItemId: 11,
  quantity: 1,
  checked: true,
  productName: '陶白条纹 T 恤',
  imageUrl: null,
  price: 99,
  stock: 5,
  conditionGrade: null,
}

describe('useCart（购物车）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('创建即默认拉取购物车列表（immediate）', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([mockItem])

    const { list, loading } = useCart()
    expect(loading.value).toBe(true)

    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(list.value).toEqual([mockItem])
  })

  it('空数组应判 Empty 态', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([])

    const { isEmpty, loading } = useCart()
    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(isEmpty.value).toBe(true)
  })

  it('add 成功后 reload 列表（角标与数量对齐真态）', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([])
    vi.mocked(h5CartApi.add).mockResolvedValue(mockItem)

    const { add } = useCart()
    await vi.waitFor(() => expect(h5CartApi.list).toHaveBeenCalledTimes(1))

    await add({ productItemId: 11, quantity: 1 })

    expect(h5CartApi.add).toHaveBeenCalledWith({ productItemId: 11, quantity: 1 })
    expect(h5CartApi.list).toHaveBeenCalledTimes(2)
  })

  it('updateQty 成功后 reload 列表', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([mockItem])
    vi.mocked(h5CartApi.update).mockResolvedValue(mockItem)

    const { updateQty } = useCart()
    await vi.waitFor(() => expect(h5CartApi.list).toHaveBeenCalledTimes(1))

    await updateQty(1, 3)

    expect(h5CartApi.update).toHaveBeenCalledWith(1, { quantity: 3 })
    expect(h5CartApi.list).toHaveBeenCalledTimes(2)
  })

  it('remove 成功后 reload 列表', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([mockItem])
    vi.mocked(h5CartApi.remove).mockResolvedValue(undefined)

    const { remove } = useCart()
    await vi.waitFor(() => expect(h5CartApi.list).toHaveBeenCalledTimes(1))

    await remove(1)

    expect(h5CartApi.remove).toHaveBeenCalledWith(1)
    expect(h5CartApi.list).toHaveBeenCalledTimes(2)
  })

  it('勾选合计：仅统计勾选的失效=false 条目 price×quantity', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([
      { ...mockItem, id: 1, price: 100, quantity: 2, invalid: false }, // 200
      { ...mockItem, id: 2, price: 50, quantity: 1, invalid: false }, // 50
      { ...mockItem, id: 3, price: 999, quantity: 1, invalid: true }, // 失效不计
    ])

    const { list, toggleCheck, checkedTotal, checkedIds } = useCart()
    await vi.waitFor(() => expect(list.value?.length).toBe(3))

    // 默认全选有效条目（初始勾选：checked && !invalid）
    expect(checkedTotal.value).toBe(250)

    toggleCheck(2)
    expect(checkedIds.value.has(2)).toBe(false)
    expect(checkedTotal.value).toBe(200)

    toggleCheck(3)
    expect(checkedIds.value.has(3)).toBe(false) // 失效条目不可勾选
  })

  it('reload 后保留用户的勾选操作（数量步进触发 reload 不重置勾选态）', async () => {
    vi.mocked(h5CartApi.list).mockResolvedValue([
      { ...mockItem, id: 1, quantity: 1, invalid: false },
      { ...mockItem, id: 2, quantity: 1, invalid: false },
    ])

    const { list, toggleCheck, checkedIds, updateQty } = useCart()
    await vi.waitFor(() => expect(list.value?.length).toBe(2))

    // 用户取消勾选 id=2
    toggleCheck(2)
    expect(checkedIds.value.has(2)).toBe(false)

    // 步进器改量触发 reload；mock 改返回新数组实例（模拟真实接口返回新数据），
    // 若 mock 复用同一引用，ref 值无变化不会触发 watch，断言会假阳性
    vi.mocked(h5CartApi.list).mockResolvedValue([
      { ...mockItem, id: 1, quantity: 5, invalid: false },
      { ...mockItem, id: 2, quantity: 1, invalid: false },
    ])
    await updateQty(1, 5)

    // 勾选态保留用户操作：id=2 仍被取消，不随 reload 重置
    expect(checkedIds.value.has(1)).toBe(true)
    expect(checkedIds.value.has(2)).toBe(false)
  })
})
