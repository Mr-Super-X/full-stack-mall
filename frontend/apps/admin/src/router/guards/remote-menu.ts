/**
 * 守卫 —— 远程菜单懒加载（独立可测的纯函数）。
 *
 * 业务背景：
 * - remote 模式下，登录后从 `/mock/menu` 拉菜单并 `router.addRoute()` 注入
 * - 每个 token 周期只拉一次（`dynamicLoaded` 标记）
 * - 加载失败 / 返回空 → 保持 local 菜单（不影响用户当前页）
 *
 * 模块级状态：
 * - `dynamicLoaded`：本次登录周期内是否已加载
 * - `currentAuthState`：上次加载时的登录标记（检测登录切换，重置 `dynamicLoaded`）
 *
 * 这些状态必须在此文件内（而非上层 auth.ts），便于 `resetAuthGuardState` 重置。
 *
 * @see [`./auth.ts`](./auth.ts) `ensureRemoteMenuLoaded` 调用点
 * @see [`../remote.ts`](../remote.ts) `fetchRemoteRoutes` 拉取与转换
 * @group 路由：远程菜单守卫
 */

import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import type { useUserStore } from '@vv/shared'
import type { useRouterStore } from '@/store/modules/router'
import { showBadge } from '@vv/shared'
import { ROUTER_CONFIG } from '../config'
import { fetchRemoteRoutes } from '../remote'

type UserStore = ReturnType<typeof useUserStore>
type RouterStore = ReturnType<typeof useRouterStore>

/** 本次登录周期内是否已加载远程菜单 */
let dynamicLoaded = false

/**
 * 上次加载时的登录标记，用于检测登录切换。
 * httpOnly 模式下 token 不可读，用 authenticated 布尔替代：
 * 账号切换必然经过 logout(false) → login(true) 的跳变，等价于 token 变化检测。
 */
let currentAuthState: boolean | null = null

/**
 * 确保远程菜单已加载（每个登录周期只拉一次）。
 *
 * 行为：
 *  - local 模式 → 直接返回 null（无需加载）
 *  - remote 模式 + 未加载 → 拉 /mock/menu，注入路由，重新触发守卫
 *  - 加载失败或返回空 → console.warn，保持 local（返回 null 放行）
 *
 * @returns null 表示可以继续走流程；RouteLocationRaw 表示需重新触发守卫
 */
export async function ensureRemoteMenuLoaded(
  to: RouteLocationNormalized,
  userStore: UserStore,
  routerStore: RouterStore,
  router: Router
): Promise<RouteLocationRaw | null> {
  if (ROUTER_CONFIG.source !== 'remote') return null

  // 登录态变化（登录/登出）→ 重置 dynamicLoaded，下次重新拉取
  if (userStore.authenticated !== currentAuthState) {
    dynamicLoaded = false
    currentAuthState = userStore.authenticated
  }

  if (dynamicLoaded) return null

  routerStore.setLoadingRemoteMenu(true)
  try {
    const remoteRoutes = await fetchRemoteRoutes()
    if (remoteRoutes.length === 0) {
      console.warn('[router] remote 菜单为空（接口失败或返回空），保持 local 菜单')
      // 徽章：label 蓝色（路由/导航语义，与 GlobalComponents 灰 / Web Vitals 紫拉开）
      showBadge('Router · 远程菜单', '0 个 · fallback', '#2563eb', '#9ca3af')
    } else {
      let injected = 0
      for (const r of remoteRoutes) {
        // 本地 routes/index.ts 是路由结构的单一事实源（auto-register.ts）。
        // addRoute 的同名替换规则会把本地"布局 + children"嵌套结构中的子路由
        // 从 matcher 中移除，导致 layout 渲染但子路由空白（2026-08-12 修复）：
        // 同名路由不替换，仅合并远程 meta（后端 hidden → meta.visible:false
        // 的双轨收紧仍然生效）；远程独有的新路由才注入。
        if (r.name && router.hasRoute(r.name)) {
          const existing = router.getRoutes().find((record) => record.name === r.name)
          // 注意（2026-08-12 架构审查补齐）：Object.assign 直接改写 vue-router matcher
          // 内部的 RouteRecord 对象，绕过了公开 API——
          //   1. 依赖 matcher 内部结构，属未公开行为：升级 vue-router 大版本时
          //      必须回归验证「远程 meta 合并后路由仍正常匹配」
          //   2. 合并是非响应式的：已渲染的菜单/页签不会随 meta 变化自动更新，
          //      仅对后续导航生效；若未来需要"菜单实时收紧"需改为重渲染方案
          if (existing && r.meta) Object.assign(existing.meta, r.meta)
          continue
        }
        router.addRoute(r)
        injected++
      }
      showBadge('Router · 远程菜单', `已注入 ${injected} 个`, '#2563eb', '#0e9f6e')
    }
    dynamicLoaded = true
    // 重新触发守卫（此时路由已注册，可正常匹配 + 应用可见性检查）
    return { path: to.fullPath, replace: true }
  } finally {
    routerStore.setLoadingRemoteMenu(false)
  }
}

/**
 * 重置远程菜单加载状态（供测试 / 强制刷新场景使用）。
 *
 * 命名说明：本函数曾用 `resetRouterState`，但实际只重置本守卫的 dynamicLoaded +
 * currentAuthState 模块级状态，不涉及 vue-router 全局状态。改为更精确的语义。
 */
export function resetAuthGuardState(): void {
  dynamicLoaded = false
  currentAuthState = null
}
