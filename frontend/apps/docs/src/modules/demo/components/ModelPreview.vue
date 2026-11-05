<script setup lang="ts">
/**
 * demo 页面统一 model JSON 预览组件
 *
 * 替换散落在各 XForm* demo 中的 `<details><summary>查看完整 model（JSON）</summary><pre>...</pre></details>` 自实现。
 *
 * 用法：
 *   <ModelPreview :model="model" />
 *   <ModelPreview :model="models[activeKey]" :summary="`查看完整 model（JSON，${activeKey}）`" />
 */
defineProps<{
  /** 要展示的对象（任意可 JSON 序列化值） */
  model: unknown
  /** summary 文案；默认「查看完整 model（JSON）」，特例可覆盖（如 Grid / LargeSchema） */
  summary?: string
}>()

const bem = createNamespace('demo-model-preview')
</script>

<template>
  <details :class="bem.b()">
    <summary>{{ summary ?? '查看完整 model（JSON）' }}</summary>
    <pre>{{ JSON.stringify(model, null, 2) }}</pre>
  </details>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-model-preview {
  margin-top: 12px;
  font-size: 12px;
  summary {
    cursor: pointer;
    color: #6b7280;
  }
  pre {
    background: #f5f7fa;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: 'Menlo', 'Consolas', monospace;
    overflow-x: auto;
    margin: 4px 0;
  }
}
</style>
