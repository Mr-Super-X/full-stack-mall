// 结算审批 composable：三步状态机 PENDING→CONFIRMED→PAID。
// 成功 reload 对齐真态；400（PAYOUT_STATE_ILLEGAL 等）错误上抛且仍刷新一次——
// 对齐后端真态，不留「幻觉成功」（计划 07 Review Focus #6：审批按钮连点/状态已变迁）。

import { ref } from 'vue'
import { adminPayoutApi } from '../apis/payouts'
import type { AdminPayoutItem } from '../apis/payouts'

export function usePayoutApproval() {
  const list = ref<AdminPayoutItem[]>([])
  const loading = ref(false)
  const status = ref('PENDING')

  async function load(s?: string): Promise<void> {
    if (s) status.value = s
    loading.value = true
    try {
      list.value = await adminPayoutApi.list(status.value)
    } finally {
      loading.value = false
    }
  }

  async function confirm(id: number): Promise<void> {
    try {
      await adminPayoutApi.confirm(id)
    } finally {
      // 无论成功或 400（状态已变迁）都刷新一次，对齐后端真态
      await load()
    }
  }

  async function pay(id: number): Promise<void> {
    try {
      await adminPayoutApi.pay(id)
    } finally {
      await load()
    }
  }

  return { list, loading, status, load, confirm, pay }
}
