/**
 * h5-mall 商城首页路由（拙衣 ZHUOYI · 陶土秋季）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计（对齐 h5-demo 模块先例）：
 * - 父记录 component 挂 `@/layouts/h5/index.vue` → 获得 H5 面板能力（rem 适配自动激活/恢复）
 * - requiresAuth: false + 白名单（src/router/whitelist.ts 经 routeNames 全量吸收）→
 *   免登录，方便手机扫码真机预览
 * - 本模块路径在 postcss-pxtorem 转换范围（src/modules/h5- 前缀约定），
 *   视图样式直接写 828 设计稿 px，构建时自动转 rem
 *
 * @see [`../views/index.vue`](../views/index.vue) 商城首页
 * @see [`../../router/whitelist.ts`](../../router/whitelist.ts) routeNames 消费方
 * @group 业务模块：H5Mall
 */

import type { RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源：collectRouteNames 递归拍平 children，
// 新增子路由时白名单自动跟随，杜绝「路由已实现但白名单漏配」的漂移
import { collectRouteNames } from '@vv/shared'

const routes: RouteRecordRaw[] = [
  {
    path: '/h5-mall',
    component: () => import('@/layouts/h5/index.vue'),
    children: [
      {
        path: '',
        name: 'H5Mall',
        component: () => import('../views/index.vue'),
        meta: {
          title: '拙衣商城',
          requiresAuth: false,
          noTags: true, // h5 无 TagsView，标记仅作契约文档（同 h5-demo 语义）
        },
      },
    ],
  },
]

export default routes

/**
 * 本模块全部路由 name（白名单吸收用，单一事实源）。
 *
 * 从 routes 派生而非手写第二份；提取逻辑单源在 @vv/shared `collectRouteNames`。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)
