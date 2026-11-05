/**
 * 权限组合式函数。
 *
 * 业务侧需要的权限相关 API 全部封装在这里，组件 / 指令 / store 共用同一份事实来源。
 *
 * 设计要点：
 * - 不在 store 增加 permission getter（过度耦合）
 * - 返回值基于 `useUserStore()` 实时计算（响应式）
 * - AND 语义：`hasPerm(['a','b'])` → 都满足才 true
 * - ANY 语义：`hasAnyPerm(['a','b'])` → 任一满足即 true
 *
 * 不发起任何网络请求，权限刷新仍由 `userStore.fetchProfile` 负责。
 *
 * @see [`src/directives/permission.ts`](../directives/permission.ts) `v-permission` 指令
 * @see [`src/store/modules/user`](../store/modules/user) permissions 状态来源
 * @group 权限组合式 API
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '../store/modules/user.ts'

/**
 * 权限组合式 API。
 *
 * 返回当前用户的权限信息 + 判定函数。组件中任何需要判断"能不能做某事"的地方
 * 都应该用 `useAuth()` 而非直接读 store（如 v-auth 指令内部）。
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * // useAuth 由 unplugin-auto-import 从 '@vv/shared' 注入，无须显式 import；
 * // 注释示例的包名形态随 codemod 批次 2 收敛（@composables 深层别名已废弃）
 * const { hasPerm, hasAnyPerm, isLoggedIn } = useAuth()
 * const canEdit = computed(() => hasPerm(['user:edit']))
 * </script>
 *
 * <template>
 *   <el-button v-if="canEdit">编辑</el-button>
 * </template>
 * ```
 *
 * @group 权限组合式 API
 */
export function useAuth() {
  const userStore = useUserStore()
  const { permissions, isLoggedIn } = storeToRefs(userStore)

  /**
   * 检查是否拥有全部指定权限（AND 语义）。
   *
   * @param codes 权限码数组；空数组视为「无要求」直接返回 true
   * @returns true 表示全部满足；false 表示缺少至少一个权限
   */
  function hasPerm(codes: readonly string[]): boolean {
    if (!codes.length) return true
    return codes.every((code) => permissions.value.includes(code))
  }

  /**
   * 检查是否拥有任一指定权限（ANY 语义）。
   *
   * @param codes 权限码数组；空数组视为「无要求」直接返回 true
   * @returns true 表示至少一个满足
   */
  function hasAnyPerm(codes: readonly string[]): boolean {
    if (!codes.length) return true
    return codes.some((code) => permissions.value.includes(code))
  }

  /** 当前用户的所有权限码（只读 computed 方便模板绑定） */
  const allPermissions = computed(() => [...permissions.value])

  return {
    isLoggedIn,
    permissions: allPermissions,
    hasPerm,
    hasAnyPerm,
  }
}
