<script setup lang="ts">
/**
 * Vant 4 按需引入验证页 —— 开发验证用（生产不注册路由）。
 *
 * 用法：pnpm dev:gateway h5 → 访问 http://localhost:8080/h5/vant-test/
 * 预期：<van-button> 自动解析 + CSS 注入 + 主题覆盖生效（品牌橙按钮）
 */
const bem = createNamespace('vant-test')
</script>

<template>
  <div :class="bem.b()">
    <h2 :class="bem.e('title')">Vant 4 按需引入验证</h2>
    <van-button type="primary" :class="bem.e('btn')">主按钮（品牌橙）</van-button>
    <van-button type="success" :class="bem.e('btn')">成功按钮</van-button>
    <van-button type="danger" :class="bem.e('btn')">危险按钮</van-button>
    <van-cell-group :class="bem.e('cell')">
      <van-cell title="单元格" value="内容" />
      <van-cell title="单元格" value="内容" />
    </van-cell-group>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-vant-test {
  padding: 20px;

  &__title {
    margin-bottom: 16px;
    font-size: 18px;
    font-weight: 600;
  }

  &__btn {
    margin-right: 12px;
    margin-bottom: 12px;
  }

  &__cell {
    margin-top: 20px;
  }
}
</style>
