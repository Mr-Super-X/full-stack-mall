/**
 * vxe-column 列映射适配层单元测试（v2.1 P2）
 *
 * 覆盖场景：
 * 1) 基础映射：prop→field / label→title
 * 2) 特殊列类型翻译：selection→checkbox / index→seq / expand→expand / operation 无 type
 * 3) sortable：true 与 'custom' 列级同映射为 true，未声明不输出 sortable
 * 4) width / minWidth / fixed 透传
 * 5) vxeProps 补充不覆盖派生值（field/title/sortable 冲突时派生优先，未冲突项保留）
 * 6) enum 列（ElTag 固有宽度）无宽度声明时补 minWidth 兜底；显式 width/minWidth/
 *    vxeProps.minWidth / 自定义 render 时兜底不生效
 * 7) hasCustomSort：任一列 'custom' 即 true
 *
 * @group ProTable adapters 测试
 */
import { describe, it, expect } from 'vitest'
import { toVxeColumnProps, hasCustomSort } from './vxe-column'
import type { ProColumn } from '../types'

describe('toVxeColumnProps', () => {
  it('基础映射：prop→field，label→title', () => {
    const col: ProColumn = { prop: 'name', label: '姓名' }
    expect(toVxeColumnProps(col)).toMatchObject({ field: 'name', title: '姓名' })
  })

  it('selection 列翻译为 checkbox 类型', () => {
    const col: ProColumn = { prop: '__selection', label: '', type: 'selection' }
    expect(toVxeColumnProps(col).type).toBe('checkbox')
  })

  it('index 列翻译为 seq 类型', () => {
    const col: ProColumn = { prop: '__index', label: '#', type: 'index' }
    expect(toVxeColumnProps(col).type).toBe('seq')
  })

  it('operation 列不输出特殊 type（按普通业务列渲染）', () => {
    const col: ProColumn = { prop: 'operation', label: '操作', type: 'operation' }
    expect(toVxeColumnProps(col).type).toBeUndefined()
  })

  it("sortable true 与 'custom' 列级均映射为 true", () => {
    const client: ProColumn = { prop: 'a', label: 'A', sortable: true }
    const server: ProColumn = { prop: 'b', label: 'B', sortable: 'custom' }
    expect(toVxeColumnProps(client).sortable).toBe(true)
    expect(toVxeColumnProps(server).sortable).toBe(true)
  })

  it('未声明 sortable 时不输出该键', () => {
    const col: ProColumn = { prop: 'a', label: 'A' }
    expect(toVxeColumnProps(col)).not.toHaveProperty('sortable')
  })

  it('width / minWidth / fixed 透传', () => {
    const col: ProColumn = { prop: 'a', label: 'A', width: 120, minWidth: 80, fixed: 'left' }
    expect(toVxeColumnProps(col)).toMatchObject({ width: 120, minWidth: 80, fixed: 'left' })
  })

  it('vxeProps 未冲突项保留（补充语义）', () => {
    const col: ProColumn = {
      prop: 'a',
      label: 'A',
      vxeProps: { showOverflow: true, resizable: false },
    }
    expect(toVxeColumnProps(col)).toMatchObject({ showOverflow: true, resizable: false })
  })

  it('vxeProps 与派生值冲突时派生优先（不覆盖语义）', () => {
    const col: ProColumn = {
      prop: 'name',
      label: '姓名',
      sortable: 'custom',
      vxeProps: { field: 'hacked', title: '覆盖', sortable: false },
    }
    const props = toVxeColumnProps(col)
    expect(props.field).toBe('name')
    expect(props.title).toBe('姓名')
    expect(props.sortable).toBe(true)
  })

  it('enum 列（ElTag 固有宽度内容）无宽度声明时补 minWidth 兜底，防窄容器挤压截断', () => {
    const col: ProColumn = {
      prop: 'status',
      label: '状态',
      enum: [{ label: '已支付', value: 'paid' }],
    }
    expect(toVxeColumnProps(col).minWidth).toBe(80)
  })

  it('enum 列用户显式 width / minWidth / vxeProps.minWidth 时兜底不生效', () => {
    const withWidth: ProColumn = {
      prop: 'status',
      label: '状态',
      enum: [{ label: '已支付', value: 'paid' }],
      width: 120,
    }
    expect(toVxeColumnProps(withWidth).minWidth).toBeUndefined()

    const withMinWidth: ProColumn = {
      prop: 'status',
      label: '状态',
      enum: [{ label: '已支付', value: 'paid' }],
      minWidth: 120,
    }
    expect(toVxeColumnProps(withMinWidth).minWidth).toBe(120)

    const withVxePropsMinWidth: ProColumn = {
      prop: 'status',
      label: '状态',
      enum: [{ label: '已支付', value: 'paid' }],
      vxeProps: { minWidth: 140 },
    }
    expect(toVxeColumnProps(withVxePropsMinWidth).minWidth).toBe(140)
  })

  it('enum + 自定义 render 列不兜底（render 内容宽度不可知，由用户自行声明）', () => {
    const col: ProColumn = {
      prop: 'status',
      label: '状态',
      enum: [{ label: '已支付', value: 'paid' }],
      render: () => 'custom',
    }
    expect(toVxeColumnProps(col).minWidth).toBeUndefined()
  })

  it('无 enum 的普通列不补 minWidth 兜底', () => {
    const col: ProColumn = { prop: 'name', label: '姓名' }
    expect(toVxeColumnProps(col).minWidth).toBeUndefined()
  })
})

describe('hasCustomSort', () => {
  it('任一列 sortable=custom 即 true', () => {
    const cols: ProColumn[] = [
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', sortable: 'custom' },
    ]
    expect(hasCustomSort(cols)).toBe(true)
  })

  it('全部为客户端排序或未排序时 false', () => {
    const cols: ProColumn[] = [
      { prop: 'a', label: 'A', sortable: true },
      { prop: 'b', label: 'B' },
    ]
    expect(hasCustomSort(cols)).toBe(false)
  })

  it('空列数组 false', () => {
    expect(hasCustomSort([])).toBe(false)
  })
})
