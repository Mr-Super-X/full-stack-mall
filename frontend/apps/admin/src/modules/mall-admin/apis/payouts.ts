// 结算审批页 API 层（对接后端 /mall/admin/payouts/*）。
// 字段与后端 PayoutDTO 一一对齐；三步状态机 PENDING→CONFIRMED→PAID（后端条件迁移）。

import { request } from '@api/http'

export interface AdminPayoutItem {
  id: number
  sellerId: number
  orderItemId: number
  sellerAmount: number
  commission: number
  status: string
  createTime: string
}

export const adminPayoutApi = {
  /** 结算单列表（按状态筛选；后端返回纯列表非分页） */
  list: (status: string) =>
    request<AdminPayoutItem[]>({ url: '/mall/admin/payouts', method: 'get', params: { status } }),

  /** 初审：PENDING → CONFIRMED */
  confirm: (id: number) =>
    request<AdminPayoutItem>({ url: `/mall/admin/payouts/${id}/confirm`, method: 'post' }),

  /** 打款：CONFIRMED → PAID（联动寄卖单 SOLD→SETTLED） */
  pay: (id: number) =>
    request<AdminPayoutItem>({ url: `/mall/admin/payouts/${id}/pay`, method: 'post' }),
}
