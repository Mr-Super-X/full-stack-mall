<script setup lang="ts">
/**
 * GroupedHeader —— 列分组（多级表头）占位组件（v3.0 新增 5c）
 *
 * 设计说明：
 * Element Plus 2.14 的 el-table-column 子节点必须是**直接 VNode** 类型的 el-table-column
 * 才能形成多级表头结构。通过 Vue 编译器 + v-for + 递归组件的间接方式，
 * el-table-column 的内部 children 收集机制无法识别（实测：递归渲染仅产生 1 行表头）。
 *
 * v3.0 现状：占位组件（实际由 ElementTableBody 用 cellClassName 实现视觉分组）。
 * v3.0.1 评估 h() 函数式渲染或 el-table-column dynamicColumnKey 模式。
 *
 * @group ProTable 组件
 */
import type { ProColumn } from '../types'

defineProps<{
  /** 嵌套列（含 children 的 ProColumn 数组） */
  columns: ProColumn[]
}>()
</script>

<template>
  <!-- 占位组件 —— 实际渲染由 ElementTableBody 用 el-table-column v-for + 嵌套 slot 实现。
       保留此组件作为未来扩展点（v3.0.1：<el-table-column> 嵌套递归 + 动态 columnKey） -->
  <span hidden />
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-table-grouped-header {
  &__group {
    text-align: center;
    font-weight: 600;
  }
}
</style>
