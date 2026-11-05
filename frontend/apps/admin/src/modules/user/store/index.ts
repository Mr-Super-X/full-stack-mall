/**
 * user 模块私有 store —— 列表页 UI 状态（搜索关键字 + 多选行）。
 *
 * 不持久化：刷新页面回到初始空选择状态是符合预期的。
 *
 * @see [`../views/List.vue`](../views/List.vue) 列表页消费方
 * @see `@api`（别名指 @vv/shared/src/api）modules/user —— 用户接口
 * @group 业务模块：User
 */
import type { UserItem } from '@api/modules/user'

export const useUserListStore = defineStore('module-user-list', () => {
  const keyword = ref('')
  const selectedRows = ref<UserItem[]>([])
  function setKeyword(k: string) {
    keyword.value = k
  }
  function clearSelection() {
    selectedRows.value = []
  }
  return { keyword, selectedRows, setKeyword, clearSelection }
})
