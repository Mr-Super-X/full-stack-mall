/**
 * draft-storage 单元测试
 *
 * 覆盖：
 * - readDraft: 命中 / 未命中
 * - writeDraft: 基本写入 / exclude 剔除 / version 信封
 * - writeDraft: 异常仅 warn（不抛错）
 * - removeDraft: 删除已存在 / 删除不存在（不抛错）
 * - storage 介质切换：local vs session
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Local, Session } from '@vv/shared'
import { readDraft, removeDraft, writeDraft } from './draft-storage'

// mock 说明符经 codemod 收敛为 '@vv/shared' barrel（2026-10-26）——单点 mock 须
// importOriginal 展开其余导出（SUT 间接加载的 shared 模块依赖 barrel 其它具名）
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual,
    Local: {
      storage: new Map<string, string>(),
      get: vi.fn((key: string) => {
        const map = (Local as unknown as { storage: Map<string, string> }).storage
        const raw = map.get(key)
        return raw ? JSON.parse(raw) : null
      }),
      set: vi.fn((key: string, value: unknown) => {
        const map = (Local as unknown as { storage: Map<string, string> }).storage
        map.set(key, JSON.stringify(value))
      }),
      remove: vi.fn((key: string) => {
        const map = (Local as unknown as { storage: Map<string, string> }).storage
        map.delete(key)
      }),
    },
    Session: {
      storage: new Map<string, string>(),
      get: vi.fn((key: string) => {
        const map = (Session as unknown as { storage: Map<string, string> }).storage
        const raw = map.get(key)
        return raw ? JSON.parse(raw) : null
      }),
      set: vi.fn((key: string, value: unknown) => {
        const map = (Session as unknown as { storage: Map<string, string> }).storage
        map.set(key, JSON.stringify(value))
      }),
      remove: vi.fn((key: string) => {
        const map = (Session as unknown as { storage: Map<string, string> }).storage
        map.delete(key)
      }),
    },
  }
})

describe('draft-storage', () => {
  beforeEach(() => {
    ;(Local as unknown as { storage: Map<string, string> }).storage.clear()
    ;(Session as unknown as { storage: Map<string, string> }).storage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('readDraft', () => {
    it('无草稿 → 返回 null', () => {
      expect(readDraft('orders.draft', 'local')).toBeNull()
    })

    it('有草稿 → 返回数据对象', () => {
      Local.set('orders.draft', { name: 'alice' })
      expect(readDraft('orders.draft', 'local')).toEqual({ name: 'alice' })
    })

    it('local 与 session 介质独立', () => {
      Local.set('k', { from: 'local' })
      Session.set('k', { from: 'session' })
      expect(readDraft('k', 'local')).toEqual({ from: 'local' })
      expect(readDraft('k', 'session')).toEqual({ from: 'session' })
    })
  })

  describe('writeDraft', () => {
    it('基本写入', () => {
      writeDraft('orders.draft', 'local', { name: 'alice' }, [])
      expect(readDraft('orders.draft', 'local')).toEqual({ name: 'alice' })
    })

    it('exclude 剔除敏感字段', () => {
      writeDraft('orders.draft', 'local', { name: 'alice', password: 'secret' }, ['password'])
      const data = readDraft('orders.draft', 'local')
      expect(data).toEqual({ name: 'alice' })
      expect(data).not.toHaveProperty('password')
    })

    it('嵌套路径 exclude', () => {
      writeDraft('orders.draft', 'local', { user: { name: 'alice', card: '1234' } }, ['user.card'])
      const data = readDraft('orders.draft', 'local')
      expect(data).toEqual({ user: { name: 'alice' } })
    })

    it('version 信封：写时包 { __v, data }', () => {
      writeDraft('orders.draft', 'local', { a: 1 }, [], 'v2')
      const raw = (Local as unknown as { storage: Map<string, string> }).storage.get('orders.draft')
      const parsed = JSON.parse(raw!)
      expect(parsed.__v).toBe('v2')
      expect(parsed.data).toEqual({ a: 1 })
    })

    it('无 version → 直接写对象（无 __v 信封）', () => {
      writeDraft('orders.draft', 'local', { a: 1 }, [])
      const raw = (Local as unknown as { storage: Map<string, string> }).storage.get('orders.draft')
      const parsed = JSON.parse(raw!)
      expect(parsed.__v).toBeUndefined()
      expect(parsed).toEqual({ a: 1 })
    })

    it('cloneDeep 剥离 reactive Proxy', () => {
      const reactiveModel = new Proxy(
        { name: 'alice' },
        {
          get: (t, p) => Reflect.get(t, p),
        }
      )
      writeDraft('k', 'local', reactiveModel as never, [])
      expect(() => JSON.stringify(readDraft('k', 'local'))).not.toThrow()
    })

    it('写入异常（如循环引用）→ 仅 warn 不抛错', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const circular: Record<string, unknown> = {}
      circular.self = circular
      // omit 会尝试 cloneDeep，可能 throw
      expect(() => writeDraft('k', 'local', circular, [])).not.toThrow()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('removeDraft', () => {
    it('删除存在的草稿 → 后续 readDraft 返回 null', () => {
      writeDraft('orders.draft', 'local', { a: 1 }, [])
      expect(readDraft('orders.draft', 'local')).not.toBeNull()
      removeDraft('orders.draft', 'local')
      expect(readDraft('orders.draft', 'local')).toBeNull()
    })

    it('删除不存在的草稿 → 不抛错', () => {
      expect(() => removeDraft('not-exist', 'local')).not.toThrow()
    })
  })
})
