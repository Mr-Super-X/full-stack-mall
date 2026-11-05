/**
 * XFormDetailFill demo 的模拟后端接口
 *
 * 模拟订单编辑页数据链路：
 * - fetchOrderDetail：GET /api/orders/:id（三条路径——已发货 / 草稿 / 失败）
 * - fetchCities / fetchDistricts：城市与区域字典，级联下拉的 asyncOptions 数据源
 */

/** 订单详情结构（对应后端响应体） */
export interface OrderDetail {
  orderNo: string
  status: 'draft' | 'shipped' | 'cancelled'
  customerName: string
  contactPhone: string
  /** 字典主键；后端约定 null 表示未填写 */
  city: number | null
  district: number | null
  needInvoice: boolean
  invoiceTitle: string
  items: Array<{ product: string; qty: number; price: number }>
  remark: string
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const ORDER_DB: Record<'ORD-A' | 'ORD-B', OrderDetail> = {
  // A 已发货：回填完成后 reaction.disabled 立即把收货人信息变灰（只读联动场景）
  'ORD-A': {
    orderNo: 'ORD-20260815-001',
    status: 'shipped',
    customerName: '上海星辰科技有限公司',
    contactPhone: '13800138000',
    city: 2,
    district: 22,
    needInvoice: true,
    invoiceTitle: '上海星辰科技有限公司',
    items: [
      { product: 'sku-002', qty: 3, price: 69 },
      { product: 'sku-003', qty: 1, price: 59 },
    ],
    remark: '加急件，客户要求周五前送达。',
  },
  // B 草稿：needInvoice=false → 发票抬头被隐藏，值静默保留；hidden 必填不阻塞校验
  'ORD-B': {
    orderNo: 'ORD-20260820-002',
    status: 'draft',
    customerName: '北京云帆信息技术有限公司',
    contactPhone: '',
    city: 1,
    district: 12,
    needInvoice: false,
    invoiceTitle: '',
    items: [{ product: 'sku-001', qty: 2, price: 89 }],
    remark: '',
  },
}

/**
 * 模拟详情接口（800ms 延迟）
 *
 * @param id 订单 id；传入 'FAIL' 固定抛错，演示 Error 三态与重试恢复
 */
export async function fetchOrderDetail(id: string): Promise<OrderDetail> {
  await delay(800)
  if (id === 'FAIL') throw new Error('网络异常：请求超时')
  const detail = ORDER_DB[id as 'ORD-A' | 'ORD-B']
  if (!detail) throw new Error(`订单 ${id} 不存在`)
  return detail
}

/** 城市字典（500ms 延迟） */
export async function fetchCities(): Promise<Array<{ id: number; name: string }>> {
  await delay(500)
  return [
    { id: 1, name: '北京' },
    { id: 2, name: '上海' },
    { id: 3, name: '广州' },
  ]
}

/** 区域字典：依赖城市 id（600ms 延迟，比城市慢一拍，便于观察级联回填时序） */
export async function fetchDistricts(
  cityId?: number | null
): Promise<Array<{ id: number; name: string }>> {
  await delay(600)
  const DICT: Record<number, Array<{ id: number; name: string }>> = {
    1: [
      { id: 11, name: '朝阳区' },
      { id: 12, name: '海淀区' },
    ],
    2: [
      { id: 21, name: '浦东新区' },
      { id: 22, name: '徐汇区' },
    ],
    3: [
      { id: 31, name: '天河区' },
      { id: 32, name: '越秀区' },
    ],
  }
  return cityId != null && DICT[cityId] ? DICT[cityId]! : []
}
