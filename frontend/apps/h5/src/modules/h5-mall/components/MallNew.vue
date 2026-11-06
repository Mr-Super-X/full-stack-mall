<script setup lang="ts">
import type { MallGoodsItem } from '../apis/index'
import MallPh from './MallPh.vue'

/**
 * 新品上架：横滑卡片（scroll-snap 吸附）。
 * 容器左右各留双份页边距（section 边距 + hscroll 内边距）——源 HTML 即此结构，首卡呈缩进感。
 * 数据来源：后端 API（MallGoodsItem，ph/garm 兜底占位块）。
 */
const bem = createNamespace('mall-new')

defineProps<{
  items: readonly MallGoodsItem[]
}>()

/** 色块档位按 id 派生（后端无此字段，前端占位图用） */
function phOf(id: number): 'a' | 'b' | 'c' {
  return id % 3 === 0 ? 'a' : id % 3 === 1 ? 'b' : 'c'
}
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
      <a v-for="item in items" :key="item.id" :class="bem.e('card')" href="#goods">
        <!-- 有图渲染真实图，无图兜底占位色块 -->
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" :class="bem.e('img')" />
        <MallPh v-else :class="bem.e('ph')" :ph="phOf(item.id)" :garm="item.garm ?? 'tshirt'">
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

  &__img {
    width: 371px;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    border-radius: var(--mall-r-md);
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
