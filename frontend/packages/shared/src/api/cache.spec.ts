import { describe, it, expect, beforeEach } from 'vitest'
import { buildCacheKey, cacheGet, cacheSet, cacheClear, _resetCache } from './cache'

beforeEach(() => {
  _resetCache()
})

describe('buildCacheKey', () => {
  it('GET /list + 空 params', () => {
    expect(buildCacheKey('get', '/list')).toBe('get|/list|')
  })

  it('params 字段顺序无关', () => {
    const k1 = buildCacheKey('get', '/list', { a: 1, b: 2 })
    const k2 = buildCacheKey('get', '/list', { b: 2, a: 1 })
    expect(k1).toBe(k2)
  })

  it('不同 method 不同 key', () => {
    expect(buildCacheKey('get', '/x')).not.toBe(buildCacheKey('post', '/x'))
  })

  it('不同 url 不同 key', () => {
    expect(buildCacheKey('get', '/a')).not.toBe(buildCacheKey('get', '/b'))
  })

  it('不同 params 不同 key', () => {
    expect(buildCacheKey('get', '/x', { a: 1 })).not.toBe(buildCacheKey('get', '/x', { a: 2 }))
  })

  it('嵌套 params 正确排序', () => {
    const k1 = buildCacheKey('get', '/x', { a: { y: 2, x: 1 } })
    const k2 = buildCacheKey('get', '/x', { a: { x: 1, y: 2 } })
    expect(k1).toBe(k2)
  })
})

describe('cacheGet / cacheSet', () => {
  it('写入后可读出', () => {
    cacheSet('k1', { foo: 'bar' }, 60) // 60 秒
    expect(cacheGet('k1')).toEqual({ foo: 'bar' })
  })

  it('未写入的 key 返回 null', () => {
    expect(cacheGet('nope')).toBeNull()
  })

  it('过期后返回 null 并自动清理', async () => {
    // 精度限制：vitest 用 Date.now()，最小 ttl 不能低于 1ms 精度
    // 用 0.01 秒（即 10ms）然后等待 20ms
    cacheSet('k1', 'value', 0.01)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(cacheGet('k1')).toBeNull()
  })

  it('不同 ttl 互不影响', () => {
    cacheSet('a', 'A', 60)
    cacheSet('b', 'B', 0.01)
    expect(cacheGet('a')).toBe('A')
    expect(cacheGet('b')).toBe('B')
  })
})

describe('cacheClear', () => {
  it('无参数清空所有', () => {
    cacheSet('a', 1, 60)
    cacheSet('b', 2, 60)
    cacheClear()
    expect(cacheGet('a')).toBeNull()
    expect(cacheGet('b')).toBeNull()
  })

  it('按前缀清除', () => {
    cacheSet('user|/list|', 1, 60)
    cacheSet('user|/detail|', 2, 60)
    cacheSet('equipment|/list|', 3, 60)
    cacheClear('user|')
    expect(cacheGet('user|/list|')).toBeNull()
    expect(cacheGet('user|/detail|')).toBeNull()
    expect(cacheGet('equipment|/list|')).toBe(3)
  })
})
