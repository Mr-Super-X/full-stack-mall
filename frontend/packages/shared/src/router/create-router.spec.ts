/**
 * createAppRouter 路由创建编排契约测试。
 *
 * 验证工厂固化的「顺序契约」与两类消费形态：
 * - 公开 app 形态：rootRedirect → notFoundRoute → 业务路由 → fallback 注册序、
 *   registerAppRouter DI、白名单直通 + 兜底可见性守卫
 * - admin 形态：无 notFoundRoute / 无白名单谓词 + extraSetup 按序注入
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { createAppRouter } from './create-router.ts'
import { createFallbackRoute } from './fallback.ts'
import { getAppRouter } from '../app-router.ts'

/** 占位组件：本 spec 只测路由层行为，组件永不渲染 */
const Stub = { template: '<div />' }

const homeRoute: RouteRecordRaw = { path: '/home', name: 'Home', component: Stub }
const pageRoute: RouteRecordRaw = { path: '/page', name: 'Page', component: Stub }
const publicRoute: RouteRecordRaw = {
  path: '/public',
  name: 'Public',
  component: Stub,
  meta: { visible: false }, // 白名单短路优先级高于可见性检查：命中即放行
}
const hiddenRoute: RouteRecordRaw = {
  path: '/hidden',
  name: 'Hidden',
  component: Stub,
  meta: { visible: false },
}
const notFoundRoute: RouteRecordRaw = {
  path: '/404',
  name: 'NotFound',
  component: Stub,
  meta: { title: '页面不存在' },
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('createAppRouter', () => {
  it('注册顺序：rootRedirect → notFoundRoute → 业务路由 → fallback catch-all 最后', () => {
    const router = createAppRouter({
      rootRedirect: '/home',
      notFoundRoute,
      routes: [pageRoute],
      fallbackRoute: createFallbackRoute(),
      isRouteWhiteListed: () => false,
    })

    expect(router.getRoutes().map((r) => r.path)).toEqual([
      '/',
      '/404',
      '/page',
      '/:pathMatch(.*)*',
    ])
  })

  it('admin 形态：缺省 notFoundRoute → 不注册 /404 记录（routes 数组直通）', () => {
    const router = createAppRouter({
      rootRedirect: '/workbench',
      routes: [pageRoute],
      fallbackRoute: createFallbackRoute(),
    })

    expect(router.getRoutes().map((r) => r.path)).toEqual(['/', '/page', '/:pathMatch(.*)*'])
  })

  it('根路径重定向：push / → 落到 rootRedirect 目标（先于 fallback 匹配）', async () => {
    const router = createAppRouter({
      rootRedirect: '/home',
      notFoundRoute,
      routes: [homeRoute, pageRoute],
      fallbackRoute: createFallbackRoute(),
      isRouteWhiteListed: () => true,
    })

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('fallback catch-all：未匹配路径重定向到 /404', async () => {
    const router = createAppRouter({
      rootRedirect: '/home',
      notFoundRoute,
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
      isRouteWhiteListed: () => true,
    })

    await router.push('/definitely-not-exist')

    expect(router.currentRoute.value.path).toBe('/404')
  })

  it('historyMode 缺省读 VITE_HISTORY_MODE：web 缺省 / hash 环境切 Hash history；显式参数优先', () => {
    // 判别式用 router.resolve().href：web history 生成 '/x'，hash history 生成 '#/x'
    // （注意 hash history 的 history.location 是归一化路径，不带 '#' 前缀，不能用作判别）
    const webRouter = createAppRouter({
      rootRedirect: '/home',
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
    })
    expect(webRouter.resolve('/probe').href).toBe('/probe')

    vi.stubEnv('VITE_HISTORY_MODE', 'hash')
    const hashRouter = createAppRouter({
      rootRedirect: '/home',
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
    })
    expect(hashRouter.resolve('/probe').href).toBe('#/probe')

    // 显式参数优先于环境（admin 传 ROUTER_CONFIG.historyMode 的口径）
    const explicitRouter = createAppRouter({
      rootRedirect: '/home',
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
      historyMode: 'web',
    })
    expect(explicitRouter.resolve('/probe').href).toBe('/probe')
  })

  it('registerAppRouter DI：工厂返回的实例即可被 getAppRouter 读到（先于守卫语义）', () => {
    const router = createAppRouter({
      rootRedirect: '/home',
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
    })

    expect(getAppRouter()).toBe(router)
  })

  it('extraSetup 按序调用且发生在 DI 之后（getAppRouter 内已可读）', () => {
    const calls: string[] = []
    const router = createAppRouter({
      rootRedirect: '/home',
      routes: [homeRoute],
      fallbackRoute: createFallbackRoute(),
      extraSetup: [
        (r) => {
          calls.push(String(getAppRouter() === r))
        },
        (r) => {
          calls.push(`second:${r.getRoutes().length > 0}`)
        },
      ],
    })

    expect(calls).toEqual(['true', 'second:true'])
    expect(getAppRouter()).toBe(router)
  })

  it('公开守卫：白名单直通（优先于可见性检查）；非白名单 hidden 路由跳 /404；可见路由放行', async () => {
    const router = createAppRouter({
      rootRedirect: '/home',
      notFoundRoute,
      routes: [homeRoute, publicRoute, hiddenRoute],
      fallbackRoute: createFallbackRoute(),
      isRouteWhiteListed: (name) => name === 'Public',
    })

    // 白名单命中：即便 meta.visible=false 也直通（短路优先级）
    await router.push('/public')
    expect(router.currentRoute.value.path).toBe('/public')

    // 非白名单 + hidden：兜底可见性检查拦截到 /404
    await router.push('/hidden')
    expect(router.currentRoute.value.path).toBe('/404')

    // 非白名单 + 可见：放行
    await router.push('/home')
    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('admin 形态：不传白名单谓词 → 工厂不挂任何守卫（hidden 也直达，语义归 setupAuthGuard）', async () => {
    const router = createAppRouter({
      rootRedirect: '/workbench',
      routes: [hiddenRoute],
      fallbackRoute: createFallbackRoute(),
    })

    await router.push('/hidden')

    expect(router.currentRoute.value.path).toBe('/hidden')
  })
})
