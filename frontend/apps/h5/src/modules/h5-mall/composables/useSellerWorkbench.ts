import { h5SellerApi } from '../apis/seller'
import type { MallConsignment } from '../apis/seller'
import type { MallOrder } from '../apis/orders'

/**
 * 卖家工作台 composable：我的寄卖 + 售出订单 双列表三态 + 接受定价 + 发货。
 *
 * 状态语义（Review Focus 2/4：不留幻觉成功）：
 * - acceptPricing / shipOrder 成功与 400 均 finally reload 对应列表对齐真态，
 *   错误向上穿透（视图 toast 后端消息）
 * - 接受平台定价 = 铸造商品上架（不可撤销），视图侧 useConfirm 二次确认 + 防重点击
 */
export function useSellerWorkbench() {
  const {
    data: consignments,
    loading: loadingConsignments,
    error: errorConsignments,
    isEmpty: isEmptyConsignments,
    refresh: loadConsignments,
  } = useRequest<MallConsignment[]>(() => h5SellerApi.myConsignments())

  const {
    data: soldOrders,
    loading: loadingOrders,
    error: errorOrders,
    isEmpty: isEmptyOrders,
    refresh: loadSoldOrders,
  } = useRequest<MallOrder[]>(() => h5SellerApi.soldOrders())

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
