<script setup lang="ts">
/**
 * BaseChart · 实时监控演示页
 *
 * 企业常见用途：服务器 CPU 监控、网络流量、业务实时指标、运维大盘。
 *
 * 演示要点：
 * 1. setInterval 模拟数据流推送：每秒推入一个新点
 * 2. 滑动窗口：超过 60 个点丢弃最早的，控制 series 数据量（防止内存单调上涨）
 * 3. 暂停 / 继续：clearInterval / 重启 setInterval
 * 4. onUnmounted 清定时器：组件卸载后定时器仍会触发回调导致泄漏，必须清理
 * 5. 高频更新下 ResizeObserver + 150ms 防抖：图表跟随容器自动 resize（容器拖拽不卡顿）
 */
import { ElMessage } from 'element-plus'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-base-chart-realtime')

// —— 滑动窗口：最近 60 秒的模拟 CPU 使用率 ——
const WINDOW_SIZE = 60
function buildSeedData(): number[] {
  // 初始序列：基础 30 + 正弦波 + 噪声，模拟真实 CPU
  return Array.from({ length: WINDOW_SIZE }, (_, i) =>
    Math.max(5, Math.min(95, 30 + Math.sin(i / 5) * 20 + Math.random() * 10))
  )
}
function buildSeedLabels(): string[] {
  return Array.from({ length: WINDOW_SIZE }, (_, i) => `${-WINDOW_SIZE + i + 1}s`)
}

const data = ref<number[]>(buildSeedData())
const labels = ref<string[]>(buildSeedLabels())

let timer: ReturnType<typeof setInterval> | null = null
const running = ref(false)
const pushCount = ref(0)

/** 每 tick 推入一个新点（CPU 在 last 基础上 ±15 抖动） */
function tick(): void {
  const last = data.value[data.value.length - 1] ?? 30
  const next = Math.max(5, Math.min(95, last + (Math.random() - 0.5) * 15))
  // 滑动窗口：slice(1) 丢最早的 + append 新值；用展开符生成新数组触发 ref 监听
  data.value = [...data.value.slice(1), next]
  labels.value = [...labels.value.slice(1), '0s']
  pushCount.value += 1
}

function start(): void {
  if (running.value) return
  running.value = true
  timer = setInterval(tick, 1000)
  ElMessage.success('开始推送（1 Hz）')
}

function pause(): void {
  if (!running.value) return
  running.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  ElMessage.info('已暂停')
}

function resetAll(): void {
  pause()
  data.value = buildSeedData()
  labels.value = buildSeedLabels()
  pushCount.value = 0
  ElMessage.success('已重置数据')
}

// 关键：组件卸载时清定时器（离开本页 / 路由切换 / 弹窗关闭等场景）
// 否则 setInterval 回调仍会持续触发，访问已卸载的 data.value 导致泄漏
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

const option = computed(() => ({
  grid: { left: 50, right: 20, top: 30, bottom: 30 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: labels.value,
    boundaryGap: false,
    // 防止 X 轴 60 个标签重叠：每隔 N 个显示一次
    axisLabel: { interval: Math.floor(WINDOW_SIZE / 6) },
  },
  yAxis: { type: 'value', min: 0, max: 100, name: 'CPU %' },
  series: [
    {
      name: 'CPU',
      type: 'line',
      smooth: true,
      symbol: 'none',
      areaStyle: { opacity: 0.3 },
      data: data.value,
      lineStyle: { color: '#409eff' },
      itemStyle: { color: '#409eff' },
    },
  ],
}))

const SNIPPET = `// setInterval 每秒推入新点
timer = setInterval(() => {
  data.value = [...data.value.slice(1), nextValue]
}, 1000)

// 卸载时必须清理（防止定时器泄漏 + 访问已 dispose 组件的 data）
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

<BaseChart :option="option" />`

const tocItems = [{ id: 'demo-realtime', label: '实时监控（CPU 折线图）' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="BaseChart · 实时监控"
    source="src/components/common/BaseChart.vue"
    :introductions="[
      '折线图 + setInterval 模拟实时数据流：每秒推入一个点，滑动窗口 60 个点。',
      '企业用途：服务器 CPU 监控、网络流量、业务实时指标、运维大盘。',
      '重点验证：暂停 / 继续 / 重置 / onUnmounted 清定时器（防内存泄漏 + 定时器泄漏）。',
    ]"
  >
    <section id="demo-realtime">
      <DemoField :code="SNIPPET" label="① CPU 实时监控（1 Hz 推送 + 滑动窗口）">
        <div :class="bem.e('controls')">
          <el-button v-if="!running" type="primary" @click="start">开始推送</el-button>
          <el-button v-else @click="pause">暂停</el-button>
          <el-button @click="resetAll">重置</el-button>
          <span :class="bem.e('status')">
            状态：
            <b>{{ running ? '运行中' : '已暂停' }}</b>
            · 累计推送 {{ pushCount }} 次
          </span>
        </div>
        <div :class="bem.e('canvas')">
          <BaseChart :option="option" />
        </div>
        <p :class="bem.e('tip')">
          切换标签页时浏览器会节流 setInterval（最低 1s），回到本页恢复推送。 离开本页（路由切换 /
          组件卸载）onUnmounted 会清理定时器，不再推送数据。 反复挂载/卸载 → DevTools
          内存应回到基线，无单调上涨。
          <br />
          <strong>GC 说明：</strong>
          本 demo 用 1 Hz（每秒推一次）+ 60 元素数组，每分钟重建 60 次数组（每次 60 个 number），GC
          压力可忽略；如需
          <code>&gt; 10 Hz</code>
          高频场景，建议改用 ring buffer（固定长度 Float64Array + 索引覆盖）避免重复 GC。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-base-chart-realtime {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  &__status {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  &__canvas {
    width: 100%;
    height: 360px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }
  &__tip {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
}
</style>
