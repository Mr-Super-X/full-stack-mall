<script setup lang="ts">
/**
 * 站内 404（白名单成员 + fallback catch-all 重定向目标）。
 * 视觉与交互统一走 @vv/ui 的 <ErrorPage />（全局自动注册，无须 import），返回首页。
 *
 * @see [`../../router/index.ts`](../../router/index.ts) /404 注册
 * @see `@vv/ui/components/common/ErrorPage/ErrorPage.vue` 共享错误页组件
 * @group 视图：兜底
 */
</script>

<template>
  <ErrorPage status="404" title="页面不存在或已移除" return-to="/home" return-label="返回首页" />
</template>
