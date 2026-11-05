<script setup lang="ts">
/**
 * 主导航（复刻参考仓 PrimaryNav）：mixed 模式顶横排 / dual 模式左侧 rail 竖排。
 *
 * 展示菜单树的顶层节点（模块级），点击后由父组件跳转该模块的第一个可见叶子页。
 * 激活态跟随 activePath（当前路由所属顶层模块）。
 *
 * 单子项提升：顶层包装路由（如 /user）自身无 meta（title/icon 为空），与 AppMenu
 * 同一套 resolveSingleChild 提升语义——显示子项的标题/图标，否则 rail/顶横排
 * 会出现空图标空文案项（2026-09-10 双栏/混合布局实测）
 *
 * @see [`../index.vue`](../index.vue) activePrimary / selectPrimary 计算与跳转
 * @see [`../config/menu.ts`](../config/menu.ts) resolveSingleChild 提升判定
 * @group 布局：Default
 */
import type { MenuNode } from '../config/types'
import { resolveSingleChild } from '../config/menu'
import MenuIcon from './MenuIcon.vue'

const bem = createNamespace('primary-nav')

const props = withDefaults(
  defineProps<{
    /** 顶层菜单节点（模块级） */
    nodes: MenuNode[]
    /** 当前激活的顶层节点 path（显式允许 undefined，exactOptionalPropertyTypes） */
    activePath?: string | undefined
    /** top：顶栏横排 / rail：侧栏竖排图标 */
    mode?: 'top' | 'rail'
  }>(),
  { activePath: '', mode: 'top' }
)

const emit = defineEmits<{
  select: [node: MenuNode]
}>()

/**
 * 显示用列表：单子项提升时 display 替换为子项（标题/图标），多子项分组 display 为自身。
 * raw 保留原节点——激活态匹配（activePath 是顶层 path）与 select 事件载荷都以 raw 为准，
 * 不能用提升后的子项 path（/user/list ≠ /user，激活态会丢失）
 */
const displayItems = computed(() =>
  props.nodes.map((node) => {
    const { oneShowingChild, onlyChild } = resolveSingleChild(node)
    return { raw: node, display: oneShowingChild ? (onlyChild ?? node) : node }
  })
)
</script>

<template>
  <nav :class="[bem.b(), bem.m(mode)]" aria-label="主导航">
    <button
      v-for="item in displayItems"
      :key="item.raw.path"
      type="button"
      :class="[bem.e('item'), bem.is('active', activePath === item.raw.path)]"
      :title="item.display.title"
      @click="emit('select', item.raw)"
    >
      <MenuIcon v-if="item.display.icon" :name="item.display.icon" />
      <span :class="bem.e('label')">{{ item.display.title }}</span>
    </button>
  </nav>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-primary-nav {
  display: flex;

  &__item {
    position: relative;
    display: flex;
    align-items: center;
    color: inherit;
    cursor: pointer;
    background: transparent;
    border: 0;

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: -2px;
    }
  }

  // 顶栏横排（mixed 模式）
  &--top {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 18px;
    overflow-x: auto;
    align-items: center;
    gap: 4px;
    color: var(--top-header-text-color);

    .#{$BEM_PREFIX}-primary-nav__item {
      gap: 7px;
      height: 36px;
      padding: 0 14px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      border-radius: 10px;

      &:hover {
        color: var(--el-color-primary);
        background: var(--top-header-hover-color);
      }

      &.is-active {
        font-weight: 600;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }
    }
  }

  // 侧栏竖排图标（dual 模式 rail）
  &--rail {
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    color: var(--left-menu-text-color);

    .#{$BEM_PREFIX}-primary-nav__item {
      flex-direction: column;
      gap: 5px;
      justify-content: center;
      width: 56px;
      min-height: 58px;
      padding: 7px 4px;
      border-radius: 10px;

      .#{$BEM_PREFIX}-primary-nav__label {
        width: 100%;
        overflow: hidden;
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &:hover {
        color: var(--left-menu-text-active-color);
        background: var(--left-menu-bg-active-color);
      }

      &.is-active {
        font-weight: 600;
        color: var(--left-menu-text-active-color);
        background: var(--left-menu-bg-active-color);
      }

      // 激活态左侧竖条指示
      &.is-active::before {
        position: absolute;
        top: 12px;
        bottom: 12px;
        left: -8px;
        width: 3px;
        background: var(--el-color-primary);
        border-radius: 0 3px 3px 0;
        content: '';
      }
    }
  }
}
</style>
