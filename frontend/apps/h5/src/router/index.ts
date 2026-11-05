/**
 * 路由入口（h5 移动端）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * app 侧只保留差异数据：
 * - rootRedirect → /h5-mall（商城首页为应用门面，2026-11-04 用户裁决）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单）
 * - 白名单谓词 isH5WhiteListed（h5-demo + h5-mall 路由名 + NotFound 已吸收）
 *
 * h5 全站公开：无登录 / 权限 / 远程菜单守卫，守卫只挂白名单直通 + 可见性检查；
 * 无 tags-view afterEach、无 /500 错误页。historyMode / base 由工厂读环境解析。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（h5-demo 路由名吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { isH5WhiteListed } from './whitelist'
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
  // 商城首页是 h5 应用门面（用户裁决 2026-11-04：h5-fashion-mall.html 落地为首页）；
  // /h5-demo 保留作 rem 适配验收页
  rootRedirect: '/h5-mall',
  notFoundRoute,
  routes: autoRegisteredRoutes,
  fallbackRoute,
  isRouteWhiteListed: isH5WhiteListed,
})

export default router
