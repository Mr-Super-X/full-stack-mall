<script setup lang="ts">
/**
 * 演示页统一容器——demo 模块所有 examples/*.vue 的三段式外壳（标题 / 简介 / 主内容）。
 *
 * 对照参考仓 demo 容器 frame 的简化版（项目自有 form-schema 不复刻参考仓目录布局，
 * 只复用「标题 + 多点简介 + 内容」三段式结构 + 源码路径展示）。
 *
 * 不提供"在编辑器打开组件"按钮（项目未配置 vite-plugin-vue-inspector）。
 */

defineProps<{
  /** 组件名（顶部大标题） */
  title: string
  /** 组件源文件路径（仅展示用，不做跳转） */
  source?: string
  /** 简介要点列表（字符串或 VNode 数组均可） */
  introductions?: string[]
}>()

const bem = createNamespace('demo-frame')
</script>

<template>
  <section :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">{{ title }}</h1>
      <code v-if="source" :class="bem.e('source')">{{ source }}</code>
    </header>

    <ul v-if="introductions?.length" :class="bem.e('intro')">
      <li v-for="(line, i) in introductions" :key="i">{{ line }}</li>
    </ul>

    <div :class="bem.e('body')">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-frame {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__source {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
  }

  &__intro {
    margin: 0;
    padding: 12px 16px 12px 28px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    list-style-position: inside;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.8;

    li {
      list-style-type: disc;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}
</style>
