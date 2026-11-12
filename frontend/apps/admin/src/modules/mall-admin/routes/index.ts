// mall-admin 模块路由
//
// 自动注册：被 src/router/auto-register.ts 扫描到，无需手动 import。
// 权限：子路由 meta.permissions=['mall:admin']（checkPermission 拦截，seller 登录后 /403）。

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/mall-admin',
    component: () => import('@/layouts/default/index.vue'),
    meta: {
      title: '商城后台',
      icon: 'shop',
      requiresAuth: true,
    },
    children: [
      {
        path: 'products',
        name: 'MallAdminProducts',
        component: () => import('../views/Products.vue'),
        meta: {
          title: '自营商品',
          requiresAuth: true,
          permissions: ['mall:admin'],
        },
      },
      {
        path: 'consignments',
        name: 'MallAdminConsignments',
        component: () => import('../views/Consignments.vue'),
        meta: {
          title: '寄卖审核',
          requiresAuth: true,
          permissions: ['mall:admin'],
        },
      },
      {
        path: 'payouts',
        name: 'MallAdminPayouts',
        component: () => import('../views/Payouts.vue'),
        meta: {
          title: '结算审批',
          requiresAuth: true,
          permissions: ['mall:admin'],
        },
      },
      {
        path: 'seckill-activities',
        name: 'MallAdminSeckillActivities',
        component: () => import('../views/SeckillActivities.vue'),
        meta: {
          title: '秒杀场次',
          requiresAuth: true,
          permissions: ['mall:admin'],
        },
      },
    ],
  },
]

export default routes
