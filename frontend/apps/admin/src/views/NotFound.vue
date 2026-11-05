<script setup lang="ts">
/**
 * 404 页面不存在页（catch-all 兜底 + 手动访问 /404）。
 * 视觉与交互统一走 @vv/ui 的 <ErrorPage />（全局自动注册，无须 import），返回工作台。
 *
 * @see [`../router/index.ts`](../router/index.ts) 路由 /404（根级内联注册）
 * @see `@vv/ui/components/common/ErrorPage/ErrorPage.vue` 共享错误页组件
 * @group 路由级页面：Error
 */
</script>

<template>
  <!-- title 走 error.404 i18n 键（2026-10-28 审计激活死键，zh 逐字相同） -->
  <ErrorPage
    status="404"
    :title="$t('error.404')"
    return-to="/workbench"
    return-label="返回工作台"
  />
</template>
