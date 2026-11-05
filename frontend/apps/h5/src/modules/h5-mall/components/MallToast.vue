<script setup lang="ts">
/**
 * 全页唯一 Toast（加购 / 收藏反馈），由父级 useToast 驱动。
 */
const bem = createNamespace('mall-toast')

defineProps<{
  visible: boolean
  message: string
}>()
</script>

<template>
  <div :class="[bem.b(), bem.is('show', visible)]" role="status" aria-live="polite">
    <svg :class="bem.e('ic')" aria-hidden="true"><use href="#mall-i-check" /></svg>
    <span>{{ message }}</span>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-toast {
  position: fixed;
  bottom: 243px;
  left: 50%;
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 44px;
  font-size: 31px;
  letter-spacing: 2px;
  color: var(--mall-ink-1);
  pointer-events: none;
  background: var(--mall-bg-card);
  border: 1px solid var(--mall-line);
  border-radius: var(--mall-r-md);
  box-shadow: var(--mall-sh-2);
  opacity: 0;
  transform: translateX(-50%) translateY(18px);
  transition:
    opacity var(--mall-dur) var(--mall-ease),
    transform var(--mall-dur) var(--mall-ease);

  &.is-show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  &__ic {
    flex: none;
    width: 37px;
    height: 37px;
    color: var(--mall-ok);
  }
}
</style>
