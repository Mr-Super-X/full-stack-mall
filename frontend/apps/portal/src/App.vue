<script setup lang="ts">
/**
 * 应用根组件（portal 企业官网门户最小壳）。
 *
 * 壳体结构（ElConfigProvider + ErrorBoundary + RouterView）与 auth/h5/big/docs
 * 全同构，统一收敛为 @vv/ui <AppShell /> 全局组件（2026-10-23 重复性审查收敛），
 * 本文件只保留 app 语义说明。
 *
 * 相对 admin App.vue 的裁剪：无远程菜单骨架（portal 无远程菜单）、
 * 无 locale 跟随 appStore 同步（门户站无语言切换入口，固定 zh-cn
 * 保证 Element Plus 组件中文文案，与官网在 admin 内的渲染口径一致）。
 *
 * @see `@vv/ui/components/common/AppShell.vue` 统一壳体（全局自动注册，零 import）
 * @see [`./router`](./router/index.ts) 路由配置
 * @group 应用根
 */
</script>

<template>
  <AppShell />
</template>
