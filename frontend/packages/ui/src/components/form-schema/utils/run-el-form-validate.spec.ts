import { describe, it, expect, vi } from 'vitest'
import { runElFormValidate } from './run-el-form-validate'

describe('runElFormValidate', () => {
  it('callback valid=true → resolve true', async () => {
    const efValidate = vi.fn((cb: (v: boolean) => void) => {
      cb(true)
      return Promise.resolve(true)
    })
    await expect(runElFormValidate(efValidate)).resolves.toBe(true)
  })

  it('callback valid=false → resolve false', async () => {
    const efValidate = vi.fn((cb: (v: boolean) => void) => {
      cb(false)
      return Promise.resolve(false)
    })
    await expect(runElFormValidate(efValidate)).resolves.toBe(false)
  })

  it('element-plus 即使传 callback 仍 reject errorsMap → catch 接住 resolve false', async () => {
    const efValidate = vi.fn(() => Promise.reject(new Error('validation failed')))
    await expect(runElFormValidate(efValidate as never)).resolves.toBe(false)
  })
})
