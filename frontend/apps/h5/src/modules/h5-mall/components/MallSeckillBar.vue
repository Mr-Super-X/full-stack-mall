<script setup lang="ts">
import type { MallSeckillItem } from '../apis/seckill'
import { useDeadlineCountdown } from '../composables/useDeadlineCountdown'

/**
 * 秒杀信息条：详情页标题下与会场卡片复用——限时徽标 + 截止倒计时 + 抢购进度。
 * 售罄/结束态由 props 进度与倒计时派生（statusText 优先于剩余时间展示）。
 */
const bem = createNamespace('mall-seckill-bar')

const props = defineProps<{
  item: MallSeckillItem
}>()

const { remaining, ended } = useDeadlineCountdown(props.item.endTime)

const soldOut = computed(() => props.item.soldCount >= props.item.seckillStock)

const progress = computed(() =>
  props.item.seckillStock > 0
    ? Math.min(100, Math.round((props.item.soldCount / props.item.seckillStock) * 100))
    : 0
)

/** 状态文案：售罄/结束优先于倒计时（倒计时归零仅兜底） */
const statusText = computed(() => {
  if (soldOut.value) return '已抢完'
  if (ended.value) return '已结束'
  return null
})
</script>

<template>
  <div :class="bem.b()">
    <span :class="bem.e('badge')">限时秒杀</span>
    <div :class="bem.e('row')">
      <span :class="bem.e('label')">{{ statusText ?? '距结束' }}</span>
      <span v-if="!statusText" :class="bem.e('time')">{{ remaining }}</span>
    </div>
    <div :class="bem.e('progress-wrap')">
      <van-progress :percentage="progress" :show-pivot="false" :class="bem.e('progress')" />
      <span :class="bem.e('count')">已抢 {{ item.soldCount }}/{{ item.seckillStock }}</span>
    </div>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-seckill-bar {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 26px;
  background: var(--mall-brand-soft);
  border-radius: var(--mall-r-md);

  &__badge {
    align-self: flex-start;
    padding: 4px 18px;
    font-size: 24px;
    font-weight: 600;
    color: var(--mall-on-brand);
    background: var(--mall-brand-deep);
    border-radius: var(--mall-r-sm);
  }

  &__row {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }

  &__label {
    font-size: 26px;
    color: var(--mall-ink-2);
  }

  &__time {
    font-size: 36px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--mall-brand-deep);
  }

  &__progress-wrap {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  &__progress {
    flex: 1;
  }

  &__count {
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    color: var(--mall-ink-3);
  }
}
</style>
