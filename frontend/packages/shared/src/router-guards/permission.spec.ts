import { describe, it, expect } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import type { useUserStore } from '../store/modules/user.ts'
import { checkPermission } from './permission'

type UserStore = ReturnType<typeof useUserStore>

const route = (permissions?: string[]) =>
  ({ meta: { permissions } }) as unknown as RouteLocationNormalized

const storeWith = (permissions: string[]) => ({ permissions }) as UserStore

describe('checkPermission', () => {
  it('meta.permissions 缺失时放行（无权限要求）', () => {
    expect(checkPermission(route(), storeWith([]))).toBeNull()
  })

  it('meta.permissions 为空数组时放行', () => {
    expect(checkPermission(route([]), storeWith([]))).toBeNull()
  })

  it('AND 语义：全部权限满足时放行', () => {
    expect(
      checkPermission(route(['user:view', 'user:edit']), storeWith(['user:view', 'user:edit']))
    ).toBeNull()
  })

  it('AND 语义：缺少任一权限时跳 /403', () => {
    expect(checkPermission(route(['user:view', 'user:edit']), storeWith(['user:view']))).toEqual({
      path: '/403',
    })
  })

  it('用户无任何权限时跳 /403', () => {
    expect(checkPermission(route(['user:view']), storeWith([]))).toEqual({ path: '/403' })
  })
})
