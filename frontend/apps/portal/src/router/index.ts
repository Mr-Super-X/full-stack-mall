/**
 * 路由入口（portal 企业官网门户）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * 工厂单源化原 6 app 逐字同构段（P6 装配编排层收敛）：createRouter 配置
 * （rootRedirect → notFoundRoute → 业务路由 → fallback 顺序）/ registerAppRouter
 * DI / 白名单直通 + 兜底可见性守卫。app 侧只保留差异数据：
 * - rootRedirect → /home（home 模块为唯一业务模块，portal 落地页）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单，
 *   路由记录必须留在这里而非工厂构建）
 * - 白名单谓词 isPortalWhiteListed（数据归 portal 私有，谓词逻辑归 @vv/shared）
 *
 * portal 裁剪：无登录 / 权限 / 远程菜单守卫（全站公开）——白名单直通 +
 * 可见性检查即全部守卫语义；无 tags-view afterEach、无 /500 错误页
 * （渲染错误由 App.vue 的 ErrorBoundary 兜底）。
 * historyMode / base 由工厂读 VITE_HISTORY_MODE / VITE_BASE 解析（gh-pages
 * 演示构建走 hash + 子路径 base）。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（home 路由名全量吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { isPortalWhiteListed } from './whitelist'
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
  isRouteWhiteListed: isPortalWhiteListed,
})

export default router
