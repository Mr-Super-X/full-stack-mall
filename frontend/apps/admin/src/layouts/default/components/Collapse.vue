<script setup lang="ts">
/**
 * 侧栏折叠按钮（hamburger）：翻转 appStore.sidebarCollapsed。
 *
 * 复刻参考仓 Collapse：纯按钮 + 图标切换（展开 Fold / 收起 Expand）。
 *
 * @see `@vv/shared` store/modules/app —— sidebarCollapsed（@/ 已不指 shared，注释路径随 Monorepo 迁移修正）
 * @group 布局：Default
 */
import { Expand, Fold } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@vv/shared'

const bem = createNamespace('app-collapse')

const appStore = useAppStore()
const { t } = useI18n()
</script>

<template>
  <button
    :class="bem.b()"
    type="button"
    :aria-label="appStore.sidebarCollapsed ? t('header.expand') : t('header.collapse')"
    @click="appStore.toggleSidebar()"
  >
    <el-icon :size="18">
      <Fold v-if="!appStore.sidebarCollapsed" />
      <Expand v-else />
    </el-icon>
  </button>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-collapse {
  display: grid;
  width: var(--top-tool-height);
  height: 100%;
  padding: 0;
  color: var(--top-header-text-color);
  cursor: pointer;
  background: transparent;
  border: 0;
  place-items: center;

  &:hover,
  &:focus-visible {
    color: var(--el-color-primary);
    background: var(--top-header-hover-color);
    outline: none;
  }
}
</style>
