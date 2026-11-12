// 自营商品管理 composable：状态/关键词筛选（视图 :key 与 request-api 闭包消费）+ 纯写操作。
// 数据流：列表归 ProTable request-api 拉取，写成功后由视图 tableRef.refresh() 对齐真态——
// composable 不再持有 list/loading（原 load 数据无消费者，属无效刷新，2026-11-12 修复）。
// 错误向上抛（视图层 toast，不静默吞错）。

import { ref } from 'vue'
import { adminProductApi } from '../apis/products'
import type { AdminProductCreatePayload, AdminProductUpdatePayload } from '../apis/products'

export function useProductManage() {
  /** '' = 全部（对齐后端 status 可空语义）；1 上架；0 下架 */
  const status = ref<number | ''>('')
  const keyword = ref('')

  async function create(payload: AdminProductCreatePayload): Promise<void> {
    await adminProductApi.create(payload)
  }

  async function update(id: number, payload: AdminProductUpdatePayload): Promise<void> {
    await adminProductApi.update(id, payload)
  }

  return { status, keyword, create, update }
}
