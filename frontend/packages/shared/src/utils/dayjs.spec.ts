import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { formatDate, formatRelative, daysFromNow, isToday, parseDate } from './dayjs'

// 固定"当前时间"为 2026-07-21 12:00:00 本地。
// 用 vitest 的 useFakeTimers + setSystemTime 全局劫持 Date，
// 让 dayjs 内部 Date.now()/new Date() 都看到一致时间。
const FROZEN_LOCAL_MS = new Date(2026, 6, 21, 12, 0, 0).valueOf()

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN_LOCAL_MS)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('dayjs 通用封装', () => {
  describe('formatDate', () => {
    it('使用默认格式 YYYY-MM-DD HH:mm:ss', () => {
      const ts = new Date(2026, 6, 21, 8, 0, 0).valueOf()
      expect(formatDate(ts, undefined, 'en-US')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it('自定义格式', () => {
      const ts = new Date(2026, 6, 21, 8, 0, 0).valueOf()
      expect(formatDate(ts, 'YYYY/MM/DD', 'en-US')).toBe('2026/07/21')
    })

    it('接受 number 类型时间戳', () => {
      const ts = new Date(2026, 0, 1, 0, 0, 0).valueOf()
      expect(formatDate(ts, 'YYYY-MM-DD', 'en-US')).toBe('2026-01-01')
    })
  })

  describe('formatRelative', () => {
    it('过去时间返回 ago 文案', () => {
      const past = new Date(2026, 6, 21, 11, 0, 0).valueOf()
      expect(formatRelative(past, 'en-US')).toMatch(/ago/)
    })

    it('未来时间返回 in 文案', () => {
      const future = new Date(2026, 6, 21, 13, 0, 0).valueOf()
      expect(formatRelative(future, 'en-US')).toMatch(/in/)
    })
  })

  describe('daysFromNow', () => {
    it('今天为 0', () => {
      const now = new Date(2026, 6, 21, 12, 0, 0).valueOf()
      expect(daysFromNow(now)).toBe(0)
    })

    it('昨天为 -1', () => {
      const yesterday = new Date(2026, 6, 20, 12, 0, 0).valueOf()
      expect(daysFromNow(yesterday)).toBe(-1)
    })

    it('明天为 1', () => {
      const tomorrow = new Date(2026, 6, 22, 12, 0, 0).valueOf()
      expect(daysFromNow(tomorrow)).toBe(1)
    })
  })

  describe('isToday', () => {
    it('今天同日返回 true', () => {
      const now = new Date(2026, 6, 21, 12, 0, 0).valueOf()
      expect(isToday(now)).toBe(true)
    })

    it('昨天返回 false', () => {
      const yesterday = new Date(2026, 6, 20, 23, 59, 59).valueOf()
      expect(isToday(yesterday)).toBe(false)
    })
  })

  describe('parseDate', () => {
    it('解析已知格式返回有效 Dayjs', () => {
      const d = parseDate('2026-07-21 08:00', 'YYYY-MM-DD HH:mm', 'en-US')
      expect(d.isValid()).toBe(true)
    })

    it('格式不匹配返回无效 Dayjs', () => {
      const d = parseDate('not a date', 'YYYY-MM-DD', 'en-US')
      expect(d.isValid()).toBe(false)
    })
  })
})
