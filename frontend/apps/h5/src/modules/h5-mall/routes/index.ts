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
 * - 常驻外壳（2026-11-09，阶段 3 收尾）：layout 下再嵌套 `../views/shell.vue`，
 *   首页/列表/订单/工作台挂 shell 下享常驻 tabbar；详情/登录/注册/404 与 shell 平级不渲染 tabbar
 *   （模块边界裁决：AGENTS.md §1.2 禁 layouts 引用 modules/，tabbar 常驻不落 layout 而落模块外壳）
 *
 * @see [`../views/index.vue`](../views/index.vue) 商城首页
 * @see [`../../router/whitelist.ts`](../../router/whitelist.ts) routeNames 消费方
 * @group 业务模块：H5Mall
 */

import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
// routeNames 提取收敛 @vv/shared 单源：collectRouteNames 递归拍平 children，
// 新增子路由时白名单自动跟随，杜绝「路由已实现但白名单漏配」的漂移
import { collectRouteNames, Session } from '@vv/shared'

/**
 * 订单/工作台登录守卫（页面级 beforeEnter）。
 *
 * h5 全局无登录守卫（apps/h5/src/router/index.ts 头注「全站公开」），订单/工作台的
 * 登录拦截落在路由级（ledger Task 1 Ruling 5）：查 Session 'auth' 标记（与模块内
 * 登录页 login.vue 写入的标记同源），未登录跳模块内 H5MallLogin 并带 redirect
 * 路由名——登录页按 redirect 回跳（views/login.vue）。
 */
function requireMallLogin(to: RouteLocationNormalized): true | { name: string; query: { redirect: string } } {
  if (Session.get<boolean>('auth')) return true
  return { name: 'H5MallLogin', query: { redirect: String(to.name) } }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/h5-mall',
    component: () => import('@/layouts/h5/index.vue'),
    children: [
      // 常驻外壳：享常驻 tabbar 的页挂 shell 下（切 tab 不消失）；
      // 详情/登录/注册/404 与 shell 平级——不渲染 tabbar（模块边界裁决见 ledger Task 1 Ruling）
      {
        path: '',
        component: () => import('../views/shell.vue'),
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
          {
            path: 'list',
            name: 'H5MallList',
            component: () => import('../views/list.vue'),
            meta: {
              title: '商品列表',
              requiresAuth: false,
              noTags: true,
            },
          },
          {
            path: 'orders',
            name: 'H5MallOrders',
            component: () => import('../views/orders.vue'),
            meta: {
              title: '我的订单',
              requiresAuth: false,
              noTags: true,
            },
            beforeEnter: requireMallLogin,
          },
          {
            path: 'seller',
            name: 'H5MallSeller',
            component: () => import('../views/seller.vue'),
            meta: {
              title: '卖家工作台',
              requiresAuth: false,
              noTags: true,
            },
            beforeEnter: requireMallLogin,
          },
          {
            path: 'cart',
            name: 'H5MallCart',
            component: () => import('../views/cart.vue'),
            meta: {
              title: '购物袋',
              requiresAuth: false,
              noTags: true,
            },
            beforeEnter: requireMallLogin,
          },
          {
            path: 'checkout',
            name: 'H5MallCheckout',
            component: () => import('../views/checkout.vue'),
            meta: {
              title: '确认订单',
              requiresAuth: false,
              noTags: true,
            },
            beforeEnter: requireMallLogin,
          },
        ],
      },
      {
        path: 'detail/:id',
        name: 'H5MallDetail',
        component: () => import('../views/detail.vue'),
        meta: {
          title: '商品详情',
          requiresAuth: false,
          noTags: true,
        },
      },
      {
        path: 'login',
        name: 'H5MallLogin',
        component: () => import('../views/login.vue'),
        meta: {
          title: '登录',
          requiresAuth: false,
          noTags: true,
        },
      },
      {
        path: 'register',
        name: 'H5MallRegister',
        component: () => import('../views/register.vue'),
        meta: {
          title: '注册',
          requiresAuth: false,
          noTags: true,
        },
      },
      {
        path: '404',
        name: 'H5MallNotFound',
        component: () => import('../views/not-found.vue'),
        meta: {
          title: '页面不存在',
          requiresAuth: false,
          noTags: true,
        },
      },
      // catch-all：/h5-mall 下未匹配路径一律进 404（防白屏）
      {
        path: ':pathMatch(.*)*',
        redirect: '/h5-mall/404',
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
