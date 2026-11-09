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
 * activeTab ↔ 当前路由名 单向同步：路由变化驱动 tabbar 选中态。
 *
 * 双向同步的另一半由宿主接线：activeTab 变化 → useMallTabNav 跳路由 → 路由变化 → 本 watch 回写。
 * 拆开单向 watch 而非双向绑定，避免「改 activeTab 触发跳转、跳转又触发 watch 回写」的环路。
 * immediate：刷新/直达深链时按当前路由恢复选中态。
 *
 * @param activeTab MallTabbar 的 v-model 值（宿主持有）
 */
export function useTabbarRouteSync(activeTab: Ref<string>): void {
  const { router } = useAppRouter()
  watch(
    () => router.currentRoute.value.name,
    (name) => {
      activeTab.value = routeToTab(typeof name === 'string' ? name : null)
    },
    { immediate: true },
  )
}
