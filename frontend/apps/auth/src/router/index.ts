/**
 * 路由入口（auth 统一登录应用）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * app 侧只保留差异数据：
 * - rootRedirect → /login（auth 唯一业务页）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单）
 * - 白名单谓词 isAuthWhiteListed（登录页本身公开，全部 auth 路由名 + NotFound 已吸收）
 *
 * auth 裁剪：无登录 / 权限 / 远程菜单守卫——auth 是登录态读写入口，不做登录态
 * 拦截，守卫只挂白名单直通 + 可见性检查；无 tags-view afterEach、无 /500 错误页。
 * historyMode / base 由工厂读 VITE_HISTORY_MODE / VITE_BASE 解析。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（auth 路由名全量吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { isAuthWhiteListed } from './whitelist'
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
  rootRedirect: '/login',
  notFoundRoute,
  routes: autoRegisteredRoutes,
  fallbackRoute,
  isRouteWhiteListed: isAuthWhiteListed,
})

export default router
