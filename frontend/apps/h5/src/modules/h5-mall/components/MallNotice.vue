<script setup lang="ts">
/**
 * 顶部公告条（营销信息滚动位 · 原型为静态单条）。
 */
const bem = createNamespace('mall-notice')

defineProps<{
  /** 公告文本（源 HTML 营销文案） */
  text: string
}>()
</script>

<template>
  <div :class="bem.b()">
    <span :class="bem.e('dot')" aria-hidden="true" />
    <span :class="bem.e('text')">{{ text }}</span>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 18px 53px;
  font-size: 28px;
  color: var(--mall-ink-2);
  background: var(--mall-bg-card);
  border-bottom: 1px solid var(--mall-line);

  &__dot {
    flex: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--mall-brand);
  }

  &__text {
    // 超长公告截断，避免挤压换行破坏吸顶栏高度
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
