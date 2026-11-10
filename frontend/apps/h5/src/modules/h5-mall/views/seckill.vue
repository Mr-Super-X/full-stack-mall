<script setup lang="ts">
/**
 * 秒杀会场页：van-tabs「抢购中 / 即将开始」两场分组列表。
 * live 卡片复用 MallSeckillBar（截止倒计时 + 抢购进度）；点击进详情。
 * 数据三态：Loading 骨架 / Error 重试 / Empty 引导回首页。
 */
import { h5SeckillApi } from '../apis/seckill'
import type { MallSeckillItem } from '../apis/seckill'
import MallSeckillBar from '../components/MallSeckillBar.vue'

const bem = createNamespace('mall-seckill')

const { router } = useAppRouter()
const activeTab = ref<'live' | 'upcoming'>('live')

const { data, loading, error, refresh } = useRequest(() => h5SeckillApi.active())

/** 预告场开始时间的展示文案（MM-DD HH:mm） */
function startText(item: MallSeckillItem): string {
  const d = new Date(item.startTime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onCard(item: MallSeckillItem): void {
  void router.push({ name: 'H5MallDetail', params: { id: item.productId } })
}
</script>

<template>
  <div :class="bem.b()">
    <h1 :class="bem.e('title')">限时秒杀</h1>

    <div v-if="loading" :class="bem.e('loading')">
      <van-skeleton v-for="i in 2" :key="i" title avatar :row="3" />
    </div>

    <div v-else-if="error" :class="bem.e('state')">
      <van-empty :description="error.message || '加载失败'">
        <van-button round type="primary" @click="refresh">重试</van-button>
      </van-empty>
    </div>

    <van-empty
      v-else-if="!data?.live.length && !data?.upcoming.length"
      :class="bem.e('state')"
      description="暂无秒杀场次"
    >
      <van-button round type="primary" @click="router.push({ name: 'H5Mall' })">回首页逛逛</van-button>
    </van-empty>

    <van-tabs v-else v-model:active="activeTab" :class="bem.e('tabs')">
      <van-tab title="抢购中" name="live">
        <div v-if="!data?.live.length" :class="bem.e('state')">
          <van-empty description="当前没有进行中的场次" />
        </div>
        <div
          v-for="item in data?.live ?? []"
          :key="item.activityId"
          :class="bem.e('card')"
          role="button"
          tabindex="0"
          @click="onCard(item)"
          @keydown.enter="onCard(item)"
        >
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.productTitle ?? ''" :class="bem.e('img')" />
          <div :class="bem.e('info')">
            <span :class="bem.e('name')">{{ item.productTitle }}</span>
            <div :class="bem.e('price')">
              <b>¥{{ item.seckillPrice }}</b>
              <s v-if="item.originPrice">¥{{ item.originPrice }}</s>
            </div>
            <MallSeckillBar :item="item" :class="bem.e('bar')" />
          </div>
        </div>
      </van-tab>

      <van-tab title="即将开始" name="upcoming">
        <div v-if="!data?.upcoming.length" :class="bem.e('state')">
          <van-empty description="暂无预告场次" />
        </div>
        <div
          v-for="item in data?.upcoming ?? []"
          :key="item.activityId"
          :class="bem.e('card')"
          role="button"
          tabindex="0"
          @click="onCard(item)"
          @keydown.enter="onCard(item)"
        >
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.productTitle ?? ''" :class="bem.e('img')" />
          <div :class="bem.e('info')">
            <span :class="bem.e('name')">{{ item.productTitle ?? `活动 ${item.activityId}` }}</span>
            <div :class="bem.e('price')">
              <b>¥{{ item.seckillPrice }}</b>
            </div>
            <span :class="bem.e('start')">{{ startText(item) }} 开抢 · 限量 {{ item.seckillStock }} 件</span>
          </div>
        </div>
      </van-tab>
    </van-tabs>
  </div>
</template>

<style lang="scss">
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-mall-seckill {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: 159px;
  font-family: var(--mall-font-body);
  background: var(--mall-bg-page);

  &__title {
    margin: 0;
    padding: 40px 53px 26px;
    font-family: var(--mall-font-head);
    font-size: 44px;
    color: var(--mall-ink-1);
    background: var(--mall-bg-card);
  }

  &__loading {
    padding: 40px 53px;
  }

  &__state {
    padding: 80px 53px;
  }

  &__card {
    display: flex;
    gap: 26px;
    margin: 26px 53px 0;
    padding: 26px;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__img {
    width: 200px;
    height: 200px;
    object-fit: cover;
    border-radius: var(--mall-r-sm);
  }

  &__info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 13px;
    min-width: 0;
  }

  &__name {
    font-size: 30px;
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
      font-size: 38px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }

    s {
      font-size: 26px;
      color: var(--mall-ink-3);
    }
  }

  &__bar {
    margin-top: auto;
  }

  &__start {
    margin-top: auto;
    font-size: 26px;
    color: var(--mall-ink-2);
  }
}
</style>
