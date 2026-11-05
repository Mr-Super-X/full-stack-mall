<script setup lang="ts">
/**
 * Blank 布局（无侧边栏 / 顶部 / 多页签）。
 *
 * 用途：首页、错误页（404 / 403 / 500）等需要全屏纯净背景的页面。
 * 最小公开应用的默认布局——需要带导航的完整布局时参考 apps/admin 的
 * layouts/default 自建（本模板不预置）。
 *
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
  background: #f5f7fa;
  /* 注意：不要用 display: flex + align-items: center + justify-content: center
     ——这会把子内容水平垂直居中在视口中央，导致内容短时看起来"悬空"。
     让内容顶部对齐即可。 */
}
</style>
