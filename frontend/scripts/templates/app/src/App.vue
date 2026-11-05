<script setup lang="ts">
/**
 * 应用根组件（__APP_NAME__ 最小壳）。
 *
 * 壳体结构（ElConfigProvider + ErrorBoundary + RouterView）统一收敛为
 * @vv/ui <AppShell /> 全局组件（自动注册，零 import），本文件只保留 app 语义说明。
 *
 * @see `@vv/ui/components/common/AppShell.vue` 统一壳体
 * @see [`./router`](./router/index.ts) 路由配置
 * @group 应用根
 */
</script>

<template>
  <AppShell />
</template>
