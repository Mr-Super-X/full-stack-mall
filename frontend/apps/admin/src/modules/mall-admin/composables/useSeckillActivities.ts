// 秒杀场次管理 composable：状态筛选 + 分页加载 + 创建（划拨）/取消（归还）。
// 写操作成功后 reload 对齐真态；错误向上抛（视图层 toast，不静默吞错）。

import { ref } from 'vue'
import { adminSeckillApi } from '../apis/seckill'
import type { AdminSeckillActivity, AdminSeckillCreatePayload } from '../apis/seckill'

export function useSeckillActivities() {
  const status = ref('')
  const page = ref(1)
  const list = ref<AdminSeckillActivity[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function load(p = 1): Promise<void> {
    page.value = p
    loading.value = true
    try {
      const res = await adminSeckillApi.page({
        status: status.value || undefined,
        page: p,
        pageSize: 10,
      })
      list.value = res.list
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  /** 创建：后端校验 + 事务划拨；成功后回第 1 页对齐真态 */
  async function create(payload: AdminSeckillCreatePayload): Promise<void> {
    await adminSeckillApi.create(payload)
    await load(1)
  }

  /** 取消（仅 PENDING）：成功后留在当前页 */
  async function cancel(id: number): Promise<void> {
    await adminSeckillApi.cancel(id)
    await load(page.value)
  }

  return { status, page, list, total, loading, load, create, cancel }
}
