import { describe, it, expect } from 'vitest'
import { pascalCase, kebabCase } from './caseConvert'

describe('pascalCase（kebab/snake → Pascal）', () => {
  it('kebab-case 单个单词', () => {
    expect(pascalCase('my-button')).toBe('MyButton')
  })

  it('kebab-case 多个单词', () => {
    expect(pascalCase('async-state')).toBe('AsyncState')
    expect(pascalCase('error-boundary')).toBe('ErrorBoundary')
  })

  it('snake_case 转换', () => {
    expect(pascalCase('error_boundary')).toBe('ErrorBoundary')
  })

  it('已是 PascalCase 不变', () => {
    expect(pascalCase('AsyncState')).toBe('AsyncState')
  })

  it('空字符串返回空', () => {
    expect(pascalCase('')).toBe('')
  })
})

describe('kebabCase（Pascal/camel → kebab）', () => {
  it('PascalCase 单个单词', () => {
    expect(kebabCase('MyButton')).toBe('my-button')
  })

  it('PascalCase 多个单词', () => {
    expect(kebabCase('AsyncState')).toBe('async-state')
    expect(kebabCase('ErrorBoundary')).toBe('error-boundary')
  })

  it('camelCase 转换', () => {
    expect(kebabCase('myButton')).toBe('my-button')
  })

  it('已是 kebab-case 不变', () => {
    expect(kebabCase('async-state')).toBe('async-state')
  })

  it('空字符串返回空', () => {
    expect(kebabCase('')).toBe('')
  })
})
