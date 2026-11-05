/**
 * 路由守卫 —— 编排入口。
 *
 * 把 5 段检查（白名单 → 可见性 → 登录态 → 远程菜单 → 权限）串成一个流水线。
 * 纯函数守卫段（可见性/登录态/权限）+ 编排器自 P1-3 起归 @vv/shared
 * （packages/shared/src/router-guards）；本文件保留 admin 编排职责：
 * 注入 admin 私有白名单数据、远程菜单加载器与各 store 实例。
 *
 * 顺序说明（顺序敏感）：白名单必须最前，否则错误页本身会被拦截；
 * 可见性必须在登录前，否则未登录用户访问 hidden 路由会被跳去登录页，体验糟糕。
 *
 * 错误处理：
 * - 远程菜单加载失败 → console.warn + 保持 local（`fetchRemoteRoutes` 内部已捕获）
 * - 动态 import 失败 → `src/router/index.ts` 的 `error-boundary.ts` 处理
 *
 * @see `@vv/shared/router-guards` 守卫骨架
 * @see [`../whitelist.ts`](../whitelist.ts) 白名单数据与判定接线
 * @group 路由：守卫编排
 */

import type { Router } from 'vue-router'
import {
  checkVisibility,
  checkLoginState,
  checkPermission,
  composeGuards,
} from '@vv/shared/router-guards'
import { registerLocalStateResetHook, useUserStore } from '@vv/shared'
import { useRouterStore } from '@/store/modules/router'
import { isAdminWhiteListed } from '../whitelist'
import { ensureRemoteMenuLoaded, resetAuthGuardState } from './remote-menu'

export { resetAuthGuardState }

// user store 复位接线（P1-3 DI）：shared 的 user store 不反向依赖 app，
// 登出/凭证失效时的守卫状态 + 路由 UI store 复位经钩子挂接。
// 模块级注册：本文件由 router/index.ts 在启动期 import，先于任何 logout 发生
registerLocalStateResetHook(() => {
  resetAuthGuardState()
  const routerStore = useRouterStore()
  if (typeof routerStore.$reset === 'function') {
    routerStore.$reset()
  }
})

/**
 * 注册路由守卫到 vue-router。
 *
 * 调用一次（在 src/router/index.ts 创建 router 后）。
 * 守卫内部用 composeGuards 串接所有 check，确保顺序、可测性、可中断。
 *
 * P4 跨应用登录协议：checkLoginState 未登录时经 redirectToAuthLogin 整页跳
 * apps/auth（location.href 已发起），其 AUTH_REDIRECTING 中断信号由
 * composeGuards 透传到此——return false 取消本次 SPA 导航，静候整页跳转，
 * 不再走 vue-router 内部 redirect（admin 内已无 /login 路由）。
 */
export function setupAuthGuard(router: Router): void {
  router.beforeEach(async (to) => {
    // 1. 白名单：跳过所有检查（按路由 name 匹配）
    if (isAdminWhiteListed(to.name)) return true

    const userStore = useUserStore()
    const routerStore = useRouterStore()

    // 2-5. 顺序检查：可见性 → 登录态 → 远程菜单 → 权限
    // 任一返回 RouteLocationRaw 立即终止（vue-router 跳转到该路由）
    try {
      const result = await composeGuards(to, [
        (route) => checkVisibility(route),
        (route) => checkLoginState(route, userStore),
        (route) => ensureRemoteMenuLoaded(route, userStore, routerStore, router),
        (route) => checkPermission(route, userStore),
      ])

      // null = 放行；非 null = vue-router 内部跳转到 RouteLocationRaw
      return result ?? true
    } catch (err) {
      // AUTH_REDIRECTING：整页跳 apps/auth 已发起，取消本次导航即可（非错误）
      if (err instanceof Error && err.message === 'AUTH_REDIRECTING') return false
      throw err
    }
  })
}
