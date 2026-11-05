<script setup lang="ts">
import type { MallGarm, MallPh } from '../config/mall'

/**
 * 商品占位图（纯 token 色块 + 线稿）：限时甄选 / 新品横滑 / 为你推荐三处共用。
 *
 * 色块三档（ph）映射模块 token 浅底；tag / action 以具名插槽交给调用方，
 * 避免把角标与收藏按钮的逻辑耦合进占位组件。
 */
withDefaults(
  defineProps<{
    /** 色块档位：a 灰陶 / b 陶粉 / c 雾蓝 */
    ph: MallPh
    /** 线稿 symbol 后缀（完整 id = mall-g-${garm}） */
    garm: MallGarm
    /** 圆角档位：sm 用于限时甄选小图，其余用 md */
    radius?: 'sm' | 'md'
  }>(),
  { radius: 'md' }
)

const bem = createNamespace('mall-ph')
</script>

<template>
  <div :class="[bem.b(), bem.m(ph), radius === 'sm' && bem.m('sm')]">
    <svg :class="bem.e('garm')" aria-hidden="true"><use :href="`#mall-g-${garm}`" /></svg>
    <span v-if="$slots.tag" :class="bem.e('tag')"><slot name="tag" /></span>
    <slot name="action" />
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-ph {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: var(--mall-r-md);

  &--sm {
    border-radius: var(--mall-r-sm);
  }

  &--a {
    background: var(--mall-bg-field);
  }

  &--b {
    background: var(--mall-brand-soft);
  }

  &--c {
    background: var(--mall-accent-soft);
  }

  &__garm {
    width: 56%;
    height: auto;
    color: var(--mall-brand-deep);
    opacity: 0.55;
  }

  &__tag {
    position: absolute;
    top: 22px;
    left: 22px;
    padding: 4px 18px;
    font-size: 24px;
    letter-spacing: 2px;
    color: var(--mall-brand-deep);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-sm);
  }
}
</style>
