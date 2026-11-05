<script setup lang="ts">
import type { MALL_CATS } from '../config/mall'

/** 金刚区品类入口（6 宫格，点击为原型锚点跳转） */
type Cat = (typeof MALL_CATS)[number]

const bem = createNamespace('mall-cats')

defineProps<{
  cats: readonly Cat[]
}>()
</script>

<template>
  <nav :class="bem.b()" :aria-label="`品类入口`">
    <div :class="bem.e('grid')">
      <a v-for="cat in cats" :key="cat.label" :class="bem.e('cat')" href="#goods">
        <span :class="bem.e('ring')">
          <svg :class="bem.e('ic')" aria-hidden="true"><use :href="`#mall-i-${cat.icon}`" /></svg>
        </span>
        {{ cat.label }}
      </a>
    </div>
  </nav>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-cats {
  margin-top: 159px;
  padding: 0 53px;

  &__grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 18px 9px;
  }

  &__cat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    font-size: 28px;
    color: var(--mall-ink-1);
    transition: transform var(--mall-dur) var(--mall-ease);

    &:active {
      transform: scale(0.95);
    }

    // 奇数位圆环换浅一档底色，破 6 宫格的整齐单调（源 HTML 视觉约定）
    &:nth-child(odd) .#{$BEM_PREFIX}-mall-cats__ring {
      background: var(--mall-bg-field);
    }
  }

  &__ring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 115px;
    height: 115px;
    color: var(--mall-brand-deep);
    background: var(--mall-brand-soft);
    border: 1px solid var(--mall-line);
    border-radius: 50%;
  }

  &__ic {
    width: 53px;
    height: 53px;
  }
}
</style>
