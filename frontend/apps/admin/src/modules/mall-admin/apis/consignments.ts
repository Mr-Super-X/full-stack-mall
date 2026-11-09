// 寄卖审核队列页 API 层（对接后端 /mall/admin/consignments/*）。
// 字段与后端 ConsignmentDTO 一一对齐；守卫已放行（Task 1 统一登录 + meta permissions=['mall:admin']）。

import { request } from '@api/http'

export interface AdminConsignmentItem {
  id: number
  brand: string | null
  title: string
  categoryId: number | null
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

export interface ReviewPayload {
  approve: boolean
  platformPrice?: number
  commissionRate?: number
  rejectReason?: string
}

export const adminConsignmentApi = {
  /** 寄卖单列表（按状态筛选；后端返回纯列表非分页） */
  list: (status: string) =>
    request<AdminConsignmentItem[]>({ url: '/mall/admin/consignments', method: 'get', params: { status } }),

  /** 审核：approve=true 附平台定价+佣金率；approve=false 附驳回原因 */
  review: (id: number, data: ReviewPayload) =>
    request<AdminConsignmentItem>({ url: `/mall/admin/consignments/${id}/review`, method: 'post', data }),
}
