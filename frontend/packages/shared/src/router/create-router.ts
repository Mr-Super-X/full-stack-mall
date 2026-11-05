/**
 * 路由创建编排工厂（@vv/shared 单源）。
 *
 * 文件角色：createAppRouter——原 6 个 app 的 router/index.ts 中逐字重复的
 * 创建编排段（createRouter 配置 / registerAppRouter DI / 白名单直通守卫，
 * 约 45 行 × 6 份）的单源实现。P5 已下沉纯函数段（resolveBasePath /
 * createDefaultScrollBehavior / createFallbackRoute）与守卫骨架
 * （checkVisibility / isWhiteListed），本文件收敛编排层。
 *
 * 两类消费形态（均由参数表达，工厂不硬编码 app 差异）：
 * - 公开 app（portal/auth/h5/big/docs）：传 notFoundRoute + isRouteWhiteListed，
 *   工厂挂「白名单直通 + 兜底可见性」公开守卫
 * - admin：不传 isRouteWhiteListed（其守卫链由 setupAuthGuard 自管白名单），
 *   私有装配（setupAuthGuard → setupRouterErrorBoundary → tags-view afterEach）
 *   经 extraSetup 按序注入
 *
 * notFoundRoute 字面量刻意留在 app 的 router/index.ts（而非工厂构建）：
 * scripts/check-routes.ts 用 `name: 'Xxx'` 正则从该文件提取根级实现名单
 * （NotFound 在 router 层注册而非 modules），路由收进工厂会让 A 校验误报。
 *
 * @see [`./base.ts`](./base.ts) base 解析 / 统一 scroll 行为
 * @see [`../app-router.ts`](../app-router.ts) router 实例 DI（registerAppRouter）
 * @see [`../router-guards/visibility.ts`](../router-guards/visibility.ts) 兜底可见性检查
 * @group 路由：创建编排
 */
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import type { RouteRecordRaw, Router } from 'vue-router'
import { registerAppRouter } from '../app-router.ts'
import { createDefaultScrollBehavior, resolveBasePath } from './base.ts'
import { checkVisibility } from '../router-guards/visibility.ts'

/** createAppRouter 装配参数：app 差异数据 + 可选私有装配 */
export interface CreateAppRouterOptions {
  /**
   * 根路径重定向目标：访问 `/` 时跳到这里（如 '/workbench' '/home' '/demo'）。
   * 不放 fallback：catch-all（`/:pathMatch(.*)*`）会把 `/` 也吞掉跳 /404，
   * 与「打开站点应看到首页」的预期不符；故 rootRedirect 最先注册。
   */
  rootRedirect: string
  /**
   * 站内 404 兜底路由记录（白名单成员；fallback catch-all 重定向的目标）。
   * 字面量必须保留在 app 的 router/index.ts——check-routes 按 name 正则从该文件
   * 提取实现名单；缺省不注册（admin 的 /404 归 modules/error 路由）。
   */
  notFoundRoute?: RouteRecordRaw
  /** 业务路由（各 app autoRegisteredRoutes 展开结果） */
  routes: RouteRecordRaw[]
  /** catch-all 404 兜底（各 app ./fallback 薄封装 createFallbackRoute()，必须最后注册） */
  fallbackRoute: RouteRecordRaw
  /**
   * 白名单直通谓词（app whitelist.ts 的 isXxxWhiteListed——数据归 app 私有，
   * 谓词逻辑归 @vv/shared isWhiteListed，两者在 app 侧接线后经此传入）。
   * 传则挂「白名单直通 + 兜底可见性」公开守卫；缺省不挂（admin 守卫链自管白名单）
   */
  isRouteWhiteListed?: (routeName: unknown) => boolean
  /**
   * history 模式：'web'（主流，URL 干净，需后端 SPA fallback）/
   * 'hash'（URL 带 #，免后端 rewrite，gh-pages 子路径部署用）。
   * 缺省读 VITE_HISTORY_MODE 环境（='hash' 时 hash），与其余 5 app 原口径一致
   */
  historyMode?: 'web' | 'hash'
  /**
   * app 私有装配：在 registerAppRouter 之后、公开白名单守卫之前按序调用——
   * admin 传 [setupAuthGuard, setupRouterErrorBoundary, setupTagsViewSync]
   * （顺序敏感：白名单/登录守卫先于错误边界先于 tags-view afterEach）
   */
  extraSetup?: Array<(router: Router) => void>
}

/**
 * 按固化顺序创建 app 路由实例（6 app router/index.ts 编排单源）。
 *
 * 顺序即契约：createRouter（rootRedirect → notFoundRoute? → 业务路由 → fallback
 * catch-all 必须最后）→ registerAppRouter DI（先于一切守卫注册——守卫链内
 * checkLoginState / 远程菜单加载会触发请求与跳转）→ extraSetup 私有装配 →
 * 公开白名单守卫（仅公开 app）。
 *
 * @param options 装配参数（差异数据 + 可选私有装配，见 {@link CreateAppRouterOptions}）
 * @returns 装配完成的 Router 实例（registerAppRouter 已接线）
 */
export function createAppRouter(options: CreateAppRouterOptions): Router {
  const {
    rootRedirect,
    notFoundRoute,
    routes,
    fallbackRoute,
    isRouteWhiteListed,
    historyMode = import.meta.env.VITE_HISTORY_MODE === 'hash'
      ? ('hash' as const)
      : ('web' as const),
    extraSetup,
  } = options

  // 路由注册顺序（顺序敏感）：rootRedirect 先匹配防被 fallback 吞 → notFoundRoute
  // （可选）→ 业务路由 → fallbackRoute catch-all 必须最后（保证最后匹配）
  const router = createRouter({
    history:
      historyMode === 'hash'
        ? createWebHashHistory(resolveBasePath())
        : createWebHistory(resolveBasePath()),
    routes: [
      { path: '/', redirect: rootRedirect },
      ...(notFoundRoute ? [notFoundRoute] : []),
      ...routes,
      fallbackRoute,
    ],
    scrollBehavior: createDefaultScrollBehavior(),
  })

  // DI 注入必须先于一切守卫注册：守卫链内可能触发请求与跳转
  // （useAppRouter / http 401 登出跳转经 getAppRouter 读取本实例）
  registerAppRouter(router)

  // app 私有装配（admin 的 setupAuthGuard → setupRouterErrorBoundary → tags-view afterEach）
  extraSetup?.forEach((setup) => setup(router))

  // 公开 app 守卫：白名单直通（跳过登录/权限语义在此短路）+ 兜底可见性检查
  // （hidden 路由不直达，语义与 admin 守卫第一段一致）
  if (isRouteWhiteListed) {
    router.beforeEach((to) => {
      if (isRouteWhiteListed(to.name)) return true
      return checkVisibility(to) ?? true
    })
  }

  return router
}
