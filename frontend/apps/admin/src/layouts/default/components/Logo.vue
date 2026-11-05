<script setup lang="ts">
/**
 * Default 布局品牌区：SVG logo + 标题，点击回首页。
 *
 * 标题显隐规则（复刻参考仓 Logo）：
 * - compact 模式（dual 的 rail 栏）→ 只显示 logo
 * - top / mixed 模式（标题在顶栏）→ 常驻显示
 * - sidebar 模式 → 跟随侧栏折叠态隐藏
 *
 * 说明：项目无 logo 图片资产，用内联 SVG 几何标代替（参考仓为 png 图）。
 *
 * @see [`../config/app.ts`](../config/app.ts) 标题文案来源
 * @see `@vv/shared` store/modules/app —— layout / sidebarCollapsed
 * @group 布局：Default
 */
import { useAppStore } from '@vv/shared'
import { defaultLayoutConfig } from '../config/app'

const bem = createNamespace('app-logo')

const props = withDefaults(
  defineProps<{
    /** 紧凑模式（dual rail）：只显示 logo 图标，无标题 */
    compact?: boolean
  }>(),
  { compact: false }
)

const appStore = useAppStore()
const { router } = useAppRouter()

/** 是否显示标题文案 */
const showTitle = computed(() => {
  if (props.compact) return false
  if (appStore.layout === 'top' || appStore.layout === 'mixed') return true
  return !appStore.sidebarCollapsed
})

function goHome() {
  router.push('/')
}
</script>

<template>
  <a :class="bem.b()" href="/" :aria-label="defaultLayoutConfig.title" @click.prevent="goHome">
    <svg :class="bem.e('mark')" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="4" fill="var(--el-color-primary)" />
      <rect x="22" y="2" width="16" height="16" rx="8" fill="var(--el-color-primary-light-3)" />
      <rect x="2" y="22" width="16" height="16" rx="8" fill="var(--el-color-primary-light-5)" />
      <rect x="22" y="22" width="16" height="16" rx="4" fill="var(--el-color-primary-light-7)" />
    </svg>
    <span
      v-if="showTitle"
      :class="[
        bem.e('title'),
        appStore.layout === 'top' || appStore.layout === 'mixed' ? bem.em('title', 'header') : '',
      ]"
    >
      {{ defaultLayoutConfig.title }}
    </span>
  </a>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--logo-height);
  padding: 0 10px;
  overflow: hidden;
  text-decoration: none;
  white-space: nowrap;
  flex: none;

  &__mark {
    width: 38px; // 与参考仓 logo 图片尺寸一致（60px 栏高内垂直居中）
    height: 38px;
    flex: none;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    // 侧栏 / dual rail：跟随侧栏标题色；top / mixed 顶栏：跟随顶栏文字色
    color: var(--logo-title-text-color);

    &--header {
      color: var(--top-header-text-color);
    }
  }
}
</style>
