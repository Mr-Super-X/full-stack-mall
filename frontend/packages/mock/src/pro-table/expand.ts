/**
 * 表格内嵌 demo —— 订单表 mock（带 items 明细 + details 详情）
 *
 * 数据设计目标：覆盖 3 种展开行内嵌场景
 * - 展开行嵌入「子表格」：每个订单的 items[]
 * - 展开行嵌入「详情面板（key-value 卡片）」：每个订单的 details{}
 * - 复杂单元格：订单号带状态点、金额带进度条、操作按钮组
 *
 * @group Demo Mock
 */
import type { ProTableRequestApi } from '@vv/shared'

export interface OrderItem {
  sku: string
  name: string
  qty: number
  price: number
}

export interface OrderDetails {
  receiver: string
  phone: string
  address: string
  remark: string
}

export interface ExpandOrder {
  id: number
  orderNo: string
  customer: string
  amount: number
  paid: number // 已支付金额（用于金额进度条 = paid / amount）
  status: '已完成' | '待发货' | '已取消' | '部分退款'
  createdAt: string
  items: OrderItem[]
  details: OrderDetails
}

const mockOrders: ExpandOrder[] = [
  {
    id: 1,
    orderNo: 'ORD20260910001',
    customer: '张伟',
    amount: 12999,
    paid: 12999,
    status: '已完成',
    createdAt: '2026-09-09 14:23',
    items: [
      { sku: 'SKU-A001', name: 'iPhone 16 Pro', qty: 1, price: 9999 },
      { sku: 'SKU-A008', name: 'AirPods Pro 3', qty: 1, price: 1899 },
      { sku: 'SKU-A012', name: 'MagSafe 充电器', qty: 1, price: 399 },
      { sku: 'SKU-A015', name: 'AppleCare+', qty: 1, price: 702 },
    ],
    details: {
      receiver: '张伟',
      phone: '138****1234',
      address: '上海市浦东新区世纪大道 100 号',
      remark: '工作日送货，签收前请检查外观',
    },
  },
  {
    id: 2,
    orderNo: 'ORD20260910002',
    customer: '李娜',
    amount: 14999,
    paid: 8000,
    status: '部分退款',
    createdAt: '2026-09-09 16:05',
    items: [{ sku: 'SKU-B002', name: 'MacBook Pro M4', qty: 1, price: 14999 }],
    details: {
      receiver: '李娜',
      phone: '139****5678',
      address: '北京市朝阳区建国路 88 号',
      remark: '客户申请退还差价 6999 元（已审核通过）',
    },
  },
  {
    id: 3,
    orderNo: 'ORD20260910003',
    customer: '王芳',
    amount: 258,
    paid: 0,
    status: '待发货',
    createdAt: '2026-09-10 09:12',
    items: [
      { sku: 'SKU-C003', name: 'AirTag 4 件装', qty: 1, price: 649 },
      { sku: 'SKU-C011', name: 'Beats Flex', qty: 1, price: 399 },
      { sku: 'SKU-C018', name: '第三方保护壳', qty: 2, price: 49 },
    ],
    details: {
      receiver: '王芳',
      phone: '186****9012',
      address: '广州市天河区珠江新城 50 号',
      remark: '加急',
    },
  },
  {
    id: 4,
    orderNo: 'ORD20260910004',
    customer: '赵磊',
    amount: 5299,
    paid: 0,
    status: '已取消',
    createdAt: '2026-09-10 11:48',
    items: [
      { sku: 'SKU-D004', name: 'iPad Air', qty: 1, price: 4799 },
      { sku: 'SKU-D005', name: 'Apple Pencil Pro', qty: 1, price: 999 },
    ],
    details: {
      receiver: '赵磊',
      phone: '137****3456',
      address: '深圳市南山区科技园路 9 号',
      remark: '客户主动取消（30 分钟内）',
    },
  },
  {
    id: 5,
    orderNo: 'ORD20260910005',
    customer: '陈静',
    amount: 7998,
    paid: 7998,
    status: '已完成',
    createdAt: '2026-09-08 20:33',
    items: [
      { sku: 'SKU-E001', name: 'Apple Watch Ultra', qty: 1, price: 6499 },
      { sku: 'SKU-E002', name: 'Watch 表带（链式）', qty: 1, price: 1499 },
    ],
    details: {
      receiver: '陈静',
      phone: '135****7890',
      address: '杭州市西湖区文三路 138 号',
      remark: '生日礼物（请附手写贺卡）',
    },
  },
  {
    id: 6,
    orderNo: 'ORD20260910006',
    customer: '刘强',
    amount: 3698,
    paid: 3698,
    status: '已完成',
    createdAt: '2026-09-09 08:20',
    items: [
      { sku: 'SKU-F003', name: 'HomePod mini ×2', qty: 2, price: 1499 },
      { sku: 'SKU-F007', name: '智能插座（HomeKit）', qty: 4, price: 175 },
    ],
    details: {
      receiver: '刘强',
      phone: '188****2345',
      address: '成都市高新区天府大道 500 号',
      remark: '已安装调试完成',
    },
  },
]

/**
 * 表格内嵌 demo 的请求 mock。
 *
 * 支持 status 过滤 + 真实分页：demo 页有「程序化搜索（setSearchParams）」按钮，
 * mock 必须按参数过滤返回，否则点击后页面无任何可见变化、该按钮无法验证。
 *
 * @param params ProTable 组装的标准参数（搜索表单值平铺 + pageNum/pageSize）
 */
export const expandRequestApi: ProTableRequestApi = async (params) => {
  await new Promise((r) => setTimeout(r, 200))
  const status = params?.status as ExpandOrder['status'] | undefined
  const filtered = status ? mockOrders.filter((o) => o.status === status) : mockOrders
  const pageNum = Number(params?.pageNum) || 1
  const pageSize = Number(params?.pageSize) || 10
  return {
    data: filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize) as unknown as Record<
      string,
      unknown
    >[],
    total: filtered.length,
    pageNum,
    pageSize,
  }
}
