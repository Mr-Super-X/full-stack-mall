/**
 * 样式定制 demo —— 商品库存 mock
 *
 * 数据设计目标：触发 6 种条件样式（用户提出的真实痛点）
 * - 价格 >= 10000（高客单价）→ 单元格金色背景
 * - 库存 = 0 → 单元格红字 + 行尾加「缺货」徽标
 * - status = '停售' → 整行灰色（半透明）
 * - status = '清仓' → 整行黄色左边条
 * - isVip = true → 整行蓝色左边条
 * - updatedAt 在 3 天内 → 「最近更新」绿色
 *
 * @group Demo Mock
 */
import type { ProTableRequestApi } from '@vv/shared'

export interface StyleOverrideProduct {
  id: number
  name: string
  category: string
  stock: number
  price: number
  status: '在售' | '停售' | '清仓'
  isVip: boolean
  updatedAt: string
}

const mockProducts: StyleOverrideProduct[] = [
  {
    id: 1,
    name: 'iPhone 16 Pro Max',
    category: '手机数码',
    stock: 35,
    price: 9999,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(1),
  },
  {
    id: 2,
    name: 'MacBook Pro M4',
    category: '电脑办公',
    stock: 12,
    price: 14999,
    status: '在售',
    isVip: true,
    updatedAt: nowMinusDays(0),
  },
  {
    id: 3,
    name: 'AirPods Pro 3',
    category: '手机数码',
    stock: 0,
    price: 1899,
    status: '停售',
    isVip: false,
    updatedAt: nowMinusDays(7),
  },
  {
    id: 4,
    name: 'iPad Air',
    category: '电脑办公',
    stock: 28,
    price: 4799,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(2),
  },
  {
    id: 5,
    name: 'Apple Watch Ultra',
    category: '智能穿戴',
    stock: 6,
    price: 6499,
    status: '清仓',
    isVip: true,
    updatedAt: nowMinusDays(3),
  },
  {
    id: 6,
    name: 'HomePod mini',
    category: '智能家居',
    stock: 0,
    price: 749,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(10),
  },
  {
    id: 7,
    name: 'Magic Keyboard',
    category: '电脑办公',
    stock: 42,
    price: 999,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(1),
  },
  {
    id: 8,
    name: 'Studio Display',
    category: '电脑办公',
    stock: 4,
    price: 11499,
    status: '在售',
    isVip: true,
    updatedAt: nowMinusDays(5),
  },
  {
    id: 9,
    name: 'AirTag 4 件装',
    category: '智能家居',
    stock: 89,
    price: 649,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(2),
  },
  {
    id: 10,
    name: '旧款 iPad Pro',
    category: '电脑办公',
    stock: 0,
    price: 5299,
    status: '停售',
    isVip: false,
    updatedAt: nowMinusDays(20),
  },
  {
    id: 11,
    name: 'Apple TV 4K',
    category: '智能家居',
    stock: 15,
    price: 1499,
    status: '清仓',
    isVip: true,
    updatedAt: nowMinusDays(4),
  },
  {
    id: 12,
    name: 'Beats Studio Pro',
    category: '影音娱乐',
    stock: 23,
    price: 2599,
    status: '在售',
    isVip: false,
    updatedAt: nowMinusDays(0),
  },
]

/** 构造「距今 N 天」的 ISO 时间串 */
function nowMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export const styleOverrideRequestApi: ProTableRequestApi = async () => {
  await new Promise((r) => setTimeout(r, 200))
  return {
    data: mockProducts as unknown as Record<string, unknown>[],
    total: mockProducts.length,
    pageNum: 1,
    pageSize: 20,
  }
}
