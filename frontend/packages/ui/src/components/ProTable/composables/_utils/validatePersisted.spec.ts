import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidPersistedSetting } from './validatePersisted'

describe('isValidPersistedSetting', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('合法空对象（全部 optional 缺省）通过', () => {
    expect(isValidPersistedSetting({})).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('完整合法结构通过', () => {
    const raw = {
      order: ['name', 'age', 'id'],
      visible: { name: true, age: false, id: true },
      fixed: { name: 'left', id: 'right' },
    }
    expect(isValidPersistedSetting(raw)).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('undefined / null / 字符串 / 数字 → not-object 失败', () => {
    expect(isValidPersistedSetting(undefined)).toBe(false)
    expect(isValidPersistedSetting(null)).toBe(false)
    expect(isValidPersistedSetting('x')).toBe(false)
    expect(isValidPersistedSetting(123)).toBe(false)
    expect(warnSpy).toHaveBeenCalledTimes(4)
  })

  it('order 非数组失败（篡改场景：用户编辑 localStorage）', () => {
    expect(isValidPersistedSetting({ order: 123 })).toBe(false)
    expect(isValidPersistedSetting({ order: 'name,age' })).toBe(false)
    expect(isValidPersistedSetting({ order: [1, 2, 3] })).toBe(false)
  })

  it('visible 非 Record 或值非 boolean 失败', () => {
    expect(isValidPersistedSetting({ visible: 'all' })).toBe(false)
    expect(isValidPersistedSetting({ visible: [true] })).toBe(false)
    expect(isValidPersistedSetting({ visible: { name: 'true' } })).toBe(false)
    expect(isValidPersistedSetting({ visible: { age: 1 } })).toBe(false)
  })

  it('fixed 非 Record 或值非 left/right 失败', () => {
    expect(isValidPersistedSetting({ fixed: 'name' })).toBe(false)
    expect(isValidPersistedSetting({ fixed: { name: 'center' } })).toBe(false)
    expect(isValidPersistedSetting({ fixed: { name: 'left', bad: 'left ', pad: 0 } })).toBe(false)
  })

  it('合法结构 + 单字段缺失也通过（向前兼容旧版本）', () => {
    expect(isValidPersistedSetting({ order: ['a', 'b'] })).toBe(true)
    expect(isValidPersistedSetting({ visible: { name: true } })).toBe(true)
    expect(isValidPersistedSetting({ fixed: { name: 'left' } })).toBe(true)
  })

  it('合法数组 vs 非法字段：先检 order 再检 visible 顺序', () => {
    // order 合法 + visible 非法：应判 false + warn 1 次
    expect(isValidPersistedSetting({ order: ['a'], visible: { bad: 'no' } })).toBe(false)
    // 整体非法时 warnSpy 至少调用 1 次（具体次数由失败点决定）
    expect(warnSpy).toHaveBeenCalled()
  })
})
