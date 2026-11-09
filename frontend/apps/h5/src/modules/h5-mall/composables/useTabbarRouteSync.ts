import type { ComputedRef } from 'vue'
import { useAppRouter } from '@vv/shared'

/**
 * route.name → tabbar key 映射表（h5-mall 全部页面）。
 *
 * 订单/工作台同属「我的」tab（买家视角我的订单、卖家视角工作台，由登录角色决定内容）；
 * 未登记路由（登录/注册/404/详情等）统一回退 home——tabbar 不跟随非常驻页高亮。
 */
const ROUTE_NAME_TO_TAB: Readonly<Record<string, string>> = {
  H5Mall: 'home',
  H5MallList: 'grid',
  H5MallOrders: 'user',
  H5MallSeller: 'user',
}

/**
 * route.name → tabbar key 纯映射（导出供单测与潜在复用）。
 *
 * @param routeName 路由 name（vue-router 允许 symbol，非字符串一律按未知处理）
 * @returns tab key；未知/空名回退 'home'
 */
export function routeToTab(routeName: string | null | undefined): string {
  if (typeof routeName !== 'string') return 'home'
  return ROUTE_NAME_TO_TAB[routeName] ?? 'home'
}

/**
 * tabbar 选中态路由派生（单一事实源，计划 08 Task 4 浏览器实测修正）。
 *
 * 背景裁决：早期实现为「activeTab ref + useMallTabNav 重置 + 本 watch 回写」双向同步，
 * route 回写会被 useMallTabNav 误判为点击再重置，终态 activeTab 与 route 错位
 *（浏览器前进/后退选中态不跟随，见 .superpowers/sdd/08 ledger Task 4 Ruling）。
 * 改为 computed 派生后：点击 tab 只负责跳路由（shell onTabSelect），路由变化自然
 * 派生 activeTab——无双向同步竞态，前进/后退/刷新天然对齐。
 *
 * @returns activeTab computed；消费方（外壳）直接 :model-value 绑定 MallTabbar
 */
export function useTabbarRouteSync(): ComputedRef<string> {
  const { router } = useAppRouter()
  return computed(() =>
    routeToTab(
      typeof router.currentRoute.value.name === 'string' ? router.currentRoute.value.name : null,
    ),
  )
}
