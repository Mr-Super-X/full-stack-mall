// h5-mall 购物车 API 层（后端 /mall/cart，全部需登录）。
//
// 业务规则（后端 CartServiceImpl 约束，前端按此分流）：
// - 仅自营商品（ownerType=PLATFORM）可入购物车；寄卖件加购后端抛 CONSIGNMENT_DIRECT_ONLY，
//   前端在商品卡/详情页直接分流：寄卖件引导走详情页「立即购买」（DIRECT 通道）
// - 同一用户同一规格 uk 唯一行，重复加购后端叠加数量（前端无感）

import { request } from '@api/http'

/** 购物车条目（CartItemDTO：行信息 + 实时商品信息 + invalid 失效标记） */
export interface MallCartItem {
  id: number
  productItemId: number
  quantity: number
  checked: boolean
  /** 实时商品信息（下单前最后一次确认价） */
  productName: string
  imageUrl: string | null
  price: number
  stock: number
  conditionGrade: string | null
  /** 失效标记：下架或缺货（不可勾选结算） */
  invalid?: boolean
}

/** 加购入参（AddCartItemRequest 对齐） */
export interface MallCartAddPayload {
  productItemId: number
  quantity: number
}

/**
 * h5-mall 购物车 API 命名空间。
 *
 * @group 业务 API：h5-mall 购物车
 */
export const h5CartApi = {
  /** 本人购物车列表 */
  list: () => request<MallCartItem[]>({ url: '/mall/cart', method: 'get' }),

  /** 加购（仅自营；寄卖件后端 400 CONSIGNMENT_DIRECT_ONLY）。端点为 /items 子路径 */
  add: (data: MallCartAddPayload) =>
    request<MallCartItem>({ url: '/mall/cart/items', method: 'post', data }),

  /** 改数量 / 勾选（UpdateCartItemRequest：quantity 与 checked 至少其一；后端用 PATCH） */
  update: (id: number, data: { quantity?: number; checked?: boolean }) =>
    request<MallCartItem>({ url: `/mall/cart/items/${id}`, method: 'patch', data }),

  /** 删除条目 */
  remove: (id: number) => request<void>({ url: `/mall/cart/items/${id}`, method: 'delete' }),
}
