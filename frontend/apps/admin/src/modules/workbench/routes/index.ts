/**
 * workbench 模块路由（default 布局验收模块）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计（验收目标决定结构）：
 * - 父记录带 meta（title/icon）→ 侧边栏呈现「多子项分组菜单」，验证 AppMenu 分组渲染
 * - 三个 children：'' index 子路由 + analysis + monitor，覆盖三类菜单形态
 * - 每个视图用 `defineOptions({ name })` 让组件名与路由 name 对齐，
 *   保证 keep-alive include（按组件 name 匹配）真正生效，可用于验证页签缓存
 * - meta.titleKey 走 i18n（menu.workbench* 键已加入 locales），切换语言验证菜单热更新
 *
 * @see [`../views/index.vue`](../views/index.vue) index 子路由视图
 * @group 业务模块：Workbench
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/workbench',
    component: () => import('@/layouts/default/index.vue'),
    meta: {
      title: '工作台',
      titleKey: 'menu.workbench',
      icon: 'odometer',
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        name: 'Workbench',
        component: () => import('../views/index.vue'),
        meta: {
          title: '工作台首页',
          titleKey: 'menu.workbenchHome',
          icon: 'odometer',
          requiresAuth: true,
          affix: true,
        },
      },
      {
        path: 'analysis',
        name: 'WorkbenchAnalysis',
        component: () => import('../views/Analysis.vue'),
        meta: {
          title: '分析页',
          titleKey: 'menu.workbenchAnalysis',
          icon: 'data-analysis',
          requiresAuth: true,
        },
      },
      {
        path: 'monitor',
        name: 'WorkbenchMonitor',
        component: () => import('../views/Monitor.vue'),
        meta: {
          title: '监控页',
          titleKey: 'menu.workbenchMonitor',
          icon: 'monitor',
          requiresAuth: true,
        },
      },
    ],
  },
]

export default routes
