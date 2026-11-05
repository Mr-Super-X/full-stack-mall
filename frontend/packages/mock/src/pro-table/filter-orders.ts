/**
 * 服务端筛选 demo —— 订单 mock（v3.5 PR2 新增）
 *
 * 演示能力：
 * - filterParamsAdapter 把全表筛选快照序列化为后端约定的 { statusList, deptList, dateRange, amountRange } 形态
 * - requestApi 接收筛选参数 + 状态枚举筛选 + 部门多选 + 日期范围 + 金额范围
 * - orderNo / customer 关键字搜索（ProTableSearchFilter search+filter 组合 demo 复用）
 *
 * 数据范围：12 行订单，覆盖 3 种状态 / 4 个部门 / 多种金额 + 日期。
 */
import type { ProTableRequestApi, ProTableResponse } from '@vv/shared'

export interface Order {
  id: string
  orderNo: string
  customer: string
  amount: number
  /** 订单创建日期（ISO yyyy-mm-dd） */
  createDate: string
  /** 部门：tech / marketing / finance / operations */
  dept: 'tech' | 'marketing' | 'finance' | 'operations'
  status: 'pending' | 'paid' | 'shipped' | 'refunded'
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNo: 'FO-20260101',
    customer: '杭州星辰科技',
    amount: 12800,
    createDate: '2026-01-15',
    dept: 'tech',
    status: 'paid',
  },
  {
    id: '2',
    orderNo: 'FO-20260201',
    customer: '上海云帆贸易',
    amount: 8600,
    createDate: '2026-02-08',
    dept: 'marketing',
    status: 'shipped',
  },
  {
    id: '3',
    orderNo: 'FO-20260301',
    customer: '北京远山文创',
    amount: 23900,
    createDate: '2026-03-22',
    dept: 'tech',
    status: 'pending',
  },
  {
    id: '4',
    orderNo: 'FO-20260401',
    customer: '深圳启明电子',
    amount: 5200,
    createDate: '2026-04-03',
    dept: 'finance',
    status: 'paid',
  },
  {
    id: '5',
    orderNo: 'FO-20260501',
    customer: '杭州星辰科技',
    amount: 31500,
    createDate: '2026-05-18',
    dept: 'tech',
    status: 'shipped',
  },
  {
    id: '6',
    orderNo: 'FO-20260601',
    customer: '成都锦城餐饮',
    amount: 4700,
    createDate: '2026-06-12',
    dept: 'operations',
    status: 'pending',
  },
  {
    id: '7',
    orderNo: 'FO-20260701',
    customer: '广州南珠服饰',
    amount: 15400,
    createDate: '2026-07-05',
    dept: 'marketing',
    status: 'refunded',
  },
  {
    id: '8',
    orderNo: 'FO-20260801',
    customer: '南京栖霞出版',
    amount: 9800,
    createDate: '2026-08-20',
    dept: 'finance',
    status: 'paid',
  },
  {
    id: '9',
    orderNo: 'FO-20260901',
    customer: '武汉长江物流',
    amount: 18300,
    createDate: '2026-09-01',
    dept: 'operations',
    status: 'shipped',
  },
  {
    id: '10',
    orderNo: 'FO-20261001',
    customer: '苏州园林设计',
    amount: 7600,
    createDate: '2026-10-10',
    dept: 'tech',
    status: 'pending',
  },
  {
    id: '11',
    orderNo: 'FO-20261101',
    customer: '重庆山城火锅',
    amount: 11200,
    createDate: '2026-11-15',
    dept: 'marketing',
    status: 'paid',
  },
  {
    id: '12',
    orderNo: 'FO-20261201',
    customer: '西安秦汉文旅',
    amount: 20500,
    createDate: '2026-12-20',
    dept: 'finance',
    status: 'shipped',
  },
]

/** 后端约定的筛选参数形态（filterParamsAdapter 序列化产物 + SearchForm 关键字搜索参数） */
export interface FilterOrdersParams {
  pageNum?: number
  pageSize?: number
  /** SearchForm 关键字：订单号模糊匹配 */
  orderNo?: string
  /** SearchForm 关键字：客户模糊匹配 */
  customer?: string
  statusList?: string[]
  deptList?: string[]
  /** ISO 日期范围 [start, end] */
  dateRange?: [string, string]
  /** 金额范围 [min, max] */
  amountRange?: [number, number]
}

export const filterOrdersRequestApi: ProTableRequestApi<Order> = async (rawParams) => {
  await new Promise((r) => setTimeout(r, 200))
  const params = rawParams as FilterOrdersParams
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 10

  let rows = [...mockOrders]

  // 关键字搜索（SearchForm）：订单号 / 客户模糊匹配
  if (params.orderNo) {
    rows = rows.filter((o) => o.orderNo.includes(params.orderNo!))
  }
  if (params.customer) {
    rows = rows.filter((o) => o.customer.includes(params.customer!))
  }

  // 状态筛选（多选）
  if (params.statusList && params.statusList.length > 0) {
    rows = rows.filter((o) => params.statusList!.includes(o.status))
  }

  // 部门筛选（多选）
  if (params.deptList && params.deptList.length > 0) {
    rows = rows.filter((o) => params.deptList!.includes(o.dept))
  }

  // 日期范围筛选（闭区间）
  if (params.dateRange && params.dateRange[0]) {
    const [start, end] = params.dateRange
    rows = rows.filter((o) => {
      if (start && o.createDate < start) return false
      if (end && o.createDate > end) return false
      return true
    })
  }

  // 金额范围筛选（闭区间）
  if (params.amountRange && (params.amountRange[0] || params.amountRange[1])) {
    const [min, max] = params.amountRange
    rows = rows.filter((o) => {
      if (min && o.amount < min) return false
      if (max && o.amount > max) return false
      return true
    })
  }

  return {
    data: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    total: rows.length,
    pageNum,
    pageSize,
  } as ProTableResponse<Order>
}

/**
 * v3.5 PR2 服务端筛选参数适配器 —— 把全表筛选快照序列化为后端约定形态。
 *
 * 业务方完全控制序列化策略：
 * - status / dept：数组 → 直接用 statusList / deptList 命名
 * - dateRange / amountRange：约定为 [start, end] / [min, max] 二元组
 * - 空数组字段过滤（不发给后端，避免无效 IN 查询）
 *
 * 与 sortParamsAdapter 对称：filterParamsAdapter 接收全表快照 Record<prop, FilterValue[]>，
 * 返回可并入 requestApi params 的 Record<string, unknown>。
 */
export const filterOrdersParamsAdapter = (
  filters: Record<string, (string | number | boolean)[]>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  if (filters.status && filters.status.length > 0) {
    result.statusList = filters.status
  }
  if (filters.dept && filters.dept.length > 0) {
    result.deptList = filters.dept
  }
  if (filters.dateRange && filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange
    if (start || end) result.dateRange = [start, end]
  }
  if (filters.amountRange && filters.amountRange.length === 2) {
    const [min, max] = filters.amountRange
    if (min || max) result.amountRange = [min, max]
  }
  return result
}
