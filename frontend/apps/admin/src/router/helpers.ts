/**
 * 路由辅助函数（标题解析、meta 提取）。
 *
 * 提供给 sidebar / breadcrumb / 页面组件使用，统一 i18n 解析逻辑。
 *
 * P1-3 包化：resolveRouteTitle 已下沉到 @vv/shared（router-title.ts，
 * shared 的 useAppRouter 依赖它）；此处 re-export 保持 Breadcrumb / menu 配置等
 * 存量消费方零改动。
 *
 * @group 路由：辅助函数
 */

import type { RouteLocationNormalized } from 'vue-router'

export { resolveRouteTitle } from '@vv/shared'

/**
 * 提取路由的权限码（业务侧 useAuth 比较用）。
 *
 * @returns 元数据中的 permissions 数组，缺失返回 undefined
 */
export function extractRoutePermissions(
  to: Pick<RouteLocationNormalized, 'meta'>
): string[] | undefined {
  return (to.meta as { permissions?: string[] }).permissions
}

/**
 * 提取路由图标名（Element Plus icon 名）。
 */
export function extractRouteIcon(to: Pick<RouteLocationNormalized, 'meta'>): string | undefined {
  return (to.meta as { icon?: string }).icon
}
