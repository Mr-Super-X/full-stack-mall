<script setup lang="ts">
/**
 * BaseChart · 多图表组合仪表盘演示页
 *
 * 企业常见用途：运营仪表盘、数据大屏、监控中心、BI 看板。
 *
 * 演示要点：
 * 1. 多个 BaseChart 在同一页面组合：4 个 KPI 卡 + 趋势 / 占比 / 排行 3 个图表
 * 2. el-row / el-col 栅格 + 响应式断点 (xs / sm / md / lg)
 * 3. 每个 BaseChart 独立 ResizeObserver：窗口 / 容器尺寸变化各自跟随
 * 4. 全屏切换：requestFullscreen API（浏览器原生全屏），所有图表重新 resize
 * 5. 排行榜柱图动态着色：itemStyle.color 支持函数返回值
 */
import { ElMessage } from 'element-plus'
// 注：echarts 6.1.0 的 types 子路径（echarts/types）未在 package.json exports 中暴露，
// 实际可用类型仅 `echarts` 根入口。itemStyle.color 回调参数类型走项目内通用约定
// （params.dataIndex / params.value / params.name 在所有 ECharts series 都存在），
// 用 `params: Record<string, unknown>` + 显式 cast 即可，运行时无影响。
// demo 业务组件不在 unplugin-vue-components 自动注册范围（dirs 三目录外的组件），
// 必须显式 import；BaseChart 等三目录内组件无需 import，靠 GlobalComponents 解析
import DemoFrame from '../../components/DemoFrame.vue' // demo 业务组件 @modules/demo/components
import DemoField from '../../components/DemoField.vue' // demo 业务组件 @modules/demo/components
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-base-chart-dashboard')

/** ECharts series 回调通用字段（echarts/types 未暴露，用本地 interface 替代 ItemStyleCallbackParams）。
 * 涵盖 itemStyle.color / tooltip.formatter / label.formatter 等所有 series 回调。 */
interface EChartCallbackParams {
  dataIndex?: number
  value?: number | string | (string | number)[]
  name?: string
}

// —— KPI 卡数据 ——
const kpis = ref([
  { label: '今日订单', value: 1284, delta: 12.5, unit: '' },
  { label: '销售额', value: 86.5, delta: 8.2, unit: '万' },
  { label: '新增用户', value: 312, delta: -3.1, unit: '' },
  { label: '转化率', value: 4.7, delta: 0.8, unit: '%' },
])

// —— 7 日销售趋势（折线图）——
const trendOption = computed(() => ({
  grid: { left: 40, right: 16, top: 20, bottom: 30 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    boundaryGap: false,
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '销售额',
      type: 'line',
      smooth: true,
      data: [820, 932, 1090, 1300, 1450, 1630, 1820],
      areaStyle: { opacity: 0.2 },
      itemStyle: { color: '#409eff' },
    },
  ],
}))

// —— 流量类目占比（环形饼图）——
const pieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, left: 'center' },
  series: [
    {
      name: '流量来源',
      type: 'pie',
      radius: ['40%', '65%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } },
      data: [
        { value: 1048, name: '搜索' },
        { value: 735, name: '直接访问' },
        { value: 580, name: '邮件营销' },
        { value: 484, name: '联盟广告' },
        { value: 300, name: '视频广告' },
      ],
    },
  ],
}))

// —— 排行榜（横向柱图 + 动态着色）——
const rankOption = computed(() => ({
  grid: { left: 70, right: 30, top: 10, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value' },
  yAxis: {
    type: 'category',
    data: ['产品 A', '产品 B', '产品 C', '产品 D', '产品 E', '产品 F', '产品 G'],
  },
  series: [
    {
      name: '销量',
      type: 'bar',
      data: [1820, 1630, 1450, 1300, 1090, 932, 820],
      // itemStyle.color 支持函数：按 dataIndex 返回不同色（演示高亮 Top 3）
      // 回调参数用本地 EChartCallbackParams interface：echarts/types 子路径未在
      // package.json exports 中暴露，无法直接用 ItemStyleCallbackParams；
      // 该 interface 涵盖所有 ECharts series 回调的共有字段（dataIndex/value/name）
      itemStyle: {
        color: (params: EChartCallbackParams) => {
          const palette = [
            '#f56c6c',
            '#e6a23c',
            '#67c23a',
            '#409eff',
            '#909399',
            '#5470c6',
            '#91cc75',
          ]
          return palette[Number(params.dataIndex ?? 0) % palette.length]
        },
      },
    },
  ],
}))

// —— 全屏切换 ——
const dashboardRef = ref<HTMLElement | null>(null)
const fullscreen = ref(false)

/** fullscreenchange 事件回调：把浏览器真实全屏状态同步到 ref。
 *
 * 关键：ESC / 浏览器 API（document.exitFullscreen()）退出全屏时
 * 都不会回调 toggleFullscreen()，按钮文案会与真实状态脱钩。
 * 因此 fullscreen.value 必须由 fullscreenchange 事件统一同步，
 * 而不是各自在 toggleFullscreen() 里手写赋值。
 */
function syncFullscreenState(): void {
  fullscreen.value = document.fullscreenElement !== null
}

async function toggleFullscreen(): Promise<void> {
  if (!dashboardRef.value) return
  try {
    if (!document.fullscreenElement) {
      await dashboardRef.value.requestFullscreen()
      ElMessage.success('进入全屏（图表自动跟随放大）')
    } else {
      await document.exitFullscreen()
    }
    // fullscreen.value 由 fullscreenchange 事件统一同步，不在此处手写
  } catch (err) {
    // 浏览器可能拒绝全屏请求（如非用户手势触发）
    ElMessage.warning(`全屏切换失败：${String(err)}`)
  }
}

// 注册 / 清理 fullscreenchange 监听
onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
})
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})

const SNIPPET = `<el-row :gutter="12">
  <el-col :xs="12" :sm="12" :md="6" v-for="kpi in kpis">
    <div class="kpi">{{ kpi.label }} {{ kpi.value }}</div>
  </el-col>
</el-row>
<el-row :gutter="12">
  <el-col :xs="24" :md="16">
    <BaseChart :option="trendOption" />
  </el-col>
  <el-col :xs="24" :md="8">
    <BaseChart :option="pieOption" />
  </el-col>
</el-row>
<!-- 全屏：dashboardRef.requestFullscreen() -->`

const tocItems = [{ id: 'demo-dashboard', label: '运营仪表盘组合' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="BaseChart · 多图表组合仪表盘"
    source="src/components/common/BaseChart.vue"
    :introductions="[
      '企业常见：运营仪表盘、监控大屏、BI 看板。',
      '4 个 KPI 卡 + 趋势折线 + 类目占比 + 排行榜，el-row/el-col 栅格 + 响应式断点。',
      '每个 BaseChart 独立 ResizeObserver，窗口 / 容器尺寸变化各自跟随；全屏切换所有图表同步放大。',
    ]"
  >
    <section id="demo-dashboard">
      <DemoField :code="SNIPPET" label="① 运营仪表盘（多 BaseChart 组合 + 全屏）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="toggleFullscreen">
            {{ fullscreen ? '退出全屏' : '进入全屏' }}
          </el-button>
          <span :class="bem.e('status')">
            全屏状态：
            <b>{{ fullscreen ? '是' : '否' }}</b>
          </span>
        </div>

        <div ref="dashboardRef" :class="bem.e('dashboard')">
          <!-- KPI 卡 -->
          <el-row :gutter="12">
            <el-col v-for="(kpi, i) in kpis" :key="i" :xs="12" :sm="12" :md="6">
              <div :class="bem.e('kpi')">
                <div :class="bem.e('kpi-label')">{{ kpi.label }}</div>
                <div :class="bem.e('kpi-value')">
                  {{ kpi.value }}
                  <span :class="bem.e('kpi-unit')">{{ kpi.unit }}</span>
                </div>
                <div
                  :class="[
                    bem.e('kpi-delta'),
                    kpi.delta >= 0 ? bem.e('kpi-up') : bem.e('kpi-down'),
                  ]"
                >
                  {{ kpi.delta >= 0 ? '↑' : '↓' }} {{ Math.abs(kpi.delta) }}%
                </div>
              </div>
            </el-col>
          </el-row>

          <!-- 趋势 + 占比 -->
          <el-row :gutter="12" :class="bem.e('charts-row')">
            <el-col :xs="24" :md="16">
              <div :class="bem.e('chart-card')">
                <div :class="bem.e('chart-title')">7 日销售趋势</div>
                <div :class="bem.e('chart-canvas')">
                  <BaseChart :option="trendOption" />
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :md="8">
              <div :class="bem.e('chart-card')">
                <div :class="bem.e('chart-title')">流量来源占比</div>
                <div :class="bem.e('chart-canvas')">
                  <BaseChart :option="pieOption" />
                </div>
              </div>
            </el-col>
          </el-row>

          <!-- 排行榜 -->
          <el-row :gutter="12">
            <el-col :span="24">
              <div :class="bem.e('chart-card')">
                <div :class="bem.e('chart-title')">商品销量排行 TOP 7</div>
                <div :class="bem.e('chart-canvas')" style="height: 280px">
                  <BaseChart :option="rankOption" />
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <p :class="bem.e('tip')">
          改变浏览器窗口宽度（断点 xs / sm / md / lg），栅格自动重排，每个 BaseChart 内部
          ResizeObserver 触发并各自 resize。进入全屏后所有图表同步放大； 退出全屏恢复原始布局。
          <br />
          <strong>全屏失败路径测试：</strong>
          F12 → Console → 在非用户手势下手动调用
          <code>toggleFullscreen()</code>
          验证 catch 分支触发
          <code>ElMessage.warning</code>
          提示「全屏切换失败」（浏览器会拒绝非用户手势的 requestFullscreen 调用）。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-base-chart-dashboard {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  &__status {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  &__dashboard {
    padding: 12px;
    background: var(--el-bg-color);
    border-radius: 6px;
  }
  &__kpi {
    padding: 16px;
    background: var(--el-bg-color-overlay);
    border-radius: 4px;
    margin-bottom: 12px;
  }
  &__kpi-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  &__kpi-value {
    margin: 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  &__kpi-unit {
    margin-left: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  &__kpi-delta {
    font-size: 12px;
  }
  &__kpi-up {
    color: var(--el-color-success);
  }
  &__kpi-down {
    color: var(--el-color-danger);
  }
  &__charts-row {
    margin-top: 12px;
  }
  &__chart-card {
    padding: 12px;
    background: var(--el-bg-color-overlay);
    border-radius: 4px;
    margin-bottom: 12px;
  }
  &__chart-title {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
  &__chart-canvas {
    width: 100%;
    height: 240px;
  }
  &__tip {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
}
</style>
