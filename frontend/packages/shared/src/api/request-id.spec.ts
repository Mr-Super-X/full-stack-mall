import { describe, it, expect } from 'vitest'
import { generateRequestId, readRequestId, REQUEST_ID_HEADER } from './request-id'

describe('generateRequestId', () => {
  it('生成的 ID 是非空字符串', () => {
    const id = generateRequestId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('两次调用生成不同 ID', () => {
    expect(generateRequestId()).not.toBe(generateRequestId())
  })

  it('格式符合 UUID v4（crypto.randomUUID 可用时）', () => {
    const id = generateRequestId()
    // crypto.randomUUID() 返回 36 字符的 UUID（含连字符）
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})

describe('readRequestId', () => {
  it('从 response header 读出 X-Request-ID', () => {
    const headers = { 'X-Request-ID': 'abc-123' }
    expect(readRequestId(headers, 'fallback')).toBe('abc-123')
  })

  it('header 缺失时走 fallback', () => {
    const headers = {}
    expect(readRequestId(headers, 'fallback')).toBe('fallback')
  })

  it('header 为空字符串时走 fallback', () => {
    const headers = { 'X-Request-ID': '' }
    expect(readRequestId(headers, 'fallback')).toBe('fallback')
  })

  it('header 为数组时取第一个元素', () => {
    const headers = { 'X-Request-ID': ['first', 'second'] }
    expect(readRequestId(headers, 'fallback')).toBe('first')
  })

  it('header 为 undefined 时走 fallback', () => {
    const headers: Record<string, string | string[] | undefined> = { 'X-Request-ID': undefined }
    expect(readRequestId(headers, 'fallback')).toBe('fallback')
  })
})

describe('REQUEST_ID_HEADER 常量', () => {
  it('值为 "X-Request-ID"', () => {
    expect(REQUEST_ID_HEADER).toBe('X-Request-ID')
  })
})
