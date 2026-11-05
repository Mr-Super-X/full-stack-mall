/**
 * h5-demo 模块路由（h5 布局验收模块）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计：
 * - 父记录 component 挂 `@/layouts/h5/index.vue` → 获得 H5 面板能力（rem 适配自动激活/恢复）
 * - requiresAuth: false + 白名单（src/router/whitelist.ts 经 routeNames 全量吸收）→
 *   免登录，方便手机扫码真机预览
 * - 本模块路径在 postcss-pxtorem 转换范围（src/modules/h5- 前缀约定），
 *   视图样式直接写 828 设计稿 px，构建时自动转 rem
 *
 * P3-2 变更：模块随 h5 layout 一并自 apps/admin 迁入本 app；
 * noTags 标记语义随迁（admin 已摘除本模块，无 TagsView 消费方，标记保留仅作契约文档）。
 *
 * @see [`../views/index.vue`](../views/index.vue) rem 适配演示页
 * @see [`../../router/whitelist.ts`](../../router/whitelist.ts) routeNames 消费方
 * @group 业务模块：H5Demo
 */

import type { RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源（2026-10-23 重复性审查：5 app 三份拷贝+变体+字面量统一）；
// 原 flatMap 只看一层 children，collectRouteNames 递归拍平，语义是超集
import { collectRouteNames } from '@vv/shared'

const routes: RouteRecordRaw[] = [
  {
    path: '/h5-demo',
    component: () => import('@/layouts/h5/index.vue'),
    children: [
      {
        path: '',
        name: 'H5Demo',
        component: () => import('../views/index.vue'),
        meta: {
          title: 'H5 示例',
          requiresAuth: false,
          noTags: true, // workbench 直达的验收页，不污染 TagsView
        },
      },
      {
        path: 'vant-test',
        name: 'H5VantTest',
        component: () => import('../views/VantTest.vue'),
        meta: {
          title: 'Vant 4 验证',
          requiresAuth: false,
          noTags: true,
        },
      },
    ],
  },
]

export default routes

/**
 * 本模块全部路由 name（白名单吸收用，单一事实源）。
 *
 * 从 routes 派生而非手写第二份：新增子路由时白名单自动跟随，
 * 杜绝「路由已实现但白名单漏配」的漂移（check:routes 的 A 校验同源）。
 * 提取逻辑单源在 @vv/shared `collectRouteNames`。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)
