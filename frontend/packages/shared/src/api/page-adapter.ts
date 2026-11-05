import type { Pagination } from './types/api.d'

/**
 * 入参字段映射配置：项目侧语义字段 → 后端字段名。
 * 不指定则使用默认（v2 后端约定）。
 *
 * 设计要点：page-adapter 可被任意分页约定复用，零改源码。
 * 业务模块只传 `usePageAdapter: true` 即可，无需关心字段映射。
 *
 * @see [`src/api/http.ts`](./http.ts) `usePageAdapter` config 字段触发点
 * @group 网络基建：分页适配
 */
export interface PageQueryFieldMap {
  /** 后端"当前页"字段名，默认 'pageIndex' */
  pageField?: string
  /** 后端"每页大小"字段名，默认 'pageSize' */
  pageSizeField?: string
}

/**
 * 响应字段映射配置：项目侧语义字段 → 后端字段名。
 */
export interface PageResponseFieldMap {
  /** 后端"数据列表"字段名，默认 'records' */
  listField?: string
  /** 后端"当前页"字段名，默认 'current' */
  pageField?: string
  /** 后端"每页大小"字段名，默认 'size' */
  pageSizeField?: string
  /** 后端"总记录数"字段名，默认 'total' */
  totalField?: string
}

/**
 * 项目侧分页入参（与 Pagination<T> 同名字段，复用约定）。
 */
export interface ProjectPageQuery {
  page?: number
  pageSize?: number
}

// ────────────────────────────────────────────────────────────────────
// 模块级全局配置（默认 v2 后端约定；通过 configurePaginationAdapter 覆盖）
// ────────────────────────────────────────────────────────────────────

/** v2 后端默认字段映射（可被 configurePaginationAdapter 覆盖） */
const DEFAULT_QUERY_FIELDS = {
  pageField: 'pageIndex',
  pageSizeField: 'pageSize',
} as const

const DEFAULT_RESPONSE_FIELDS = {
  listField: 'records',
  pageField: 'current',
  pageSizeField: 'size',
  totalField: 'total',
} as const

/**
 * 当前生效的字段映射（对象引用稳定，configurePaginationAdapter 修改其属性即可生效）。
 * http.ts 请求拦截器读取 _getRequestFieldMap() 获取最新值。
 */
const currentAdapter: {
  request: Required<PageQueryFieldMap>
  response: Required<PageResponseFieldMap>
} = {
  request: { ...DEFAULT_QUERY_FIELDS },
  response: { ...DEFAULT_RESPONSE_FIELDS },
}

/**
 * 一次性配置分页适配器（应用启动时调用，其他场景无需关心）。
 *
 * 不传任何参数时使用 v2 后端默认值（默认行为）；只有后端字段名不同时才需要配置。
 *
 * @example 默认（当前 v2 后端，无需调用）
 * ```ts
 * // 不调用此函数，request<T> 配置 usePageAdapter:true 即可自动转换
 * ```
 *
 * @example 团队 B 后端字段名不同
 * ```ts
 * // main.ts
 * import { configurePaginationAdapter } from '@api/page-adapter'
 *
 * configurePaginationAdapter({
 *   request: { pageField: 'p', pageSizeField: 'limit' },
 *   response: { listField: 'items', pageField: 'page_num' },
 * })
 * ```
 */
export function configurePaginationAdapter(map: {
  request?: PageQueryFieldMap
  response?: PageResponseFieldMap
}): void {
  if (map.request) {
    currentAdapter.request = { ...DEFAULT_QUERY_FIELDS, ...map.request }
  }
  if (map.response) {
    currentAdapter.response = { ...DEFAULT_RESPONSE_FIELDS, ...map.response }
  }
}

// ────────────────────────────────────────────────────────────────────
// 低阶助手函数（http.ts 内部调用；业务模块通常不直接用）
// ────────────────────────────────────────────────────────────────────

/**
 * 把项目侧分页入参转换为后端入参格式。
 *
 * **业务模块通常不直接调用此函数**——通过 `usePageAdapter: true` 让 http.ts 自动调用。
 * 默认参数 `fieldMap = _getRequestFieldMap()` 会读取当前全局配置（configurePaginationAdapter 修改后的值）。
 *
 * @example 直接调用（不推荐，除非需要 per-call 自定义字段映射）
 * ```ts
 * import { buildBackendPageQuery } from '@api/page-adapter'
 *
 * // 默认读取全局配置（v2：pageIndex/pageSize）
 * const q1 = buildBackendPageQuery({ page: 1, pageSize: 20 })
 * // => { pageIndex: 1, pageSize: 20 }
 *
 * // 显式覆盖 fieldMap（per-call 自定义）
 * const q2 = buildBackendPageQuery(
 *   { page: 1, pageSize: 20 },
 *   { pageField: 'p' }
 * )
 * // => { p: 1, pageSize: 20 }
 * ```
 *
 * @example 推荐：业务模块通过 usePageAdapter 自动调用
 * ```ts
 * // 业务模块无需 import buildBackendPageQuery
 * await request<Pagination<Item>>({
 *   url: '/list',
 *   method: 'get',
 *   params: { page: 1, pageSize: 20 },
 *   usePageAdapter: true,  // ← http.ts 自动调 buildBackendPageQuery
 * })
 * ```
 */
export function buildBackendPageQuery(
  query: ProjectPageQuery,
  fieldMap: PageQueryFieldMap = _getRequestFieldMap()
): Record<string, number> {
  const fields = { ...DEFAULT_QUERY_FIELDS, ...fieldMap }
  return {
    [fields.pageField]: query.page ?? 1,
    [fields.pageSizeField]: query.pageSize ?? 10,
  }
}

/**
 * 把后端分页响应适配为项目内 Pagination<T>。
 *
 * **业务模块通常不直接调用此函数**——通过 `usePageAdapter: true` 让 http.ts 自动调用。
 * 缺失字段走默认值（空数组 / 0 / 1 / 10），确保调用方拿到有效 Pagination 对象。
 *
 * @example 直接调用（不推荐，除非需要 per-call 自定义字段映射）
 * ```ts
 * import { adaptBackendPage } from '@api/page-adapter'
 *
 * // 默认读取全局配置（v2：records/current/size/total）
 * const page1 = adaptBackendPage<Item>({
 *   records: [{ id: 1 }],
 *   current: 1,
 *   size: 10,
 *   total: 100,
 * })
 * // => { list: [{ id: 1 }], page: 1, pageSize: 10, total: 100 }
 *
 * // 显式覆盖 fieldMap
 * const page2 = adaptBackendPage<Item>(raw, {
 *   listField: 'items',
 *   pageField: 'page_num',
 * })
 * ```
 *
 * @example 推荐：业务模块通过 usePageAdapter 自动调用
 * ```ts
 * // 业务模块无需 import adaptBackendPage
 * const page = await request<Pagination<Item>>({
 *   url: '/list',
 *   method: 'get',
 *   params: { page: 1, pageSize: 20 },
 *   usePageAdapter: true,  // ← http.ts 自动调 adaptBackendPage
 * })
 * // page 类型为 Pagination<Item>，无需手动解包
 * ```
 */
export function adaptBackendPage<T>(
  raw: Record<string, unknown>,
  fieldMap: PageResponseFieldMap = _getResponseFieldMap()
): Pagination<T> {
  const fields = { ...DEFAULT_RESPONSE_FIELDS, ...fieldMap }
  return {
    list: (raw[fields.listField] as T[] | undefined) ?? [],
    total: (raw[fields.totalField] as number | undefined) ?? 0,
    page: (raw[fields.pageField] as number | undefined) ?? 1,
    pageSize: (raw[fields.pageSizeField] as number | undefined) ?? 10,
  }
}

// ────────────────────────────────────────────────────────────────────
// 内部访问器（http.ts 使用，业务模块不应调用）
// ────────────────────────────────────────────────────────────────────

/** @internal http.ts 请求拦截器读取当前请求字段映射 */
export function _getRequestFieldMap(): Required<PageQueryFieldMap> {
  return currentAdapter.request
}

/** @internal http.ts 响应处理读取当前响应字段映射 */
export function _getResponseFieldMap(): Required<PageResponseFieldMap> {
  return currentAdapter.response
}
