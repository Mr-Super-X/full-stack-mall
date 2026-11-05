/**
 * reports 模块路由（隐藏菜单演示）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到。
 *
 * **隐藏菜单设计**：meta.menuVisible: false 让菜单列表不渲染此条目，但 URL 直访不受限。
 * 用 menuVisible 而非 visible，因为 visible: false 会被守卫拦截直访。
 *
 * 适用场景：客服通过邮件链接直达报表页（不暴露在常规菜单）。
 *
 * @see [`@/router/auto-register.ts`](../../../router/auto-register.ts) 自动注册入口
 * @see [`../views/index.vue`](../views/index.vue) 报表页
 * @group 业务模块：Reports
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/reports',
    component: () => import('@/layouts/default/index.vue'),
    children: [
      {
        path: '',
        name: 'Reports',
        component: () => import('../views/index.vue'),
        meta: {
          title: '运营报表',
          icon: 'data-analysis',
          permissions: ['reports:view'],
          // 菜单隐藏但允许 URL 直访（场景：客服通过邮件链接直达报表页）。
          // 注意：用 menuVisible 而非 visible，因为 visible: false 会被守卫拦截直访。
          menuVisible: false,
        },
      },
    ],
  },
]

export default routes
