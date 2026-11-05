<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallFlashItem } from '../config/mall'
import { useCountdown } from '../composables/useCountdown'
import MallPh from './MallPh.vue'

/**
 * 限时甄选：每日 10:00–22:00，倒计时指向每日 22:00（useCountdown 语义）。
 */
const bem = createNamespace('mall-flash')

defineProps<{
  items: readonly MallFlashItem[]
}>()

const { remaining } = useCountdown(22)
</script>

<template>
  <section :class="bem.b()">
    <div :class="bem.e('head')">
      <h2 :class="bem.e('title')">限时甄选</h2>
      <span :class="bem.e('timer')" aria-label="距结束时间">{{ remaining }}</span>
      <span :class="bem.e('sub')">每日 10:00 – 22:00 · 两件再享 9 折</span>
    </div>
    <div :class="bem.e('grid')">
      <a v-for="item in items" :key="item.name" :class="bem.e('item')" href="#goods">
        <MallPh :ph="item.ph" :garm="item.garm" radius="sm">
          <template #tag>{{ item.tag }}</template>
        </MallPh>
        <div :class="bem.e('name')">{{ item.name }}</div>
        <div :class="bem.e('price')">
          <b>¥{{ item.price }}</b>
          <s>¥{{ item.originPrice }}</s>
        </div>
      </a>
    </div>
  </section>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-flash {
  margin: 159px 53px 0;
  padding: 53px;
  background: var(--mall-bg-card);
  border: 1px solid var(--mall-line);
  border-radius: var(--mall-r-md);

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 22px;
    margin-bottom: 35px;
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 38px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--mall-ink-1);
  }

  &__timer {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 7px 22px;
    font-size: 28px;
    letter-spacing: 2px;
    font-variant-numeric: tabular-nums;
    color: var(--mall-brand-deep);
    background: var(--mall-brand-soft);
    border-radius: var(--mall-r-sm);
  }

  &__sub {
    flex-basis: 100%;
    font-size: 28px;
    color: var(--mall-ink-3);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 26px;
  }

  &__name {
    margin-top: 18px;
    overflow: hidden;
    font-size: 28px;
    color: var(--mall-ink-1);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__price {
    display: flex;
    align-items: baseline;
    gap: 13px;
    margin-top: 4px;

    b {
      font-size: 34px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }

    s {
      font-size: 28px;
      color: var(--mall-ink-3);
    }
  }
}
</style>
