// 秒杀场次管理页 API 层（对接后端 /mall/admin/seckill-activities/*）。
// 字段与后端 SeckillActivityAdminDTO/SeckillCandidateDTO 对齐；
// 守卫：路由 meta permissions=['mall:admin']。

import { request } from '@api/http'

export interface AdminSeckillActivity {
  id: number
  productId: number
  productTitle: string | null
  seckillPrice: number
  seckillStock: number
  soldCount: number
  startTime: string
  endTime: string
  limitPerUser: number
  status: string
}

/** 新建 dialog 候选商品（单 SKU 自营有库存） */
export interface AdminSeckillCandidate {
  productId: number
  title: string
  itemId: number
  stock: number
  price: number
}

export interface AdminSeckillPage {
  list: AdminSeckillActivity[]
  total: number
  page: number
  pageSize: number
}

export interface AdminSeckillCreatePayload {
  productId: number
  seckillPrice: number
  seckillStock: number
  startTime: string
  endTime: string
  limitPerUser: number
}

export const adminSeckillApi = {
  /** 场次分页（status 可空=全部；exactOptionalPropertyTypes 下显式接受 undefined） */
  page: (params: { status?: string | undefined, page: number, pageSize: number }) =>
    request<AdminSeckillPage>({ url: '/mall/admin/seckill-activities', method: 'get', params }),

  /** 候选商品（新建 dialog 下拉） */
  candidates: () =>
    request<AdminSeckillCandidate[]>({ url: '/mall/admin/seckill-activities/products', method: 'get' }),

  /** 创建：后端事务划拨库存并落 PENDING */
  create: (data: AdminSeckillCreatePayload) =>
    request<AdminSeckillActivity>({ url: '/mall/admin/seckill-activities', method: 'post', data }),

  /** 取消（仅 PENDING，归还划拨库存） */
  cancel: (id: number) =>
    request<void>({ url: `/mall/admin/seckill-activities/${id}/cancel`, method: 'post' }),
}
