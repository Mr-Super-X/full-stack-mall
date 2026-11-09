import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import { routeToTab, useTabbarRouteSync } from './useTabbarRouteSync'

// mock useAppRouter（项目封装，§1.6.2 包名 barrel 消费）；
// currentRoute 用 ref 模拟 vue-router 的 shallowRef 行为
const currentRoute = ref<{ name: string | null }>({ name: 'H5Mall' })
vi.mock('@vv/shared', () => ({
  useAppRouter: () => ({ router: { currentRoute } }),
}))

describe('routeToTab（route.name → tab key 纯映射）', () => {
  it('商城首页映射 home', () => {
    expect(routeToTab('H5Mall')).toBe('home')
  })

  it('商品列表映射 grid', () => {
    expect(routeToTab('H5MallList')).toBe('grid')
  })

  it('我的订单/卖家工作台映射 user', () => {
    expect(routeToTab('H5MallOrders')).toBe('user')
    expect(routeToTab('H5MallSeller')).toBe('user')
  })

  it('未知路由与空名回退 home', () => {
    expect(routeToTab('H5MallUnknown')).toBe('home')
    expect(routeToTab(null)).toBe('home')
    expect(routeToTab(undefined)).toBe('home')
  })
})

describe('useTabbarRouteSync（activeTab ↔ route.name 同步）', () => {
  beforeEach(() => {
    currentRoute.value = { name: 'H5Mall' }
  })

  it('immediate：挂载即按当前路由校准 activeTab', () => {
    currentRoute.value = { name: 'H5MallList' }
    const activeTab = ref('home')
    useTabbarRouteSync(activeTab)
    expect(activeTab.value).toBe('grid')
  })

  it('route.name 变化驱动 activeTab 跟随', async () => {
    const activeTab = ref('home')
    useTabbarRouteSync(activeTab)
    expect(activeTab.value).toBe('home')

    currentRoute.value = { name: 'H5MallOrders' }
    await vi.waitFor(() => expect(activeTab.value).toBe('user'))

    currentRoute.value = { name: 'H5Mall' }
    await vi.waitFor(() => expect(activeTab.value).toBe('home'))
  })
})
