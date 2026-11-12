// 寄卖审核队列 composable：状态筛选 + 纯写操作（通过定价/驳回原因）。
// 数据流：列表归 ProTable request-api 拉取，写成功后由视图 tableRef.refresh() 对齐真态
// （审核后行状态变迁，原 load 数据无消费者属无效刷新，2026-11-12 修复）。
// 错误向上抛（视图层 toast，Review Focus #5：不静默吞错）；失败不刷新（与 Payouts 的
// 防幻觉成功语义不同：审核 400 时行状态未变，无需对齐）。

import { ref } from 'vue'
import { adminConsignmentApi } from '../apis/consignments'

export function useConsignmentReview() {
  const status = ref('SUBMITTED')

  async function approve(id: number, platformPrice: number, commissionRate: number): Promise<void> {
    await adminConsignmentApi.review(id, { approve: true, platformPrice, commissionRate })
  }

  async function reject(id: number, reason: string): Promise<void> {
    await adminConsignmentApi.review(id, { approve: false, rejectReason: reason })
  }

  return { status, approve, reject }
}
