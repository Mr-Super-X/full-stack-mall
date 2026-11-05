/**
 * RowDragAdapter 单元测试（v3.5 PR1-B Task 4 + Task 5）—— 验证 RowDragAdapter 接口契约
 * 与 elementPlusRowDragAdapter / vxeRowDragAdapter 双引擎实现。
 *
 * @group ProTable adapters 测试
 */
import { describe, it, expect } from 'vitest'
import {
  createElementPlusRowDragAdapter,
  createVxeRowDragAdapter,
  VXE_TABLE_TBODY_SELECTOR,
  EL_TABLE_TBODY_SELECTOR,
  EL_TABLE_ROW_KEY_ATTR,
  EL_TABLE_ROW_LEVEL_ATTR,
  type RowDragAdapter,
} from './row-drag-adapter'

describe('RowDragAdapter (elementPlusRowDragAdapter)', () => {
  describe('常量导出', () => {
    it('EL_TABLE_TBODY_SELECTOR 选择器与 ElementTableBody DOM 结构一致', () => {
      // 必须与 ElementTableBody 模板实际生成的 tbody DOM 选择器匹配
      expect(EL_TABLE_TBODY_SELECTOR).toBe('.el-table__body-wrapper tbody')
    })
    it('EL_TABLE_ROW_KEY_ATTR 行 rowKey 属性名与 ElementTableBody 一致', () => {
      expect(EL_TABLE_ROW_KEY_ATTR).toBe('data-row-key')
    })
    it('EL_TABLE_ROW_LEVEL_ATTR 行层级属性名与 ElementTableBody 一致', () => {
      expect(EL_TABLE_ROW_LEVEL_ATTR).toBe('data-level')
    })
  })

  describe('createElementPlusRowDragAdapter', () => {
    it('getTbody 返回当前 el-table tbody（jsdom 下为空，无 .el-table__body-wrapper）', () => {
      const adapter = createElementPlusRowDragAdapter()
      expect(adapter.getTbody()).toBeNull()
    })

    it('getTbody 在挂载 .el-table__body-wrapper tbody 后返回该元素', () => {
      // 临时挂 DOM：模拟 el-table 渲染产物
      const wrap = document.createElement('div')
      wrap.className = 'el-table__body-wrapper'
      const tbody = document.createElement('tbody')
      wrap.appendChild(tbody)
      document.body.appendChild(wrap)

      const adapter = createElementPlusRowDragAdapter()
      const got = adapter.getTbody()
      expect(got).toBe(tbody)

      document.body.removeChild(wrap)
    })

    it('extractRowKey 从 data-row-key 属性读取（字符串原样返回）', () => {
      const adapter = createElementPlusRowDragAdapter('orderNo')
      const row = document.createElement('tr')
      row.setAttribute('data-row-key', 'abc-123')
      expect(adapter.extractRowKey(row)).toBe('abc-123')
    })

    it('extractRowKey rowKey="id" 时数字字符串转回 number', () => {
      // 与 useTable.data 行 key 类型一致：业务 row.id 为数字时 adapter 还原 1 而非 "1"
      const adapter = createElementPlusRowDragAdapter('id')
      const row = document.createElement('tr')
      row.setAttribute('data-row-key', '42')
      expect(adapter.extractRowKey(row)).toBe(42)
    })

    it('extractRowKey 属性缺失返回 null（useRowDrag 走 console.warn + 跳过）', () => {
      const adapter = createElementPlusRowDragAdapter()
      const row = document.createElement('tr')
      expect(adapter.extractRowKey(row)).toBeNull()
    })

    it('extractRowKey 属性为空字符串返回 null', () => {
      const adapter = createElementPlusRowDragAdapter()
      const row = document.createElement('tr')
      row.setAttribute('data-row-key', '')
      expect(adapter.extractRowKey(row)).toBeNull()
    })

    it('getRowLevel 从 data-level 属性读取数字', () => {
      const adapter = createElementPlusRowDragAdapter()
      const row = document.createElement('tr')
      row.setAttribute('data-level', '2')
      expect(adapter.getRowLevel?.(row)).toBe(2)
    })

    it('getRowLevel 缺失或非数字返回 null', () => {
      const adapter = createElementPlusRowDragAdapter()
      const row = document.createElement('tr')
      expect(adapter.getRowLevel?.(row)).toBeNull()
      row.setAttribute('data-level', '')
      expect(adapter.getRowLevel?.(row)).toBeNull()
    })

    it('满足 RowDragAdapter 接口契约（duck typing 3 方法签名）', () => {
      const a: RowDragAdapter = createElementPlusRowDragAdapter()
      expect(typeof a.getTbody).toBe('function')
      expect(typeof a.extractRowKey).toBe('function')
      // getRowLevel 可选；存在时 typeof 校验
      expect(a.getRowLevel === undefined || typeof a.getRowLevel === 'function').toBe(true)
    })
  })
})

describe('RowDragAdapter (vxeRowDragAdapter)', () => {
  it('VXE_TABLE_TBODY_SELECTOR 与 vxe-table v4 DOM 结构一致', () => {
    expect(VXE_TABLE_TBODY_SELECTOR).toBe('.vxe-table--body-wrapper tbody')
  })

  it('getTbody 在挂载 .vxe-table--body-wrapper tbody 后返回该元素', () => {
    const wrap = document.createElement('div')
    wrap.className = 'vxe-table--body-wrapper'
    const tbody = document.createElement('tbody')
    wrap.appendChild(tbody)
    document.body.appendChild(wrap)

    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => [] })
    expect(adapter.getTbody()).toBe(tbody)

    document.body.removeChild(wrap)
  })

  it('getTbody 在 jsdom 无 vxe-table 时返回 null（安全 noop）', () => {
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => [] })
    expect(adapter.getTbody()).toBeNull()
  })

  it('extractRowKey 按视图索引从 props.rows 反查 rowKey', () => {
    // 模拟 vxe 平铺：DOM tr 顺序与 props.rows 一致
    const tbody = document.createElement('tbody')
    const rows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
    const trs = rows.map(() => {
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      return tr
    })
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => rows })
    // trs[1] → 视图索引 1 → rows[1].id = 'r2'
    expect(adapter.extractRowKey(trs[1])).toBe('r2')
    expect(adapter.extractRowKey(trs[0])).toBe('r1')
    expect(adapter.extractRowKey(trs[2])).toBe('r3')
  })

  it('extractRowKey rowKey 字段可配置（非 id）', () => {
    const tbody = document.createElement('tbody')
    const rows = [{ orderNo: 'A1' }, { orderNo: 'A2' }]
    const trs = rows.map(() => {
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      return tr
    })
    const adapter = createVxeRowDragAdapter({
      getRowsByIndex: () => rows,
      rowKey: 'orderNo',
    })
    expect(adapter.extractRowKey(trs[0])).toBe('A1')
    expect(adapter.extractRowKey(trs[1])).toBe('A2')
  })

  it('extractRowKey 行不在 tbody 中返回 null（vxe 行已销毁或视图错位）', () => {
    // orphan tr 不在 tbody 内，adapter 应走「行无父元素」分支返回 null
    const orphan = document.createElement('tr')
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => [{ id: 1 }] })
    expect(adapter.extractRowKey(orphan)).toBeNull()
  })

  it('extractRowKey 视图索引超出 rows 长度返回 null', () => {
    const tbody = document.createElement('tbody')
    const trs = [1, 2, 3].map(() => {
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      return tr
    })
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => [{ id: 1 }] }) // 只 1 行
    expect(adapter.extractRowKey(trs[2])).toBeNull()
  })

  it('extractRowKey 行 rowKey 字段缺失返回 null', () => {
    const tbody = document.createElement('tbody')
    const rows = [{ name: 'A' }, { name: 'B' }]
    const trs = rows.map(() => {
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      return tr
    })
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => rows })
    expect(adapter.extractRowKey(trs[0])).toBeNull()
  })

  it('getRowLevel 在 tree 模式下按视图索引读 _level 字段', () => {
    const tbody = document.createElement('tbody')
    const rows = [{ _level: 0 }, { _level: 1 }, { _level: 0 }]
    const trs = rows.map(() => {
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      return tr
    })
    const adapter = createVxeRowDragAdapter({
      getRowsByIndex: () => rows,
      getLevelByViewIndex: () => rows.map((r) => r['_level'] as number),
    })
    expect(adapter.getRowLevel?.(trs[0])).toBe(0)
    expect(adapter.getRowLevel?.(trs[1])).toBe(1)
    expect(adapter.getRowLevel?.(trs[2])).toBe(0)
  })

  it('getRowLevel 未提供 getLevelByViewIndex 时返回 null（平铺模式）', () => {
    const tbody = document.createElement('tbody')
    const tr = document.createElement('tr')
    tbody.appendChild(tr)
    const adapter = createVxeRowDragAdapter({ getRowsByIndex: () => [] })
    expect(adapter.getRowLevel?.(tr)).toBeNull()
  })

  it('满足 RowDragAdapter 接口契约（与 el 适配器同 duck typing）', () => {
    const a: RowDragAdapter = createVxeRowDragAdapter({ getRowsByIndex: () => [] })
    expect(typeof a.getTbody).toBe('function')
    expect(typeof a.extractRowKey).toBe('function')
    expect(a.getRowLevel === undefined || typeof a.getRowLevel === 'function').toBe(true)
  })
})
