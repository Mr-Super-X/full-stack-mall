import { h5CartApi } from '../apis/cart'
import type { MallCartItem } from '../apis/cart'

/**
 * 购物车 composable：列表三态 + 加购/改量/删除 + 本地勾选合计。
 *
 * 勾选语义：checked 状态不进后端（UpdateCartItemRequest.checked 存在但 h5 结算
 * 直接传 cartItemIds，勾选纯属本地挑选）；失效条目（invalid=下架/缺货）不可勾选。
 * 每个变更操作成功后 reload 对齐真态（与 useMyOrders 同策略：不留幻觉成功）。
 */
export function useCart() {
  const {
    data: list,
    loading,
    error,
    refresh: load,
  } = useRequest<MallCartItem[]>(() => h5CartApi.list())

  const isEmpty = computed(() => !loading.value && !error.value && (list.value?.length ?? 0) === 0)

  /** 本地勾选的条目 id 集（数据到达后初始化为「后端 checked 且未失效」） */
  const checkedIds = ref<Set<number>>(new Set<number>())

  watch(
    list,
    (rows) => {
      if (!rows) return
      checkedIds.value = new Set(rows.filter((r) => r.checked && !r.invalid).map((r) => r.id))
    },
    { immediate: true },
  )

  /** 勾选条目合计金额（仅失效=false 的勾选行） */
  const checkedTotal = computed(() => {
    const rows = list.value ?? []
    return rows
      .filter((r) => checkedIds.value.has(r.id) && !r.invalid)
      .reduce((sum, r) => sum + r.price * r.quantity, 0)
  })

  /** 失效条目忽略勾选操作 */
  function toggleCheck(id: number): void {
    const row = list.value?.find((r) => r.id === id)
    if (!row || row.invalid) return
    const next = new Set(checkedIds.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    checkedIds.value = next
  }

  async function add(payload: { productItemId: number; quantity: number }): Promise<void> {
    try {
      await h5CartApi.add(payload)
    } finally {
      await load()
    }
  }

  async function updateQty(id: number, quantity: number): Promise<void> {
    try {
      await h5CartApi.update(id, { quantity })
    } finally {
      await load()
    }
  }

  async function remove(id: number): Promise<void> {
    try {
      await h5CartApi.remove(id)
    } finally {
      await load()
    }
  }

  return { list, loading, error, isEmpty, load, checkedIds, checkedTotal, toggleCheck, add, updateQty, remove }
}
