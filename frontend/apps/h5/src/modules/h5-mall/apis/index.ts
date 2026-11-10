// h5-mall 商城 API 层（对接后端契约）。
//
// 与 packages/shared/src/api/modules/*.ts 互斥：仅本模块使用，强内聚（AGENTS.md §1.2）。
// 全部走 `request<T>()`，由 shared http.ts 拦截器链统一注入 withCredentials / 401 refresh / 缓存 / 分页适配。
// @api 别名指 @vv/shared/src/api（既定例外路径，§1.6.2）。
//
// 后端契约来源：docs/superpowers/plans/02-阶段1-商品域重构与用户鉴权.md（Task 3/5 Produces）
// 信封约定：{code,message,data}，code=200 成功；分页 {list,total,page,pageSize}。

import { request } from '@api/http'

// ────────────────────────────────────────────────────────────────────
// 类型定义（与后端 DTO 字段对齐）
// ────────────────────────────────────────────────────────────────────

/** 商品卡片（列表/首页区块通用） */
export interface MallGoodsItem {
  id: number
  name: string
  /** 该商品最低规格价（"¥xx 起"） */
  price: number
  /** 最大划线价（无折扣时为 null） */
  originPrice?: number | null
  /** 主图 URL（sort=0；无图时为 null，前端兜底 MallPh 占位块） */
  imageUrl?: string | null
  /** 角标，如 "-27%"、"本季主打" */
  tag?: string | null
  /** 卡内小标签（材质/卖点；后端字段名，对齐原型 minitag 语义） */
  sellingPoint?: string | null
  /** 前端线稿图标 key（mall-g-* 后缀，过渡期字段） */
  garm?: string | null
  sales?: number | null
  ownerType: 'PLATFORM' | 'CONSIGNMENT'
  saleMode: 'NORMAL' | 'SECKILL' | 'CROWDFUND' | 'SUBSCRIPTION'
  /** 成色：NEW/LIKE_NEW/GOOD/FAIR；寄卖商品非 NEW 时卡片显示成色角标 */
  conditionGrade: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'
}

/** 商品规格/单件 */
export interface MallProductItem {
  id: number
  size?: string | null
  color?: string | null
  conditionGrade: string
  price: number
  originPrice?: number | null
  stock: number
}

/** 商品详情（卡片字段 + 详情页专属） */
export interface MallProductDetail extends MallGoodsItem {
  categoryId: number
  /** 寄卖商品卖家 id（卖家卡片用） */
  sellerId?: number | null
  detailHtml?: string | null
  createTime: string
  /** 全部在售规格，按 price 升序 */
  items: MallProductItem[]
  /** 图片 URL 列表，按 sort 升序（首图即主图） */
  images: string[]
}

/** 首页轮播 */
export interface BannerItem {
  id: number
  title: string
  picUrl: string
  linkUrl?: string | null
  sort: number
}

/** 首页分类（一级） */
export interface CategoryItem {
  id: number
  name: string
  icon?: string | null
  sort: number
}

/** 限时甄选区块 */
export interface FlashSection {
  title: string
  items: MallGoodsItem[]
}

/** 首页聚合内容 */
export interface MallHomeContent {
  notice: string
  banners: BannerItem[]
  categories: CategoryItem[]
  flash: FlashSection
  news: MallGoodsItem[]
  recommend: MallGoodsItem[]
}

// ────────────────────────────────────────────────────────────────────
// API 函数（命名小驼峰，对象名 `${name}Api`）
// ────────────────────────────────────────────────────────────────────

/** 列表查询参数 */
export interface MallListParams {
  page: number
  pageSize: number
  keyword?: string | undefined
  categoryId?: number | undefined
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'sales_desc' | undefined
  /** 只看折扣商品（首页"限时甄选"复用列表查询用） */
  discountOnly?: boolean | undefined
}

/** 分页响应（pageAdapter 转换后的统一结构） */
export interface MallListResponse {
  list: MallGoodsItem[]
  total: number
  page: number
  pageSize: number
}

/**
 * h5-mall API 命名空间。
 *
 * 全部走 `request<T>()`；列表接口传 `usePageAdapter: true`（http.ts 自动抽 page/pageSize 注入后端查询参数）。
 * 认证接口已迁移到 shared `authApi`（统一登录接线计划 07 v2）：login/register/me/logout
 * 走 `@vv/shared` 的 /mall/auth/* 契约，h5 不再维护平行认证端点（useAuthForm 消费 userStore）。
 */
export const h5MallApi = {
  /** 首页聚合内容（公告/banner/分类/限时甄选/新品/推荐） */
  getHome: () => request<MallHomeContent>({ url: '/mall/home/content', method: 'get' }),

  /** 商品分页列表（关键词/分类/排序/折扣筛选） */
  getList: (params: MallListParams) =>
    request<MallListResponse>({
      url: '/mall/product/list',
      method: 'get',
      params,
      usePageAdapter: true,
    }),

  /** 商品详情（含规格与图片列表） */
  getDetail: (id: number) => request<MallProductDetail>({ url: `/mall/product/${id}`, method: 'get' }),
}

// ────────────────────────────────────────────────────────────────────
// 订单域（买家视角我的订单；卖家售出订单 Task 3 复用 MallOrder/ORDER_STATUS_TEXT）
// 实现见 ./orders.ts——本文件作为模块 API 统一出口收敛导出
// ────────────────────────────────────────────────────────────────────
export { h5OrderApi, ORDER_STATUS_TEXT } from './orders'
export type { MallOrder, MallOrderItem, MallOrderAddress } from './orders'

// ────────────────────────────────────────────────────────────────────
// 卖家工作台域（我的寄卖 + 接受定价 + 售出订单发货）
// 实现见 ./seller.ts——本文件作为模块 API 统一出口收敛导出
// ────────────────────────────────────────────────────────────────────
export { h5SellerApi, CONSIGNMENT_STATUS_TEXT } from './seller'
export type { MallConsignment } from './seller'

// ────────────────────────────────────────────────────────────────────
// 购物车与结算域（购物袋 + 地址；下单/支付在 orders.ts）
// 实现见 ./cart.ts / ./address.ts
// ────────────────────────────────────────────────────────────────────
export { h5CartApi } from './cart'
export type { MallCartItem } from './cart'
export { h5AddressApi } from './address'
export type { MallAddress, MallAddressPayload } from './address'
