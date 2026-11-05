/**
 * 1920 标准大屏的 ECharts option 配置（从视图抽离）。
 *
 * 抽离理由：option 是纯数据配置（无响应式、无生命周期），内联会让视图组件
 * 超出行限且稀释布局结构的可读性；视图只关心「哪个面板放哪张图」。
 *
 * 配色语义：主蓝 #4da3ff（柱/品牌）、金 #f7c948（增长率对比线）、
 * 绿 #2fd39a（走势面积）、紫 #b478ff（占比第四类）。
 */
import type { EChartsOption } from 'echarts'
import { MAIN_TREND, SHARE_DATA } from '../apis'

/** 坐标轴统一深色风格（三个图表共用） */
const axisStyle = {
  axisLine: { lineStyle: { color: 'rgba(143, 168, 216, 0.4)' } },
  axisLabel: { color: '#8fa8d8', fontSize: 14 },
  splitLine: { lineStyle: { color: 'rgba(143, 168, 216, 0.12)' } },
} as const

/** 月度经营趋势（柱状交易额 + 折线增长率，双 y 轴） */
export const mainTrendOption: EChartsOption = {
  backgroundColor: 'transparent',
  grid: { left: 60, right: 60, top: 50, bottom: 40 },
  legend: { data: ['交易额', '增长率'], textStyle: { color: '#8fa8d8', fontSize: 14 }, top: 8 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: MAIN_TREND.months, ...axisStyle },
  yAxis: [
    { type: 'value', name: '万元', nameTextStyle: { color: '#8fa8d8' }, ...axisStyle },
    {
      type: 'value',
      name: '%',
      nameTextStyle: { color: '#8fa8d8' },
      ...axisStyle,
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: '交易额',
      type: 'bar',
      data: MAIN_TREND.volume,
      barWidth: 18,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: '#4da3ff' },
            { offset: 1, color: '#1d4f9c' },
          ],
        },
      },
    },
    {
      name: '增长率',
      type: 'line',
      yAxisIndex: 1,
      data: MAIN_TREND.growth,
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 3, color: '#f7c948' },
      itemStyle: { color: '#f7c948' },
    },
  ],
}

/** 业务占比（环形饼图） */
export const shareOption: EChartsOption = {
  backgroundColor: 'transparent',
  tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
  legend: {
    bottom: 0,
    textStyle: { color: '#8fa8d8', fontSize: 14 },
    itemWidth: 14,
    itemHeight: 14,
  },
  series: [
    {
      type: 'pie',
      // 半径收窄 + labelLine 缩短：460px 侧栏面板内为 label 让出横向空间，
      // 否则「线上商城 42%」等长标签被面板边缘截断成省略号
      radius: ['32%', '52%'],
      center: ['50%', '44%'],
      data: SHARE_DATA,
      label: { color: '#d6e4ff', fontSize: 14, formatter: '{b}\n{c}%' },
      labelLine: { length: 8, length2: 8 },
      itemStyle: { borderColor: '#06122b', borderWidth: 2 },
      color: ['#4da3ff', '#2fd39a', '#f7c948', '#b478ff'],
    },
  ],
}

/** 交易额走势（侧栏小图：平滑面积线，数据为主趋势的 0.7 倍模拟对照系） */
export const trendOption: EChartsOption = {
  backgroundColor: 'transparent',
  grid: { left: 60, right: 30, top: 30, bottom: 40 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: MAIN_TREND.months, ...axisStyle },
  yAxis: { type: 'value', ...axisStyle },
  series: [
    {
      type: 'line',
      data: MAIN_TREND.volume.map((v) => Math.round(v * 0.7)),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#2fd39a' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(47, 211, 154, 0.35)' },
            { offset: 1, color: 'rgba(47, 211, 154, 0)' },
          ],
        },
      },
    },
  ],
}
