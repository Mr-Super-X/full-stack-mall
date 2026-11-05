/**
 * home 模块路由。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计（最小公开应用骨架）：
 * - `/home` 使用 `blank` 布局（无侧边栏 / 顶部的全屏纯净壳）
 * - 公开访问：本应用全站公开，`src/router/whitelist.ts` 经本文件的 routeNames
 *   全量吸收（不挂登录守卫，白名单直通 + 可见性检查兜底）
 *
 * @see [`@/router/auto-register.ts`](../../../router/auto-register.ts) 自动注册入口
 * @see [`@/router/whitelist.ts`](../../../router/whitelist.ts) 白名单吸收方（routeNames）
 * @see [`../views/index.vue`](../views/index.vue) 首页视图
 * @group 业务模块：Home
 */

import type { RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源（递归拍平 children，新增子路由自动跟随）
import { collectRouteNames } from '@vv/shared'

const routes: RouteRecordRaw[] = [
  {
    path: '/home',
    component: () => import('@/layouts/blank/index.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/index.vue'),
        meta: {
          title: '首页',
        },
      },
    ],
  },
]

/**
 * home 全部路由 name（供白名单全量吸收）。
 * 提取逻辑单源在 @vv/shared `collectRouteNames`（递归拍平 children，新增子路由自动跟随）。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)

export default routes
