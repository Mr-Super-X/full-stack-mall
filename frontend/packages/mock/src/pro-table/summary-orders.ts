/**
 * ProTableSummary demo —— 订单 mock（含 4 种聚合字段）
 *
 * mock 数据：50 条订单，含数量 / 单价 / 折扣（用于 sum/avg/max 演示）
 */
import type { ProTableRequestApi } from '@vv/shared'

interface Order {
  id: number
  product: string
  quantity: number
  price: number
  discount: number
}

function generateMockData(total: number): Order[] {
  return Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    product: `商品-${i + 1}`,
    quantity: 10 + (i % 20),
    price: 50 + (i % 100),
    discount: Math.round((i % 5) * 5) / 100,
  }))
}

const ALL_MOCK = generateMockData(50)

export const summaryOrdersRequestApi: ProTableRequestApi<Order> = async (params) => {
  await new Promise((r) => setTimeout(r, 300))
  const pageNum = Number(params['pageNum'] ?? 1)
  const pageSize = Number(params['pageSize'] ?? 10)
  const start = (pageNum - 1) * pageSize
  return {
    data: ALL_MOCK.slice(start, start + pageSize),
    total: ALL_MOCK.length,
    pageNum,
    pageSize,
  }
}
