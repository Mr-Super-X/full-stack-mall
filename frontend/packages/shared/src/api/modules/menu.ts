/**
 * 菜单 API。
 *
 * 设计要点：
 * - 仅返回业务路由 `name`（不返回组件路径，避免泄露前端源码结构）
 * - 由前端 `src/router/auto-register.ts` 派生 `COMPONENT_REGISTRY`（name → 组件）
 * - 后端按用户角色过滤可见菜单，前端无需再校验可见性
 *
 * 重试 / 超时：
 * - `timeout`：通过 axios config 传入（毫秒）
 * - `retries`：在 `src/router/remote.ts` 的 `fetchRemoteRoutes` 用 `withRetry` 包装
 *
 * @see [`src/router/auto-register.ts`](../../router/auto-register.ts) 路由注册
 * @see [`src/router/remote.ts`](../../router/remote.ts) 远程菜单加载
 * @group 业务 API：菜单
 */

import { request } from '../http'
import type { RouteMeta } from 'vue-router'

/**
 * 后端返回的菜单项 JSON 格式（与后端约定）。
 *
 * 设计要点：
 *  - name 是业务路由名（前端通过 auto-register.ts 派生的 COMPONENT_REGISTRY 校验）
 *  - 不返回 component 路径（避免泄露前端源码结构）
 *  - children 嵌套支持多级菜单
 *  - hidden: true → 前端转换为 meta.visible: false（守卫拦截）
 *
 * 类型契约归本包（P1-3 包化：API 契约与请求出口同址）；
 * admin 侧 `router/types.ts` 以 re-export 保持既有消费方（remote.ts 等）零改动。
 * meta 引用 vue-router 的 RouteMeta——app 侧的 `declare module 'vue-router'` 扩展
 * 在 app 编译单元内自动叠加，结构上兼容。
 *
 * zod schema 在 app 侧 router/remote.ts 实现（RemoteMenuItemSchema），
 * 本类型作为 TS 静态契约；运行时校验由 remote.ts 守卫加载时执行。
 */
export interface RemoteMenuItem {
  name: string
  path: string
  meta?: RouteMeta & {
    /**
     * 后端标记菜单是否隐藏。后端用 `hidden: true`（行业惯例），
     * 前端转换为 `meta.visible: false`（统一内部约定）。
     */
    hidden?: boolean
  }
  children?: RemoteMenuItem[]
}

export const menuApi = {
  /**
   * 获取当前用户的可见菜单树（按角色权限过滤后）。
   *
   * 支持的 config 字段：
   * - `timeout?`：单次请求超时（毫秒）
   *
   * @group 业务 API：菜单
   */
  getMenu: (config: { timeout?: number } = {}) =>
    request<RemoteMenuItem[]>({ url: '/menu', method: 'get', ...config }),
}
