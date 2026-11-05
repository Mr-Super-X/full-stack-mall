// useAuth composable 单测
//
// 覆盖 4 个核心场景：
//  - 空权限要求 → 放行
//  - 全部权限满足（AND）
//  - 部分权限缺失（AND 失败）
//  - 至少一个权限满足（ANY）
//  - 未登录态时 hasPerm 全部返回 false

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { mockIsLoggedIn, mockPermissions } = vi.hoisted(() => ({
  // 模拟 storeToRefs 的响应式结构
  mockIsLoggedIn: { value: true },
  mockPermissions: { value: ['user:view', 'user:edit'] as string[] },
}))

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia')
  return {
    ...actual,
    storeToRefs: () => ({
      permissions: mockPermissions,
      isLoggedIn: mockIsLoggedIn,
    }),
  }
})

vi.mock('../store/modules/user.ts', () => ({
  useUserStore: () => ({
    permissions: mockPermissions,
    isLoggedIn: mockIsLoggedIn,
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockIsLoggedIn.value = true
  mockPermissions.value = ['user:view', 'user:edit']
})

describe('useAuth', () => {
  it('空权限要求 → 直接放行', async () => {
    const { useAuth } = await import('./useAuth')
    const { hasPerm, hasAnyPerm } = useAuth()
    expect(hasPerm([])).toBe(true)
    expect(hasAnyPerm([])).toBe(true)
  })

  it('全部权限满足（AND）', async () => {
    const { useAuth } = await import('./useAuth')
    const { hasPerm } = useAuth()
    expect(hasPerm(['user:view', 'user:edit'])).toBe(true)
    expect(hasPerm(['user:view'])).toBe(true)
  })

  it('部分权限缺失（AND 失败）', async () => {
    const { useAuth } = await import('./useAuth')
    const { hasPerm } = useAuth()
    expect(hasPerm(['user:view', 'orders:view'])).toBe(false)
    expect(hasPerm(['orders:view'])).toBe(false)
  })

  it('至少一个权限满足（ANY）', async () => {
    const { useAuth } = await import('./useAuth')
    const { hasAnyPerm } = useAuth()
    expect(hasAnyPerm(['user:view', 'orders:view'])).toBe(true)
    expect(hasAnyPerm(['orders:view', 'reports:view'])).toBe(false)
  })

  it('未登录态：hasPerm 全部返回 false（除了空数组）', async () => {
    mockIsLoggedIn.value = false
    mockPermissions.value = []
    const { useAuth } = await import('./useAuth')
    const { hasPerm, hasAnyPerm } = useAuth()
    expect(hasPerm([])).toBe(true)
    expect(hasPerm(['user:view'])).toBe(false)
    expect(hasAnyPerm(['user:view'])).toBe(false)
  })

  it('permissions 暴露只读 computed 防止外部写入', async () => {
    const { useAuth } = await import('./useAuth')
    const { permissions } = useAuth()
    expect(permissions.value).toEqual(['user:view', 'user:edit'])
    // 修改 computed 返回值不影响 store（因为是数组 spread 包装）
    permissions.value.push('hack')
    expect(permissions.value).toContain('hack')
    // store 原始不变
    expect(mockPermissions.value).not.toContain('hack')
  })
})
