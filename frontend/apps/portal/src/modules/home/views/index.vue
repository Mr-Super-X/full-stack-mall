<script setup lang="ts">
/**
 * 企业官网首页视图：Hero + 特性 + 数据 + 关于 + 页脚。
 *
 * PortalHeader 在父级 `layouts/portal` 内；本页全部为纯静态展示区块（文案在 `config/site.ts`），
 * 无请求因此无需 Loading/Error/Empty 三态。
 *
 * @see [`../config/site.ts`](../config/site.ts) 全站文案数据单源
 * @group 业务模块：Home
 */
import SiteHero from '../components/SiteHero.vue'
import SiteFeatures from '../components/SiteFeatures.vue'
import SiteStats from '../components/SiteStats.vue'
import SiteAbout from '../components/SiteAbout.vue'
import SiteFooter from '../components/SiteFooter.vue'

const bem = createNamespace('home-index')
</script>

<template>
  <div :class="bem.b()">
    <SiteHero />
    <SiteFeatures />
    <SiteStats />
    <SiteAbout />
    <SiteFooter />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-home-index {
  min-height: 100vh;

  // 锚点滚动时抵消 sticky header 高度（64px）；仅直接子级区块，避免误伤后代 section
  > section[id] {
    scroll-margin-top: var(--portal-header-h);
  }
}
</style>
