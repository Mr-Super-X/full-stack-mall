import { describe, it, expect } from 'vitest'
import { createProxyConfig } from './proxy'

describe('createProxyConfig', () => {
  it('当前返回空对象（占位）', () => {
    expect(createProxyConfig({})).toEqual({})
  })

  it('接受 env 参数并忽略（未来扩展位）', () => {
    expect(createProxyConfig({ FOO: 'bar' })).toEqual({})
  })
})
