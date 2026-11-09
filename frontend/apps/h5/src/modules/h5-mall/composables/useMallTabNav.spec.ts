import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import { useMallTabNav } from './useMallTabNav'

// mock useAppRouter（项目封装，§1.6.2 包名 barrel 消费）
const pushByName = vi.fn()
vi.mock('@vv/shared', () => ({
  useAppRouter: () => ({ pushByName }),
}))

describe('useMallTabNav', () => {
  beforeEach(() => {
    pushByName.mockClear()
  })
  it('切到分类应跳列表页并重置选中态回首页', async () => {
    const activeTab = ref('home')
    useMallTabNav(activeTab)

    activeTab.value = 'grid'
    await vi.waitFor(() => expect(pushByName).toHaveBeenCalledWith('H5MallList'))

    expect(activeTab.value).toBe('home')
  })

  it('购物袋/我的应走 onTodo 提示且不跳转', async () => {
    const activeTab = ref('home')
    const onTodo = vi.fn()
    useMallTabNav(activeTab, { onTodo })

    activeTab.value = 'bag'
    await vi.waitFor(() => expect(onTodo).toHaveBeenCalledWith('bag'))
    expect(pushByName).not.toHaveBeenCalled()

    activeTab.value = 'user'
    await vi.waitFor(() => expect(onTodo).toHaveBeenCalledWith('user'))
    expect(pushByName).not.toHaveBeenCalled()
  })

  it('首页 tab 不触发任何动作', async () => {
    const activeTab = ref('home')
    const onTodo = vi.fn()
    useMallTabNav(activeTab, { onTodo })

    activeTab.value = 'home'
    await new Promise((r) => setTimeout(r, 50))

    expect(pushByName).not.toHaveBeenCalled()
    expect(onTodo).not.toHaveBeenCalled()
  })
})
