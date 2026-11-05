// Workbench 模块的 API 层（模块内强内聚版本）。
//
// 与 src/api/modules/workbench.ts 互斥：
//   - 仅本模块使用（强内聚）→ 放本目录（脚手架默认）
//   - 跨模块共享            → 迁到 src/api/modules/workbench.ts
//
// 自动应用 http.ts 基建：401 refresh、retry、cache、abort、pageAdapter 等。

import { request } from '@api/http'

/** 业务实体类型定义（按需扩展） */
export interface WorkbenchItem {
  id: number
  name: string
  // createdAt?: string
  // status?: 'active' | 'inactive'
}

/** 列表查询参数 */
export interface WorkbenchListParams {
  page: number
  pageSize: number
  keyword?: string
}

/** 分页响应（pageAdapter 转换后的统一结构） */
export interface WorkbenchListResponse {
  list: WorkbenchItem[]
  total: number
}

/**
 * workbench API 命名空间。
 *
 * 命名约定：函数名小驼峰，对象名 `${name}Api`（与项目 src/api/modules/*.ts 风格一致）。
 * 全部走 `request<T>()`，由 http.ts 拦截器链统一注入 token / 401 retry / 缓存 / 分页适配等。
 */
export const workbenchApi = {
  /** 列表查询（自动分页转换 + GET 缓存 + 401 自动 refresh 重试） */
  getList: (params: WorkbenchListParams) =>
    request<WorkbenchListResponse>({
      url: '/workbench/list',
      method: 'get',
      params,
      usePageAdapter: true,
    }),

  // 示例：详情 / 创建 / 更新 / 删除（按需启用）
  // getById: (id: number) =>
  //   request<WorkbenchItem>({ url: `/${'workbench'}/${id}`, method: 'get' }),
  //
  // create: (payload: Omit<WorkbenchItem, 'id'>) =>
  //   request<WorkbenchItem>({ url: '/workbench', method: 'post', data: payload }),
  //
  // update: (id: number, payload: Partial<WorkbenchItem>) =>
  //   request<WorkbenchItem>({ url: `/${'workbench'}/${id}`, method: 'put', data: payload }),
  //
  // remove: (id: number) =>
  //   request<void>({ url: `/${'workbench'}/${id}`, method: 'delete' }),
}
