<script setup lang="ts">
/**
 * 卖家工作台（占位）——Task 3 覆写为正式视图（我的寄卖 + 接受定价 + 售出订单发货）。
 * 路由已在 ../routes/index.ts 注册（name: H5MallSeller），tabbar 常驻经 ../shell.vue。
 */
const bem = createNamespace('h5-mall-seller')
</script>

<template>
  <div :class="bem.b()">
    <van-empty description="卖家工作台建设中" />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-h5-mall-seller {
  padding: 106px 53px;
}
</style>
