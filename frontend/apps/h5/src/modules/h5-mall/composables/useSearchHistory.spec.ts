import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSearchHistory } from './useSearchHistory'

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('add 去重并置顶', () => {
    const { list, add } = useSearchHistory()
    add('T恤')
    add('风衣')
    add('T恤')

    expect(list.value).toEqual(['T恤', '风衣'])
  })

  it('add 上限 10 条裁剪最旧', () => {
    const { list, add } = useSearchHistory()
    for (let i = 1; i <= 12; i += 1) add(`词${i}`)

    expect(list.value).toHaveLength(10)
    expect(list.value[0]).toBe('词12')
    expect(list.value).not.toContain('词1')
    expect(list.value).not.toContain('词2')
  })

  it('add 空词与纯空白跳过', () => {
    const { list, add } = useSearchHistory()
    add('')
    add('   ')

    expect(list.value).toEqual([])
  })

  it('持久化到 localStorage，新实例读到同一份', () => {
    const first = useSearchHistory()
    first.add('针织衫')

    const second = useSearchHistory()
    expect(second.list.value).toEqual(['针织衫'])
  })

  it('clear 清空存储与状态', () => {
    const { list, add, clear } = useSearchHistory()
    add('乐福鞋')
    clear()

    expect(list.value).toEqual([])
    expect(localStorage.getItem('mall:search-history')).toBeNull()
  })

  it('localStorage 写入失败时降级不抛错（隐私模式）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    const { add } = useSearchHistory()
    expect(() => add('短靴')).not.toThrow()
    vi.restoreAllMocks()
  })
})
