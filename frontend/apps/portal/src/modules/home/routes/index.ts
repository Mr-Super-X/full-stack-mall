/**
 * home 模块路由。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计（2026-10-20 企业官网改造）：
 * - `/home` 使用 `portal` 布局（简约顶栏 + 锚点导航的企业官网）
 * - 公开访问：portal 全站公开，`src/router/whitelist.ts` 经本文件的 routeNames
 *   全量吸收（portal 不挂登录守卫，白名单直通 + 可见性检查兜底）
 * - 首页刻意不进多页签（meta.noTags: true），portal 落地页通过顶部锚点导航返回即可
 *
 * P3-1 变更：模块从 apps/admin 随迁到 apps/portal（企业官网独立为门户应用）；
 * 原「远程菜单模式下覆盖本地路由」语义随 admin 远程菜单一并摘除（portal 无远程菜单）。
 *
 * @see [`@/router/auto-register.ts`](../../../router/auto-register.ts) 自动注册入口
 * @see [`@/router/whitelist.ts`](../../../router/whitelist.ts) 白名单吸收方（routeNames）
 * @see [`../views/index.vue`](../views/index.vue) 官网首页视图
 * @group 业务模块：Home
 */

import type { RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源（2026-10-23 重复性审查：5 app 三份拷贝+变体+字面量统一）
import { collectRouteNames } from '@vv/shared'

const routes: RouteRecordRaw[] = [
  {
    path: '/home',
    component: () => import('@/layouts/portal/index.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/index.vue'),
        meta: {
          title: '首页',
          titleKey: 'menu.home',
          icon: 'odometer',
          noTags: true,
        },
      },
    ],
  },
]

/**
 * home 全部路由 name（供 portal 白名单吸收）。
 * 提取逻辑单源在 @vv/shared `collectRouteNames`（递归拍平 children，新增子路由自动跟随）。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)

export default routes
