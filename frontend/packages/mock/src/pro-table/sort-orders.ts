/**
 * 服务端排序 demo —— 订单 mock（M3 改造：响应结构改为 { records, totalCount }，
 * 与 ProTable 默认约定不同，演示 responseAdapter 的真实业务用法）
 *
 * 支持：分页 / customer 模糊搜索 / amount、orderNo 服务端排序回显。
 * 注：文件名取 sort-orders 而非 orders —— mock/pro-table/orders.ts 已被单元格合并 demo 占用。
 */
import type { ProTableRequestApi, ProTableResponse } from '@vv/shared'

export interface Order {
  id: string
  orderNo: string
  customer: string
  amount: number
  status: 'pending' | 'paid' | 'shipped'
}

/** 后端原始分页结构（非 ProTable 默认约定 → 必须配合 responseAdapter 使用） */
export interface BackendPage<T> {
  records: T[]
  totalCount: number
}

const mockOrders: Order[] = [
  { id: '1', orderNo: 'SO-20260901', customer: '杭州星辰科技', amount: 12800, status: 'paid' },
  { id: '2', orderNo: 'SO-20260902', customer: '上海云帆贸易', amount: 8600, status: 'shipped' },
  { id: '3', orderNo: 'SO-20260903', customer: '北京远山文创', amount: 23900, status: 'pending' },
  { id: '4', orderNo: 'SO-20260904', customer: '深圳启明电子', amount: 5200, status: 'paid' },
  { id: '5', orderNo: 'SO-20260905', customer: '杭州星辰科技', amount: 31500, status: 'shipped' },
  { id: '6', orderNo: 'SO-20260906', customer: '成都锦城餐饮', amount: 4700, status: 'pending' },
  { id: '7', orderNo: 'SO-20260907', customer: '广州南珠服饰', amount: 15400, status: 'paid' },
  { id: '8', orderNo: 'SO-20260908', customer: '南京栖霞出版', amount: 9800, status: 'shipped' },
  { id: '9', orderNo: 'SO-20260909', customer: '武汉长江物流', amount: 18300, status: 'pending' },
  { id: '10', orderNo: 'SO-20260910', customer: '苏州园林设计', amount: 7600, status: 'paid' },
  { id: '11', orderNo: 'SO-20260911', customer: '重庆山城火锅', amount: 11200, status: 'shipped' },
  { id: '12', orderNo: 'SO-20260912', customer: '西安秦汉文旅', amount: 20500, status: 'pending' },
]

interface SortOrdersParams {
  pageNum?: number
  pageSize?: number
  customer?: string
  orderByColumn?: string
  isAsc?: 'asc' | 'desc'
}

export const sortOrdersRequestApi: ProTableRequestApi<Order> = async (rawParams) => {
  await new Promise((r) => setTimeout(r, 200))
  const params = rawParams as SortOrdersParams
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 10
  let rows = [...mockOrders]
  if (params.customer) {
    rows = rows.filter((o) => o.customer.includes(params.customer as string))
  }
  if (params.orderByColumn === 'amount') {
    rows.sort((a, b) => (params.isAsc === 'desc' ? b.amount - a.amount : a.amount - b.amount))
  }
  if (params.orderByColumn === 'orderNo') {
    rows.sort((a, b) =>
      params.isAsc === 'desc'
        ? b.orderNo.localeCompare(a.orderNo)
        : a.orderNo.localeCompare(b.orderNo)
    )
  }
  return {
    records: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    totalCount: rows.length,
  } as unknown as ProTableResponse<Order>
}

/** responseAdapter —— 把后端 { records, totalCount } 映射为 ProTable 约定结构 */
export const sortOrdersResponseAdapter = (raw: unknown): ProTableResponse<Order> => {
  const page = raw as BackendPage<Order>
  return { data: page.records, total: page.totalCount, pageNum: 1, pageSize: 10 }
}
