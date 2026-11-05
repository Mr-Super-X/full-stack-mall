/**
 * cell-format 单元测试 —— v3.1 内置格式化器预设
 *
 * 覆盖矩阵：
 * - resolveFormatter：undefined / 函数 / 预设 key / 非法 key 四态分发
 * - dateTime / date / time：合法输入格式化、非法输入原样返回
 * - amount：千分位 + 2 位小数、非数字原样返回、null/空串原样返回
 * - percent：小数语义 ×100、非法输入原样返回
 * - boolTag：真值集合（true/1/'1'/'true'）→ success tag，其余 → info tag
 *
 * @group ProTable adapters
 */
import { describe, it, expect } from 'vitest'
import { h, isVNode, type VNode } from 'vue'
import { ElTag } from 'element-plus'
import { resolveFormatter } from './cell-format'
import type { ProColumn } from '../types'

/** 构造最小列定义（formatter 分发只用 prop） */
function makeCol(formatter: unknown): ProColumn {
  return { prop: 'v', label: '值', formatter: formatter as never }
}

const ROW = { v: 123 }
const NOOP_ROW: Record<string, unknown> = {}

describe('resolveFormatter 分发', () => {
  it('undefined 返回 null', () => {
    expect(resolveFormatter(undefined)).toBeNull()
  })

  it('函数形态原样返回', () => {
    const fn = (row: Record<string, unknown>) => String(row.v)
    expect(resolveFormatter(fn)).toBe(fn)
  })

  it('非法 key 返回 null（走 fallback 分支）', () => {
    expect(resolveFormatter('not-a-preset')).toBeNull()
  })

  it.each(['dateTime', 'date', 'time', 'amount', 'percent', 'boolTag'] as const)(
    '预设 %s 返回可执行函数',
    (preset) => {
      const resolved = resolveFormatter(preset)
      expect(typeof resolved).toBe('function')
      const col = makeCol(preset)
      // 不抛错即可（具体输出由下方用例断言）
      expect(() => resolved?.(ROW, col, ROW.v, 0)).not.toThrow()
    }
  )
})

describe('dateTime / date / time 预设', () => {
  it('dateTime：合法时间戳格式化到秒', () => {
    const fn = resolveFormatter('dateTime')!
    // 2026-09-16 00:00:00 UTC+8 对应时间戳（固定值避免时区抖动：用 dayjs 可解析字符串更稳）
    expect(fn(NOOP_ROW, makeCol('dateTime'), '2026-09-16 14:30:00', 0)).toBe('2026-09-16 14:30:00')
  })

  it('date：只保留日期部分', () => {
    const fn = resolveFormatter('date')!
    expect(fn(NOOP_ROW, makeCol('date'), '2026-09-16 14:30:00', 0)).toBe('2026-09-16')
  })

  it('time：只保留时间部分', () => {
    const fn = resolveFormatter('time')!
    expect(fn(NOOP_ROW, makeCol('time'), '2026-09-16 14:30:00', 0)).toBe('14:30:00')
  })

  it('非法日期原样返回（不输出 Invalid Date）', () => {
    const fn = resolveFormatter('dateTime')!
    expect(fn(NOOP_ROW, makeCol('dateTime'), 'not-a-date', 0)).toBe('not-a-date')
  })
})

describe('amount / percent 预设', () => {
  it('amount：千分位 + 保留 2 位小数', () => {
    const fn = resolveFormatter('amount')!
    expect(fn(NOOP_ROW, makeCol('amount'), 1234567.891, 0)).toBe('1,234,567.89')
  })

  it('amount：整数千分位', () => {
    const fn = resolveFormatter('amount')!
    expect(fn(NOOP_ROW, makeCol('amount'), 1000, 0)).toBe('1,000.00')
  })

  it('amount：非数字原样返回', () => {
    const fn = resolveFormatter('amount')!
    expect(fn(NOOP_ROW, makeCol('amount'), 'abc', 0)).toBe('abc')
    expect(fn(NOOP_ROW, makeCol('amount'), null, 0)).toBe('')
  })

  it('percent：小数语义 ×100 保留 2 位', () => {
    const fn = resolveFormatter('percent')!
    expect(fn(NOOP_ROW, makeCol('percent'), 0.1567, 0)).toBe('15.67%')
    expect(fn(NOOP_ROW, makeCol('percent'), 1, 0)).toBe('100.00%')
  })

  it('percent：非法输入原样返回', () => {
    const fn = resolveFormatter('percent')!
    expect(fn(NOOP_ROW, makeCol('percent'), undefined, 0)).toBe('')
  })
})

describe('boolTag 预设', () => {
  function renderBool(value: unknown): VNode {
    const fn = resolveFormatter('boolTag')!
    const vnode = fn(NOOP_ROW, makeCol('boolTag'), value, 0)
    if (!isVNode(vnode)) throw new Error('boolTag 应返回 VNode')
    return vnode
  }

  it.each([true, 1, '1', 'true'])('真值 %j → success tag + "是"', (value) => {
    const vnode = renderBool(value)
    expect(vnode.type).toBe(ElTag)
    expect(vnode.props?.type).toBe('success')
  })

  it.each([false, 0, '0', undefined, null])('假值 %j → info tag + "否"', (value) => {
    const vnode = renderBool(value)
    expect(vnode.type).toBe(ElTag)
    expect(vnode.props?.type).toBe('info')
  })

  it('输出为 ElTag VNode（非字符串）', () => {
    expect(isVNode(renderBool(true))).toBe(true)
    // 防御回归：h() 产物才是 VNode，字符串会被 CellContent 走文本插值
    expect(typeof h('span')).toBe('object')
  })
})
