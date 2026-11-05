/**
 * 路由入口（admin 中后台主干业务端）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * 工厂单源化原逐字同构段（P6 装配编排层收敛）：createRouter 配置 /
 * registerAppRouter DI / historyMode 接线。admin 私有守卫编排经 extraSetup
 * 按序注入（顺序敏感）：
 * 1. setupAuthGuard——白名单 → 可见性 → 登录态 → 远程菜单 → 权限 五段流水线
 *    （P4 起未登录经 redirectToAuthLogin 整页跳 apps/auth）
 * 2. setupRouterErrorBoundary——动态 import 失败 / 路由解析异常跳 /500 错误页
 * 3. tags-view afterEach——路由切换后加入 visitedViews（必须在 setupAuthGuard
 *    后，否则未登录的 redirect 会污染 visitedViews）
 *
 * 不传 isRouteWhiteListed：admin 的守卫链自管白名单（无任何公开页），
 * 工厂不挂公开白名单守卫。
 *
 * 错误页内联注册（2026-10-27 形态统一）：原 modules/error 模块（views+routes 三件套）
 * 拍平为 src/views/ + 本文件根级具名路由——错误页是纯展示页（ErrorPage 组件包圆逻辑，
 * 无领域资产），模块制属过度分层；portal/docs/h5/big 同形态（views/NotFound.vue +
 * router 内联），admin 对齐消灭双形态。check:routes 的正则提取兼容本文件根级路由
 * （scripts/check-routes.ts 附加扫描 router/index.ts 的 name 字段）。
 *
 * 根路径重定向：访问 `/` 时跳到工作台 /workbench（admin 登录后默认落地页，
 * P3-1 起；redirect 后 vue-router 会对 /workbench 重新触发完整守卫链）。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./guards/auth.ts`](./guards/auth.ts) 守卫编排（5 段检查流水线）
 * @group 路由：入口
 */
import type { Router, RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { setupAuthGuard } from './guards/auth'
import { setupRouterErrorBoundary } from './error-boundary'
import { ROUTER_CONFIG } from './config'
import { useTagsViewStore } from '@/store/modules/tags-view'

// 多页签：每次路由切换后自动加入 visitedViews（layout 中通过 keep-alive :include 联动 cache）
// 注意：必须在 setupAuthGuard 后调用，否则未登录的 redirect 会污染 visitedViews
const setupTagsViewSync = (router: Router): void => {
  router.afterEach((to) => {
    useTagsViewStore().addRouteView(to)
  })
}

/**
 * 错误页具名路由（/403 /404 /500）——根级注册，check:routes 正则从此提取名单。
 * noTags：错误页不污染 TagsView。匿名可达性由守卫链的公开白名单判定（apps-registry
 * requiredRoutes 语义：错误页必须匿名可达——未登录命中错误也要求可到达）。
 */
const errorRoutes: RouteRecordRaw[] = [
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/Forbidden.vue'),
    meta: { title: '403', noTags: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '404', noTags: true },
  },
  {
    path: '/500',
    name: 'ServerError',
    component: () => import('@/views/ServerError.vue'),
    meta: { title: '500', noTags: true },
  },
]

export const router = createAppRouter({
  rootRedirect: '/workbench',
  routes: [...errorRoutes, ...autoRegisteredRoutes],
  fallbackRoute,
  historyMode: ROUTER_CONFIG.historyMode,
  extraSetup: [setupAuthGuard, setupRouterErrorBoundary, setupTagsViewSync],
})

export default router
