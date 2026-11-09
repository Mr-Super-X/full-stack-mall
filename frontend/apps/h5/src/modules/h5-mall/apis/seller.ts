// h5-mall 卖家工作台 API 层（我的寄卖 + 接受定价 + 售出订单发货）。
//
// 后端契约：backend ConsignmentController（/mall/consignments）+ OrderController（/mall/orders/sold、/ship）。
// 字段与 ConsignmentDTO 一一对齐；信封约定 {code,message,data}，code=200 成功。
//
// 注意（计划偏差裁决，沿用 ledger Task 2 Ruling）：
// - POST /mall/orders/{id}/ship 后端返回 Result<Void>（非 OrderDTO），
//   前端 ship 类型对齐为 Promise<void>；成功后由 composable 自行 reload 对齐真态。
// - POST /mall/consignments/{id}/accept 后端返回 Result<ConsignmentDTO>（与计划一致）。

import { request } from '@api/http'
import type { MallOrder } from './orders'

// ────────────────────────────────────────────────────────────────────
// 类型定义（与后端 ConsignmentDTO 字段对齐）
// ────────────────────────────────────────────────────────────────────

/** 寄卖单（与后端 ConsignmentDTO 对齐；images 已由后端从 JSON 列解析为数组） */
export interface MallConsignment {
  id: number
  brand: string
  title: string
  categoryId: number
  conditionGrade: string
  size: string | null
  images: string[]
  description: string | null
  expectedPrice: number | null
  platformPrice: number | null
  commissionRate: number | null
  status: string
  rejectReason: string | null
  listedProductId: number | null
  createTime: string
}

/** 寄卖状态中文映射（SUBMITTED/PRICED/LISTED/SOLD/SETTLED/REJECTED） */
export const CONSIGNMENT_STATUS_TEXT: Readonly<Record<string, string>> = {
  SUBMITTED: '审核中',
  PRICED: '已定价',
  LISTED: '已上架',
  SOLD: '已售出',
  SETTLED: '已结算',
  REJECTED: '已驳回',
}

// ────────────────────────────────────────────────────────────────────
// API 函数
// ────────────────────────────────────────────────────────────────────

/**
 * h5-mall 卖家工作台 API 命名空间。
 *
 * @group 业务 API：h5-mall 卖家工作台
 */
export const h5SellerApi = {
  /** 我的寄卖列表（当前用户提交的全部寄卖单） */
  myConsignments: () => request<MallConsignment[]>({ url: '/mall/consignments/mine', method: 'get' }),

  /** 接受平台定价（PRICED→LISTED，铸造商品上架，不可撤销）；非 PRICED 状态后端 400 上抛 */
  accept: (id: number) =>
    request<MallConsignment>({ url: `/mall/consignments/${id}/accept`, method: 'post' }),

  /** 售出订单列表（卖家视角，订单明细含 sellerId 快照） */
  soldOrders: () => request<MallOrder[]>({ url: '/mall/orders/sold', method: 'get' }),

  /** 发货（PAID→SHIPPED，寄卖件卖家发货）；非 PAID 状态后端 400 上抛 */
  ship: (orderId: number) => request<void>({ url: `/mall/orders/${orderId}/ship`, method: 'post' }),
}
