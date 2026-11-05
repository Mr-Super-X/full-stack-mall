import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RouteLocationNormalized, Router } from 'vue-router'
import type { useUserStore } from '@vv/shared'
import type { useRouterStore } from '@/store/modules/router'

const { mockFetchRemoteRoutes, mockRouterConfig } = vi.hoisted(() => ({
  mockFetchRemoteRoutes: vi.fn(),
  mockRouterConfig: { source: 'remote' as 'local' | 'remote' },
}))

vi.mock('../config', () => ({ ROUTER_CONFIG: mockRouterConfig }))
vi.mock('../remote', () => ({ fetchRemoteRoutes: mockFetchRemoteRoutes }))
// mock 说明符经 codemod 收敛为 '@vv/shared' barrel（2026-10-26）——barrel 聚合整个包，
// 单点 mock 必须 importOriginal 展开其余导出，否则间接加载的 shared 模块全取 undefined
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return { ...actual, showBadge: vi.fn() }
})

import { ensureRemoteMenuLoaded, resetAuthGuardState } from './remote-menu'

type UserStore = ReturnType<typeof useUserStore>
type RouterStore = ReturnType<typeof useRouterStore>

const to = { path: '/orders', fullPath: '/orders', meta: {} } as RouteLocationNormalized

const makeUserStore = (authenticated = true): UserStore =>
  ({ authenticated }) as unknown as UserStore

const makeRouterStore = (): RouterStore & { setLoadingRemoteMenu: ReturnType<typeof vi.fn> } =>
  ({ setLoadingRemoteMenu: vi.fn() }) as unknown as RouterStore & {
    setLoadingRemoteMenu: ReturnType<typeof vi.fn>
  }

const makeRouter = (): Router & { addRoute: ReturnType<typeof vi.fn> } =>
  ({
    addRoute: vi.fn(),
    hasRoute: vi.fn().mockReturnValue(false),
    getRoutes: vi.fn().mockReturnValue([]),
  }) as unknown as Router & { addRoute: ReturnType<typeof vi.fn> }

beforeEach(() => {
  resetAuthGuardState()
  mockFetchRemoteRoutes.mockReset()
  mockRouterConfig.source = 'remote'
})

describe('ensureRemoteMenuLoaded', () => {
  it('local 模式直接放行（不拉菜单）', async () => {
    mockRouterConfig.source = 'local'
    const result = await ensureRemoteMenuLoaded(
      to,
      makeUserStore(),
      makeRouterStore(),
      makeRouter()
    )
    expect(result).toBeNull()
    expect(mockFetchRemoteRoutes).not.toHaveBeenCalled()
  })

  it('remote + 菜单为空 → 保持 local 菜单（不注入路由，重新触发守卫后放行）', async () => {
    mockFetchRemoteRoutes.mockResolvedValueOnce([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const router = makeRouter()

    const result = await ensureRemoteMenuLoaded(to, makeUserStore(), makeRouterStore(), router)

    // 空菜单不注入任何路由，但实现上仍重新触发守卫（第二遍 dynamicLoaded=true → 放行）
    expect(router.addRoute).not.toHaveBeenCalled()
    expect(result).toEqual({ path: '/orders', replace: true })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('remote + 菜单非空 → addRoute 注入并重新触发守卫', async () => {
    mockFetchRemoteRoutes.mockResolvedValueOnce([
      { path: '/a', name: 'A' },
      { path: '/b', name: 'B' },
    ])
    const router = makeRouter()

    const result = await ensureRemoteMenuLoaded(to, makeUserStore(), makeRouterStore(), router)

    expect(router.addRoute).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ path: '/orders', replace: true })
  })

  it('同名路由不替换本地记录（防嵌套结构被拆散），仅合并远程 meta', async () => {
    const localRecord = { name: 'Home', path: '/home', meta: { title: '仪表盘' }, children: [] }
    mockFetchRemoteRoutes.mockResolvedValueOnce([
      { path: '/home', name: 'Home', meta: { visible: false, permissions: ['p1'] } },
      { path: '/new-page', name: 'NewPage' },
    ])
    const router = makeRouter()
    ;(router.hasRoute as ReturnType<typeof vi.fn>).mockImplementation(
      (name: string) => name === 'Home'
    )
    ;(router.getRoutes as ReturnType<typeof vi.fn>).mockReturnValue([localRecord])

    const result = await ensureRemoteMenuLoaded(to, makeUserStore(), makeRouterStore(), router)

    // Home 已存在 → 不 addRoute，仅合并 meta（后端 hidden → visible:false 控制保留）
    expect(router.addRoute).toHaveBeenCalledTimes(1)
    expect(router.addRoute).toHaveBeenCalledWith({ path: '/new-page', name: 'NewPage' })
    expect(localRecord.meta).toEqual({
      title: '仪表盘',
      visible: false,
      permissions: ['p1'],
    })
    expect(result).toEqual({ path: '/orders', replace: true })
  })

  it('同一登录周期内只拉一次（dynamicLoaded 缓存）', async () => {
    mockFetchRemoteRoutes.mockResolvedValueOnce([{ path: '/a', name: 'A' }])
    const userStore = makeUserStore()
    const router = makeRouter()

    await ensureRemoteMenuLoaded(to, userStore, makeRouterStore(), router)
    const second = await ensureRemoteMenuLoaded(to, userStore, makeRouterStore(), router)

    expect(second).toBeNull()
    expect(mockFetchRemoteRoutes).toHaveBeenCalledTimes(1)
  })

  it('登录态切换（authenticated 变化）后重新拉取', async () => {
    mockFetchRemoteRoutes.mockResolvedValue([{ path: '/a', name: 'A' }])
    const router = makeRouter()

    await ensureRemoteMenuLoaded(to, makeUserStore(true), makeRouterStore(), router)
    // 登出 → 登录：authenticated false→true 跳变触发重新加载
    await ensureRemoteMenuLoaded(to, makeUserStore(false), makeRouterStore(), router)
    await ensureRemoteMenuLoaded(to, makeUserStore(true), makeRouterStore(), router)

    expect(mockFetchRemoteRoutes.mock.calls.length).toBeGreaterThan(1)
  })

  it('加载中 setLoadingRemoteMenu 正确开关（finally 兜底）', async () => {
    mockFetchRemoteRoutes.mockRejectedValueOnce(new Error('network down'))
    const routerStore = makeRouterStore()

    await ensureRemoteMenuLoaded(to, makeUserStore(), routerStore, makeRouter()).catch(() => {})

    expect(routerStore.setLoadingRemoteMenu).toHaveBeenCalledWith(true)
    expect(routerStore.setLoadingRemoteMenu).toHaveBeenLastCalledWith(false)
  })
})
