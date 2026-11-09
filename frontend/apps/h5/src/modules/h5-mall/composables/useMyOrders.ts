import { h5OrderApi } from '../apis/orders'
import type { MallOrder } from '../apis/orders'

/**
 * 我的订单 composable（买家视角）：列表三态 + 确认收货。
 *
 * 三态供视图层显式处理（frontend.md §1.1）：
 * - loading: 骨架屏（区分于空态）
 * - error: 错误提示 + 重试
 * - isEmpty: 非加载非错误且无数据（空态占位）
 *
 * confirmReceipt 语义（Review Focus 2：不留幻觉成功）：
 * - 成功：reload 列表对齐真态
 * - 400（ORDER_STATE_ILLEGAL 等）：错误向上穿透（视图 toast），finally 中仍 reload——
 *   后端状态可能已被其它端改变，前端必须对齐真态而非停在本地旧数据
 */
export function useMyOrders() {
  const {
    data: list,
    loading,
    error,
    isEmpty,
    refresh: load,
  } = useRequest<MallOrder[]>(() => h5OrderApi.list())

  async function confirmReceipt(id: number): Promise<void> {
    try {
      await h5OrderApi.confirm(id)
    } finally {
      await load()
    }
  }

  return { list, loading, error, isEmpty, load, confirmReceipt }
}
