import { describe, it, expect } from 'vitest'
import { isEmail, isPhone, isIdCard } from './validate'

describe('isEmail', () => {
  it('accepts valid email', () => {
    expect(isEmail('test@example.com')).toBe(true)
  })
  it('rejects invalid email', () => {
    expect(isEmail('not-an-email')).toBe(false)
  })
})

describe('isPhone', () => {
  it('accepts 11-digit Chinese mobile', () => {
    expect(isPhone('13800138000')).toBe(true)
  })
  it('rejects invalid phone', () => {
    expect(isPhone('12345')).toBe(false)
  })
})

describe('isIdCard', () => {
  it('accepts 18-digit ID', () => {
    expect(isIdCard('110101199003078811')).toBe(true)
  })
  it('rejects invalid ID', () => {
    expect(isIdCard('123')).toBe(false)
  })
})
