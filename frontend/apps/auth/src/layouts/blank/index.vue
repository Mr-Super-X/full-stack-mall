<script setup lang="ts">
/**
 * Blank 布局（无侧边栏 / 顶部 / 多页签）。
 *
 * 用途：登录页、错误页（404 / 403 / 500）等需要全屏纯净背景的页面。
 * 路由 meta.layout === 'blank' 的路由会使用本布局。
 *
 * @see [`../../router/config.ts`](../../router/config.ts) 路由配置
 * @see [`../default/index.vue`](../default/index.vue) 完整布局
 * @group 布局
 */
// 运行时 BEM 命名空间：vv-blank-layout
const bem = createNamespace('blank-layout')
</script>

<template>
  <div :class="bem.b()">
    <RouterView />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-blank-layout {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f7fa);
  /* 注意：不要用 display: flex + align-items: center + justify-content: center
     ——这会把子内容水平垂直居中在视口中央，导致内容短时看起来"悬空"。
     让内容顶部对齐即可。 */
}
</style>
