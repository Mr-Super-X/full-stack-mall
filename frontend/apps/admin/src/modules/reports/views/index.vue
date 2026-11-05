<script setup lang="ts">
/**
 * 报表页（演示 meta.menuVisible 隐藏 + 仍然能直接 URL 访问的能力）。
 *
 * 注：本视图不在菜单中渲染（meta.menuVisible: false 仅过滤侧边栏，不触发守卫拦截），
 * 但路由仍存在。业务场景：运营报表不希望出现在侧边栏，但客服可以通过邮件链接直达。
 *
 * @see [`../routes/index.ts`](../routes/index.ts) 路由配置
 * @see [`@/router/guards/permission`](../../../router/guards/permission.ts) 权限守卫
 * @group 业务模块：Reports
 */
// BEM 工具由 unplugin-auto-import 自动注入，无须显式 import
const bem = createNamespace('reports-index')
</script>

<template>
  <div :class="bem.b()">
    <h2>运营报表</h2>
    <p>隐藏菜单（meta.menuVisible: false），需手动输入 URL 访问。</p>
    <p>
      权限码：
      <code>reports:view</code>
    </p>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-reports-index {
  padding: 24px;
}
</style>
