import { h5AddressApi } from '../apis/address'
import { h5OrderApi } from '../apis/orders'
import type { MallCreateOrderPayload, MallOrder } from '../apis/orders'

/**
 * 结算 composable：地址列表 + 默认地址 + 下单（CART/DIRECT）+ 发起支付 + 状态轮询。
 *
 * 支付闭环（FakeProvider）：createOrder 返回的订单带 paymentNo（后端已建 CREATED 支付单）
 * → startPay(paymentNo) 换收银台 payUrl → 前端跳收银台完成支付 → pollPayStatus 轮询
 * 至终态（SUCCESS/FAILED）→ 跳订单页。错误一律穿透（视图 toast + 对齐真态）。
 */
export function useCheckout() {
  const {
    data: addresses,
    loading,
    error: addressError,
    refresh: loadAddresses,
  } = useRequest(() => h5AddressApi.list())

  /** 默认地址：isDefault 优先，否则列表第一条（与常见结算页语义一致） */
  const defaultAddress = computed(() => {
    const rows = addresses.value ?? []
    return rows.find((a) => a.isDefault) ?? rows[0] ?? null
  })

  async function createOrder(payload: MallCreateOrderPayload): Promise<MallOrder> {
    return h5OrderApi.create(payload)
  }

  /** 发起支付，返回收银台跳转地址（payUrl） */
  async function startPay(paymentNo: string): Promise<string> {
    const result = await h5OrderApi.pay(paymentNo)
    return result.payUrl ?? ''
  }

  /** 查询支付状态（轮询至 SUCCESS/FAILED 由视图驱动） */
  async function pollPayStatus(paymentNo: string): Promise<string> {
    const result = await h5OrderApi.payStatus(paymentNo)
    return result.status
  }

  return {
    addresses,
    loading,
    addressError,
    loadAddresses,
    defaultAddress,
    createOrder,
    startPay,
    pollPayStatus,
  }
}
