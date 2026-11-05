<script setup lang="ts">
/**
 * 大屏排名列表：序号（前三奖牌色）+ 名称 + 占比条形 + 数值。
 *
 * 占比按列表内最大值归一化，纯展示无交互。
 * RankingItem 是 apis 层 BigRankItem 的别名（数据层单一事实源，避免双处定义漂移），
 * 从组件 re-export 供视图层组装数据时复用。
 */
import type { BigRankItem } from '../apis'

/** 排名条目；name 需列表内唯一（作为 v-for key，重复会导致 patch 错乱） */
export type RankingItem = BigRankItem

interface Props {
  items: RankingItem[]
}
const props = defineProps<Props>()

const bem = createNamespace('ranking-list')

/** 归一化基数：列表最大值（全 0 / 空列表时回退 1 防除零） */
const maxValue = computed(() => Math.max(1, ...props.items.map((item) => item.value)))

function barWidth(value: number): string {
  return `${Math.round((value / maxValue.value) * 100)}%`
}

/** 前三名奖牌色（金/银/铜），其余统一深蓝；色值走 big-tokens（:style 绑定 var() 引用，运行时解析） */
const MEDAL_COLORS = [
  'var(--big-medal-gold)',
  'var(--big-medal-silver)',
  'var(--big-medal-bronze)',
] as const
function medalColor(index: number): string {
  return MEDAL_COLORS[index] ?? 'var(--big-rank-active)'
}
</script>

<template>
  <ol :class="bem.b()">
    <li v-for="(item, index) in items" :key="item.name" :class="bem.e('item')">
      <span :class="bem.e('rank')" :style="{ background: medalColor(index) }">{{ index + 1 }}</span>
      <span :class="bem.e('name')">{{ item.name }}</span>
      <span :class="bem.e('bar-track')">
        <span :class="bem.e('bar')" :style="{ width: barWidth(item.value) }" />
      </span>
      <span :class="bem.e('value')">{{ item.value.toLocaleString() }}</span>
    </li>
  </ol>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-ranking-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 16px;
  }

  &__rank {
    flex: none;
    width: 24px;
    height: 24px;
    font-size: 14px;
    line-height: 24px;
    text-align: center;
    color: var(--big-text-deep);
    border-radius: 4px;
  }

  &__name {
    flex: none;
    width: 96px;
    overflow: hidden;
    color: var(--big-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__bar-track {
    flex: 1;
    height: 8px;
    overflow: hidden;
    background: rgba(var(--big-blue-mid-rgb), 0.12);
    border-radius: 4px;
  }

  &__bar {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--big-rank-bar), var(--big-primary));
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  &__value {
    flex: none;
    width: 80px;
    text-align: right;
    color: var(--big-text-2);
    font-variant-numeric: tabular-nums;
  }
}
</style>
