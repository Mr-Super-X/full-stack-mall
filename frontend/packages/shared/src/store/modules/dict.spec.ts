// dict store 单测
//
// 覆盖：
//   - fetchDict：首次发请求 / 5min 缓存命中 / force 强制刷新 / 并发防抖池合并
//   - getLabel：命中 / 未命中 / null undefined
//   - preloadDict：批量拉取 PRELOAD_DICT_KEYS / 自定义 codes
//   - clear：清空所有缓存

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock dictApi（在导入 useDictStore 之前）
vi.mock('../../api/modules/dict.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/modules/dict.ts')>()
  return {
    ...actual,
    dictApi: {
      ...actual.dictApi,
      getDict: vi.fn(),
    },
  }
})

import { dictApi } from '../../api/modules/dict.ts'
import type { DictItem } from '../../types/dict.ts'
import { useDictStore, PRELOAD_DICT_KEYS } from './dict'

const mockedGetDict = dictApi.getDict as unknown as ReturnType<typeof vi.fn>

describe('useDictStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedGetDict.mockReset()
  })

  describe('fetchDict', () => {
    it('首次调用发请求 + 写入缓存 + 记录时间戳', async () => {
      const data: DictItem[] = [{ value: 'a', label: 'A' }]
      mockedGetDict.mockResolvedValueOnce(data)

      const store = useDictStore()
      const result = await store.fetchDict('user_status')

      expect(result).toEqual(data)
      expect(store.dicts['user_status']).toEqual(data)
      expect(store.lastFetchAt['user_status']).toBeGreaterThan(0)
      expect(mockedGetDict).toHaveBeenCalledTimes(1)
    })

    it('同一 code 5min 内复用缓存（不重复请求）', async () => {
      const data = [{ value: 'a', label: 'A' }]
      mockedGetDict.mockResolvedValueOnce(data)

      const store = useDictStore()
      await store.fetchDict('user_status')
      await store.fetchDict('user_status')
      await store.fetchDict('user_status')

      expect(mockedGetDict).toHaveBeenCalledTimes(1)
    })

    it('force=true 强制刷新', async () => {
      const data1 = [{ value: 'a', label: 'A' }]
      const data2 = [{ value: 'a', label: 'A-updated' }]
      mockedGetDict.mockResolvedValueOnce(data1).mockResolvedValueOnce(data2)

      const store = useDictStore()
      await store.fetchDict('user_status')
      const result = await store.fetchDict('user_status', true)

      expect(mockedGetDict).toHaveBeenCalledTimes(2)
      expect(result).toEqual(data2)
      expect(store.dicts['user_status']).toEqual(data2)
    })

    it('并发调用共享防抖池中的同一 Promise（只发一次请求）', async () => {
      const data: DictItem[] = [{ value: 'a', label: 'A' }]
      let resolve!: (val: DictItem[]) => void
      mockedGetDict.mockReturnValueOnce(
        new Promise<DictItem[]>((r) => {
          resolve = r
        })
      )

      const store = useDictStore()
      const p1 = store.fetchDict('x')
      const p2 = store.fetchDict('x')
      const p3 = store.fetchDict('x')

      // 防抖池语义：并发调用共享同一次请求。
      // 注意：Pinia action 会重新包装返回的 Promise（wrappedAction），
      // 因此对外不能断言实例同一性（p2 === p1），只断言结果一致 + 请求一次。
      resolve(data)
      await expect(p1).resolves.toEqual(data)
      await expect(p2).resolves.toEqual(data)
      await expect(p3).resolves.toEqual(data)

      expect(mockedGetDict).toHaveBeenCalledTimes(1)
      expect(store.dicts['x']).toEqual(data)
    })

    it('请求失败抛错且 loading / 防抖池状态被清理', async () => {
      mockedGetDict.mockRejectedValueOnce(new Error('network'))

      const store = useDictStore()
      await expect(store.fetchDict('x')).rejects.toThrow('network')
      expect(store.loading.has('x')).toBe(false)

      // 失败后防抖池已出池：再次调用会重新发请求（而不是拿到 rejected 的旧 Promise）
      mockedGetDict.mockResolvedValueOnce([{ value: 'a', label: 'A' }])
      const result = await store.fetchDict('x')
      expect(result).toEqual([{ value: 'a', label: 'A' }])
      expect(mockedGetDict).toHaveBeenCalledTimes(2)
    })
  })

  describe('getLabel', () => {
    it('命中已加载字典', () => {
      const store = useDictStore()
      store.dicts['user_status'] = [
        { value: 'active', label: '启用' },
        { value: 'inactive', label: '禁用' },
      ]

      expect(store.getLabel('user_status', 'active')).toBe('启用')
      expect(store.getLabel('user_status', 'inactive')).toBe('禁用')
    })

    it('未命中返回 String(value) 兜底', () => {
      const store = useDictStore()
      expect(store.getLabel('user_status', 'ghost')).toBe('ghost')
    })

    it('null / undefined 返回空串', () => {
      const store = useDictStore()
      expect(store.getLabel('user_status', null)).toBe('')
      expect(store.getLabel('user_status', undefined)).toBe('')
    })

    it('code 字典未加载（未调过 fetchDict）也走兜底', () => {
      const store = useDictStore()
      expect(store.getLabel('user_status', 'active')).toBe('active')
    })
  })

  describe('preloadDict', () => {
    it('批量拉取 PRELOAD_DICT_KEYS', async () => {
      mockedGetDict.mockResolvedValue([])
      const store = useDictStore()
      await store.preloadDict()

      expect(mockedGetDict).toHaveBeenCalledTimes(PRELOAD_DICT_KEYS.length)
    })

    it('支持自定义 codes 列表', async () => {
      mockedGetDict.mockResolvedValue([])
      const store = useDictStore()
      await store.preloadDict(['custom_a', 'custom_b'])

      expect(mockedGetDict).toHaveBeenCalledTimes(2)
      expect(mockedGetDict).toHaveBeenCalledWith('custom_a')
      expect(mockedGetDict).toHaveBeenCalledWith('custom_b')
    })
  })

  describe('clear', () => {
    it('清空所有缓存', () => {
      const store = useDictStore()
      store.dicts['user_status'] = [{ value: 'a', label: 'A' }]
      store.lastFetchAt['user_status'] = Date.now()

      store.clear()

      expect(store.dicts).toEqual({})
      expect(store.lastFetchAt).toEqual({})
    })
  })
})
