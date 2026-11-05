// H5Mall 模块的 API 层（模块内强内聚版本）。
//
// 与 packages/shared/src/api/modules/h5-mall.ts 互斥：
//   - 仅本模块使用（强内聚）→ 放本目录（脚手架默认）
//   - 跨模块共享            → 迁到 packages/shared/src/api/modules/h5-mall.ts
//
// 自动应用 http.ts 基建：401 refresh、retry、cache、abort、pageAdapter 等。
// @api 别名指 @vv/shared/src/api（sanctioned 既定路径，§1.6.2——api 不聚合 barrel）；
// '@/api' 是单应用时代残留（app src 已无 api 目录），2026-10-27 注释审计修复

import { request } from '@api/http'

/** 业务实体类型定义（按需扩展） */
export interface H5MallItem {
  id: number
  name: string
  // createdAt?: string
  // status?: 'active' | 'inactive'
}

/** 列表查询参数 */
export interface H5MallListParams {
  page: number
  pageSize: number
  keyword?: string
}

/** 分页响应（pageAdapter 转换后的统一结构） */
export interface H5MallListResponse {
  list: H5MallItem[]
  total: number
}

/**
 * h5-mall API 命名空间。
 *
 * 命名约定：函数名小驼峰，对象名 `${name}Api`（与项目 packages/shared/src/api/modules/*.ts 风格一致）。
 * 全部走 `request<T>()`，由 http.ts 拦截器链统一注入 token / 401 retry / 缓存 / 分页适配等。
 */
export const h5MallApi = {
  /** 列表查询（自动分页转换 + GET 缓存 + 401 自动 refresh 重试） */
  getList: (params: H5MallListParams) =>
    request<H5MallListResponse>({
      url: '/h5-mall/list',
      method: 'get',
      params,
      usePageAdapter: true,
    }),

  // 示例：详情 / 创建 / 更新 / 删除（按需启用）
  // getById: (id: number) =>
  //   request<H5MallItem>({ url: `/${'h5-mall'}/${id}`, method: 'get' }),
  //
  // create: (payload: Omit<H5MallItem, 'id'>) =>
  //   request<H5MallItem>({ url: '/h5-mall', method: 'post', data: payload }),
  //
  // update: (id: number, payload: Partial<H5MallItem>) =>
  //   request<H5MallItem>({ url: `/${'h5-mall'}/${id}`, method: 'put', data: payload }),
  //
  // remove: (id: number) =>
  //   request<void>({ url: `/${'h5-mall'}/${id}`, method: 'delete' }),
}
