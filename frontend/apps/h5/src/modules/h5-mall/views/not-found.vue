<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）

/**
 * 404 页：商品不存在/页面不存在通用。
 * 由 detail.vue 的 404 错误触发跳转，或直接访问 /h5-mall/404。
 */
const bem = createNamespace('mall-not-found')

// 项目 composable @vv/shared（vite 自动注入）
const { replaceByName } = useAppRouter()
</script>

<template>
  <div :class="bem.b()">
    <van-empty description="页面不存在或商品已下架">
      <van-button round type="primary" @click="replaceByName('H5Mall')">返回首页</van-button>
    </van-empty>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-mall-not-found {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mall-font-body);
  background: var(--mall-bg-page);
}
</style>
