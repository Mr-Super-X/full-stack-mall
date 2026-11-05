<script setup lang="ts">
/**
 * 右键/点击菜单封装（复刻参考仓 ContextMenu）：基于 el-dropdown 的轻量封装。
 *
 * 两种用法：
 * - trigger="contextmenu"（默认）：给页签等目标绑定右键菜单
 * - trigger="click"：页签条右侧"更多操作"按钮
 *
 * @group 布局：Default
 */
import type { Component } from 'vue'

/** 菜单项 schema（icon 为 Element Plus 图标组件）。字段显式允许 undefined 以兼容 exactOptionalPropertyTypes。 */
export interface ContextMenuItem {
  label: string
  icon?: Component | undefined
  disabled?: boolean | undefined
  divided?: boolean | undefined
  command?: (() => void) | undefined
}

withDefaults(
  defineProps<{
    schema: ContextMenuItem[]
    trigger?: 'click' | 'hover' | 'contextmenu'
  }>(),
  { trigger: 'contextmenu' }
)

const bem = createNamespace('context-menu')

/** 弹层类名（element-plus teleports 到 body，BEM 前缀动态拼接，见下方全局样式） */
const popperClass = computed(() => `${bem.b()}-popper`)

function onCommand(item: ContextMenuItem) {
  item.command?.()
}
</script>

<template>
  <!-- as any：EP 2.14 + TS6 下 popper-class prop 类型被推断为元对象（EP 已知 prop 类型 bug） -->
  <el-dropdown
    :trigger="trigger"
    placement="bottom-start"
    :popper-class="popperClass as any"
    @command="onCommand"
  >
    <slot />
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="(item, index) in schema"
          :key="`${item.label}-${index}`"
          :divided="item.divided === true"
          :disabled="item.disabled === true"
          :command="item"
        >
          <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
          {{ item.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style lang="scss">
// 弹层菜单项图标与文字间距（element-plus teleports 到 body，全局样式）
.#{$BEM_PREFIX}-context-menu-popper {
  .el-dropdown-menu__item {
    display: flex;
    gap: 6px;
    align-items: center;
  }
}
</style>
