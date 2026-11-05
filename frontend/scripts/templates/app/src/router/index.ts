/**
 * 路由入口（__APP_NAME__）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * app 侧只保留差异数据：
 * - rootRedirect → /home（home 模块为脚手架自带的首个业务模块）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单，
 *   路由记录必须留在这里而非工厂构建）
 * - 白名单谓词 is__ROUTE_NAME__WhiteListed（数据归 app 私有，谓词逻辑归 @vv/shared）
 *
 * 最小公开应用：无登录 / 权限 / 远程菜单守卫（全站公开）——白名单直通 +
 * 可见性检查即全部守卫语义；渲染错误由 App.vue 壳体的 ErrorBoundary 兜底。
 * historyMode / base 由工厂读 VITE_HISTORY_MODE / VITE_BASE 解析。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（home 路由名全量吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { is__ROUTE_NAME__WhiteListed } from './whitelist'
import NotFound from '@/views/NotFound.vue'

/**
 * 站内 404（白名单成员；fallback catch-all 重定向的目标）。
 * 字面量保留在本文件：scripts/check-routes.ts 按 `name:` 正则从 router/index.ts
 * 提取根级实现名单（NotFound 在 router 层注册而非 modules）。
 */
const notFoundRoute: RouteRecordRaw = {
  path: '/404',
  name: 'NotFound',
  component: NotFound,
  meta: { title: '页面不存在' },
}

export const router = createAppRouter({
  rootRedirect: '/home',
  notFoundRoute,
  routes: autoRegisteredRoutes,
  fallbackRoute,
  isRouteWhiteListed: is__ROUTE_NAME__WhiteListed,
})

export default router
