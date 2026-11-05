import { describe, it, expect } from 'vitest'
import { SERVER_DEFAULTS } from './server'

describe('SERVER_DEFAULTS', () => {
  it('端口 5174（与默认 5173 错开）', () => {
    expect(SERVER_DEFAULTS.port).toBe(5174)
  })

  it('strictPort: true（端口占用时直接报错）', () => {
    expect(SERVER_DEFAULTS.strictPort).toBe(true)
  })
})
