// h5-mall 订单 API 层（买家视角：我的订单列表 / 详情 / 确认收货）。
//
// 后端契约：backend OrderController（/mall/orders），字段与 OrderDTO/OrderItemDTO 一一对齐。
// 信封约定：{code,message,data}，code=200 成功。
//
// 注意（计划偏差裁决，ledger Task 2 Ruling）：
// - POST /mall/orders/{id}/confirm 后端返回 Result<Void>（非 OrderDTO），
//   前端 confirm 类型对齐为 Promise<void>；成功后由 composable 自行 reload 对齐真态。
// - 重复 confirm/ship 后端返回 400（ORDER_STATE_ILLEGAL），错误穿透供视图 toast + reload。

import { request } from '@api/http'

// ────────────────────────────────────────────────────────────────────
// 类型定义（与后端 OrderDTO/OrderItemDTO/AddressSnapshotDTO 字段对齐）
// ────────────────────────────────────────────────────────────────────

/** 订单明细（snapshot 定格下单瞬间；与后端 OrderItemDTO 对齐） */
export interface MallOrderItem {
  productItemId: number
  price: number
  quantity: number
  sellerId: number | null
  /** 快照字段 */
  title: string
  imageUrl: string | null
  conditionGrade: string
  size: string | null
  color: string | null
  brand: string | null
  ownerType: string
}

/** 地址快照（下单瞬间定格；与后端 AddressSnapshotDTO 对齐） */
export interface MallOrderAddress {
  receiverName: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
}

/** 订单（与后端 OrderDTO 对齐） */
export interface MallOrder {
  id: number
  orderNo: string
  type: string
  status: string
  payAmount: number
  expiredAt: string | null
  createTime: string
  paymentNo: string | null
  items: MallOrderItem[]
  address: MallOrderAddress | null
}

/** 订单状态中文映射（PENDING/PAID/SHIPPED/COMPLETED/CANCELLED）——Task 3 售出订单复用 */
export const ORDER_STATUS_TEXT: Readonly<Record<string, string>> = {
  PENDING: '待付款',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

// ────────────────────────────────────────────────────────────────────
// API 函数
// ────────────────────────────────────────────────────────────────────

/**
 * h5-mall 订单 API 命名空间（买家视角）。
 *
 * @group 业务 API：h5-mall 订单
 */
export const h5OrderApi = {
  /** 我的订单列表（后端支持 ?status= 过滤；当前全量返回前端按需渲染） */
  list: () => request<MallOrder[]>({ url: '/mall/orders', method: 'get' }),

  /** 订单详情 */
  detail: (id: number) => request<MallOrder>({ url: `/mall/orders/${id}`, method: 'get' }),

  /** 确认收货（SHIPPED→COMPLETED + 生成 Payout）；重复调用后端 400 上抛 */
  confirm: (id: number) => request<void>({ url: `/mall/orders/${id}/confirm`, method: 'post' }),
}
