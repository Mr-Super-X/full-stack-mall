/**
 * 路由入口（docs demo 文档站）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * app 侧只保留差异数据：
 * - rootRedirect → /demo（demo 路由自身再 redirect 到首个示例）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单）
 * - 白名单谓词 isDocsWhiteListed（demo 全部路由名 + NotFound 已吸收）
 *
 * docs 全站公开：无登录 / 权限 / 远程菜单守卫（菜单即 demo 路由静态注册），
 * 守卫只挂白名单直通 + 可见性检查；无 tags-view afterEach、无 /500 错误页。
 * historyMode / base 由工厂读环境解析（gh-pages 演示构建走 hash + 子路径 base）。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（demo 路由名全量吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { isDocsWhiteListed } from './whitelist'
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
  rootRedirect: '/demo',
  notFoundRoute,
  routes: autoRegisteredRoutes,
  fallbackRoute,
  isRouteWhiteListed: isDocsWhiteListed,
})

export default router
