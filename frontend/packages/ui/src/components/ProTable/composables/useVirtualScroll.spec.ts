/**
 * useVirtualScroll 单元测试（v3.0.1 升级：强隔离校验矩阵 + v2 props）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useVirtualScroll } from './useVirtualScroll'
import type { TableEngine } from '../types'

/** ProTableProps 测试夹具 —— cast 到 any 简化类型 */
function makeProps(overrides: Record<string, unknown> = {}): never {
  return {
    columns: [],
    requestApi: () => Promise.resolve({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
    ...overrides,
  } as never
}

describe('useVirtualScroll 基础行为', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('virtualized=true 启用', () => {
    const result = useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(result.enabled.value).toBe(true)
  })

  it('virtualized=false 不启用', () => {
    const result = useVirtualScroll({
      props: makeProps({ virtualized: false }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(result.enabled.value).toBe(false)
  })

  it('element-plus 引擎 tableProps 含 rowHeight + height', () => {
    const result = useVirtualScroll({
      props: makeProps({ virtualized: { rowHeight: 60 } }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(result.tableProps.value).toMatchObject({
      rowHeight: 60,
      height: 500,
    })
  })

  it('使用默认值 rowHeight=48 overscan=10', () => {
    const result = useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(result.config.value).toEqual({})
    expect(result.tableProps.value).toMatchObject({ rowHeight: 48 })
  })
})

describe('v3.0.1 强隔离校验', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('virtualized + enableRowEdit → warn 含 enableRowEdit', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: true,
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableRowEdit'))
  })

  it('virtualized + enableTree → warn 含 enableTree', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true, enableTree: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableTree'))
  })

  it('virtualized + enableSummary → warn 含 enableSummary', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true, enableSummary: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableSummary'))
  })

  it('virtualized + enableCellSpan → warn 含 enableCellSpan', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true, enableCellSpan: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableCellSpan'))
  })

  it('virtualized + enableRowDrag → warn 含 enableRowDrag', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true, enableRowDrag: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableRowDrag'))
  })

  it('virtualized + tableEngine="vxe-table" → engineConflict 标记 + warn（不再 mutate engine.value）', () => {
    const engine = ref<TableEngine>('vxe-table')
    const result = useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine,
      enableRowEdit: false,
    })
    // v3.1.3 review：useVirtualScroll 不再 mutate options.engine.value；
    // 引擎回落由编排层 useEngineFallback.handleEngineFallback 接管
    expect(engine.value).toBe('vxe-table')
    expect(result.engineConflict.value).toBe('vxe-table-incompatible')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('vxe-table'))
  })

  it('virtualized + element-plus 引擎 → engineConflict 为 null', () => {
    const engine = ref<TableEngine>('element-plus')
    const result = useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine,
      enableRowEdit: false,
    })
    expect(result.engineConflict.value).toBeNull()
  })

  it('virtualized 且全部能力关闭 → 无 warn', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: false,
    })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('未启用 virtualized + 任意能力 → 无 warn', () => {
    useVirtualScroll({
      props: makeProps({ virtualized: false, enableTree: true, enableSummary: true }),
      engine: ref<TableEngine>('element-plus'),
      enableRowEdit: true,
    })
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('v3.0.1 v2TableConfig 派生', () => {
  it('v2TableConfig 派生正确（override）', () => {
    const engine = ref<TableEngine>('element-plus')
    const { v2TableConfig } = useVirtualScroll({
      props: makeProps({ virtualized: { rowHeight: 60, height: 800, width: 1200 } }),
      engine,
      enableRowEdit: false,
    })
    expect(v2TableConfig.value).toEqual({
      width: 1200,
      height: 800,
      estimatedRowHeight: 60,
    })
  })

  it('v2TableConfig 缺省值：width=auto height=500 estimatedRowHeight=48', () => {
    const engine = ref<TableEngine>('element-plus')
    const { v2TableConfig } = useVirtualScroll({
      props: makeProps({ virtualized: true }),
      engine,
      enableRowEdit: false,
    })
    expect(v2TableConfig.value).toEqual({
      width: 'auto',
      height: 500,
      estimatedRowHeight: 48,
    })
  })
})
