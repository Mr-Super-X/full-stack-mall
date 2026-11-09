// 寄卖审核队列 composable：状态筛选 + 通过（定价/佣金率）/驳回（原因）。
// 审核成功后自动 reload 对齐真态；错误向上抛（视图层 toast，Review Focus #5：不静默吞错）。

import { ref } from 'vue'
import { adminConsignmentApi } from '../apis/consignments'
import type { AdminConsignmentItem } from '../apis/consignments'

export function useConsignmentReview() {
  const list = ref<AdminConsignmentItem[]>([])
  const loading = ref(false)
  const status = ref('SUBMITTED')

  async function load(s?: string): Promise<void> {
    if (s) status.value = s
    loading.value = true
    try {
      list.value = await adminConsignmentApi.list(status.value)
    } finally {
      loading.value = false
    }
  }

  async function approve(id: number, platformPrice: number, commissionRate: number): Promise<void> {
    await adminConsignmentApi.review(id, { approve: true, platformPrice, commissionRate })
    await load()
  }

  async function reject(id: number, reason: string): Promise<void> {
    await adminConsignmentApi.review(id, { approve: false, rejectReason: reason })
    await load()
  }

  return { list, loading, status, load, approve, reject }
}
