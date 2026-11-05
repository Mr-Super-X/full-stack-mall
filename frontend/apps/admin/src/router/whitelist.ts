/**
 * 路由白名单（admin 单一事实来源）。
 *
 * 用途：白名单路由跳过登录检查 + 跳过权限检查
 * 判定依据：路由的 `name` 在 `ROUTE_WHITE_LIST` 中（按 name 而非 path 匹配）
 *
 * 为什么用 name 而不是 path：
 * - 路由 path 可能变化（如 `/profile` → `/account`），name 更稳定
 * - 后端菜单可能用任意 path 注入，按 name 校验更可控
 *
 * 注意：白名单路由仍建议挂载 layout（避免裸路由破布局）
 *
 * P2 变更：demo 模块物理独立到 apps/docs（连同 `demoWhitelistNames` 吸收链）。
 * P3-1 变更：home 模块物理独立到 apps/portal（连同 'Home' 白名单行）。
 * P3-2 变更：H5Demo 随迁至 apps/h5（h5-demo 模块 + h5 layout 整体抽离）。
 * P3-3 变更：big-demo 模块随 big layout 物理独立到 apps/big。
 * P4 变更：auth 模块物理独立到 apps/auth（连同 'Login' 白名单行）——
 * admin 无任何公开页：未登录访问一律由守卫经 `redirectToAuthLogin` 整页跳
 * apps/auth（跨应用统一登录协议，@vv/shared auth/redirect.ts）。
 *
 * @see [`./guards/auth.ts`](./guards/auth.ts) `isWhiteListed` 调用点
 * @group 路由：白名单
 */

import { isWhiteListed } from '@vv/shared/router-guards'

/**
 * 白名单路由集合。增删只需修改下方字面量数组。
 *
 * @example 业务路由加入白名单
 * ```ts
 * // 在字面量数组中追加即可：
 * 'Preview',
 * ```
 */
export const ROUTE_WHITE_LIST: ReadonlySet<string> = new Set<string>([
  'Forbidden', // 403 无权限
  'NotFound', // 404 页面
  'ServerError', // 500 页面
])

/**
 * 判定路由是否在 admin 白名单内（跳过登录 + 权限检查）。
 *
 * 判定谓词 `isWhiteListed` 归 @vv/shared（P1-3 守卫骨架下沉）；
 * 数据 ROUTE_WHITE_LIST 归 admin 私有，两者在此接线。
 *
 * @param routeName 路由 name（Vue Router 中可能是 string | symbol | null | undefined；
 *                   symbol 用于命名空间，本系统未使用，统一按 string 处理）
 * @returns true 表示在白名单内，可直接放行
 */
export function isAdminWhiteListed(routeName: unknown): boolean {
  return isWhiteListed(routeName, ROUTE_WHITE_LIST)
}
