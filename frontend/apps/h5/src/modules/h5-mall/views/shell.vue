<script setup lang="ts">
/**
 * h5-mall 常驻外壳：RouterView + 常驻 Tabbar（切 tab 页不消失）。
 *
 * 结构裁决：tabbar 常驻靠本外壳（非上移 layouts/h5）——AGENTS.md §1.2 模块边界
 * 禁止 layouts 引用 modules/ 组件（见 .superpowers/sdd/08 ledger Task 1 Ruling）。
 * 路由接线见 ../routes/index.ts：layout 下再嵌套本 shell，detail/login/register/404
 * 与 shell 平级、不享常驻 tabbar。
 *
 * 选中态单一事实源（ledger Task 4 Ruling）：activeTab 为 route.name 的 computed 派生
 *（useTabbarRouteSync），点击 tab 只跳路由、路由变化自然派生选中态——
 * 浏览器前进/后退/刷新选中态天然跟随，无双向同步竞态。
 *
 * BEM 命名与首页同 `h5-mall`（而非 shell 独立命名空间）：--mall-* token 挂在
 * `.vv-h5-mall` 选择器（../styles/h5-mall-tokens.scss），tabbar 的陶土槽位
 * 消费这些变量，外壳根必须落在 token 作用域内。
 *
 * Toast 实例说明：本外壳的 MallToast 只接 tab 未实现提示（bag）；首页区块交互
 *（加购/收藏）保留首页自己的 useToast + MallToast 实例，两者独立互不干扰。
 */
import MallSprite from '../components/MallSprite.vue'
import MallTabbar from '../components/MallTabbar.vue'
import MallToast from '../components/MallToast.vue'
import { useTabbarRouteSync } from '../composables/useTabbarRouteSync'
import { useToast } from '../composables/useToast'
import { useCartBadgeStore } from '../store/cart'

const bem = createNamespace('h5-mall')

const { visible, message, show } = useToast()

const { pushByName } = useAppRouter()

/** Tabbar 选中态：route.name 派生（单一事实源，切 tab/前进后退/刷新均随路由） */
const activeTab = useTabbarRouteSync()

/** 购物车角标（bag 条数）：挂载刷新一次，加购/购物车变更后由调用方 refresh */
const cartBadge = useCartBadgeStore()
onMounted(() => {
  void cartBadge.refresh()
})

/** tab key → 路由接线：点击只负责跳路由，选中态由路由派生（取代原 useMallTabNav 的 watch 模型） */
function onTabSelect(key: string): void {
  if (key === 'home') {
    void pushByName('H5Mall')
    return
  }
  if (key === 'grid') {
    void pushByName('H5MallList')
    return
  }
  if (key === 'user') {
    void pushByName('H5MallOrders')
    return
  }
  // bag（购物袋）：跳购物车页（未登录由路由守卫拦登录）
  void pushByName('H5MallCart')
}
</script>

<template>
  <div :class="bem.b()">
    <!-- MallSprite 为全页唯一 SVG symbol 定义源：tabbar/首页区块/商品占位线稿都经 <use href="#mall-*"> 引用。
         必须挂常驻外壳——tabbar 常驻后切走首页即卸载，symbol 丢失致 icon 全空（2026-11-10 浏览器实证） -->
    <MallSprite />
    <RouterView />
    <MallTabbar :model-value="activeTab" @update:model-value="onTabSelect" :cart-count="cartBadge.count" />
    <MallToast :visible="visible" :message="message" />
  </div>
</template>

<style lang="scss">
// @use 发射 .vv-h5-mall { --mall-* } token 规则；与本 shell 根类同名，
// 与首页 views/index.vue 的 @use 产出并集生效（值同，重复发射无害）
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-h5-mall {
  min-height: 100vh;
  // 100dvh 渐进增强：规避 iOS Safari 地址栏收缩溢出（与 layouts/h5 同策略）
  min-height: 100dvh;
  // 应用外壳底色 = 页面米色：fixed tabbar 占位区（下方 padding）与各页滚到底的
  // 内容间隙均由此承接，否则透出 body 白底造成视觉割裂（2026-11-11 用户截图实证）
  background: var(--mall-bg-page);
  // 为 fixed tabbar 留出底部空间：容器高 TB_H(134)@362 稿 × (828/362) ≈ 307 稿 px；
  // 该留白随 tabbar 上移自首页迁至此（首页原 padding-bottom 已删）
  padding-bottom: 307px;
}
</style>
