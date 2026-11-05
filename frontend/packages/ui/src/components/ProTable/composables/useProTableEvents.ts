/**
 * useProTableEvents —— ProTable.vue 编排层事件桥接抽离（v3.1.1 review）。
 *
 * 把 ProTable.vue 中 11 个具名 handler（page / size / density / sort / selection /
 * radio / expand / searchParams / visibleKeys / columnOrder / colSettingVisible）收敛到
 * 一个独立 composable，让 ProTable.vue 模板零内联箭头函数（稳定子组件 prop 引用，
 * 避免子组件 watchEffect 误触发），主体行数从 440 降至 ~320。
 *
 * 设计要点：
 * - 接收编排层 composable 返回值 + emit 函数，输出 11 个具名 handler
 * - 不持有任何 ref / computed / watch，纯函数式桥接
 * - 可独立单测：mock emit 验证调用次数与参数
 *
 * 类型设计：使用「最小接口」（UseProTableEventsTable / UseProTableEventsColumns / 等）
 * 而非 `ReturnType<typeof useTable>` 全量类型 —— 编排层桥接不依赖 useTable 全部字段，
 * 最小化依赖面让单元测试可独立 mock。
 *
 * @see [`../ProTable.vue`](../ProTable.vue) 编排层 —— 唯一调用方
 * @group ProTable composables
 */
import { nextTick, type Ref } from 'vue'
import type {
  FilterValuesMap,
  ProColumn,
  SortChangeEvent,
  SortState,
  TableDensity,
  TableEngine,
} from '../types'
import type { useTreeData } from './useTreeData'

/**
 * 编排层桥接所需 useTable 最小接口 —— 显式声明依赖面而非直接 import ReturnType<typeof useTable>
 */
export interface UseProTableEventsTable<T extends object = Record<string, unknown>> {
  page: Ref<number>
  pageSize: Ref<number>
  selectedRows: Ref<unknown[]>
  sortState: Ref<SortState<T> | null>
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  setDensity: (d: TableDensity) => void
  onSortChange: (evt: SortChangeEvent) => void
  setSelectedRows: (rows: T[]) => void
  /** v3.5 PR2：el-table filter-change 事件入口 —— 更新筛选状态 + 触发请求 */
  setFilter: (newFilters: FilterValuesMap) => void
  /** D(#7)：filter-change 事件 payload 来源 —— merge 后全表筛选快照（与 emit 同形态） */
  getFilterState: () => FilterValuesMap
  /** v3.5 PR2：清空筛选状态 —— 编排层 search.reset 路径同步调用 */
  resetFilter: () => void
}

/**
 * 编排层桥接所需 useColumns 最小接口
 */
export interface UseProTableEventsColumns<T extends object = Record<string, unknown>> {
  sortedColumns: Ref<ProColumn<T>[]>
  colSettingVisible: Ref<boolean>
  setVisibleKeys: (keys: string[]) => void
  setColumnOrder: (order: string[]) => void
}

/** useSearch 桥接所需接口 */
export interface UseProTableEventsSearch {
  updateParams: (params: Record<string, unknown>) => void
}

/**
 * 行编辑桥接所需最小接口 —— 仅依赖 _start（双击启动 + 行数据回填 drafts），
 * 与 UseProTableEventsTable 同一「最小接口」设计，不 import useRowEdit 全量类型
 */
export interface UseProTableEventsRowEdit {
  _start: (rowKey: string | number, rowData?: Record<string, unknown>) => void
}

/**
 * vxe 引擎行高重算上下文 —— ProTable.vue 持有 proTableVxe ref，
 * 本 composable 不感知 VxeTableBody 内部结构，仅通过 recalculate 方法触发行高重算
 */
export interface UseProTableEventsEngineContext {
  /** vxe 引擎分支当前生效标志（effectiveEngine） */
  effectiveEngine: Ref<TableEngine>
  /** vxe-table 实例 ref —— recalculate 方法由 VxeTableBody 通过 defineExpose 暴露 */
  proTableVxe: Ref<{ recalculate?: () => void } | null>
}

/**
 * emit 函数接口（只声明本 composable 实际 emit 的事件）——
 * 对齐 ProTable.vue defineEmits 的 sort-change + filter-change 签名。
 */
export type UseProTableEventsEmit<T extends object = Record<string, unknown>> = {
  (event: 'sort-change', payload: SortState<T> | null): void
  (event: 'filter-change', payload: FilterValuesMap): void
}

export interface UseProTableEventsOptions<T extends object = Record<string, unknown>> {
  table: UseProTableEventsTable<T>
  columns: UseProTableEventsColumns<T>
  search: UseProTableEventsSearch
  treeData: ReturnType<typeof useTreeData> | null
  /** 行编辑能力（未启用 enableRowEdit 时为 null）—— 双击编辑启动通道 */
  rowEdit: UseProTableEventsRowEdit | null
  engine: UseProTableEventsEngineContext
  emit: UseProTableEventsEmit<T>
}

export interface UseProTableEventsReturn {
  /** 分页当前页变化 —— ElPagination @current-change */
  handlePageChange: (p: number) => void
  /** 分页 size 变化 —— ElPagination @size-change */
  handleSizeChange: (s: number) => void
  /** 表格密度切换 —— TableHeader @update:density；vxe 引擎需 nextTick recalculate */
  handleDensityChange: (d: TableDensity) => void
  /** 服务端排序桥接 —— 仅 sortable='custom' 列生效，向外 emit sort-change */
  handleSortChange: (evt: SortChangeEvent) => void
  /**
   * v3.5 PR2：服务端筛选桥接 —— 经 useTable.setFilter 更新状态 + 触发请求（adapter 存在时），
   * 随后 emit 当前全表筛选快照供父级消费（URL 同步 / 埋点 / 上报）。
   * 无 adapter 时 setFilter 仅 UI 记忆；emit 仍触发（业务方可监听做 UI 联动）。
   */
  handleFilterChange: (newFilters: FilterValuesMap) => void
  /** 多选变化 —— el-table @selection-change */
  handleSelectionChange: (rows: Record<string, unknown>[]) => void
  /** 单选列选中 —— 复用 useTable 统一选中区（selectedRows 单元素） */
  handleRadioSelect: (row: Record<string, unknown>) => void
  /** 树形展开/折叠 —— 转发给 useTreeData.toggle */
  handleExpandToggle: (rowKey: string | number) => void
  /**
   * 双击单元格启动行编辑 —— 两引擎 body 组件统一只转发 cell-dblclick 事件到此，
   * 由桥接层调 rowEdit._start（带回填行数据初始化 drafts）。
   * 2026-09-18 review 收编理由：原 el 分支在展示组件内直调 _start（越权 + 与文件头
   * 「仅事件转发」声明矛盾），vxe 分支只 emit 无人消费导致双击编辑静默失效
   */
  handleCellDblclick: (rowKey: string | number, rowData: Record<string, unknown>) => void
  /** 搜索参数纯写 —— SearchForm @update:search-params */
  updateSearchParams: (v: Record<string, unknown>) => void
  /** 列设置抽屉：可见性切换 */
  handleColSettingUpdate: (visible: boolean) => void
  /** 列设置抽屉：可见列 keys 更新 */
  updateVisibleKeys: (keys: string[]) => void
  /** 列设置抽屉：列顺序更新 */
  updateColumnOrder: (order: string[]) => void
}

export function useProTableEvents<T extends object = Record<string, unknown>>(
  options: UseProTableEventsOptions<T>
): UseProTableEventsReturn {
  const { table, columns, search, treeData, rowEdit, engine, emit } = options

  function handlePageChange(p: number): void {
    table.setPage(p)
  }

  function handleSizeChange(s: number): void {
    table.setPageSize(s)
  }

  function handleDensityChange(d: TableDensity): void {
    table.setDensity(d)
    // vxe 引擎需额外触发行高重算：vxe 行高变量测量结果有缓存，data-density 变更不自动重测
    if (engine.effectiveEngine.value === 'vxe-table') {
      void nextTick(() => engine.proTableVxe.value?.recalculate?.())
    }
  }

  /**
   * 服务端排序桥接 —— 仅 sortable='custom' 列生效。
   * 经 useTable.onSortChange 更新状态 + 回第 1 页 + 触发请求，随后 emit 当前排序状态。
   */
  function handleSortChange(evt: SortChangeEvent): void {
    const col = columns.sortedColumns.value.find((c) => c.prop === evt.prop)
    if (!col || col.sortable !== 'custom') return
    table.onSortChange(evt)
    emit('sort-change', table.sortState.value)
  }

  /**
   * v3.5 PR2：服务端筛选桥接 —— 与 handleSortChange 对称（不同点：filter-change
   * 没有 sortable==='custom' 的列级开关；列头筛选 UI 由 element-plus column.filters
   * 配置声明，业务方启用筛选即视为走服务端协议）。无 adapter 时仅 UI 记忆。
   *
   * D（docs/audit/2026-10-15 protable#7）：emit payload 统一为 `getFilterState()` 全表合并快照 ——
   * EP 2.14 的 filter-change 可能仅携带变化列（增量），vxe 翻译层则已是全表快照；
   * 统一经 getFilterState 发出，消费方拿到的恒为 merge 后全表状态，不感知引擎差异
   */
  function handleFilterChange(newFilters: FilterValuesMap): void {
    table.setFilter(newFilters)
    emit('filter-change', table.getFilterState())
  }

  /** 多选变化桥接 —— el-table 事件行为 Record 视角（cast 收口到 selectedRows） */
  function handleSelectionChange(rows: Record<string, unknown>[]): void {
    table.setSelectedRows(rows as T[])
  }

  /** 单选列选中桥接 —— 复用 useTable 统一选中区（selectedRows 单元素） */
  function handleRadioSelect(row: Record<string, unknown>): void {
    table.setSelectedRows([row as T])
  }

  /** 树形展开/折叠桥接 —— 转发给 useTreeData.toggle */
  function handleExpandToggle(rowKey: string | number): void {
    if (treeData) void treeData.toggle(rowKey)
  }

  /** 双击启动行编辑桥接 —— rowData 回填 drafts（v3.0 修复语义保留） */
  function handleCellDblclick(rowKey: string | number, rowData: Record<string, unknown>): void {
    rowEdit?._start(rowKey, rowData)
  }

  /** 搜索参数更新桥接 —— SearchForm @update:search-params */
  function updateSearchParams(v: Record<string, unknown>): void {
    search.updateParams(v)
  }

  /** 列设置抽屉：可见性切换（来自 TableHeader @update:col-setting-visible） */
  function handleColSettingUpdate(visible: boolean): void {
    columns.colSettingVisible.value = visible
  }

  /** 列设置抽屉：可见列 keys 更新（ColSetting @update:visible-keys） */
  function updateVisibleKeys(keys: string[]): void {
    columns.setVisibleKeys(keys)
  }

  /** 列设置抽屉：列顺序更新（ColSetting @reorder） */
  function updateColumnOrder(order: string[]): void {
    columns.setColumnOrder(order)
  }

  return {
    handlePageChange,
    handleSizeChange,
    handleDensityChange,
    handleSortChange,
    handleFilterChange,
    handleSelectionChange,
    handleRadioSelect,
    handleExpandToggle,
    handleCellDblclick,
    updateSearchParams,
    updateVisibleKeys,
    updateColumnOrder,
    handleColSettingUpdate,
  }
}
