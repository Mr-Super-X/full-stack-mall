// h5-mall 商城首页静态数据（拙衣 ZHUOYI · 陶土秋季）。
//
// 原型阶段无后端：全部区块数据在此单源登记，将来接 API 时逐字段平移到响应类型即可。
// 视觉约定（来源：根 style-tokens.json 陶土模板）：
//   - ph 色块三档（a/b/c）对应 --mall-bg-field / --mall-brand-soft / --mall-accent-soft
//   - garm 线稿为 SVG symbol id，sprite 注册于 ../views/index.vue（id 前缀 mall-g-）

/** 商品占位色块档位（映射到模块 token 的三种浅底） */
export type MallPh = 'a' | 'b' | 'c'

/** 商品线稿图标（SVG symbol 后缀，完整 id = `mall-g-${garm}`） */
export type MallGarm =
  'shirt' | 'sweater' | 'trench' | 'skirt' | 'tshirt' | 'pants' | 'shoe' | 'tote'

/** 限时甄选单品 */
export interface MallFlashItem {
  name: string
  price: number
  originPrice: number
  ph: MallPh
  garm: MallGarm
  /** 折扣角标（如 -27%） */
  tag: string
}

/** 新品横滑卡片 */
export interface MallNewItem {
  name: string
  price: number
  ph: MallPh
  garm: MallGarm
  tag?: string
}

/** 为你推荐商品卡 */
export interface MallGoodsItem {
  id: number
  name: string
  price: number
  ph: MallPh
  garm: MallGarm
  /** 卡内小标签（材质 / 卖点，如「棉 100%」「免烫」） */
  minitag: string
}

/** 底部 Tab 项 */
export interface MallTab {
  key: string
  label: string
  /** SVG symbol 后缀，完整 id = `mall-i-${icon}` */
  icon: 'home' | 'grid' | 'bag' | 'user'
}

/** 顶部公告 */
export const MALL_NOTICE = '新客立减 ¥30 · 全场满 ¥299 顺丰包邮 · 7 天无理由退换'

/** 金刚区品类入口（6 宫格）；icon 为 SVG symbol 后缀，完整 id = `mall-i-${icon}` */
export const MALL_CATS: ReadonlyArray<{
  label: string
  icon: 'spark' | 'dress-s' | 'coat-s' | 'shoe-s' | 'bag' | 'gem-s'
}> = [
  { label: '今日上新', icon: 'spark' },
  { label: '女装', icon: 'dress-s' },
  { label: '男装', icon: 'coat-s' },
  { label: '鞋靴', icon: 'shoe-s' },
  { label: '箱包', icon: 'bag' },
  { label: '配饰', icon: 'gem-s' },
]

/** 限时甄选（每日 10:00–22:00） */
export const MALL_FLASH: ReadonlyArray<MallFlashItem> = [
  { name: '云朵感圆领针织', price: 189, originPrice: 259, ph: 'b', garm: 'sweater', tag: '-27%' },
  { name: '垂感锥形阔腿裤', price: 159, originPrice: 219, ph: 'a', garm: 'pants', tag: '-27%' },
  { name: '头层牛皮乐福鞋', price: 329, originPrice: 459, ph: 'c', garm: 'shoe', tag: '-28%' },
]

/** 新品上架（横滑） */
export const MALL_NEWS: ReadonlyArray<MallNewItem> = [
  { name: '陶土色垂感风衣', price: 399, ph: 'a', garm: 'trench', tag: '本季主打' },
  { name: '燕麦色针织开衫', price: 219, ph: 'b', garm: 'sweater' },
  { name: '月白法式衬衫', price: 149, ph: 'c', garm: 'shirt' },
  { name: '雾蓝伞形半身裙', price: 179, ph: 'a', garm: 'skirt' },
]

/** 编辑专题（单卡） */
export const MALL_TOPIC = {
  kicker: "EDITORS' PICK",
  title: '棉麻 Capsule · 第 12 期',
  desc: '一件穿十年的基础衣柜：从 7 个单品开始。',
  meta: '每周四更新 · 已更新 12 期',
  artText: '拾贰',
} as const

/** 为你推荐筛选 chips（首项为默认选中） */
export const MALL_CHIPS: ReadonlyArray<string> = ['推荐', '上衣', '裙装', '裤装', '外套', '配饰']

/** 为你推荐商品（瀑布双列） */
export const MALL_GOODS: ReadonlyArray<MallGoodsItem> = [
  {
    id: 1,
    name: '陶土色垂感风衣 · 中长款双面呢',
    price: 399,
    ph: 'a',
    garm: 'trench',
    minitag: '棉 100%',
  },
  { id: 2, name: '月白法式衬衫 · 微泡纱免烫', price: 149, ph: 'b', garm: 'shirt', minitag: '免烫' },
  { id: 3, name: '雾蓝伞形半身裙 · 高腰过膝', price: 179, ph: 'c', garm: 'skirt', minitag: '显瘦' },
  {
    id: 4,
    name: '燕麦圆领针织衫 · 细密罗纹',
    price: 189,
    ph: 'b',
    garm: 'sweater',
    minitag: '软糯',
  },
  { id: 5, name: '陶白条纹 T 恤 · 有机棉', price: 99, ph: 'a', garm: 'tshirt', minitag: '有机棉' },
  {
    id: 6,
    name: '焦糖色托特包 · 头层牛皮',
    price: 259,
    ph: 'c',
    garm: 'tote',
    minitag: '头层牛皮',
  },
]

/** 底部 Tabbar（首页 / 分类 / 购物袋 / 我的） */
export const MALL_TABS: ReadonlyArray<MallTab> = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'grid', label: '分类', icon: 'grid' },
  { key: 'bag', label: '购物袋', icon: 'bag' },
  { key: 'user', label: '我的', icon: 'user' },
]
