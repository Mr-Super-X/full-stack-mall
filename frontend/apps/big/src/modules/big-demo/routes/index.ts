/**
 * big-demo 模块路由（big layout 验收模块）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * P3-3 变更：模块随 big layout 自 admin 物理独立到 apps/big；
 * 白名单吸收改由本 app 的 src/router/whitelist.ts 经 routeNames 全量引入
 * （noTags 在 big 无 TagsView 消费方，保留仅为 meta 契约语义，见 admin router/types.ts）。
 *
 * 设计：
 * - 父记录 component 挂 `@/layouts/big/index.vue` → 获得大屏面板能力（scale 适配自动激活）
 * - requiresAuth: false + 白名单（本 app src/router/whitelist.ts）→ 免登录，演示厅直接打开
 * - 超宽页通过 meta.bigScreen 声明 9000×1080 设计稿尺寸（缺省 1920×1080）
 *
 * @see [`../views/index.vue`](../views/index.vue) 1920 标准大屏
 * @see [`../views/Wide.vue`](../views/Wide.vue) 9000×1080 超宽拼接屏示例
 * @group 业务模块：BigDemo
 */

import type { RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源（2026-10-23 重复性审查：原硬编码字面量在新增强
// 路由时白名单不跟随，漂移面最大，改为从 routes 派生）
import { collectRouteNames } from '@vv/shared'

const routes: RouteRecordRaw[] = [
  {
    path: '/big-demo',
    component: () => import('@/layouts/big/index.vue'),
    children: [
      {
        path: '',
        name: 'BigDemo',
        component: () => import('../views/index.vue'),
        meta: {
          title: '数据大屏',
          requiresAuth: false,
          noTags: true, // 免登录直达验收页语义（big 无 TagsView，契约字段保留）
        },
      },
      {
        path: 'wide',
        name: 'BigDemoWide',
        component: () => import('../views/Wide.vue'),
        meta: {
          title: '超宽拼接大屏',
          requiresAuth: false,
          noTags: true, // 免登录直达验收页语义（big 无 TagsView，契约字段保留）
          bigScreen: { width: 9000, height: 1080 },
        },
      },
      {
        // 五态示范页（/autoplan Phase 2 D-SC-1）：异步数据在大屏场景的五种形态集中演示
        path: 'state-demo',
        name: 'BigDemoStateDemo',
        component: () => import('../views/StateDemo.vue'),
        meta: { title: '五态示范', requiresAuth: false, noTags: true },
      },
    ],
  },
]

/**
 * 白名单吸收依据：本模块全部路由 name（apps/big/src/router/whitelist.ts 消费）。
 * 从 routes 派生（collectRouteNames 单源）：新增子路由时白名单自动跟随，
 * 杜绝「路由已实现但白名单漏配」的漂移（check:routes 的 A 校验同源）。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)

export default routes
