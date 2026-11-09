<script setup lang="ts">
/**
 * 我的订单（占位）——Task 2 覆写为正式视图（列表 + 确认收货）。
 * 路由已在 ../routes/index.ts 注册（name: H5MallOrders），tabbar 常驻经 ../shell.vue。
 */
const bem = createNamespace('h5-mall-orders')
</script>

<template>
  <div :class="bem.b()">
    <van-empty description="订单功能建设中" />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-h5-mall-orders {
  padding: 106px 53px;
}
</style>
