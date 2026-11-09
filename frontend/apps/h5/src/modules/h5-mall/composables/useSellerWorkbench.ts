import { h5SellerApi } from '../apis/seller'
import type { MallConsignment } from '../apis/seller'
import type { MallOrder } from '../apis/orders'

/**
 * 售出订单的卖家实收金额：按本卖家明细行合计（price × quantity）。
 *
 * 不可用 order.payAmount——那是订单头整单金额（跨卖家合并下单时含其它卖家行，
 * 后端 sold() 已把 items 过滤为本卖家行，payAmount 仍是全额，直接展示会夸大）。
 */
export function sellerGross(order: MallOrder): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

/**
 * 卖家工作台 composable：我的寄卖 + 售出订单 双列表三态 + 接受定价 + 发货。
 *
 * 状态语义（Review Focus 2/4：不留幻觉成功）：
 * - acceptPricing / shipOrder 成功与 400 均 finally reload 对应列表对齐真态，
 *   错误向上穿透（视图 toast 后端消息）
 * - 接受平台定价 = 铸造商品上架（不可撤销），视图侧 useConfirm 二次确认 + 防重点击
 *
 * Empty 判定按列表长度：useRequest 的 isEmpty 判 data===null，后端空列表返回 []，
 * 空数组必须长度判定（新卖家无寄卖/售出记录时给空态占位而非空白）。
 */
export function useSellerWorkbench() {
  const {
    data: consignments,
    loading: loadingConsignments,
    error: errorConsignments,
    refresh: loadConsignments,
  } = useRequest<MallConsignment[]>(() => h5SellerApi.myConsignments())

  const {
    data: soldOrders,
    loading: loadingOrders,
    error: errorOrders,
    refresh: loadSoldOrders,
  } = useRequest<MallOrder[]>(() => h5SellerApi.soldOrders())

  const isEmptyConsignments = computed(
    () => !loadingConsignments.value && !errorConsignments.value && (consignments.value?.length ?? 0) === 0,
  )
  const isEmptyOrders = computed(
    () => !loadingOrders.value && !errorOrders.value && (soldOrders.value?.length ?? 0) === 0,
  )

  async function acceptPricing(id: number): Promise<void> {
    try {
      await h5SellerApi.accept(id)
    } finally {
      await loadConsignments()
    }
  }

  async function shipOrder(orderId: number): Promise<void> {
    try {
      await h5SellerApi.ship(orderId)
    } finally {
      await loadSoldOrders()
    }
  }

  return {
    consignments,
    soldOrders,
    loadingConsignments,
    loadingOrders,
    errorConsignments,
    errorOrders,
    isEmptyConsignments,
    isEmptyOrders,
    loadConsignments,
    loadSoldOrders,
    acceptPricing,
    shipOrder,
  }
}
