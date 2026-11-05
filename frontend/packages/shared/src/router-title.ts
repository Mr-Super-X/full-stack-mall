/**
 * 路由标题解析（纯函数，从 admin 的 router/helpers.ts 下沉）。
 *
 * 下沉原因：useAppRouter（本包）的 pushWithTitle 依赖它；
 * admin 侧 router/helpers.ts 保留同名 re-export，Breadcrumb / menu 配置等
 * 存量消费方零改动。
 *
 * 不在本函数内直接 import locales，理由：
 *  - 本包是库，持有 i18n 实例会形成与 app 的双向依赖
 *  - 业务侧通常已有 useI18n() 的 t 函数，让调用方注入更解耦
 *  - 不在 SFC setup 外调 useI18n 会报错（i18n 必须在 setup 上下文）
 *
 * 未传入 t 或 t 返回 key 本身 → fallback 到 meta.title / route.name，不抛错。
 *
 * @group 路由：辅助函数
 */
import type { RouteLocationNormalized, RouteMeta } from 'vue-router'

/**
 * 解析路由的展示标题。
 *
 * 优先级：
 *   1. meta.titleKey + i18n.t()           // 国际化路径（需调用方传入 t 函数）
 *   2. meta.title                          // 兜底字符串
 *   3. route.name                          // 开发期兜底（便于调试）
 */
export function resolveRouteTitle(
  to: Pick<RouteLocationNormalized, 'meta' | 'name'>,
  t?: (key: string) => string
): string {
  const meta = to.meta as RouteMeta
  const titleKey = (meta as { titleKey?: string }).titleKey
  if (titleKey && t) {
    const translated = t(titleKey)
    if (translated && translated !== titleKey) return translated
  }

  const title = (meta as { title?: string }).title
  if (title) return title

  return typeof to.name === 'string' ? to.name : ''
}
