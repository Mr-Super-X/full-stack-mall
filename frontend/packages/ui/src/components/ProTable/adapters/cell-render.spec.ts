/**
 * cell-render adapter 单元测试
 *
 * 覆盖矩阵（v2.1 P1 抽取的渲染优先级链）：
 * - col.render 存在时优先返回 render 产物（VNode）
 * - col.render 不存在 + col.enum 存在 + 值匹配 → 返回 ElTag VNode
 * - col.render 不存在 + col.enum 存在 + 值不匹配 → fallback 到 row[prop]
 * - col.render 不存在 + col.enum 不存在 → 直接返回 row[prop]
 * - enum 命中后用 entry.label + entry.tagType（默认 'info'）
 *
 * @group ProTable adapters 测试
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import type { VNode } from 'vue'
import { resolveCellContent } from './cell-render'
import type { ProColumn } from '../types'

interface Row {
  id: number
  name: string
  status?: string
}

describe('cell-render / resolveCellContent', () => {
  const baseRow: Row = { id: 1, name: 'A' }

  it('col.render 存在时优先返回 render 产物（VNode），忽略 enum 和字段值', () => {
    const customVnode = h('span', { class: 'custom' }, '自定义渲染')
    const col: ProColumn<Row> = {
      prop: 'name',
      label: '名称',
      render: () => customVnode,
      enum: [{ value: 'A', label: '不应使用', tagType: 'primary' }],
    }
    const result = resolveCellContent(col, baseRow, 0)
    expect(result).toBe(customVnode)
  })

  it('col.render 接收正确参数：row / column / $index', () => {
    let captured: { row: Row; column: ProColumn<Row>; $index: number } | null = null
    const col: ProColumn<Row> = {
      prop: 'name',
      label: '名称',
      render: (scope) => {
        captured = scope
        return h('span', 'OK')
      },
    }
    resolveCellContent(col, baseRow, 3)
    expect(captured).not.toBeNull()
    expect(captured!.row).toBe(baseRow)
    expect(captured!.column).toBe(col)
    expect(captured!.$index).toBe(3)
  })

  it('无 render + 有 enum + 值匹配 → 返回 ElTag VNode（label + tagType）', () => {
    const col: ProColumn<Row> = {
      prop: 'status',
      label: '状态',
      enum: [
        { value: 'active', label: '活跃', tagType: 'success' },
        { value: 'inactive', label: '停用', tagType: 'danger' },
      ],
    }
    const row: Row = { id: 1, name: 'A', status: 'active' }
    const result = resolveCellContent(col, row, 0)
    expect(result).toBeDefined()
    expect((result as VNode).type).toBeDefined() // ElTag 组件对象
  })

  it('无 render + 有 enum + 值不匹配 → fallback 到 row[prop]', () => {
    const col: ProColumn<Row> = {
      prop: 'status',
      label: '状态',
      enum: [{ value: 'active', label: '活跃', tagType: 'success' }],
    }
    const row: Row = { id: 1, name: 'A', status: 'unknown-value' }
    const result = resolveCellContent(col, row, 0)
    expect(result).toBe('unknown-value')
  })

  it('无 render + 无 enum → 直接返回 row[prop]', () => {
    const col: ProColumn<Row> = { prop: 'name', label: '名称' }
    expect(resolveCellContent(col, baseRow, 0)).toBe('A')
  })

  it('无 render + 无 enum + 字段值为 undefined → 返回 undefined（消费方应处理）', () => {
    const col: ProColumn<Row> = { prop: 'status', label: '状态' }
    const result = resolveCellContent(col, baseRow, 0)
    expect(result).toBeUndefined()
  })

  it('enum 缺省 tagType 时使用默认 "info"', () => {
    // 通过观察 ElTag 渲染 props 的 type 字段验证默认 tagType
    const col: ProColumn<Row> = {
      prop: 'status',
      label: '状态',
      enum: [{ value: 'active', label: '活跃' }], // 无 tagType
    }
    const row: Row = { id: 1, name: 'A', status: 'active' }
    const result = resolveCellContent(col, row, 0)
    // ElTag 的 props 通过 h() 的第二参数传入，验证 type === 'info'
    const vnode = result as VNode
    expect(vnode.props).toMatchObject({ type: 'info' })
  })

  it('enum 多个 entry：find 返回第一个匹配', () => {
    // enum 是 Array.find 语义，多个匹配只取第一个
    const col: ProColumn<Row> = {
      prop: 'status',
      label: '状态',
      enum: [
        { value: 'a', label: 'A版', tagType: 'primary' },
        { value: 'a', label: 'A版别名', tagType: 'success' }, // 同 value，按数组顺序取第一个
      ],
    }
    const row: Row = { id: 1, name: 'A', status: 'a' }
    const result = resolveCellContent(col, row, 0) as VNode
    expect(result.props).toMatchObject({ type: 'primary' })
  })
})
