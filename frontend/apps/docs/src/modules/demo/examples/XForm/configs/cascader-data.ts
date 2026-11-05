/**
 * XFormReactionAdvanced 用的静态字典 mock
 *
 * 拆出此文件的原因：demo 主文件目标 ≤320 行（CLAUDE.md §6），静态字典
 * （省/市/区、商品类型/型号、度量单位）累计 ~80 行，放在 schema 旁边
 * 会撑爆。
 *
 * 命名约定：Select 组件 props.options 兼容 { value, label }[] 形态。
 */

export interface OptionItem {
  value: string
  label: string
}

/** 省份（演示级联起点） */
export const PROVINCES: OptionItem[] = [
  { value: 'zhejiang', label: '浙江省' },
  { value: 'jiangsu', label: '江苏省' },
  { value: 'guangdong', label: '广东省' },
]

/** 省份 → 城市列表（演示 reaction.props 按上级值动态切 options） */
export const CITIES_BY_PROVINCE: Record<string, OptionItem[]> = {
  zhejiang: [
    { value: 'hangzhou', label: '杭州' },
    { value: 'ningbo', label: '宁波' },
    { value: 'wenzhou', label: '温州' },
  ],
  jiangsu: [
    { value: 'nanjing', label: '南京' },
    { value: 'suzhou', label: '苏州' },
  ],
  guangdong: [
    { value: 'guangzhou', label: '广州' },
    { value: 'shenzhen', label: '深圳' },
  ],
}

/** 城市 → 区/县列表 */
export const DISTRICTS_BY_CITY: Record<string, OptionItem[]> = {
  hangzhou: [
    { value: 'xihu', label: '西湖区' },
    { value: 'yuhang', label: '余杭区' },
  ],
  ningbo: [
    { value: 'haishu', label: '海曙区' },
    { value: 'jiangbei', label: '江北区' },
  ],
  nanjing: [{ value: 'gulou', label: '鼓楼区' }],
  suzhou: [{ value: 'gusu', label: '姑苏区' }],
  guangzhou: [{ value: 'tianhe', label: '天河区' }],
  shenzhen: [{ value: 'nanshan', label: '南山区' }],
}

/** 商品类型 → 型号（演示改类型清空型号） */
export const ITEM_TYPES: OptionItem[] = [
  { value: 'phone', label: '手机' },
  { value: 'laptop', label: '笔记本' },
  { value: 'tablet', label: '平板' },
]

export const MODELS_BY_TYPE: Record<string, OptionItem[]> = {
  phone: [
    { value: 'iphone-15', label: 'iPhone 15' },
    { value: 'mate-60', label: 'Mate 60' },
  ],
  laptop: [
    { value: 'mbp-14', label: 'MacBook Pro 14' },
    { value: 'xps-15', label: 'XPS 15' },
  ],
  tablet: [
    { value: 'ipad-air', label: 'iPad Air' },
    { value: 'matepad', label: 'MatePad' },
  ],
}

/** 度量单位 → 各类 props 映射（Section ③ 一次性查 4 张表） */
export type MetricKey = 'weight' | 'volume' | 'count'

export const METRIC_OPTIONS: OptionItem[] = [
  { value: 'weight', label: '重量 (kg)' },
  { value: 'volume', label: '体积 (m³)' },
  { value: 'count', label: '数量 (件)' },
]

export const METRIC_LABEL: Record<MetricKey, string> = {
  weight: '重量',
  volume: '体积',
  count: '数量',
}

export const METRIC_MIN: Record<MetricKey, number> = { weight: 0, volume: 0, count: 1 }
export const METRIC_MAX: Record<MetricKey, number> = {
  weight: 10000,
  volume: 1000,
  count: 999999,
}
export const METRIC_PRECISION: Record<MetricKey, number> = { weight: 2, volume: 3, count: 0 }
export const METRIC_PLACEHOLDER: Record<MetricKey, string> = {
  weight: '请输入重量 (kg)',
  volume: '请输入体积 (m³)',
  count: '请输入数量 (件)',
}

/** 折扣等级 → 折扣率（Section ③） */
export const DISCOUNT_LEVEL_OPTIONS: OptionItem[] = [
  { value: 'normal', label: '普通 (无折扣)' },
  { value: 'silver', label: '银卡 (95 折)' },
  { value: 'gold', label: '金卡 (9 折)' },
  { value: 'diamond', label: '钻石 (8 折)' },
]

export const DISCOUNT_RATE: Record<string, number> = {
  normal: 1,
  silver: 0.95,
  gold: 0.9,
  diamond: 0.8,
}
