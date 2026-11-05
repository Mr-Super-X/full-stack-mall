<script setup lang="ts">
/**
 * Portal 布局：企业官网专用头部 + 路由出口。
 *
 * 职责：只负责头部（PortalHeader：品牌区 + 锚点导航 + 登录/用户双态）与一行内容出口。
 *      导航以下的所有官网区块（Hero/特性/数据/关于/页脚）由 home 模块自管。
 *
 * 2026-10-20 改造：头部从 180px 位图政务风改为 64px 白底极简风（见 PortalHeader 头注释）。
 *
 * @see [`./components/PortalHeader.vue`](./components/PortalHeader.vue) 门户头部
 * @see [`./components/PortalNav.vue`](./components/PortalNav.vue) 顶部锚点导航
 * @see [`@/modules/home`](../../modules/home) 官网业务内容
 * @group 布局
 */
import PortalHeader from './components/PortalHeader.vue'

const bem = createNamespace('portal-layout')
</script>

<template>
  <div :class="bem.b()">
    <PortalHeader />
    <main :class="bem.e('main')">
      <RouterView />
    </main>
  </div>
</template>

<style lang="scss">
// 非 scoped：portal-tokens 提供的 CSS 变量需对子组件可见
@use './styles/portal-tokens.scss' as *;
</style>

<style lang="scss">
.#{$BEM_PREFIX}-portal-layout {
  min-height: 100vh;
  background: var(--portal-bg);
  display: flex;
  flex-direction: column;

  &__main {
    flex: 1;
    width: 100%;
  }
}
</style>
