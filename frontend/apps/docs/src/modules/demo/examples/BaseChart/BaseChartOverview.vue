<script setup lang="ts">
/**
 * BaseChart 用法总览演示页
 *
 * 覆盖验证点：
 * 1. 基础用法 + Loading：option 驱动 + 内置 loading 切换
 * 2. option 响应式 + notMerge：prop 变更触发整体替换，验证旧 series tooltip 状态不残留
 * 3. getInstance()：通过 ref 拿到原生实例绑定 click 事件
 * 4. ResizeObserver 自动 resize：拖动父容器宽度 → 150ms 防抖 → 自动 resize
 * 5. 主题切换：ECharts 主题仅 init 生效，本组件走「dispose + init」重建路径
 * 6. autoResize 关闭：手动 ref.resize() 控制
 */
import { ElMessage } from 'element-plus'
import type { ECharts } from 'echarts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-base-chart')

/** BaseChart 暴露方法类型（也可用 InstanceType<typeof BaseChart>） */
interface BaseChartExposed {
  getInstance: () => ECharts | null
  resize: () => void
  clear: () => void
}

// —— ① 基础用法 + Loading ——
const basicLoading = ref(false)
const basicOption = {
  title: { text: '本周销量', left: 'center' },
  tooltip: { trigger: 'axis' },
  legend: { data: ['销量'], bottom: 0 },
  grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  xAxis: {
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '销量',
      type: 'bar',
      data: [120, 200, 150, 80, 70, 110, 130],
      itemStyle: { color: '#409eff' },
    },
  ],
}
function toggleBasicLoading() {
  basicLoading.value = !basicLoading.value
}
const SNIPPET_BASIC = `<BaseChart :option="option" :loading="loading" />`

// —— ② option 响应式 + notMerge ——
const datasetType = ref<'bar' | 'line'>('bar')
const baseData = [120, 200, 150, 80, 70, 110, 130]
const reactiveOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  yAxis: { type: 'value' },
  series: [
    {
      type: datasetType.value,
      data: baseData,
      smooth: datasetType.value === 'line',
    },
  ],
}))
function switchDataset() {
  datasetType.value = datasetType.value === 'bar' ? 'line' : 'bar'
}
const SNIPPET_REACTIVE = `// option 是 computed：底层数据变化 → 整体替换（notMerge: true）
<BaseChart :option="reactiveOption" />`

// —— ③ getInstance() + 事件绑定 ——
const chartRef = useTemplateRef<BaseChartExposed>('chartRef')
const clickLog = ref<string[]>([])
function bindClick() {
  const instance = chartRef.value?.getInstance()
  if (!instance) {
    ElMessage.warning('图表实例尚未就绪')
    return
  }
  // 先解绑避免重复绑定
  instance.off('click')
  instance.on('click', (params) => {
    clickLog.value = [...clickLog.value, `${params.name}：${params.value}`].slice(-3)
  })
  ElMessage.success('点击事件已绑定，点击柱子试试')
}
const clickOption = {
  tooltip: {},
  xAxis: { type: 'category', data: ['A', 'B', 'C', 'D'] },
  yAxis: {},
  series: [{ type: 'bar', data: [10, 22, 15, 30], itemStyle: { color: '#67c23a' } }],
}
// SNIPPET_INSTANCE：演示「绑定点击事件」完整流程
// ① 重命名为 chartRef 避免遮蔽 AutoImport 的 ref()
// ② 用 BaseChartExposed interface 替代 InstanceType<typeof BaseChart>，
//    避免演示代码要求消费方 import BaseChart 触发 §1.7 hover 失效
// ③ SNIPPET_INSTANCE 不含 console.log（用户复制后会污染 DevTools）：
// 真实场景是业务侧埋点 / ElMessage 提示 / 写 store，注释位占位
const SNIPPET_INSTANCE = `// ① 用组件已暴露的方法类型（无需 import BaseChart）
const chartRef = useTemplateRef<BaseChartExposed>('chartRef')
const instance = chartRef.value?.getInstance()
instance?.on('click', params => {
  // 真实业务：埋点上报 / ElMessage 提示 / 写 store
  /* 处理点击事件：params.name / params.value */
})`

// —— ④ ResizeObserver 自动 resize ——
const containerWidth = ref(600)
function shrink() {
  containerWidth.value = Math.max(300, containerWidth.value - 100)
}
function expand() {
  containerWidth.value = Math.min(900, containerWidth.value + 100)
}
const resizeOption = {
  tooltip: {},
  xAxis: { type: 'category', data: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
  yAxis: {},
  series: [{ type: 'bar', data: [5, 20, 36, 10, 10, 20, 25], itemStyle: { color: '#e6a23c' } }],
}
const SNIPPET_RESIZE = `<div :style="{ width: w + 'px' }">
  <BaseChart :option="option" />  <!-- ResizeObserver 150ms 防抖自动跟随 -->
</div>`

// —— ⑤ 主题切换（销毁重建路径）——
const theme = ref<'light' | 'dark'>('light')
const themeOption = computed(() => ({
  title: {
    text: '主题切换',
    textStyle: { color: theme.value === 'dark' ? '#fff' : '#000' },
  },
  backgroundColor: theme.value === 'dark' ? '#2c2c2c' : '#fff',
  tooltip: {},
  legend: { textStyle: { color: theme.value === 'dark' ? '#fff' : '#000' } },
  xAxis: {
    type: 'category',
    data: ['A', 'B', 'C'],
    axisLabel: { color: theme.value === 'dark' ? '#fff' : '#000' },
  },
  yAxis: { axisLabel: { color: theme.value === 'dark' ? '#fff' : '#000' } },
  series: [
    {
      type: 'pie',
      radius: '50%',
      data: [
        { value: 30, name: 'A' },
        { value: 50, name: 'B' },
        { value: 20, name: 'C' },
      ],
    },
  ],
}))
function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
const SNIPPET_THEME = `<BaseChart :option="option" :theme="theme" />
<!-- ECharts 没有 setTheme API，本组件 watch theme → dispose → init 重建 -->`

// —— ⑥ autoResize 关闭 + 手动 resize ——
const manualChartRef = useTemplateRef<BaseChartExposed>('manualChartRef')
const manualWidth = ref(400)
function manualResize() {
  manualWidth.value = manualWidth.value === 400 ? 700 : 400
  // 关闭 autoResize 后父级尺寸变化不会自动触发 resize，必须手动调用
  manualChartRef.value?.resize()
  ElMessage.info(`容器改为 ${manualWidth.value}px，已手动调用 resize()`)
}
// SNIPPET_MANUAL：演示「关闭 autoResize 后手动 resize()」
// 重命名为 chartRef：与 line 101 的 SNIPPET_INSTANCE 保持命名一致
// 避免模板 ref 名 ref 与 AutoImport 的 ref() 命名冲突（用户复制后会编译失败）
const SNIPPET_MANUAL = `<BaseChart ref="chartRef" :option="option" :auto-resize="false" />
<!-- 父容器尺寸变化后必须手动触发 -->
<button @click="chartRef?.resize()">resize</button>`

const tocItems = [
  { id: 'demo-basic', label: '基础用法 + Loading' },
  { id: 'demo-reactive', label: 'option 响应式 + notMerge' },
  { id: 'demo-instance', label: 'getInstance() + 事件绑定' },
  { id: 'demo-resize', label: 'ResizeObserver 自动 resize' },
  { id: 'demo-theme', label: '主题切换' },
  { id: 'demo-manual', label: 'autoResize 关闭 + 手动 resize' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="BaseChart 用法总览"
    source="src/components/common/BaseChart.vue"
    :introductions="[
      '通用 ECharts 容器组件：option 驱动渲染 + ResizeObserver 自适应 + 三步内存清理。',
      '通过 getInstance() 暴露原生实例，可绑定 click / hover 等事件或调用 dispatchAction。',
      '本页用真实交互验证：loading 切换、option 响应式、事件绑定、主题切换、resize 控制。',
    ]"
  >
    <section id="demo-basic">
      <DemoField :code="SNIPPET_BASIC" label="① 基础用法 + Loading">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="toggleBasicLoading">
            {{ basicLoading ? '关闭 Loading' : '打开 Loading' }}
          </el-button>
          <span :class="bem.e('status')">loading = {{ basicLoading }}</span>
        </div>
        <div :class="bem.e('canvas')">
          <BaseChart :option="basicOption" :loading="basicLoading" />
        </div>
      </DemoField>
    </section>

    <section id="demo-reactive">
      <DemoField :code="SNIPPET_REACTIVE" label="② option 响应式 + notMerge 整体替换">
        <div :class="bem.e('controls')">
          <el-button @click="switchDataset">切换 bar / line</el-button>
          <span :class="bem.e('status')">当前类型：{{ datasetType }}</span>
        </div>
        <div :class="bem.e('canvas')">
          <BaseChart :option="reactiveOption" />
        </div>
        <p :class="bem.e('tip')">
          <strong>验证步骤：</strong>
          先 hover 柱子触发 tooltip，再切换 bar / line；若 tooltip 残留（旧 series 高亮未清掉） 说明
          notMerge 没生效——本组件强制开启 notMerge: true。
        </p>
      </DemoField>
    </section>

    <section id="demo-instance">
      <DemoField :code="SNIPPET_INSTANCE" label="③ getInstance() 获取原生实例绑定事件">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="bindClick">绑定点击事件</el-button>
          <el-button @click="clickLog = []">清空记录</el-button>
        </div>
        <div :class="bem.e('canvas')">
          <BaseChart ref="chartRef" :option="clickOption" />
        </div>
        <ul :class="bem.e('log')">
          <li v-if="clickLog.length === 0" :class="bem.e('log-empty')">绑定后点击柱子试试</li>
          <li v-for="(line, i) in clickLog" :key="i">{{ line }}</li>
        </ul>
      </DemoField>
    </section>

    <section id="demo-resize">
      <DemoField :code="SNIPPET_RESIZE" label="④ ResizeObserver 自动 resize（150ms 防抖）">
        <div :class="bem.e('controls')">
          <el-button @click="shrink">- 缩小 100px</el-button>
          <el-button @click="expand">+ 放大 100px</el-button>
          <span :class="bem.e('status')">容器宽度：{{ containerWidth }}px</span>
        </div>
        <div :class="bem.e('canvas')" :style="{ width: containerWidth + 'px', maxWidth: '100%' }">
          <BaseChart :option="resizeOption" />
        </div>
        <p :class="bem.e('tip')">
          改变宽度时，BaseChart 内部 ResizeObserver 触发并 150ms 防抖后调用 resize()。
          离开本页（组件卸载）时 dispose 会断开观察器释放 DOM 引用。
        </p>
      </DemoField>
    </section>

    <section id="demo-theme">
      <DemoField :code="SNIPPET_THEME" label="⑤ 主题切换（销毁重建路径）">
        <div :class="bem.e('controls')">
          <el-button @click="toggleTheme">切换 light / dark</el-button>
          <span :class="bem.e('status')">当前主题：{{ theme }}</span>
        </div>
        <p :class="bem.e('tip')">
          ECharts 没有 setTheme API，本组件 watch theme 变化后 dispose → init
          重建实例（任何旧状态会被清掉）。
        </p>
        <div :class="bem.e('canvas')">
          <BaseChart :option="themeOption" :theme="theme" />
        </div>
      </DemoField>
    </section>

    <section id="demo-manual">
      <DemoField :code="SNIPPET_MANUAL" label="⑥ autoResize 关闭 + 手动 resize()">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="manualResize">改尺寸 + 手动 resize</el-button>
          <span :class="bem.e('status')">容器宽度：{{ manualWidth }}px</span>
        </div>
        <div :class="bem.e('canvas')" :style="{ width: manualWidth + 'px', maxWidth: '100%' }">
          <BaseChart ref="manualChartRef" :option="resizeOption" :auto-resize="false" />
        </div>
        <p :class="bem.e('tip')">
          autoResize 设为 false 后，父容器尺寸变化不会自动 resize； 本例在改尺寸的同时手动调用
          ref.resize() 让图表跟随。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-base-chart {
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
    height: 320px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  &__tip {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  &__log {
    margin: 8px 0 0;
    padding: 8px 12px;
    list-style: none;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.8;
  }

  &__log-empty {
    color: var(--el-text-color-placeholder);
  }
}
</style>
