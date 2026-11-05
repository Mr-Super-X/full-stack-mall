import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Local, Session, namespacedStorageKey } from './storage'

// 测试期间 vitest 加载 .env.development，VITE_STORAGE_NAMESPACE 是配置的 storage
// 隔离标识（如 'vue3-vite-project'）。fallback 'vue3-vite-project' 与 storage.ts 保持一致。
const APP_NAMESPACE = (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':'

// 清理 storage 状态避免跨用例污染
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('storage 工具', () => {
  describe('Local（localStorage 包装）', () => {
    it('set + get 写入并读取对象', () => {
      Local.set('user', { name: 'Admin', id: 1 })
      expect(Local.get('user')).toEqual({ name: 'Admin', id: 1 })
    })

    it('set + get 写入并读取字符串', () => {
      Local.set('theme', 'dark')
      expect(Local.get('theme')).toBe('dark')
    })

    it('key 会被 namespace 前缀化（避免多项目冲突）', () => {
      Local.set('key1', 'value1')
      const raw = window.localStorage.getItem(APP_NAMESPACE + 'key1')
      expect(raw).not.toBeNull()
      expect(Local.get('key1')).toBe('value1')
    })

    it('namespacedStorageKey 与 Local.set 写入的 key 规则一致（供 Pinia persist key 等直接场景）', () => {
      Local.set('same-rule', 'v')
      expect(namespacedStorageKey('same-rule')).toBe(APP_NAMESPACE + 'same-rule')
      expect(window.localStorage.getItem(namespacedStorageKey('same-rule'))).toBe('"v"')
    })

    it('remove 移除指定 key', () => {
      Local.set('tmp', 123)
      Local.remove('tmp')
      expect(window.localStorage.getItem(APP_NAMESPACE + 'tmp')).toBeNull()
    })

    it('get 不存在的 key 返回 null', () => {
      expect(Local.get('not-exists')).toBeNull()
    })

    it('get 遇到脏数据（非 JSON）返回 null + 自动清理', () => {
      // 手动塞入非 JSON 字符串
      window.localStorage.setItem(APP_NAMESPACE + 'corrupt', 'not valid json {')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(Local.get('corrupt')).toBeNull()
      expect(warn).toHaveBeenCalled()
      // 脏数据被自动清理
      expect(window.localStorage.getItem(APP_NAMESPACE + 'corrupt')).toBeNull()
    })

    describe('clear 命名空间隔离（不破坏其他应用数据）', () => {
      it('只清本 namespace 的 key，保留其他 prefix 的 key', () => {
        // 本项目数据
        Local.set('mine', '1')
        // 模拟其他应用的数据
        window.localStorage.setItem('other-app:foo', 'other-value')
        window.localStorage.setItem('unrelated-key', 'unrelated-value')

        Local.clear()

        expect(window.localStorage.getItem(APP_NAMESPACE + 'mine')).toBeNull()
        // 其他 prefix 的数据保留
        expect(window.localStorage.getItem('other-app:foo')).toBe('other-value')
        expect(window.localStorage.getItem('unrelated-key')).toBe('unrelated-value')
      })

      it('空 storage 时不抛错', () => {
        expect(() => Local.clear()).not.toThrow()
      })
    })
  })

  describe('Session（sessionStorage 包装）', () => {
    it('普通 key 走 sessionStorage 命名空间', () => {
      Session.set('lastVisited', '/dashboard')
      expect(Session.get('lastVisited')).toBe('/dashboard')
      expect(window.sessionStorage.getItem(APP_NAMESPACE + 'lastVisited')).not.toBeNull()
    })

    it('登录标记 auth 的写入/读取/清除', () => {
      // httpOnly 模式：'auth' 只是普通命名空间 key，不含凭证信息
      Session.set('auth', true)
      expect(Session.get<boolean>('auth')).toBe(true)
      Session.remove('auth')
      expect(Session.get('auth')).toBeNull()
    })

    it('普通对象能 round-trip', () => {
      Session.set('userProfile', { id: 1, name: 'Admin' })
      expect(Session.get('userProfile')).toEqual({ id: 1, name: 'Admin' })
    })

    it('remove 移除指定 key', () => {
      Session.set('foo', 'bar')
      Session.remove('foo')
      expect(window.sessionStorage.getItem(APP_NAMESPACE + 'foo')).toBeNull()
    })

    it('Session.get 不存在的 key 返回 null', () => {
      expect(Session.get('not-exists')).toBeNull()
    })

    it('Session.get 遇到脏数据返回 null + 自动清理（与 Local 行为一致）', () => {
      window.sessionStorage.setItem(APP_NAMESPACE + 'corrupt', '}{ invalid json')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(Session.get('corrupt')).toBeNull()
      expect(warn).toHaveBeenCalled()
      // 脏数据被自动清理（与 Local 行为一致）
      expect(window.sessionStorage.getItem(APP_NAMESPACE + 'corrupt')).toBeNull()
    })

    describe('Session.clear 命名空间隔离', () => {
      it('只清本 namespace 的 sessionStorage key，保留其他 prefix', () => {
        Session.set('mine', '1')
        window.sessionStorage.setItem('other-app:foo', 'other-value')

        Session.clear()

        expect(window.sessionStorage.getItem(APP_NAMESPACE + 'mine')).toBeNull()
        expect(window.sessionStorage.getItem('other-app:foo')).toBe('other-value')
      })
    })
  })
})
