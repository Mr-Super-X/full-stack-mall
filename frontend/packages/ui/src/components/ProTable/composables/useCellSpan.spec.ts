import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCellSpan } from './useCellSpan'
import type { ProColumn } from '../types'

describe('useCellSpan', () => {
  let columns: ProColumn[]

  beforeEach(() => {
    columns = [
      { prop: 'status', label: '状态', span: { direction: 'row' } },
      { prop: 'name', label: '姓名' },
    ]
  })

  it('同列相邻相等值自动纵向合并', () => {
    const data = [
      { status: '待付款', name: '订单1' },
      { status: '待付款', name: '订单2' },
      { status: '已付款', name: '订单3' },
      { status: '已付款', name: '订单4' },
      { status: '已付款', name: '订单5' },
    ]
    const span = useCellSpan({ columns, data, maxMergeSpan: 10 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 2, colspan: 1 })
    expect(
      span.spanMethod({
        row: data[1]!,
        rowIndex: 1,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 0, colspan: 1 })
    expect(
      span.spanMethod({
        row: data[2]!,
        rowIndex: 2,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 3, colspan: 1 })
  })

  it('自定义 judge 函数（按部门合并）', () => {
    const data = [
      { dept: 'A', name: '张三' },
      { dept: 'A', name: '李四' },
      { dept: 'B', name: '王五' },
    ]
    const deptCol: ProColumn = {
      prop: 'dept',
      label: '部门',
      span: { direction: 'row', judge: (a, b) => a.dept === b.dept },
    }
    const span = useCellSpan({ columns: [deptCol], data, maxMergeSpan: 10 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'dept' },
      })
    ).toEqual({ rowspan: 2, colspan: 1 })
    expect(
      span.spanMethod({
        row: data[1]!,
        rowIndex: 1,
        columnIndex: 0,
        column: { property: 'dept' },
      })
    ).toEqual({ rowspan: 0, colspan: 1 })
    expect(
      span.spanMethod({
        row: data[2]!,
        rowIndex: 2,
        columnIndex: 0,
        column: { property: 'dept' },
      })
    ).toEqual({ rowspan: 1, colspan: 1 })
  })

  it('maxMergeSpan = 3 限制合并上限', () => {
    const data = Array.from({ length: 6 }, () => ({ status: 'X' }))
    const span = useCellSpan({ columns, data, maxMergeSpan: 3 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 3, colspan: 1 })
    expect(
      span.spanMethod({
        row: data[3]!,
        rowIndex: 3,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 3, colspan: 1 })
  })

  it('未声明 span 的列返回默认 {rowspan:1, colspan:1}', () => {
    const data = [{ name: '张三' }]
    const span = useCellSpan({ columns, data, maxMergeSpan: 10 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 1,
        column: { property: 'name' },
      })
    ).toEqual({ rowspan: 1, colspan: 1 })
  })

  it('resetCache 后重新计算', () => {
    const data = [{ status: 'X' }, { status: 'X' }]
    const span = useCellSpan({ columns, data, maxMergeSpan: 10 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 2, colspan: 1 })

    // 修改 data，模拟拖拽后顺序变化
    data.splice(0, 2, { status: 'A' }, { status: 'B' })
    span.resetCache()

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 1, colspan: 1 })
  })

  it('跨列合并（colspan > 1）通过 _spanTarget 字段', () => {
    const data = [{ order: '001', product: 'iPhone' }]
    const cols: ProColumn[] = [
      { prop: 'order', label: '订单号', span: { direction: 'column' } },
      { prop: 'product', label: '商品', span: { direction: 'column' } },
    ]
    const span = useCellSpan({ columns: cols, data, maxMergeSpan: 10 })

    data[0]!._spanTarget = 'order'
    span.resetCache()

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'order' },
      })
    ).toEqual({ rowspan: 1, colspan: 2 })
  })

  it('judge 抛错时降级为不相等即不合并 + console.warn', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = [{ status: 'X' }, { status: 'X' }]
    const cols: ProColumn[] = [
      {
        prop: 'status',
        label: '状态',
        span: {
          direction: 'row',
          judge: () => {
            throw new Error('judge 错误')
          },
        },
      },
    ]
    const span = useCellSpan({ columns: cols, data, maxMergeSpan: 10 })

    expect(
      span.spanMethod({
        row: data[0]!,
        rowIndex: 0,
        columnIndex: 0,
        column: { property: 'status' },
      })
    ).toEqual({ rowspan: 1, colspan: 1 })
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })
})
