<script setup lang="ts">
/**
 * h5-mall 常驻外壳：RouterView + 常驻 Tabbar（切 tab 页不消失）。
 *
 * 结构裁决：tabbar 常驻靠本外壳（非上移 layouts/h5）——AGENTS.md §1.2 模块边界
 * 禁止 layouts 引用 modules/ 组件（见 .superpowers/sdd/08 ledger Task 1 Ruling）。
 * 路由接线见 ../routes/index.ts：layout 下再嵌套本 shell，detail/login/register/404
 * 与 shell 平级、不享常驻 tabbar。
 *
 * BEM 命名与首页同 `h5-mall`（而非 shell 独立命名空间）：--mall-* token 挂在
 * `.vv-h5-mall` 选择器（../styles/h5-mall-tokens.scss），tabbar 的陶土槽位
 * 消费这些变量，外壳根必须落在 token 作用域内。
 *
 * Toast 实例说明：本外壳的 MallToast 只接 tab 未实现提示（bag）；首页区块交互
 * （加购/收藏）保留首页自己的 useToast + MallToast 实例，两者独立互不干扰。
 */
import MallTabbar from '../components/MallTabbar.vue'
import MallToast from '../components/MallToast.vue'
import { useMallTabNav } from '../composables/useMallTabNav'
import { useTabbarRouteSync } from '../composables/useTabbarRouteSync'
import { useToast } from '../composables/useToast'

const bem = createNamespace('h5-mall')

const { visible, message, show } = useToast()

/** Tabbar 选中 key（v-model 受控；路由同步见 useTabbarRouteSync，切 tab 跳路由见 useMallTabNav） */
const activeTab = ref('home')

/** 路由变化 → activeTab 回写（含浏览器前进/后退、刷新恢复选中态） */
useTabbarRouteSync(activeTab)

/** tab key → 路由接线（grid 跳列表、user 跳我的订单；bag 未实现走 toast 提示） */
useMallTabNav(activeTab, {
  onTodo: (tab) => show(tab === 'bag' ? '购物袋功能开发中' : '功能开发中'),
})
</script>

<template>
  <div :class="bem.b()">
    <RouterView />
    <MallTabbar v-model="activeTab" :cart-count="0" />
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
  // 为 fixed tabbar 留出底部空间：容器高 TB_H(134)@362 稿 × (828/362) ≈ 307 稿 px；
  // 该留白随 tabbar 上移自首页迁至此（首页原 padding-bottom 已删）
  padding-bottom: 307px;
}
</style>
