/**
 * big-demo 数据层：静态 mock（演示厅无外网，不依赖后端）。
 *
 * 实时感通过视图层 setInterval 调 jitterValue 周期性抖动数值模拟。
 */

/** KPI 指标项（KpiCard 的 props 形态） */
export interface BigKpi {
  label: string
  value: number
  unit?: string
  /** 同比百分比（正涨负跌，0 为持平） */
  trend?: number
}

/** 排名列表项 */
export interface BigRankItem {
  name: string
  value: number
}

/** 主趋势图（柱状 + 折线双轴共用月份轴） */
export interface BigTrend {
  months: string[]
  /** 交易额（柱，万元） */
  volume: number[]
  /** 增长率（线，%） */
  growth: number[]
}

/** 业务占比饼图项 */
export interface BigShareItem {
  name: string
  value: number
}

/** 实时滚动条目 */
export interface BigLiveItem {
  time: string
  text: string
}

export const OVERVIEW_KPIS: BigKpi[] = [
  { label: '今日交易额', value: 12860, unit: '万元', trend: 12.6 },
  { label: '今日订单量', value: 8942, unit: '单', trend: 8.3 },
  { label: '活跃用户', value: 56210, unit: '人', trend: -2.1 },
  { label: '转化率', value: 32, unit: '%', trend: 1.8 },
]

export const SIDE_KPIS: BigKpi[] = [
  { label: '在途工单', value: 326, unit: '件', trend: -5.2 },
  { label: '客诉率', value: 3, unit: '%', trend: -0.6 },
]

export const MAIN_TREND: BigTrend = {
  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  volume: [820, 932, 901, 934, 1290, 1330, 1320, 1450, 1500, 1230, 1420, 1610],
  growth: [2.1, 13.7, -3.3, 3.7, 38.1, 3.1, -0.8, 9.8, 3.4, -18.0, 15.4, 13.4],
}

export const SHARE_DATA: BigShareItem[] = [
  { name: '线上商城', value: 42 },
  { name: '门店零售', value: 28 },
  { name: '渠道分销', value: 18 },
  { name: '大客户', value: 12 },
]

export const REGION_RANK: BigRankItem[] = [
  { name: '华东区', value: 4860 },
  { name: '华南区', value: 3920 },
  { name: '华北区', value: 3410 },
  { name: '西南区', value: 2380 },
  { name: '华中区', value: 1960 },
  { name: '东北区', value: 1120 },
]

export const LIVE_FEED: BigLiveItem[] = [
  { time: '10:24:16', text: '华东区新增大额订单 ¥128,000' },
  { time: '10:23:58', text: '华南区客诉工单已闭环' },
  { time: '10:22:41', text: '华北区库存周转率提升至 4.2' },
  { time: '10:21:09', text: '西南区新签渠道分销商 2 家' },
  { time: '10:19:33', text: '线上商城促销活动 UV 峰值 8.2w' },
]

/** 数值抖动：±5% 内随机波动（模拟实时数据跳动），返回四舍五入整数 */
export function jitterValue(base: number): number {
  return Math.round(base * (1 + (Math.random() - 0.5) * 0.1))
}

// ─── 9000 超宽页（/big-demo/wide）静态面板数据 ────────────────

/** 超宽页 · 核心指标组（左面板） */
export const WIDE_METRIC_GROUPS = [
  { label: '实时交易额', value: '¥ 12,860 万' },
  { label: '实时订单', value: '8,942 单' },
  { label: '在线终端', value: '3,412 台' },
  { label: '数据延迟', value: '< 2 s' },
] as const

/** 超宽页 · 实时告警（右面板）；level 决定徽标配色（高红/中黄/低灰） */
export const WIDE_ALARMS = [
  { level: '高', text: '华东区仓储周转低于阈值', time: '10:24' },
  { level: '中', text: '华南区客诉率环比上升 0.4%', time: '10:12' },
  { level: '中', text: '东北区物流时效超时 6 单', time: '09:58' },
  { level: '低', text: '西南区渠道库存预警', time: '09:31' },
] as const

/** 超宽页 · 分析维度按钮组（右面板） */
export const WIDE_DIMENSIONS = ['按大区', '按渠道', '按品类', '按门店'] as const

/** 超宽页 · 联动开关（左面板）；defaultOn 为初始态，视图据此派生初始 switchState */
export const WIDE_SWITCHES = [
  { key: 'realtime', label: '实时数据推送', defaultOn: true },
  { key: 'alarm', label: '告警联动', defaultOn: true },
  { key: 'night', label: '夜间值守模式', defaultOn: false },
] as const
