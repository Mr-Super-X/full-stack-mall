/**
 * 单元格合并 demo —— 订单列表 mock（spec §八.3 / Task 10）
 *
 * 6 条订单，按状态相邻自动纵向合并：待付款 2 条 / 已付款 3 条 / 已发货 1 条。
 */
import type { ProTableRequestApi } from '@vv/shared'

interface Order {
  id: string
  orderNo: string
  product: string
  qty: number
  status: '待付款' | '已付款' | '已发货'
}

const mockOrders: Order[] = [
  { id: '1', orderNo: 'ORD001', product: 'iPhone', qty: 2, status: '待付款' },
  { id: '2', orderNo: 'ORD002', product: 'iPhone', qty: 1, status: '待付款' },
  { id: '3', orderNo: 'ORD003', product: 'MacBook', qty: 1, status: '已付款' },
  { id: '4', orderNo: 'ORD004', product: 'MacBook', qty: 3, status: '已付款' },
  { id: '5', orderNo: 'ORD005', product: 'MacBook', qty: 1, status: '已付款' },
  { id: '6', orderNo: 'ORD006', product: 'iPad', qty: 2, status: '已发货' },
]

export const ordersRequestApi: ProTableRequestApi = async () => {
  await new Promise((r) => setTimeout(r, 200))
  return {
    data: mockOrders as unknown as Record<string, unknown>[],
    total: mockOrders.length,
    pageNum: 1,
    pageSize: 10,
  }
}
