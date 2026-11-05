/**
 * ProTable SearchForm 架构升级 demo 私有 mock（configs 层）
 *
 * 角色：为 ProTableSearchAdvanced.vue 提供「4 档布局 + 多筛选维度」的真实业务级 mock 数据。
 * 字段命名贴近电商订单场景，演示 v3.3 新引入的 layoutMode 4 档自适应（flat / collapse /
 * flat-large / drawer）+ v3.2 已有的 searchDisplay 联动 / 防抖 / 高级筛选。
 *
 * @group Demo API
 */

import type { ProColumn, EnumProps } from '@vv/ui/components/ProTable/index.ts'

/** 订单行模型 —— 故意覆盖 5+ 搜索维度，便于验证 v3.2 高级筛选 / 联动 / 防抖 */
export interface OrderRow extends Record<string, unknown> {
  id: number
  orderNo: string
  userName: string
  /** 订单状态：触发 searchDisplay 联动（refundReason / deliveryDate） */
  status: 'paid' | 'shipped' | 'refunded' | 'pending'
  amount: number
  region: 'north' | 'south' | 'east' | 'west' | 'central'
  category: 'electronics' | 'clothing' | 'food' | 'books' | 'home'
  /** 退款原因：仅 status=refunded 时通过 searchDisplay 联动显示 */
  refundReason: 'damaged' | 'not_as_described' | 'changed_mind' | ''
  /** 发货日期：仅 status=shipped 时通过 searchDisplay 联动显示 */
  deliveryDate: string
  createdAt: string
  /** 评分：1-5 整数，演示 input-number 控件 */
  rating: number
  /** 备注：长文本输入演示 */
  remark: string
}

/* ─────────── 共享枚举常量（v3.3 重构：避免 4 套 columns 重复定义） ─────────── */

/**
 * 注意：不能用 `as const`，因为 ProColumn.enum 类型是 `EnumProps[]`（可变数组）。
 * `as const` 会把元素 readonly，导致与 EnumProps 不兼容（TS4104）。
 * 故此处保持 mutable 数组形态，仅显式标注 `EnumProps` 类型即可。
 */
const STATUS_ENUM: EnumProps[] = [
  { label: '已支付', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已退款', value: 'refunded' },
  { label: '待处理', value: 'pending' },
]
const REGION_ENUM: EnumProps[] = [
  { label: '华北', value: 'north' },
  { label: '华南', value: 'south' },
  { label: '华东', value: 'east' },
  { label: '华西', value: 'west' },
  { label: '华中', value: 'central' },
]
const CATEGORY_ENUM: EnumProps[] = [
  { label: '电子产品', value: 'electronics' },
  { label: '服装', value: 'clothing' },
  { label: '食品', value: 'food' },
  { label: '图书', value: 'books' },
  { label: '家居', value: 'home' },
]
const REFUND_REASON_ENUM: EnumProps[] = [
  { label: '商品损坏', value: 'damaged' },
  { label: '与描述不符', value: 'not_as_described' },
  { label: '改变主意', value: 'changed_mind' },
]

/* ─────────── 全量订单数据 + requestApi ─────────── */

/** 全量订单数据 —— 50 行 */
const ALL_ORDERS: OrderRow[] = Array.from({ length: 50 }, (_, i) => {
  const statuses: OrderRow['status'][] = ['paid', 'shipped', 'refunded', 'pending']
  const regions: OrderRow['region'][] = ['north', 'south', 'east', 'west', 'central']
  const categories: OrderRow['category'][] = ['electronics', 'clothing', 'food', 'books', 'home']
  return {
    id: i + 1,
    orderNo: `ORD-${String(i + 1).padStart(5, '0')}`,
    userName: `用户-${(i % 20) + 1}`,
    status: statuses[i % 4]!,
    amount: 999.5 + i * 137.5,
    region: regions[i % 5]!,
    category: categories[i % 5]!,
    refundReason:
      i % 4 === 2 ? (['damaged', 'not_as_described', 'changed_mind'] as const)[i % 3]! : '',
    deliveryDate: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    createdAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')} 1${i % 10}:2${i % 6}:0${i % 10}`,
    rating: (i % 5) + 1,
    remark: i % 3 === 0 ? '特殊备注' : '',
  }
})

/**
 * 订单搜索 requestApi —— 500ms 延迟；按 10 个搜索字段过滤
 *
 * 接收任意 params（来自 useSearch.serializeParams 后），按需匹配 ALL_ORDERS。
 * 兼容 v3.3 新增的 4 档矩阵 demo —— 每档只传子集字段，未传字段不会进入 filter 链路。
 */
export async function orderRequestApi(params: Record<string, unknown>) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const {
    orderNo,
    userName,
    status,
    amount,
    region,
    category,
    refundReason,
    deliveryDate,
    rating,
    remark,
    minAmount,
    maxAmount,
    pageNum = 1,
    pageSize = 10,
  } = params

  let filtered = ALL_ORDERS
  if (typeof orderNo === 'string' && orderNo) {
    filtered = filtered.filter((r) => r.orderNo.toLowerCase().includes(orderNo.toLowerCase()))
  }
  if (typeof userName === 'string' && userName) {
    filtered = filtered.filter((r) => r.userName.includes(userName))
  }
  if (status) {
    filtered = filtered.filter((r) => r.status === status)
  }
  if (typeof amount === 'string' && amount) {
    // amount 演示 number 过滤（v3.2 无 range 控件，简化为精确匹配或模糊）
    filtered = filtered.filter((r) => String(r.amount).includes(amount))
  }
  if (region) {
    filtered = filtered.filter((r) => r.region === region)
  }
  if (category) {
    filtered = filtered.filter((r) => r.category === category)
  }
  if (refundReason) {
    filtered = filtered.filter((r) => r.refundReason === refundReason)
  }
  if (deliveryDate) {
    filtered = filtered.filter((r) => r.deliveryDate === deliveryDate)
  }
  if (rating !== undefined && rating !== null && rating !== '') {
    filtered = filtered.filter((r) => r.rating === Number(rating))
  }
  if (typeof remark === 'string' && remark) {
    filtered = filtered.filter((r) => r.remark.includes(remark))
  }
  // v3.3 新增：minAmount / maxAmount 范围过滤
  if (minAmount !== undefined && minAmount !== null && minAmount !== '') {
    filtered = filtered.filter((r) => r.amount >= Number(minAmount))
  }
  if (maxAmount !== undefined && maxAmount !== null && maxAmount !== '') {
    filtered = filtered.filter((r) => r.amount <= Number(maxAmount))
  }

  const start = (Number(pageNum) - 1) * Number(pageSize)
  return {
    data: filtered.slice(start, start + Number(pageSize)),
    total: filtered.length,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  }
}

/* ─────────── v3.3 新增：4 档布局矩阵 columns ─────────── */

/**
 * v3.3 flat 档演示 columns —— 3 个 basic，无 advanced
 *
 * 触发条件：basic ≤ 3（且无 advanced）。SearchForm 内 layoutMode === 'flat'，
 * 主表单全部平铺，**无任何按钮**（无展开/收起、无高级筛选）。
 */
export const flatModeColumns: ProColumn<OrderRow>[] = [
  { prop: 'orderNo', label: '订单号', search: { el: 'input' } },
  { prop: 'userName', label: '用户名', search: { el: 'input' } },
  { prop: 'status', label: '订单状态', enum: STATUS_ENUM, search: { el: 'select' } },
]

/**
 * v3.3 collapse 档演示 columns —— 6 个 basic，无 advanced
 *
 * 触发条件：basic > 3 且 <= 8（且无 advanced）。layoutMode === 'collapse'，
 * 默认折叠显示前 4 个字段，点「展开」按钮显示全部。**无抽屉按钮**。
 */
export const collapseModeColumns: ProColumn<OrderRow>[] = [
  { prop: 'orderNo', label: '订单号', search: { el: 'input' } },
  { prop: 'userName', label: '用户名', search: { el: 'input' } },
  { prop: 'status', label: '订单状态', enum: STATUS_ENUM, search: { el: 'select' } },
  { prop: 'region', label: '地区', enum: REGION_ENUM, search: { el: 'select' } },
  { prop: 'amount', label: '金额', search: { el: 'input' } },
  { prop: 'category', label: '类目', enum: CATEGORY_ENUM, search: { el: 'select' } },
]

/**
 * v3.3 flat-large 档演示 columns —— 10 个 basic，无 advanced
 *
 * 触发条件：basic > 8（且无 advanced）。layoutMode === 'flat-large'，
 * 全部 10 个字段 inline 平铺，**无任何按钮**（折叠按钮被禁用，因为「展开 8+ 字段会
 * 严重摧毁表格可视高度」，改走抽屉；无 advanced 时也走 inline flat，不显示抽屉按钮）。
 */
export const flatLargeModeColumns: ProColumn<OrderRow>[] = [
  { prop: 'orderNo', label: '订单号', search: { el: 'input' } },
  { prop: 'userName', label: '用户名', search: { el: 'input' } },
  { prop: 'status', label: '订单状态', enum: STATUS_ENUM, search: { el: 'select' } },
  { prop: 'region', label: '地区', enum: REGION_ENUM, search: { el: 'select' } },
  { prop: 'amount', label: '金额', search: { el: 'input' } },
  { prop: 'category', label: '类目', enum: CATEGORY_ENUM, search: { el: 'select' } },
  { prop: 'minAmount', label: '最低金额', search: { el: 'input-number' } },
  { prop: 'maxAmount', label: '最高金额', search: { el: 'input-number' } },
  { prop: 'deliveryDate', label: '发货日期', search: { el: 'date-picker' } },
  { prop: 'refundReason', label: '退款原因', enum: REFUND_REASON_ENUM, search: { el: 'select' } },
]

/**
 * v3.2.2 演示 columns —— 13 个搜索字段（8 basic + 5 advanced）
 *
 * 触发条件：任意 advanced 字段 → layoutMode === 'drawer'。
 * 分布：
 * - 基础字段（8 个）：orderNo / userName / status / region / amount / category / minAmount / maxAmount
 * - 高级字段（5 个）：refundReason / deliveryDate / rating / remark / createdAt
 * - 联动字段（2 个）：refundReason / deliveryDate 受 status 控制显隐
 */
export const v32SearchColumns: ProColumn<OrderRow>[] = [
  // ──────────── 基础字段 ────────────
  {
    prop: 'orderNo',
    label: '订单号',
    search: { el: 'input', debounce: 300 }, // 字段级防抖
  },
  { prop: 'userName', label: '用户名', search: { el: 'input' } },
  {
    prop: 'status',
    label: '订单状态',
    enum: STATUS_ENUM,
    search: { el: 'select' },
  },
  { prop: 'region', label: '地区', enum: REGION_ENUM, search: { el: 'select' } },
  { prop: 'amount', label: '金额', search: { el: 'input' } },
  { prop: 'category', label: '类目', enum: CATEGORY_ENUM, search: { el: 'select' } },
  { prop: 'minAmount', label: '最低金额', search: { el: 'input-number' } },
  { prop: 'maxAmount', label: '最高金额', search: { el: 'input-number' } },
  // ──────────── 高级筛选字段（Drawer）────────────
  {
    prop: 'refundReason',
    label: '退款原因',
    enum: REFUND_REASON_ENUM,
    search: { el: 'select', level: 'advanced' },
  },
  { prop: 'deliveryDate', label: '发货日期', search: { el: 'date-picker', level: 'advanced' } },
  { prop: 'rating', label: '评分', search: { el: 'input-number', level: 'advanced' } },
  { prop: 'remark', label: '备注', search: { el: 'input', level: 'advanced' } },
  { prop: 'createdAt', label: '创建时间', search: { el: 'date-picker', level: 'advanced' } },
]

/**
 * v3.2 searchDisplay 联动函数
 * - 订单状态 = 已退款 → 显示「退款原因」
 * - 订单状态 = 已发货 → 显示「发货日期」
 * - 其他状态 → 两者都隐藏
 */
export const v32SearchDisplay = (params: Record<string, unknown>): Record<string, boolean> => {
  const result: Record<string, boolean> = {}
  result.refundReason = params.status === 'refunded'
  result.deliveryDate = params.status === 'shipped'
  return result
}

// ─────────── 业务友好别名（demo 用，不暴露内部版本号） ───────────
export { v32SearchColumns as advancedSearchColumns, v32SearchDisplay as advancedSearchDisplay }
