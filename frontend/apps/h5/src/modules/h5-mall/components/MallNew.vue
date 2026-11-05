<script setup lang="ts">
import type { MallNewItem } from '../config/mall'
import MallPh from './MallPh.vue'

/**
 * 新品上架：横滑卡片（scroll-snap 吸附）。
 * 容器左右各留双份页边距（section 边距 + hscroll 内边距）——源 HTML 即此结构，首卡呈缩进感。
 */
const bem = createNamespace('mall-new')

defineProps<{
  items: readonly MallNewItem[]
}>()
</script>

<template>
  <section :class="bem.b()">
    <div :class="bem.e('head')">
      <h2 :class="bem.e('title')">新品上架</h2>
      <span :class="bem.e('en')">NEW ARRIVAL</span>
      <a :class="bem.e('more')" href="#goods">
        全部
        <svg :class="bem.e('moreic')" aria-hidden="true"><use href="#mall-i-arrow" /></svg>
      </a>
    </div>
    <div :class="bem.e('scroll')">
      <a v-for="item in items" :key="item.name" :class="bem.e('card')" href="#goods">
        <MallPh :class="bem.e('ph')" :ph="item.ph" :garm="item.garm">
          <template v-if="item.tag" #tag>{{ item.tag }}</template>
        </MallPh>
        <div :class="bem.e('name')">{{ item.name }}</div>
        <div :class="bem.e('price')">
          <b>¥{{ item.price }}</b>
        </div>
      </a>
    </div>
  </section>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-new {
  margin-top: 159px;
  padding: 0 53px;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 53px;
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 49px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--mall-ink-1);
  }

  &__en {
    flex: 1;
    margin-left: 18px;
    font-size: 24px;
    letter-spacing: 7px;
    color: var(--mall-ink-3);
  }

  &__more {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-size: 29px;
    color: var(--mall-ink-2);
  }

  &__moreic {
    width: 31px;
    height: 31px;
  }

  &__scroll {
    display: flex;
    gap: 35px;
    padding: 0 53px 9px;
    margin: 0 -53px; // 抵消 section 边距：横滑轨道延伸至视口缘（源 HTML 双份边距视觉）
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__card {
    flex: 0 0 371px;
    scroll-snap-align: start;
  }

  &__ph {
    width: 371px;
  }

  &__name {
    margin-top: 22px;
    font-size: 31px;
    color: var(--mall-ink-1);
  }

  &__price {
    margin-top: 4px;

    b {
      font-size: 34px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }
  }
}
</style>
