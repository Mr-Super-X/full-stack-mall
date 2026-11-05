/**
 * 守卫 —— 权限码检查（独立可测的纯函数）。
 *
 * 业务背景：路由 `meta.permissions` 是 AND 语义数组（所有权限都满足才放行），
 * 无权限时跳 `/403` 错误页（区别于白名单路由的「可匿名访问」语义）。
 *
 * 设计要点：
 * - 纯函数：仅依赖入参，便于单测
 * - 不修改任何全局状态（无副作用）
 * - `meta.permissions` 缺失或为空数组均视为"无权限要求"，返回放行
 *
 * @see 编排器位于各 app 的 `router/guards/auth.ts`（如 apps/admin）—— `checkPermission` 调用点
 * @see [`src/composables/useAuth.ts`](../../composables/useAuth.ts) `hasPerm` 语义对齐
 * @group 路由：权限守卫
 */

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { useUserStore } from '../store/modules/user.ts'

type UserStore = ReturnType<typeof useUserStore>

const FORBIDDEN_PATH = '/403'

/**
 * 检查当前用户权限码是否覆盖路由 meta.permissions。
 *
 * @returns null 表示通过；RouteLocationRaw 表示跳转到 /403
 */
export function checkPermission(
  to: RouteLocationNormalized,
  userStore: UserStore
): RouteLocationRaw | null {
  // 演示模式（gh-pages CI 构建 VITE_DEMO_NO_AUTH=true）：路由级权限校验跳过——
  // prod 版 profile mock 的演示权限码未必覆盖全部路由 meta.permissions；
  // 按钮级 v-auth 仍按真实 permissions 渲染（profile 拉取成功时），权限控制效果不受影响。
  // 常规构建本分支被静态消除。
  if (import.meta.env.VITE_DEMO_NO_AUTH === 'true') return null

  const requiredPerms = (to.meta as { permissions?: string[] }).permissions
  if (!requiredPerms?.length) return null

  // AND 语义：所有权限都满足才放行
  const hasAll = requiredPerms.every((p) => userStore.permissions.includes(p))
  if (!hasAll) return { path: FORBIDDEN_PATH }

  return null
}
