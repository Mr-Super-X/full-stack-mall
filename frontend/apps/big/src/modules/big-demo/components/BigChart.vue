<script setup lang="ts">
/**
 * 大屏 ECharts 薄封装：防模糊 + 随 option 更新。
 *
 * 为什么不复用公共 BaseChart：大屏 scale 场景需要 devicePixelRatio × scale 的
 * 初始化策略补偿位图放大，属 big-demo 模块自治关注点，不动公共组件（§1.2 模块边界）。
 *
 * 机制说明：
 * - transform: scale 不改变容器 CSS 尺寸（offsetWidth 恒为设计稿值），无需 resize 监听
 * - canvas 位图会被视觉放大 scale 倍 → init 时 devicePixelRatio 乘 scale 补偿
 * - devicePixelRatio 只能 init 时指定 → scale 变化时 dispose + 重建（防抖与 layout 一致 150ms）
 * - 补偿值显式钳制上限（MAX_EFFECTIVE_DPR）→ 4K 拼接屏叠加高 DPR 环境时位图面积
 *   不失控， rationale 见常量注释（/autoplan Phase 3 E-ARCH-1）
 *
 * 已知限制：窗口拖到不同 DPR 显示器且逻辑视口不变时，scale 不变 → 不触发重建，
 * devicePixelRatio 补偿过期（轻微模糊）；浏览器缩放会连带改变 innerWidth 触发重建，已覆盖。
 */
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { BIG_SCALE_STATE_KEY, type BigScaleState } from '@/layouts/big/config/scale'

interface Props {
  /** 完整 ECharts option（深 watch 更新，notMerge 模式全量替换） */
  option: EChartsOption
}
const props = defineProps<Props>()

const bem = createNamespace('big-chart')

const containerRef = ref<HTMLElement>()
let chart: echarts.ECharts | undefined

/** 不在 big layout 内时的回退（scale=1，组件可独立预览/单测） */
const FALLBACK_STATE: Readonly<Ref<BigScaleState>> = readonly(
  ref({ scale: 1, offsetX: 0, offsetY: 0, designWidth: 1920, designHeight: 1080 })
)
const scaleState = inject(BIG_SCALE_STATE_KEY, FALLBACK_STATE)

/**
 * dpr×scale 补偿的显式上限（有效像素比）。
 * 为什么需要钳制：devicePixelRatio × scale 无上限时，4K 拼接屏（scale=2）叠加高 DPR
 * 渲染环境（dpr=2）→ 有效 dpr=4 → canvas 位图面积放大 16 倍（1920×1080 单图 ≈130MB
 * GPU 显存），整页多图叠加可致 WebGL 上下文丢失/页面崩溃。大屏是真实部署形态，非理论风险。
 * 为什么是 2.5：大屏典型观看距离 2-3 米，超出该密度的像素增益人眼已不可分辨，纯显存浪费；
 * 显存代价随上限线性增长，更锐利则调高、更省则调低。
 */
const MAX_EFFECTIVE_DPR = 2.5

/** 计算传给 echarts.init 的有效 devicePixelRatio（dpr×scale 钳制到上限） */
function resolveEffectiveDpr(scale: number): number {
  return Math.min(window.devicePixelRatio * scale, MAX_EFFECTIVE_DPR)
}

/** 销毁并重建（scale 变化时调用，保证 devicePixelRatio 与当前缩放匹配） */
function renderChart(): void {
  if (!containerRef.value) return
  chart?.dispose()
  chart = echarts.init(containerRef.value, undefined, {
    devicePixelRatio: resolveEffectiveDpr(scaleState.value.scale),
  })
  chart.setOption(props.option)
}

let rebuildTimer: ReturnType<typeof setTimeout> | undefined
function scheduleRebuild(): void {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(renderChart, 150)
}

onMounted(renderChart)

// option 数据更新：不重建实例，notMerge 全量替换（demo 数据量小，无增量合并必要）
watch(
  () => props.option,
  (next) => chart?.setOption(next, true),
  { deep: true }
)

// scale 变化（视口变化触发）：devicePixelRatio 只能 init 指定，必须重建
watch(() => scaleState.value.scale, scheduleRebuild)

onUnmounted(() => {
  clearTimeout(rebuildTimer)
  chart?.dispose()
  chart = undefined
})
</script>

<template>
  <div ref="containerRef" :class="bem.b()" />
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-chart {
  width: 100%;
  height: 100%;
}
</style>
