<script setup lang="ts">
/**
 * CellContent —— ProTable 单元格内容渲染（v2.0 自 ProTable.vue 模板抽取）
 *
 * 承接 resolveCell 的输出分发：VNode（render 函数 / enum ElTag 产物）直接挂载组件，
 * 原始值走文本插值。抽取后 ProTable.vue 树形分支与默认分支共用同一段渲染逻辑，
 * 消除两处重复的 v-for 包装 trick。
 *
 * @see [`../ProTable.vue`](../ProTable.vue) 的 resolveCell —— 本组件的 content 来源
 * @group ProTable 组件
 */
import { isVNode } from 'vue'

defineProps<{
  /** resolveCell 的返回值：VNode 走组件挂载，其余走文本插值 */
  content: unknown
}>()
</script>

<template>
  <component :is="content" v-if="isVNode(content)" />
  <template v-else>{{ content }}</template>
</template>
