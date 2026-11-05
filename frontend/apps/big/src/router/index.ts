/**
 * 路由入口（big 数据大屏站）——装配收敛至 @vv/shared createAppRouter 工厂。
 *
 * app 侧只保留差异数据：
 * - rootRedirect → /big-demo（big-demo 路由父记录挂 big layout，scale 适配自动激活）
 * - notFoundRoute 字面量（check-routes 按 name 正则从本文件提取实现名单）
 * - 白名单谓词 isBigWhiteListed（big-demo 全部路由名 + NotFound 已吸收）
 *
 * big 全站公开：无登录 / 权限 / 远程菜单守卫，守卫只挂白名单直通 + 可见性检查；
 * 无 tags-view afterEach、无 /500 错误页。historyMode / base 由工厂读环境解析
 * （预留子路径部署能力）。
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 模块路由自动扫描
 * @see [`./whitelist.ts`](./whitelist.ts) 白名单（big-demo 路由名全量吸收）
 * @group 路由：入口
 */
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from '@vv/shared'
import { autoRegisteredRoutes } from './auto-register'
import { fallbackRoute } from './fallback'
import { isBigWhiteListed } from './whitelist'
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
  rootRedirect: '/big-demo',
  notFoundRoute,
  routes: autoRegisteredRoutes,
  fallbackRoute,
  isRouteWhiteListed: isBigWhiteListed,
})

export default router
