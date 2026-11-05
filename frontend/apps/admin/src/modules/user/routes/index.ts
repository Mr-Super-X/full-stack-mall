/**
 * user 模块路由。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计：
 * - `/user/list` 使用 `default` 布局（完整后台框架）
 * - meta.permissions: ['user:view'] 触发 v-auth 守卫检查
 * - meta.icon: 'user' 在侧边栏显示对应图标
 *
 * @see [`@/router/auto-register.ts`](../../../router/auto-register.ts) 自动注册入口
 * @see [`../views/List.vue`](../views/List.vue) 用户列表页
 * @group 业务模块：User
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    component: () => import('@/layouts/default/index.vue'),
    children: [
      {
        path: 'list',
        name: 'UserList',
        component: () => import('../views/List.vue'),
        meta: {
          title: '用户管理',
          titleKey: 'menu.user',
          icon: 'user',
          requiresAuth: true,
          permissions: ['user:view'],
        },
      },
    ],
  },
]

export default routes
