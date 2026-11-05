<script setup lang="ts">
/**
 * 顶栏工具条（复刻参考仓 ToolHeader）。
 *
 * 左侧：折叠按钮（hamburger）+ 面包屑（均可通过 props / config.ui 关闭）
 * 右侧：布局切换器 + 主题开关 + 语言下拉 + 用户信息
 *
 * 主题开关复用项目 useTheme（data-theme 属性），切换 light/dark。
 *
 * @see [`./LayoutSwitcher.vue`](./LayoutSwitcher.vue) 布局切换
 * @see `@vv/shared` composables/useTheme —— 主题切换（app src 无 composables 目录，2026-10-27 审计修断链）
 * @group 布局：Default
 */
import { Moon, Sunny } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@vv/shared'
import { defaultLayoutConfig } from '../config/app'
import Collapse from './Collapse.vue'
import Breadcrumb from './Breadcrumb.vue'
import LayoutSwitcher from './LayoutSwitcher.vue'
import LocaleDropdown from './LocaleDropdown.vue'
import UserInfo from './UserInfo.vue'

const bem = createNamespace('tool-header')

withDefaults(
  defineProps<{
    /** 展示折叠按钮（mixed 模式顶栏需要） */
    showCollapse?: boolean
    /** 展示面包屑 */
    showBreadcrumb?: boolean
  }>(),
  { showCollapse: true, showBreadcrumb: true }
)

const { isDark, setMode } = useTheme()
const { t } = useI18n()
</script>

<template>
  <div :class="bem.b()">
    <div v-if="showCollapse || showBreadcrumb" :class="bem.e('left')">
      <Collapse v-if="defaultLayoutConfig.ui.hamburger && showCollapse" />
      <Breadcrumb v-if="defaultLayoutConfig.ui.breadcrumb && showBreadcrumb" />
    </div>
    <div :class="bem.e('right')">
      <LayoutSwitcher />
      <el-switch
        v-if="defaultLayoutConfig.ui.theme"
        :class="bem.e('theme')"
        :model-value="isDark"
        inline-prompt
        :active-icon="Moon"
        :inactive-icon="Sunny"
        :aria-label="t('header.darkMode')"
        @update:model-value="(v: boolean | string | number) => setMode(v ? 'dark' : 'light')"
      />
      <LocaleDropdown v-if="defaultLayoutConfig.ui.locale" />
      <UserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--top-tool-height);
  padding: 0 var(--top-tool-p-x);

  &__left,
  &__right {
    display: flex;
    align-items: center;
    height: 100%;
    min-width: 0;
  }

  &__theme {
    margin: 0 8px;
  }
}
</style>
