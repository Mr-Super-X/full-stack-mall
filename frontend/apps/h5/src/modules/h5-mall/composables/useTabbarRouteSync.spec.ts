import { describe, expect, it, vi } from 'vitest'
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

describe('useTabbarRouteSync（activeTab 路由派生，单一事实源）', () => {
  it('按当前路由派生 activeTab（浏览器前进/后退/刷新随路由对齐）', () => {
    currentRoute.value = { name: 'H5Mall' }
    const activeTab = useTabbarRouteSync()
    expect(activeTab.value).toBe('home')

    currentRoute.value = { name: 'H5MallList' }
    expect(activeTab.value).toBe('grid')

    currentRoute.value = { name: 'H5MallOrders' }
    expect(activeTab.value).toBe('user')

    currentRoute.value = { name: 'H5MallSeller' }
    expect(activeTab.value).toBe('user')

    // 未登记路由（登录/404/详情）回退 home
    currentRoute.value = { name: 'H5MallLogin' }
    expect(activeTab.value).toBe('home')
  })
})
