<script setup lang="ts">
/**
 * 500 服务器内部错误页（守卫捕获异常后跳此路由）。
 * 视觉与交互统一走 @vv/ui 的 <ErrorPage />（全局自动注册，无须 import），返回工作台。
 *
 * @see [`../router/guards/auth`](../router/guards/auth.ts) 守卫消费方
 * @see [`../router/index.ts`](../router/index.ts) 路由 /500（根级内联注册）
 * @see `@vv/ui/components/common/ErrorPage/ErrorPage.vue` 共享错误页组件
 * @group 路由级页面：Error
 */
</script>

<template>
  <!-- title 走 error.500 i18n 键（2026-10-28 审计激活死键；zh 由口语「服务器开小差了」统一为键值「服务器错误」）；return-label 属业务文案保留硬编码 -->
  <ErrorPage
    status="500"
    :title="$t('error.500')"
    return-to="/workbench"
    return-label="返回工作台"
  />
</template>
