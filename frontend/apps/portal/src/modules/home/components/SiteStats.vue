<script setup lang="ts">
/**
 * 数据指标条（id=stats）：静态数字，刻意不做滚动计数（KISS / YAGNI）。
 *
 * @see [`../config/site.ts`](../config/site.ts) SITE_STATS 数据单源
 * @group 业务模块：Home
 */
import { SITE_STATS } from '../config/site'

const bem = createNamespace('site-stats')
</script>

<template>
  <section id="stats" :class="bem.b()">
    <div :class="bem.e('inner')" role="list">
      <div v-for="s in SITE_STATS" :key="s.label" :class="bem.e('item')" role="listitem">
        <div :class="bem.e('value')">{{ s.value }}</div>
        <div :class="bem.e('label')">{{ s.label }}</div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-stats {
  background: var(--portal-bg);
  border-top: 1px solid var(--portal-line);
  border-bottom: 1px solid var(--portal-line);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 96px 24px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    text-align: center;
  }

  // 数据高亮走主色文字（云灰品牌族点亮）
  &__value {
    font-size: 40px;
    font-weight: 700;
    color: var(--portal-brand-deep);
    line-height: 1.2;
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: 14px;
    color: var(--portal-ink-2);
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}
</style>
