import { describe, it, expect } from 'vitest'
import { createProxyConfig } from './proxy'

describe('createProxyConfig', () => {
  it('返回 /api 代理到后端 18080（context-path 同为 /api，无需 rewrite）', () => {
    expect(createProxyConfig({})).toEqual({
      '/api': { target: 'http://localhost:18080', changeOrigin: true },
    })
  })

  it('接受 env 参数（未来扩展位，env 不改动当前固定代理）', () => {
    expect(createProxyConfig({ FOO: 'bar' })).toEqual({
      '/api': { target: 'http://localhost:18080', changeOrigin: true },
    })
  })
})
