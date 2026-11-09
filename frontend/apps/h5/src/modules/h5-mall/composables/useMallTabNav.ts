import { useAppRouter } from '@vv/shared'

/**
 * 底部 Tabbar 的 tab key → 路由接线（MallTabbar 只负责受控切换，路由由宿主经本 composable 接住）。
 *
 * 映射（MALL_TABS）：
 * - home（首页）→ 留在本页，无动作
 * - grid（分类）→ 跳商品列表页 H5MallList，并把选中态重置回 home（返回时 tabbar 选中正确）
 * - user（我的）→ 跳我的订单页 H5MallOrders；选中态先重置回 home，跳转完成后由
 *   useTabbarRouteSync 按 route.name 回写 'user'（避免跳转期间选中态悬空）
 * - bag（购物袋）→ 页面未实现，经 onTodo 回调提示（宿主决定文案与形式）
 *
 * @param activeTab MallTabbar 的 v-model 值（宿主持有）
 * @param options.onTodo 未实现 tab 的提示回调（宿主传 useToast 的 show 等）
 */
export function useMallTabNav(activeTab: Ref<string>, options?: { onTodo?: (tab: string) => void }): void {
  const { pushByName } = useAppRouter()

  watch(activeTab, (key) => {
    if (key === 'grid') {
      activeTab.value = 'home'
      void pushByName('H5MallList')
      return
    }
    if (key === 'user') {
      activeTab.value = 'home'
      void pushByName('H5MallOrders')
      return
    }
    if (key !== 'home') {
      options?.onTodo?.(key)
      // 未实现页不跳转，选中态也重置回 home（避免停留在没有内容的 tab）
      activeTab.value = 'home'
    }
  })
}
