/**
 * 路由白名单（docs 单一事实来源）。
 *
 * docs 全站公开：demo 全部路由名从 `@/modules/demo/routes` 的 routeNames
 * 全量吸收（demo 物理独立后不再有需要按构建剔除的门控），外加站内 404。
 * 判定依据：路由的 `name` 在集合中（按 name 而非 path 匹配，path 可能变化）。
 *
 * @see [`./index.ts`](./index.ts) 守卫挂接点
 * @group 路由：白名单
 */

import { createWhiteList, isWhiteListed } from '@vv/shared/router-guards'
import { routeNames as demoRouteNames } from '@/modules/demo/routes'

// 白名单构造样板经 @vv/shared createWhiteList 单源（2026-10-23 重复性审查收敛）；
// check-routes 按 createWhiteList 调用提取名单，改名须同步脚本
export const ROUTE_WHITE_LIST: ReadonlySet<string> = createWhiteList('NotFound', demoRouteNames)

/**
 * 判定路由是否在 docs 白名单内（直通放行）。
 *
 * 判定谓词 `isWhiteListed` 归 @vv/shared；数据 ROUTE_WHITE_LIST 归 docs 私有，两者在此接线。
 *
 * @param routeName 路由 name（string | symbol | null | undefined；统一按 string 处理）
 * @returns true 表示在白名单内，可直接放行
 */
export function isDocsWhiteListed(routeName: unknown): boolean {
  return isWhiteListed(routeName, ROUTE_WHITE_LIST)
}
