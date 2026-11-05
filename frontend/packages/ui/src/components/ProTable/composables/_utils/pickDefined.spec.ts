/**
 * _utils/pickDefined 单元测试
 */
import { describe, it, expect } from 'vitest'
import { pickDefined, asConfig, castToRecordArray } from './pickDefined'

describe('pickDefined', () => {
  it('过滤 undefined 字段，保留已定义字段', () => {
    const src = { a: 1, b: undefined, c: 'x' }
    const out = pickDefined(src, ['a', 'b', 'c'])
    expect(out).toEqual({ a: 1, c: 'x' })
  })

  it('空 keys 返回空对象', () => {
    const src = { a: 1 }
    const out = pickDefined(src, [])
    expect(out).toEqual({})
  })

  it('所有字段都未定义时返回空对象', () => {
    const src = { a: undefined, b: undefined }
    const out = pickDefined(src, ['a', 'b'])
    expect(out).toEqual({})
  })
})

describe('asConfig', () => {
  it('boolean true → 返回 fallback', () => {
    const out = asConfig(true, { default: 'fb' })
    expect(out).toEqual({ default: 'fb' })
  })

  it('undefined → 返回 fallback', () => {
    const out = asConfig(undefined, { default: 'fb' })
    expect(out).toEqual({ default: 'fb' })
  })

  it('Config 对象 → 透传', () => {
    const cfg = { custom: 'value' }
    const out = asConfig(cfg, { default: 'fb' })
    expect(out).toBe(cfg)
  })

  it('null（防御性）→ 返回 fallback', () => {
    const out = asConfig(null as never, { default: 'fb' })
    expect(out).toEqual({ default: 'fb' })
  })
})

describe('castToRecordArray', () => {
  it('业务行数组 → Record 视角数组（运行时同引用）', () => {
    type Row = { id: number; name: string }
    const rows: Row[] = [{ id: 1, name: 'a' }]
    const out = castToRecordArray(rows)
    expect(out).toBe(rows as unknown as Record<string, unknown>[])
    expect(out[0]?.id).toBe(1)
  })
})
