import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { mockPreloadDict } = vi.hoisted(() => ({
  mockPreloadDict: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./dict', () => ({
  useDictStore: () => ({ preloadDict: mockPreloadDict }),
}))

vi.mock('../../api/modules/auth.ts', () => ({
  authApi: {
    login: vi.fn(),
    fetchProfile: vi.fn(),
    logout: vi.fn(),
  },
}))
vi.mock('../../utils/storage.ts', () => ({
  Session: { remove: vi.fn(), set: vi.fn(), get: vi.fn() },
  Local: { set: vi.fn(), get: vi.fn(), remove: vi.fn(), clear: vi.fn() },
}))
vi.mock('../../api/global-abort.ts', () => ({
  globalAbort: {
    signal: new AbortController().signal,
    abort: vi.fn(),
    reset: vi.fn(),
  },
}))

import { useUserStore, registerLocalStateResetHook } from './user'
import { authApi } from '../../api/modules/auth.ts'
import { Session } from '../../utils/storage.ts'
import { globalAbort } from '../../api/global-abort.ts'

const mockAuthLogin = authApi.login as ReturnType<typeof vi.fn>
const mockAuthFetchProfile = authApi.fetchProfile as ReturnType<typeof vi.fn>
const mockAuthLogout = authApi.logout as ReturnType<typeof vi.fn>
const mockSessionSet = Session.set as ReturnType<typeof vi.fn>
const mockSessionRemove = Session.remove as ReturnType<typeof vi.fn>
const mockSessionGet = Session.get as ReturnType<typeof vi.fn>
const mockGlobalAbortAbort = globalAbort.abort as ReturnType<typeof vi.fn>
const mockGlobalAbortReset = globalAbort.reset as ReturnType<typeof vi.fn>

// P1-3 包化后守卫状态 / 路由 UI store 归 app 侧私有，user store 经
// registerLocalStateResetHook 回调清理；此处注册两个 spy 验证钩子确实被逐个调用
const mockGuardResetHook = vi.fn()
const mockRouterUiResetHook = vi.fn()
registerLocalStateResetHook(mockGuardResetHook)
registerLocalStateResetHook(mockRouterUiResetHook)

beforeEach(() => {
  setActivePinia(createPinia())
  mockAuthLogin.mockReset()
  mockAuthFetchProfile.mockReset()
  mockAuthLogout.mockReset()
  mockSessionSet.mockReset()
  mockSessionRemove.mockReset()
  mockSessionGet.mockReset()
  mockGlobalAbortAbort.mockReset()
  mockGlobalAbortReset.mockReset()
  mockGuardResetHook.mockReset()
  mockRouterUiResetHook.mockReset()
  mockPreloadDict.mockReset().mockResolvedValue(undefined)
})

describe('userStore.login()', () => {
  it('成功路径：写登录标记 + 拉 profile + 预加载字典', async () => {
    mockAuthLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    mockAuthFetchProfile.mockResolvedValueOnce({
      id: 1,
      name: 'Admin',
      permissions: ['user:view'],
    })
    const store = useUserStore()

    await store.login({ username: 'admin', password: '123456' })

    // httpOnly 模式：不存 token，只写无敏感信息的登录标记
    expect(mockSessionSet).toHaveBeenCalledWith('auth', true)
    expect(store.authenticated).toBe(true)
    expect(store.isLoggedIn).toBe(true)
    expect(mockAuthFetchProfile).toHaveBeenCalledTimes(1)
    expect(store.profile).toEqual({ id: 1, name: 'Admin', permissions: ['user:view'] })
    expect(store.permissions).toEqual(['user:view'])
    expect(mockPreloadDict).toHaveBeenCalledTimes(1)
  })

  it('字典预加载失败不阻塞登录（console.warn 兜底）', async () => {
    mockAuthLogin.mockResolvedValueOnce({})
    mockAuthFetchProfile.mockResolvedValueOnce({ id: 1, name: 'A', permissions: [] })
    mockPreloadDict.mockRejectedValueOnce(new Error('dict error'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useUserStore()

    await store.login({ username: 'admin', password: '123456' })

    expect(store.isLoggedIn).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('userStore.fetchProfile()（含跨端口登录标记对齐，2026-10-30）', () => {
  it('探测成功且本 origin 无标记 → 补写登录标记（守卫同步判定依据）', async () => {
    // 场景：用户在其它端口登录过，cookie 有效（不按端口隔离）但本 origin 的
    // sessionStorage 无标记（按端口隔离）——portal 探测成功后跳 admin 的链路依赖此补写
    mockSessionGet.mockReturnValue(null)
    mockAuthFetchProfile.mockResolvedValueOnce({ id: 1, name: 'A', permissions: ['p1'] })
    const store = useUserStore()

    await store.fetchProfile()

    expect(store.profile).toEqual({ id: 1, name: 'A', permissions: ['p1'] })
    expect(store.permissions).toEqual(['p1'])
    expect(mockSessionSet).toHaveBeenCalledWith('auth', true)
  })

  it('探测成功且标记已存在 → 幂等不重复写', async () => {
    mockSessionGet.mockReturnValue(true)
    mockAuthFetchProfile.mockResolvedValueOnce({ id: 1, name: 'A', permissions: [] })
    const store = useUserStore()

    await store.fetchProfile()

    expect(mockSessionSet).not.toHaveBeenCalled()
  })

  it('探测失败（401）→ 不写标记', async () => {
    mockSessionGet.mockReturnValue(null)
    mockAuthFetchProfile.mockRejectedValueOnce(new Error('401'))
    const store = useUserStore()

    await expect(store.fetchProfile()).rejects.toThrow('401')

    expect(mockSessionSet).not.toHaveBeenCalled()
  })
})

describe('userStore.logout()（乐观退出）', () => {
  it('成功路径：先清本地登录态，再通知后端', async () => {
    mockAuthLogout.mockResolvedValueOnce(undefined)
    const store = useUserStore()
    store.authenticated = true
    store.profile = { id: 1, name: 'A', permissions: ['p1'] }
    store.permissions = ['p1']

    await store.logout()

    // 本地清理全套
    expect(mockSessionRemove).toHaveBeenCalledWith('auth')
    expect(store.authenticated).toBe(false)
    expect(store.profile).toBe(null)
    expect(store.permissions).toEqual([])
    expect(mockGlobalAbortAbort).toHaveBeenCalledWith('logout')
    expect(mockGuardResetHook).toHaveBeenCalledTimes(1)
    expect(mockRouterUiResetHook).toHaveBeenCalledTimes(1)
    expect(mockGlobalAbortReset).toHaveBeenCalledTimes(1)
    // 后端通知已发出
    expect(mockAuthLogout).toHaveBeenCalledTimes(1)
  })

  it('后端 logout 失败：本地仍清理 + 不抛错 + console.warn', async () => {
    mockAuthLogout.mockRejectedValueOnce(new Error('server down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useUserStore()
    store.authenticated = true

    // 乐观语义：后端失败不影响本地退出
    await expect(store.logout()).resolves.toBeUndefined()

    expect(mockSessionRemove).toHaveBeenCalledWith('auth')
    expect(store.authenticated).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('userStore.resetLocalState()', () => {
  it('清标记 + 清状态 + abort/reset + 复位钩子逐个调用', () => {
    const store = useUserStore()
    store.authenticated = true
    store.profile = { id: 1, name: 'A', permissions: [] }

    store.resetLocalState()

    expect(mockSessionRemove).toHaveBeenCalledWith('auth')
    expect(store.authenticated).toBe(false)
    expect(store.profile).toBe(null)
    expect(mockGlobalAbortAbort).toHaveBeenCalledWith('logout')
    expect(mockGuardResetHook).toHaveBeenCalledTimes(1)
    expect(mockRouterUiResetHook).toHaveBeenCalledTimes(1)
    expect(mockGlobalAbortReset).toHaveBeenCalledTimes(1)
    // resetLocalState 不触碰后端
    expect(mockAuthLogout).not.toHaveBeenCalled()
  })

  it('单个复位钩子抛错不阻断其余钩子', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = vi.fn(() => {
      throw new Error('hook boom')
    })
    const after = vi.fn()
    const off1 = registerLocalStateResetHook(failing)
    const off2 = registerLocalStateResetHook(after)

    useUserStore().resetLocalState()

    expect(failing).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
    off1()
    off2()
    warn.mockRestore()
  })
})
