<script setup lang="ts">
/**
 * 首页限时秒杀区块：live 场卡（≤2，内嵌 MallSeckillBar 倒计时+进度）+ 预告计数。
 * 区块是「入口」不是抢购界面：场卡点击内部跳详情，「全部」emit 跳会场页。
 * 无 live 场时由父级 v-if 整块不渲染。
 */
import type { MallSeckillItem } from '../apis/seckill'
import MallSeckillBar from './MallSeckillBar.vue'

const bem = createNamespace('mall-seckill-section')

const props = defineProps<{
  section: {
    title: string
    live: MallSeckillItem[]
    upcomingCount: number
  }
}>()

const emit = defineEmits<{
  open: []
}>()

const { router } = useAppRouter()

function onCard(item: MallSeckillItem): void {
  void router.push({ name: 'H5MallDetail', params: { id: item.productId } })
}
</script>

<template>
  <section :class="bem.b()">
    <header :class="bem.e('head')">
      <h2 :class="bem.e('title')">{{ props.section.title }}</h2>
      <button type="button" :class="bem.e('more')" @click="emit('open')">
        全部
        <span aria-hidden="true">→</span>
      </button>
    </header>

    <div
      v-for="item in props.section.live"
      :key="item.activityId"
      :class="bem.e('card')"
      role="button"
      tabindex="0"
      @click="onCard(item)"
      @keydown.enter="onCard(item)"
    >
      <div :class="bem.e('top')">
        <img
          v-if="item.imageUrl"
          :src="item.imageUrl"
          :alt="item.productTitle ?? ''"
          :class="bem.e('img')"
        />
        <div :class="bem.e('info')">
          <span :class="bem.e('name')">{{ item.productTitle }}</span>
          <span :class="bem.e('price')">
            <b>¥{{ item.seckillPrice }}</b>
            <s v-if="item.originPrice">¥{{ item.originPrice }}</s>
          </span>
        </div>
      </div>
      <MallSeckillBar :item="item" :class="bem.e('bar')" />
    </div>

    <p v-if="props.section.upcomingCount > 0" :class="bem.e('upcoming')">
      还有 {{ props.section.upcomingCount }} 场即将开抢
    </p>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-seckill-section {
  margin-top: 18px;
  padding: 40px 53px;
  background: var(--mall-bg-card);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 26px;
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 40px;
    font-weight: 600;
    color: var(--mall-ink-1);
  }

  &__more {
    font: inherit;
    font-size: 26px;
    color: var(--mall-brand-deep);
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__card {
    padding: 26px;
    margin-bottom: 18px;
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__top {
    display: flex;
    gap: 22px;
    margin-bottom: 18px;
  }

  &__img {
    width: 160px;
    height: 160px;
    object-fit: cover;
    border-radius: var(--mall-r-sm);
  }

  &__info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 9px;
    min-width: 0;
  }

  &__name {
    font-size: 28px;
    font-weight: 500;
    color: var(--mall-ink-1);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__price {
    display: flex;
    align-items: baseline;
    gap: 13px;

    b {
      font-size: 34px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }

    s {
      font-size: 24px;
      color: var(--mall-ink-3);
    }
  }

  &__upcoming {
    margin: 8px 0 0;
    font-size: 26px;
    color: var(--mall-ink-3);
  }
}
</style>
