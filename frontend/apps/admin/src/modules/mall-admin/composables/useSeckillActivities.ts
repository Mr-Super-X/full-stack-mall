// 秒杀场次管理 composable：状态筛选 + 纯写操作（创建/取消）。
// 数据流：列表归 ProTable request-api 拉取，写成功后由视图对齐真态
// （cancel 留当前页 refresh；create 回第 1 页走视图 key 重挂载）——
// 原 load 数据无消费者属无效刷新，2026-11-12 修复。
// 错误向上抛（视图层 toast，不静默吞错）。

import { ref } from 'vue'
import { adminSeckillApi } from '../apis/seckill'
import type { AdminSeckillCreatePayload } from '../apis/seckill'

export function useSeckillActivities() {
  const status = ref('')

  async function create(payload: AdminSeckillCreatePayload): Promise<void> {
    await adminSeckillApi.create(payload)
  }

  async function cancel(id: number): Promise<void> {
    await adminSeckillApi.cancel(id)
  }

  return { status, create, cancel }
}
