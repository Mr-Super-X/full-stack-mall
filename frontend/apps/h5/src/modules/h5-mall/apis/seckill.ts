// h5-mall 秒杀 API 层（买家视角：活动查询 / 秒杀直购下单）。
//
// 后端契约：backend SeckillController（/mall/seckill），字段与 SeckillActiveDTO 对齐。
// 信封约定：{code,message,data}，code=200 成功；四业务码 40001~40004 由错误通道上抛，
// 视图层 toast 后端 message。
//
// 无 mock 处理器（商城业务接口均无 mock 先例，dev 走网关真实后端，纯前端模式不演示秒杀）。

import { request } from '@api/http'

// ────────────────────────────────────────────────────────────────────
// 类型定义（与后端 SeckillActiveDTO / SeckillOrderResultDTO 对齐）
// ────────────────────────────────────────────────────────────────────

/** 秒杀活动项（live 含完整商品摘要；upcoming 仅进度与时间） */
export interface MallSeckillItem {
  activityId: number
  productId: number
  productItemId: number | null
  productTitle: string | null
  imageUrl: string | null
  seckillPrice: number
  /** 挂载 item 现价（原价，划线展示） */
  originPrice: number | null
  soldCount: number
  seckillStock: number
  startTime: string
  endTime: string
}

/** GET /mall/seckill/active 出参 */
export interface MallSeckillActive {
  live: MallSeckillItem[]
  upcoming: MallSeckillItem[]
}

/** 秒杀下单出参：同步策略 orderNo+paymentNo 齐；redis 异步策略 paymentNo=null（受理态，前端轮询出单） */
export interface MallSeckillOrderResult {
  orderNo: string
  paymentNo: string | null
}

/** 出单状态轮询出参（4b 异步受理：ACCEPTED 受理中 / CREATED 携 paymentNo / FAILED 已回补） */
export interface MallSeckillOrderStatus {
  status: 'ACCEPTED' | 'CREATED' | 'FAILED'
  paymentNo: string | null
}

// ────────────────────────────────────────────────────────────────────
// API 函数
// ────────────────────────────────────────────────────────────────────

/**
 * h5-mall 秒杀 API 命名空间（买家视角）。
 *
 * @group 业务 API：h5-mall 秒杀
 */
export const h5SeckillApi = {
  /** 进行中 + 预告场（匿名可访问） */
  active: () => request<MallSeckillActive>({ url: '/mall/seckill/active', method: 'get' }),

  /** 秒杀直购下单（登录态；四业务码 40001~40004 上抛由视图 toast；40005/40006 为 HTTP 503/429） */
  placeOrder: (activityId: number, data: { addressId: number, productItemId: number }) =>
    request<MallSeckillOrderResult>({
      url: `/mall/seckill/${activityId}/orders`,
      method: 'post',
      data,
    }),

  /** 出单状态轮询（4b 异步受理；登录态，Auth 拦截已登记 /mall/seckill/orders/**） */
  orderStatus: (orderNo: string) =>
    request<MallSeckillOrderStatus>({ url: `/mall/seckill/orders/${orderNo}`, method: 'get' }),
}
