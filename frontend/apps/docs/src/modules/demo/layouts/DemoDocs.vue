<script setup lang="ts">
/**
 * demo 文档站路由级布局（/demo 父路由组件）。
 *
 * 职责：把 DocLayout 三栏壳固定为路由级——子路由切换只重渲染 main 的
 * <RouterView />，sidebar / toc 不重挂载，侧栏滚动位置、搜索词、折叠与
 * 拖拽宽度跨页保留（根治「切路由侧栏滚动归零」）。
 *
 * toc 数据流：各 demo 页 setup 中 useDocToc(tocItems) 写入模块级
 * currentDocToc（见 composables/useDocToc），此处统一渲染 <DocToc>。
 *
 * @see composables/useDocToc.ts 数据通道
 * @see routes/index.ts /demo 父路由接线
 */
import DocLayout from './DocLayout.vue'
import DocToc from '../components/DocToc.vue'
import { currentDocToc } from '../composables/useDocToc'
</script>

<template>
  <DocLayout>
    <RouterView />
    <template #toc>
      <DocToc :items="currentDocToc" />
    </template>
  </DocLayout>
</template>
