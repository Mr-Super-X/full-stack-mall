export interface ApiResponse<T> {
  /** 业务码（成功为 BusinessCode.SUCCESS = 200，其他为业务错误码） */
  code: number
  /** 用户可见消息（toast 用） */
  message: string
  /** 接口业务数据 */
  data: T
}

export interface Pagination<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
