<script setup lang="ts">
/**
 * Default 布局页脚：版权信息（config.ui.footer 控制显隐）。
 *
 * @see [`../config/app.ts`](../config/app.ts) title 与 footer 开关
 * @group 布局：Default
 */
import { defaultLayoutConfig } from '../config/app'

const bem = createNamespace('app-footer')

const year = new Date().getFullYear()
</script>

<template>
  <footer :class="bem.b()">
    <span>© {{ year }} {{ defaultLayoutConfig.title }}</span>
  </footer>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--app-footer-height);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--app-content-bg-color);
}
</style>
