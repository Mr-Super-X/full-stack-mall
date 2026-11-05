/**
 * useProTableEvents composable 单元测试（v3.5 PR2 新增）
 *
 * 覆盖场景：
 * 1) handleFilterChange 调用 table.setFilter（更新 filterState）
 * 2) handleFilterChange emit('filter-change', newFilters)
 * 3) 多次 handleFilterChange emit 顺序正确
 *
 * 仅覆盖 PR2 新增 API；既有 handleSortChange / handleSelectionChange 等行为由
 * ProTable.integration.spec.ts（端到端 mount 触发）覆盖。
 *
 * @group ProTable composables 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useProTableEvents } from './useProTableEvents'
import type { FilterValuesMap, SortState } from '../types'

describe('useProTableEvents v3.5 PR2', () => {
  const makeDeps = () => {
    // D(#7)：filterState 状态模拟 —— setFilter merge 进状态，getFilterState 返回全表快照
    const filterState: FilterValuesMap = {}
    const setFilter = vi.fn((f: FilterValuesMap) => Object.assign(filterState, f))
    const getFilterState = vi.fn(() => ({ ...filterState }))
    const resetFilter = vi.fn()
    const sortState = ref<SortState | null>(null)
    const onSortChange = vi.fn()
    return {
      table: {
        page: ref(1),
        pageSize: ref(10),
        selectedRows: ref([]),
        sortState,
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        setDensity: vi.fn(),
        onSortChange,
        setSelectedRows: vi.fn(),
        setFilter,
        getFilterState,
        resetFilter,
      } as never,
      columns: {
        sortedColumns: ref([]),
        colSettingVisible: ref(false),
        setVisibleKeys: vi.fn(),
        setColumnOrder: vi.fn(),
      } as never,
      search: { updateParams: vi.fn() } as never,
      treeData: null,
      rowEdit: null,
      engine: {
        effectiveEngine: ref('element-plus' as const),
        proTableVxe: ref(null),
      } as never,
      emit: vi.fn() as never,
      setFilter,
      resetFilter,
    }
  }

  it('handleFilterChange 调用 table.setFilter（更新 filterState 通道）', () => {
    const deps = makeDeps()
    const events = useProTableEvents(deps)
    const newFilters: FilterValuesMap = { status: ['paid'], dept: ['tech'] }
    events.handleFilterChange(newFilters)
    expect(deps.setFilter).toHaveBeenCalledTimes(1)
    expect(deps.setFilter).toHaveBeenCalledWith(newFilters)
  })

  it('handleFilterChange emit filter-change 事件，payload 为全表合并快照（D#7 语义）', () => {
    const deps = makeDeps()
    const events = useProTableEvents(deps)
    events.handleFilterChange({ status: ['paid'] })
    expect(deps.emit).toHaveBeenCalledWith('filter-change', deps.table.getFilterState())
  })

  it('多次 handleFilterChange：setFilter 与 emit 调用次数与顺序一致', () => {
    const deps = makeDeps()
    const events = useProTableEvents(deps)
    const f1: FilterValuesMap = { status: ['paid'] }
    const f2: FilterValuesMap = { dept: ['tech'] }
    events.handleFilterChange(f1)
    events.handleFilterChange(f2)
    expect(deps.setFilter).toHaveBeenNthCalledWith(1, f1)
    expect(deps.setFilter).toHaveBeenNthCalledWith(2, f2)
    // D(#7)：每次 emit 均为当时的全表合并快照（第二次含第一次的列）
    expect(deps.emit).toHaveBeenNthCalledWith(1, 'filter-change', { status: ['paid'] })
    expect(deps.emit).toHaveBeenNthCalledWith(2, 'filter-change', {
      status: ['paid'],
      dept: ['tech'],
    })
  })

  it('handleFilterChange({})：清空筛选（调用方清空列筛选项时）', () => {
    const deps = makeDeps()
    const events = useProTableEvents(deps)
    events.handleFilterChange({})
    expect(deps.setFilter).toHaveBeenCalledWith({})
    expect(deps.emit).toHaveBeenCalledWith('filter-change', {})
  })
})

describe('useProTableEvents D(#7) filter-change 全表快照', () => {
  const makeDeps = () => {
    const setFilter = vi.fn()
    const mergedSnapshot = { status: ['paid'], dept: ['tech'] } // setFilter merge 后的全表状态
    const getFilterState = vi.fn(() => mergedSnapshot)
    return {
      table: {
        page: ref(1),
        pageSize: ref(10),
        selectedRows: ref([]),
        sortState: ref<SortState | null>(null),
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        setDensity: vi.fn(),
        onSortChange: vi.fn(),
        setSelectedRows: vi.fn(),
        setFilter,
        getFilterState,
        resetFilter: vi.fn(),
      } as never,
      columns: { sortedColumns: ref([]), colSettingVisible: ref(false) } as never,
      search: { updateParams: vi.fn() } as never,
      treeData: null,
      rowEdit: null,
      engine: { effectiveEngine: ref('element-plus' as const), proTableVxe: ref(null) } as never,
      emit: vi.fn() as never,
      setFilter,
      getFilterState,
      mergedSnapshot,
    }
  }

  it('handleFilterChange 的 emit payload = getFilterState() 全表合并快照（EP 2.14 增量负载不外泄）', () => {
    const deps = makeDeps()
    const events = useProTableEvents(deps)
    // 模拟 EP 2.14 filter-change 仅携带变化列的增量负载
    events.handleFilterChange({ status: ['paid'] })
    expect(deps.setFilter).toHaveBeenCalledWith({ status: ['paid'] })
    // ★ emit 必须是 merge 后的全表快照（与 getFilterState() 一致），消费方不感知引擎差异
    expect(deps.emit).toHaveBeenCalledWith('filter-change', deps.mergedSnapshot)
    expect(deps.getFilterState).toHaveBeenCalled()
  })
})
