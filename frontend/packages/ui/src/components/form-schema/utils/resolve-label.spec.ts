import { describe, it, expect, vi } from 'vitest'
import { resolveLabel } from './resolve-label'
import type { XFormLabelFn } from '../types'

describe('resolveLabel —— label 渲染期求值', () => {
  it('undefined → undefined（调用方决定占位）', () => {
    expect(resolveLabel(undefined)).toBeUndefined()
    expect(resolveLabel(undefined, vi.fn())).toBeUndefined()
  })

  it('string 字面量原样返回（不经过 t）', () => {
    const t = vi.fn(() => '翻译')
    expect(resolveLabel('邮箱', t)).toBe('邮箱')
    expect(t).not.toHaveBeenCalled()
  })

  it('XFormLabelFn 以注入的 t 求值', () => {
    const t = (key: string) => `zh:${key}`
    const label: XFormLabelFn = (tt) => tt('form.email')
    expect(resolveLabel(label, t)).toBe('zh:form.email')
  })

  it('未注入 t 时函数式 label 收到 identity（key 原样返回）', () => {
    const label: XFormLabelFn = (tt) => tt('form.email')
    expect(resolveLabel(label)).toBe('form.email')
  })

  it('同一 label fn 随不同 t 产出不同文案（语言切换 = 换 t 重渲）', () => {
    const label: XFormLabelFn = (tt) => tt('form.email')
    expect(resolveLabel(label, (k) => `zh:${k}`)).toBe('zh:form.email')
    expect(resolveLabel(label, (k) => `en:${k}`)).toBe('en:form.email')
  })
})
