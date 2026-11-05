<script setup lang="ts">
/**
 * BaseChart —— 通用 ECharts 容器组件
 *
 * 设计要点（避免日后被"善意重构"破坏）：
 * 1. shallowRef 持有 ECharts 实例：实例含大量方法、循环引用与 Canvas 句柄，
 *    深度响应式既无必要又拖性能；浅响应式已足够驱动 watch 链路。
 * 2. ResizeObserver 替代 window.resize：侧边栏折叠、弹窗拉伸场景下，
 *    容器尺寸变化与 window 解耦，必须观察容器自身。
 * 3. setOption 强制 notMerge: true：避免新旧 series/legend/tooltip 状态合并残留，
 *    否则切换数据集时旧 series 的 tooltip 状态会卡住不消失。
 * 4. 主题变更需销毁重建：ECharts 主题仅 init 时生效，没有 setTheme API。
 * 5. onBeforeUnmount 三步清理：定时器 → ResizeObserver → ECharts 实例
 *    （dispose 同步移除所有事件监听器并释放 canvas，否则内存持续泄漏）。
 */
import { onBeforeUnmount, onMounted, shallowRef, watch, useTemplateRef } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsCoreOption } from 'echarts'

interface BaseChartProps {
  /** ECharts 配置项；prop 变更时通过 notMerge 整体替换 */
  option: EChartsCoreOption
  /** 是否显示内置 Loading 动画 */
  loading?: boolean
  /** 主题名称（需先 echarts.registerTheme）或主题对象 */
  theme?: string | object
  /** 是否监听容器尺寸变化自动 resize；侧边栏/弹窗场景建议保持开启 */
  autoResize?: boolean
}

const props = withDefaults(defineProps<BaseChartProps>(), {
  loading: false,
  autoResize: true,
})

// createNamespace 由 unplugin-auto-import 自动注入（项目 §1.6 / §3.2）
const bem = createNamespace('base-chart')
const chartRef = useTemplateRef<HTMLDivElement>('chartRef')

// —— 内部状态 ——
// shallowRef：仅追踪引用本身，不深度代理 ECharts 实例
const instance = shallowRef<ECharts | null>(null)
const resizeObserver = shallowRef<ResizeObserver | null>(null)
// 单独持有防抖定时器 id，便于卸载时清理
let resizeTimer: ReturnType<typeof setTimeout> | null = null

// —— 防抖（trailing edge）——
// 容器拖拽/动画期间 ResizeObserver 以 ~60Hz 高频触发；
// 合并为最后一次触发后调用 resize，150ms 对中后台 60Hz 屏足够平滑且节省 GPU 重绘。
const debouncedResize = (): void => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    instance.value?.resize()
    resizeTimer = null
  }, 150)
}

const initChart = (): void => {
  if (!chartRef.value) return
  // 防御性：主题切换或异常重建时先释放旧实例，杜绝内存泄漏
  instance.value?.dispose()
  instance.value = echarts.init(chartRef.value, props.theme)
  instance.value.setOption(props.option, { notMerge: true })
  if (props.loading) instance.value.showLoading()
}

const setupResize = (): void => {
  if (!props.autoResize || !chartRef.value) return
  resizeObserver.value = new ResizeObserver(debouncedResize)
  resizeObserver.value.observe(chartRef.value)
}

const teardownResize = (): void => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  resizeObserver.value?.disconnect()
  resizeObserver.value = null
}

// option 变更：整体替换，避免 series/legend 状态合并导致 tooltip 卡住
watch(
  () => props.option,
  (newOption) => {
    instance.value?.setOption(newOption, { notMerge: true })
  },
  { deep: true }
)

// loading 切换：使用 ECharts 内置 Loading 遮罩，不阻塞底层渲染
watch(
  () => props.loading,
  (loading) => {
    if (!instance.value) return
    if (loading) {
      instance.value.showLoading()
    } else {
      instance.value.hideLoading()
    }
  }
)

// 主题变更：ECharts 主题仅 init 时生效，必须销毁重建
watch(
  () => props.theme,
  () => {
    if (instance.value) initChart()
  }
)

// autoResize 切换：动态挂载/卸载 ResizeObserver
watch(
  () => props.autoResize,
  (enabled) => {
    teardownResize()
    if (enabled) setupResize()
  }
)

onMounted(() => {
  initChart()
  setupResize()
})

onBeforeUnmount(() => {
  // 内存销毁三步走，缺一不可：
  // 1. 清防抖定时器 → 否则卸载后定时器仍会触发 resize（实例已 dispose → 静默失败）
  // 2. disconnect ResizeObserver → 释放对 DOM 节点的强引用
  // 3. dispose ECharts → 同步移除所有事件监听器并释放 canvas
  teardownResize()
  instance.value?.dispose()
  instance.value = null
})

defineExpose({
  /** 获取 ECharts 原生实例，可绑定 click/hover 事件或调用 dispatchAction */
  getInstance: (): ECharts | null => instance.value,
  /** 手动触发重绘（容器尺寸外部已变但 ResizeObserver 未触发的兜底入口） */
  resize: (): void => {
    instance.value?.resize()
  },
  /** 清空图表内容，保留实例本身（与 dispose 不同） */
  clear: (): void => {
    instance.value?.clear()
  },
})
</script>

<template>
  <div ref="chartRef" :class="bem.b()"></div>
</template>

<style lang="scss">
/* 非 scoped：BEM 命名空间隔离（项目 §3.2 强制约定；scoped 在 BEM 下是冗余） */
.#{$BEM_PREFIX}-base-chart {
  width: 100%;
  height: 100%;
  /* 兜底：父容器塌陷为 0 时 ECharts 会报 width/height 0 警告，1px 即可 */
  min-height: 1px;
}
</style>
