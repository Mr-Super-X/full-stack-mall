import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { readRefStr } from './read-ref-str'

describe('readRefStr', () => {
  it('returns undefined for undefined / null', () => {
    expect(readRefStr(undefined)).toBeUndefined()
    expect(readRefStr(null)).toBeUndefined()
  })

  it('returns string directly', () => {
    expect(readRefStr('error')).toBe('error')
    expect(readRefStr('')).toBe('')
  })

  it('reads value from Ref<string>', () => {
    expect(readRefStr(ref('hello'))).toBe('hello')
  })

  it('returns undefined when Ref value is not string', () => {
    expect(readRefStr(ref(123))).toBeUndefined()
    expect(readRefStr(ref({}))).toBeUndefined()
    expect(readRefStr(ref(null))).toBeUndefined()
  })

  it('returns string from ref-like plain object with .value', () => {
    expect(readRefStr({ value: 'plain-object' })).toBe('plain-object')
  })

  it('returns undefined for non-ref objects without value', () => {
    expect(readRefStr({ foo: 'bar' } as never)).toBeUndefined()
  })
})
