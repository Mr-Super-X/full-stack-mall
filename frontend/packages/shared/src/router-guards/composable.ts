/**
 * 守卫 —— 统一编排器（chain guards）。
 *
 * 把多个 guard 串成一个调用链，任一 guard 返回非 null 即终止。
 *
 * 设计要点：
 * - 类似 koa / express 的 middleware chain，返回 `RouteLocationRaw` 即 `next('error')`
 * - 支持 async guards（`fetchProfile` / `ensureRemoteMenuLoaded` 都需要异步）
 * - 任何 guard 抛错时记录 `console.error` 并放行（避免守卫自身错误阻塞整个 SPA）
 *
 * @see 编排器位于各 app 的 `router/guards/auth.ts`（如 apps/admin）—— `composeGuards` 调用方
 * @group 路由：守卫编排
 */

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export type RouteGuard = (
  to: RouteLocationNormalized,
  ...args: unknown[]
) => RouteLocationRaw | null | Promise<RouteLocationRaw | null>

/**
 * 顺序执行 guards 链，返回第一个非 null 的跳转目标或 null。
 *
 * 调用方按顺序传入 guards，链中任一 guard 返回 RouteLocationRaw 即终止。
 * 不修改路由或路由状态，不抛错（错误被吞并 console.error）。
 *
 * 例外（P4 跨应用登录协议）：guard 抛出的 `AUTH_REDIRECTING` 是
 * redirectToAuthLogin 的中断信号（整页 location.href 已发起），**不吞**——
 * 透传给 app 编排器 catch 后 return false 取消本次导航，避免吞掉后守卫链
 * 继续空跑（未登录时白拉远程菜单 / 权限检查做无意义计算）。
 */
export async function composeGuards(
  to: RouteLocationNormalized,
  guards: ReadonlyArray<RouteGuard>,
  context: ReadonlyArray<unknown> = []
): Promise<RouteLocationRaw | null> {
  for (const guard of guards) {
    try {
      const result = await guard(to, ...context)
      if (result !== null) return result
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH_REDIRECTING') throw err
      console.error('[router/guards] guard 执行失败:', err)
      // 不中断链路，继续执行下一个 guard
    }
  }
  return null
}
