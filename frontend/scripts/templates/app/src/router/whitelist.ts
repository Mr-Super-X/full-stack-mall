/**
 * 路由白名单（__APP_NAME__ 单一事实来源）。
 *
 * 最小公开应用全站公开：home 全部路由名从 `@/modules/home/routes` 的 routeNames
 * 全量吸收，外加站内 404。判定依据：路由的 `name` 在集合中（按 name 而非 path
 * 匹配，path 可能变化）。新增公开业务模块时在此追加其 routeNames。
 *
 * @see [`./index.ts`](./index.ts) 守卫挂接点
 * @group 路由：白名单
 */

import { createWhiteList, isWhiteListed } from '@vv/shared/router-guards'
import { routeNames as homeRouteNames } from '@/modules/home/routes'

// 白名单构造样板经 @vv/shared createWhiteList 单源；
// check-routes 按 createWhiteList 调用提取名单，改名须同步脚本
export const ROUTE_WHITE_LIST: ReadonlySet<string> = createWhiteList('NotFound', homeRouteNames)

/**
 * 判定路由是否在 __APP_NAME__ 白名单内（直通放行）。
 *
 * 判定谓词 `isWhiteListed` 归 @vv/shared；数据 ROUTE_WHITE_LIST 归 app 私有，两者在此接线。
 *
 * @param routeName 路由 name（string | symbol | null | undefined；统一按 string 处理）
 * @returns true 表示在白名单内，可直接放行
 */
export function is__ROUTE_NAME__WhiteListed(routeName: unknown): boolean {
  return isWhiteListed(routeName, ROUTE_WHITE_LIST)
}
