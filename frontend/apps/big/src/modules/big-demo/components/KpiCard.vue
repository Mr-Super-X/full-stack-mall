<script setup lang="ts">
/**
 * 大屏指标株：光晕标签 + 数值 + 同比趋势——异星荧光森林语义的 KPI 单元。
 *
 * 纯展示组件，数据由父级面板传入；趋势行仅在传入 trend 时渲染。
 * 光晕色：青/丁香按 variant 交替，focus 株独享白 bloom（全页唯一最亮）。
 */
interface Props {
  /** 指标名（如「今日交易额」） */
  label: string
  /** 指标值（已格式化字符串或数字） */
  value: string | number
  /** 单位（如「万元」「单」）；显式允许 undefined——exactOptionalPropertyTypes 下 `?: string` 不接受显式 undefined 传入 */
  unit?: string | undefined
  /** 同比变化百分比（正=涨红，负=跌绿，0=持平灰；不传则不显示趋势行） */
  trend?: number | undefined
  /** 光晕色变种：青 / 丁香交替（默认 cyan）；focus 株独享白 bloom 并放大 */
  variant?: 'cyan' | 'lilac' | 'focus' | undefined
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'cyan',
})

const bem = createNamespace('kpi-card')

const trendText = computed(() => {
  if (props.trend === undefined) return ''
  const sign = props.trend > 0 ? '+' : ''
  return `${sign}${props.trend}%`
})
const trendClass = computed(() => {
  if (props.trend === undefined) return ''
  // 三态：涨红 / 跌绿 / 持平中性灰（trend=0 渲染 ▲+0% 是语义错误——0 非上涨）
  if (props.trend > 0) return bem.em('trend', 'up')
  if (props.trend < 0) return bem.em('trend', 'down')
  return bem.em('trend', 'flat')
})
</script>

<template>
  <div :class="[bem.b(), bem.m(variant)]">
    <!-- 孢子光晕（装饰层，焦点株为白 bloom） -->
    <i :class="bem.e('glow')" aria-hidden="true" />

    <div :class="bem.e('label')">{{ label }}</div>
    <div :class="bem.e('value-row')">
      <span :class="bem.e('value')">{{ value }}</span>
      <span v-if="unit" :class="bem.e('unit')">{{ unit }}</span>
    </div>
    <div v-if="trend !== undefined" :class="trendClass">
      {{ trend > 0 ? '▲' : trend < 0 ? '▼' : '—' }} {{ trendText }} 同比
    </div>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-kpi-card {
  position: relative;
  box-sizing: border-box;
  padding: 20px 24px;
  // 面板底：根脉汇聚微亮区（上部透明，底部微亮）
  background: linear-gradient(
    180deg,
    transparent 40%,
    rgba(var(--big-panel-glow-cyan-rgb), 0.5) 100%
  );
  // 细线分支边框：不用直角硬边，左右细线模拟植物分支
  border-right: 1px solid rgba(var(--big-spore-cyan-rgb), 0.12);
  border-left: 1px solid rgba(var(--big-spore-cyan-rgb), 0.12);

  // 孢子光晕团：青 / 丁香 / 白 bloom 三档
  &__glow {
    position: absolute;
    top: -8px;
    left: 20px;
    width: 28px;
    height: 28px;
    pointer-events: none;
    border-radius: 50%;
    // 青：内亮外衰减
    background: radial-gradient(
      circle,
      rgba(var(--big-bloom-rgb), 0.9) 0%,
      rgba(var(--big-spore-cyan-rgb), 0.5) 40%,
      transparent 70%
    );
    filter: blur(4px);
  }

  &--lilac &__glow {
    background: radial-gradient(
      circle,
      rgba(var(--big-bloom-rgb), 0.85) 0%,
      rgba(var(--big-spore-lilac-rgb), 0.5) 40%,
      transparent 70%
    );
  }

  // 焦点株：全页唯一白 bloom，光晕最大最亮
  &--focus &__glow {
    top: -12px;
    width: 40px;
    height: 40px;
    background: radial-gradient(
      circle,
      rgba(var(--big-bloom-rgb), 1) 0%,
      rgba(var(--big-spore-cyan-rgb), 0.4) 45%,
      transparent 75%
    );
    filter: blur(6px);
  }

  &__label {
    font-size: 15px;
    letter-spacing: 1px;
    color: var(--big-text-2);
  }

  &__value-row {
    display: flex;
    align-items: baseline;
    margin-top: 8px;
  }

  &__value {
    font-size: 38px;
    font-weight: 700;
    // 等宽数字：多位数值跳动时列宽不抖
    font-variant-numeric: tabular-nums;
    color: var(--big-text);
    text-shadow: 0 0 20px rgba(var(--big-spore-cyan-rgb), 0.3);
  }

  &--lilac &__value {
    text-shadow: 0 0 20px rgba(var(--big-spore-lilac-rgb), 0.3);
  }

  &--focus &__value {
    font-size: 44px;
    text-shadow: 0 0 28px rgba(var(--big-bloom-rgb), 0.4);
  }

  &__unit {
    margin-left: 6px;
    font-size: 13px;
    color: var(--big-text-2);
  }

  &__trend {
    margin-top: 6px;
    font-size: 13px;

    &--up {
      color: var(--el-color-danger);
    }

    &--down {
      color: var(--big-kpi-down);
    }

    &--flat {
      color: var(--big-text-2);
    }
  }
}
</style>
