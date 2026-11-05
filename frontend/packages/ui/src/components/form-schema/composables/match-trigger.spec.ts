import { describe, it, expect } from 'vitest'
import { matchTrigger } from './match-trigger'

describe('matchTrigger(ruleTrigger, eventType)', () => {
  describe('undefined trigger (向后兼容默认行为)', () => {
    it('undefined 时响应 blur', () => {
      expect(matchTrigger(undefined, 'blur')).toBe(true)
    })
    it('undefined 时不响应 change', () => {
      expect(matchTrigger(undefined, 'change')).toBe(false)
    })
  })

  describe('string trigger (单值)', () => {
    it('trigger=blur 时响应 blur', () => {
      expect(matchTrigger('blur', 'blur')).toBe(true)
    })
    it('trigger=blur 时不响应 change', () => {
      expect(matchTrigger('blur', 'change')).toBe(false)
    })
    it('trigger=change 时响应 change', () => {
      expect(matchTrigger('change', 'change')).toBe(true)
    })
    it('trigger=change 时不响应 blur', () => {
      expect(matchTrigger('change', 'blur')).toBe(false)
    })
    it("trigger='manual' 时永远不响应 blur", () => {
      expect(matchTrigger('manual', 'blur')).toBe(false)
    })
    it("trigger='manual' 时永远不响应 change", () => {
      expect(matchTrigger('manual', 'change')).toBe(false)
    })
  })

  describe('array trigger (多事件)', () => {
    it("trigger=['blur', 'change'] 时响应两种事件", () => {
      expect(matchTrigger(['blur', 'change'], 'blur')).toBe(true)
      expect(matchTrigger(['blur', 'change'], 'change')).toBe(true)
    })
    it("trigger=['change'] 时只响应 change", () => {
      expect(matchTrigger(['change'], 'change')).toBe(true)
      expect(matchTrigger(['change'], 'blur')).toBe(false)
    })
    it("trigger=['blur'] 时只响应 blur", () => {
      expect(matchTrigger(['blur'], 'blur')).toBe(true)
      expect(matchTrigger(['blur'], 'change')).toBe(false)
    })
    it("trigger=['blur', 'change', 'manual'] 时 manual 也会匹配(语义层面 manual 不算事件,调用方不要传 manual 到数组里)", () => {
      // 当前实现不阻止 manual 在数组里,数组包含则匹配
      // 这是有意设计:调用方负责控制 trigger 字段值
      expect(matchTrigger(['blur', 'change', 'manual'], 'manual' as never)).toBe(true)
    })
  })

  describe('实际场景(对照 schema 写法)', () => {
    it('密码确认 crossValidator(无 trigger)→ 默认 blur 触发', () => {
      // 实际 XFormCrossField demo 中 passwordConfirm 的 crossValidator 没写 trigger
      expect(matchTrigger(undefined, 'blur')).toBe(true)
    })
    it('日期 crossValidator(trigger="change")→ 只响应 change,不响应 blur', () => {
      // endDate 的 crossValidator 写了 trigger: 'change'
      expect(matchTrigger('change', 'blur')).toBe(false)
      expect(matchTrigger('change', 'change')).toBe(true)
    })
    it('manual 触发器:仅在 validateForm 时跑,blur/change 都不响应', () => {
      // 用户配置 trigger: 'manual' 意为只在提交时跑
      expect(matchTrigger('manual', 'blur')).toBe(false)
      expect(matchTrigger('manual', 'change')).toBe(false)
    })
  })
})

describe('历史嵌套数组兼容（⑧ 类型修复前运行时可写入）', () => {
  it("trigger=[['blur','change']] 嵌套数组拍平后正常匹配", () => {
    const nested = [['blur', 'change']] as unknown as string[]
    expect(matchTrigger(nested, 'blur')).toBe(true)
    expect(matchTrigger(nested, 'change')).toBe(true)
  })

  it("trigger=[['blur']] 嵌套数组只响应 blur", () => {
    const nested = [['blur']] as unknown as string[]
    expect(matchTrigger(nested, 'blur')).toBe(true)
    expect(matchTrigger(nested, 'change')).toBe(false)
  })
})
