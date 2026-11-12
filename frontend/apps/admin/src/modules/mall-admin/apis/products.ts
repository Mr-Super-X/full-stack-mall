// 自营商品管理 API 层（对接后端 /mall/admin/products/*）。
// 类型与后端 AdminProductDTO / AdminProductCreateRequest / AdminProductUpdateRequest 一一对齐。

import { request } from '@api/http'

export interface AdminProductItem {
  id: number
  size: string | null
  color: string | null
  conditionGrade: string
  price: number
  originPrice: number | null
  stock: number
}

export interface AdminProduct {
  id: number
  categoryId: number
  brand: string | null
  name: string
  tag: string | null
  sellingPoint: string | null
  detailHtml: string | null
  /** 1 上架 0 下架 */
  status: number
  sales: number
  items: AdminProductItem[]
  createTime: string
  updateTime: string
}

export interface AdminProductItemPayload {
  size?: string | null
  color?: string | null
  price: number
  originPrice?: number | null
  stock: number
}

export interface AdminProductCreatePayload {
  categoryId: number
  brand?: string | null
  name: string
  tag?: string | null
  sellingPoint?: string | null
  detailHtml?: string | null
  items: AdminProductItemPayload[]
  /** 可空；每项 url 必填，sort 缺省按数组顺序补位（0 为主图）。`| undefined` 对齐 exactOptionalPropertyTypes */
  images?: { url: string; sort?: number }[] | undefined
}

/** PATCH 语义：字段传 null/不传 = 不更新（后端 MP updateById 忽略 null） */
export interface AdminProductUpdatePayload {
  categoryId?: number | undefined
  brand?: string | null
  name?: string
  tag?: string | null
  sellingPoint?: string | null
  detailHtml?: string | null
  status?: number
}

export interface AdminProductPageQuery {
  /** `| undefined` 对齐 exactOptionalPropertyTypes（显式传 undefined = 不传该筛选） */
  status?: number | undefined
  keyword?: string | undefined
  page: number
  pageSize: number
}

/** 类目树节点（与后端 CategoryTreeDTO 对齐）——dialog 选择器与表格回填共用 */
export interface CategoryTreeNode {
  id: number
  parentId: number | null
  name: string
  icon?: string | null
  children?: CategoryTreeNode[]
}

export const adminProductApi = {
  page: (params: AdminProductPageQuery) =>
    request<{ list: AdminProduct[]; total: number; page: number; pageSize: number }>({
      url: '/mall/admin/products',
      method: 'get',
      params,
    }),

  create: (data: AdminProductCreatePayload) =>
    request<AdminProduct>({ url: '/mall/admin/products', method: 'post', data }),

  update: (id: number, data: AdminProductUpdatePayload) =>
    request<AdminProduct>({ url: `/mall/admin/products/${id}`, method: 'patch', data }),
}
