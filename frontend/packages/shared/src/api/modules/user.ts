/**
 * 用户 API（CRUD）。
 *
 * 设计要点：
 * - 标准 RESTful 风格：GET/POST/PUT/DELETE 对应查/增/改/删
 * - 列表用 `Pagination<UserItem>` 通用分页结构（`src/api/types/api.d`）
 * - 业务侧调用前确认权限（http.ts 拦截器层 + 后端鉴权）
 *
 * @see [`src/modules/user/views/List.vue`](../../modules/user/views/List.vue) 业务调用示例
 * @group 业务 API：用户
 */

import { request } from '../http'
import type { Pagination } from '../types/api.d'

export interface UserItem {
  id: number
  name: string
  email: string
  role: string
  createdAt: string
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export const userApi = {
  /**
   * 分页查询用户列表。
   * @group 业务 API：用户
   */
  getList: (params: UserListParams) =>
    request<Pagination<UserItem>>({ url: '/user/list', method: 'get', params }),

  /**
   * 按 ID 查询单个用户。
   * @group 业务 API：用户
   */
  getById: (id: number) => request<UserItem>({ url: `/user/${id}`, method: 'get' }),

  /**
   * 创建用户（不含 id/createdAt 字段）。
   * @group 业务 API：用户
   */
  create: (data: Omit<UserItem, 'id' | 'createdAt'>) =>
    request<UserItem>({ url: '/user', method: 'post', data }),

  /**
   * 更新用户（部分字段）。
   * @group 业务 API：用户
   */
  update: (id: number, data: Partial<UserItem>) =>
    request<UserItem>({ url: `/user/${id}`, method: 'put', data }),

  /**
   * 删除用户。
   * @group 业务 API：用户
   */
  remove: (id: number) => request<void>({ url: `/user/${id}`, method: 'delete' }),
}
