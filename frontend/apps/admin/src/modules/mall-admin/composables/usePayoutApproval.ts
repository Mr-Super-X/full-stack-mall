// 结算审批 composable：三步状态机 PENDING→CONFIRMED→PAID（纯写操作）。
// 数据流：列表归 ProTable request-api 拉取，刷新由视图对齐真态（成功后 refresh；
// 400 状态已变迁时视图 finally 也刷新——Review Focus #6 防「幻觉成功」语义移交视图层）。
// 错误上抛（视图 toast）。

import { ref } from 'vue'
import { adminPayoutApi } from '../apis/payouts'

export function usePayoutApproval() {
  const status = ref('PENDING')

  async function confirm(id: number): Promise<void> {
    await adminPayoutApi.confirm(id)
  }

  async function pay(id: number): Promise<void> {
    await adminPayoutApi.pay(id)
  }

  return { status, confirm, pay }
}
