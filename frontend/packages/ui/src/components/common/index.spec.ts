import { describe, it, expect } from 'vitest'
import { isExcluded, resolveComponentName } from './_internal/naming'

describe('isExcluded', () => {
  it('默认 common 文件名不被排除', () => {
    expect(isExcluded('./AsyncState.vue')).toBe(false)
  })
  it('以 _ 开头的文件被排除', () => {
    expect(isExcluded('./_Internal.vue')).toBe(true)
  })
  it('以 . 开头的文件被排除', () => {
    expect(isExcluded('./.Hidden.vue')).toBe(true)
  })
  it('子目录内以 _ 开头的文件仍被排除', () => {
    expect(isExcluded('./Sub/_Comp.vue')).toBe(true)
  })
})

describe('resolveComponentName', () => {
  it('优先使用 SFC 显式 name', () => {
    expect(resolveComponentName('./AsyncState.vue', 'MyAlias')).toBe('MyAlias')
  })
  it('name 缺失时回退到文件 basename', () => {
    expect(resolveComponentName('./AsyncState.vue')).toBe('AsyncState')
  })
  it('支持子目录路径的 basename 抽取', () => {
    expect(resolveComponentName('./SubDir/Bar.vue')).toBe('Bar')
  })
  it('大小写后缀 .Vue / .vue 都能去掉', () => {
    expect(resolveComponentName('./AsyncState.Vue')).toBe('AsyncState')
  })
})
