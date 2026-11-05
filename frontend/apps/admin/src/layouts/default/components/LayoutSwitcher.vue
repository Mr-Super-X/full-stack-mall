<script setup lang="ts">
/**
 * 布局模式切换面板（复刻参考仓 LayoutSwitcher）。
 *
 * 触发按钮显示当前布局名，面板为 2x2 网格：每个选项用纯 CSS 绘制
 * 布局结构缩略图（header/sidebar/content 色块）+ 选中对勾。
 * 选择后写入 appStore.setLayout，面板通过 focusout / Esc 关闭。
 *
 * @see `@vv/shared` store/modules/app —— LayoutMode / setLayout
 * @group 布局：Default
 */
import { ArrowDown, Check, Menu as MenuIconEp } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, type LayoutMode } from '@vv/shared'

const bem = createNamespace('layout-switcher')

const appStore = useAppStore()
const { t } = useI18n()
const open = ref(false)

/** 布局项的 i18n 键（label 走 t()，切换语言热更新） */
const LAYOUTS: { value: LayoutMode; labelKey: string }[] = [
  { value: 'sidebar', labelKey: 'header.layoutSidebar' },
  { value: 'top', labelKey: 'header.layoutTop' },
  { value: 'mixed', labelKey: 'header.layoutMixed' },
  { value: 'dual', labelKey: 'header.layoutDual' },
]

const currentLabel = computed(() =>
  t(LAYOUTS.find((item) => item.value === appStore.layout)?.labelKey ?? '')
)

function selectLayout(mode: LayoutMode) {
  appStore.setLayout(mode)
  open.value = false
}

/** 面板失焦关闭（焦点移出容器时） */
function closeOnBlur(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement
  if (!current.contains(event.relatedTarget as Node | null)) {
    open.value = false
  }
}
</script>

<template>
  <div :class="[bem.b(), bem.is('open', open)]" @focusout="closeOnBlur" @keydown.esc="open = false">
    <button
      :class="bem.e('trigger')"
      type="button"
      :aria-label="t('header.switchLayout')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <el-icon :size="18"><MenuIconEp /></el-icon>
      <span :class="bem.e('trigger-label')">{{ currentLabel }}</span>
      <el-icon :class="[bem.e('trigger-caret'), bem.is('open', open)]" :size="12">
        <ArrowDown />
      </el-icon>
    </button>

    <div :class="bem.e('panel')">
      <div :class="bem.e('heading')">
        <strong>{{ t('header.layoutSettings') }}</strong>
        <span>{{ t('header.layoutSettingsHint') }}</span>
      </div>

      <button
        v-for="item in LAYOUTS"
        :key="item.value"
        type="button"
        :class="[bem.e('option'), bem.is('active', appStore.layout === item.value)]"
        @click="selectLayout(item.value)"
      >
        <span :class="[bem.e('preview'), `is-${item.value}`]">
          <i :class="bem.e('preview-header')"></i>
          <i :class="bem.e('preview-primary')"></i>
          <i :class="bem.e('preview-secondary')"></i>
          <i :class="bem.e('preview-content')"></i>
        </span>
        <span :class="bem.e('option-label')">{{ t(item.labelKey) }}</span>
        <el-icon v-if="appStore.layout === item.value" :size="16"><Check /></el-icon>
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-layout-switcher {
  position: relative;
  height: 100%;

  &__trigger {
    display: flex;
    gap: 7px;
    align-items: center;
    height: 100%;
    padding: 0 12px;
    color: var(--top-header-text-color);
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover,
    &:focus-visible {
      color: var(--el-color-primary);
      background: var(--top-header-hover-color);
      outline: none;
    }
  }

  &__trigger-label {
    font-size: 13px;
  }

  // 箭头随面板展开旋转 180°（open 状态由根节点 is-open 同步到 trigger 箭头）
  &__trigger-caret {
    transition: transform 160ms ease;

    &.is-open {
      transform: rotate(180deg);
    }
  }

  &__panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 4px;
    z-index: var(--z-index-layout-overlay);
    display: grid;
    padding: 14px;
    pointer-events: none;
    background: var(--top-header-bg-color);
    border: 1px solid var(--layout-border-color);
    border-radius: 16px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-6px);
    box-shadow: var(--layout-shadow);
    transition:
      opacity 160ms ease,
      transform 160ms ease,
      visibility 160ms;
    grid-template-columns: repeat(2, 150px);
    gap: 8px;
  }

  &.is-open &__panel {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  &__heading {
    display: flex;
    grid-column: 1 / -1;
    align-items: baseline;
    justify-content: space-between;
    padding: 2px 2px 6px;

    strong {
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    span {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  &__option {
    position: relative;
    display: grid;
    grid-template-columns: 52px 1fr 16px;
    gap: 9px;
    align-items: center;
    min-height: 58px;
    padding: 8px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    background: var(--left-menu-bg-light-color);
    border: 1px solid transparent;
    border-radius: 10px;

    &:hover,
    &:focus-visible,
    &.is-active {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary-light-7);
      outline: none;
    }

    &.is-active {
      background: var(--el-color-primary-light-9);
    }
  }

  &__option-label {
    font-size: 13px;
  }

  // ─── 布局缩略图（纯 CSS 色块拼装，i 标签为结构占位）───
  &__preview {
    position: relative;
    display: block;
    width: 52px;
    height: 38px;
    overflow: hidden;
    background: var(--app-content-bg-color);
    border: 1px solid var(--layout-border-color);
    border-radius: 6px;

    i {
      position: absolute;
      display: block;
    }

    &-header {
      top: 0;
      right: 0;
      left: 0;
      height: 7px;
      background: var(--top-header-bg-color);
      border-bottom: 1px solid var(--layout-border-color);
    }

    &-primary,
    &-secondary {
      top: 0;
      bottom: 0;
      left: 0;
      background: var(--left-menu-bg-color);
      border-right: 1px solid var(--layout-border-color);
    }

    &-content {
      right: 5px;
      bottom: 5px;
      width: 25px;
      height: 15px;
      background: var(--el-color-primary-light-8);
      border-radius: 2px;
    }

    // sidebar：左侧宽栏 + 顶部 header
    &.is-sidebar {
      .#{$BEM_PREFIX}-layout-switcher__preview-primary {
        width: 12px;
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-header {
        left: 12px;
      }
    }

    // top：顶部横贯导航
    &.is-top {
      .#{$BEM_PREFIX}-layout-switcher__preview-primary {
        right: 0;
        width: auto;
        height: 9px;
        border-right: 0;
        border-bottom: 1px solid var(--layout-border-color);
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-header {
        display: none;
      }
    }

    // mixed：顶部主导航 + 左侧二级栏
    &.is-mixed {
      .#{$BEM_PREFIX}-layout-switcher__preview-primary {
        right: 0;
        width: auto;
        height: 9px;
        border-right: 0;
        border-bottom: 1px solid var(--layout-border-color);
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-secondary {
        top: 9px;
        width: 12px;
        background: var(--left-menu-bg-light-color);
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-header {
        top: 9px;
        left: 12px;
      }
    }

    // dual：窄 rail + 二级栏 + 顶部 header
    &.is-dual {
      .#{$BEM_PREFIX}-layout-switcher__preview-primary {
        width: 8px;
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-secondary {
        left: 8px;
        width: 11px;
        background: var(--left-menu-bg-light-color);
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-header {
        left: 19px;
      }

      .#{$BEM_PREFIX}-layout-switcher__preview-content {
        width: 21px;
      }
    }
  }
}

@media (max-width: 767px) {
  .#{$BEM_PREFIX}-layout-switcher {
    &__trigger-label {
      display: none;
    }

    &__panel {
      right: -110px;
      grid-template-columns: 160px;
    }

    &__heading {
      grid-column: 1;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .#{$BEM_PREFIX}-layout-switcher__panel {
    transition: none;
  }
}
</style>
