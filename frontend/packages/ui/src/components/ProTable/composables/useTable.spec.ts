/**
 * useTable composable 单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) refresh() 主动触发 requestApi
 * 2) refresh() 后 loading 关闭
 * 3) setPage 触发 watch → refresh
 * 4) 快速连续 refresh 取消上一次请求（AbortController，spec §九 #5）
 * 5) getSelectedRows 返回按 row-key 去重的选中
 * 6) clearSelection 清空 selectedRows
 *
 * 注：useTable 内部用 onMounted + watch 触发 refresh。composable 单测环境无 component context，
 * 所以测试主动调用 refresh() 验证行为。
 *
 * @group ProTable composables 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useTable } from './useTable'
import type { SortState } from '../types'

describe('useTable', () => {
  const makeDeps = () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1, name: 'a' }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    return {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi,
        pageSize: 10,
        rowKey: 'id',
      } as never,
      columns: {} as never,
      getSearchParams: () => ({ name: '' }),
    }
  }

  it('refresh() 调用 requestApi 并填充 data / total', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    expect(deps.props.requestApi).toHaveBeenCalledTimes(1)
    expect(table.data.value).toEqual([{ id: 1, name: 'a' }])
    expect(table.total.value).toBe(1)
  })

  it('refresh() 后 loading 关闭', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    expect(table.loading.value).toBe(false)
  })

  it('setPage 触发 watch → refresh + 更新 page', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    expect(deps.props.requestApi).toHaveBeenCalledTimes(1)
    table.setPage(2)
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(table.page.value).toBe(2)
  })

  it('review R5：waitForRefresh 可等待 page watcher 触发的刷新完成（reset 路径）', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    expect(deps.props.requestApi).toHaveBeenCalledTimes(1)
    // 模拟编排层 reset 路径：setPage 后 watcher 异步发起刷新，waitForRefresh 须等其完成
    table.setPage(3)
    await nextTick() // watcher（默认 flush）已执行，其间 void refresh() 登记 pendingRefresh
    await table.waitForRefresh()
    expect(deps.props.requestApi).toHaveBeenCalledTimes(2)
    expect(table.page.value).toBe(3)
  })

  it('快速连续 refresh：第二次覆盖第一次结果（useRequest AbortController）', async () => {
    const deps = makeDeps()
    deps.props.requestApi = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], total: 1, pageNum: 1, pageSize: 10 })
      .mockResolvedValueOnce({ data: [{ id: 99 }], total: 99, pageNum: 1, pageSize: 10 })
    const table = useTable(deps)
    const p1 = table.refresh()
    const p2 = table.refresh()
    await Promise.all([p1, p2])
    // 第二次请求的 data 应该覆盖
    expect(table.data.value).toEqual([{ id: 99 }])
    expect(table.total.value).toBe(99)
  })

  it('refresh() 使用 getSearchParams 返回值组装请求参数（含分页 + 序列化）', async () => {
    const deps = makeDeps()
    deps.getSearchParams = () => ({ name: '张三', empty: '', nil: null })
    const table = useTable(deps)
    await table.refresh()
    expect(deps.props.requestApi).toHaveBeenCalledWith({
      name: '张三',
      pageNum: 1,
      pageSize: 10,
    })
  })

  it('getSelectedRows 返回按 row-key 去重的选中', () => {
    const table = useTable(makeDeps())
    table.setSelectedRows([{ id: 1 }, { id: 2 }, { id: 1 }])
    expect(table.getSelectedRows()).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('clearSelection 清空 selectedRows', () => {
    const table = useTable(makeDeps())
    table.setSelectedRows([{ id: 1 }])
    table.clearSelection()
    expect(table.getSelectedRows()).toEqual([])
  })

  it('v2.2-M1：clearSelection 同步调用 el-table 实例的 clearSelection（清 UI 勾选态）', () => {
    const table = useTable(makeDeps())
    const elClearSelection = vi.fn()
    table.tableRef.value = { clearSelection: elClearSelection } as never
    table.setSelectedRows([{ id: 1 }])
    table.clearSelection()
    expect(elClearSelection).toHaveBeenCalledTimes(1)
    expect(table.getSelectedRows()).toEqual([])
  })

  it('M2：onSortChange 更新 sortState 并把排序参数并入请求（默认序列化）', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    // 注：getSearchParams 返回的 name:'' 被 serializeParams 剔除（附录 A #10），故不在期望内
    expect(deps.props.requestApi).toHaveBeenLastCalledWith({
      orderByColumn: 'name',
      isAsc: 'asc',
      pageNum: 1,
      pageSize: 10,
    })
    expect(table.getSortState()).toEqual({ prop: 'name', order: 'ascending' })
  })

  it('M2：第三击（order=null）清除排序状态且请求不带排序参数', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    table.onSortChange({ prop: 'name', order: null })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(3))
    expect(table.getSortState()).toBeNull()
    const last = deps.props.requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(last).not.toHaveProperty('orderByColumn')
    expect(last).not.toHaveProperty('isAsc')
  })

  it('M2：自定义 sortParamsAdapter 覆盖默认序列化', async () => {
    const deps = makeDeps()
    deps.props.sortParamsAdapter = (state: SortState) => ({
      sortBy: state.prop,
      sortOrder: state.order,
    })
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'descending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(deps.props.requestApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'descending' })
    )
  })

  it('M2：排序变化回第 1 页（page>1 时只触发一次新请求）', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.setPage(3)
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(table.page.value).toBe(3)
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(table.page.value).toBe(1))
    const last = deps.props.requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(last).toMatchObject({ pageNum: 1, orderByColumn: 'name' })
    // page watch 已触发刷新：确认没有二次重复请求
    await new Promise((r) => setTimeout(r, 20))
    expect(deps.props.requestApi).toHaveBeenCalledTimes(3)
  })

  it('M3：responseAdapter 映射自定义结构（records/totalCount → data/total）', async () => {
    const deps = makeDeps()
    deps.props.requestApi = vi
      .fn()
      .mockResolvedValue({ records: [{ id: 7, name: 'x' }], totalCount: 1 })
    deps.props.responseAdapter = (raw: unknown) => {
      const r = raw as { records: unknown[]; totalCount: number }
      return { data: r.records, total: r.totalCount, pageNum: 1, pageSize: 10 }
    }
    const table = useTable(deps)
    await table.refresh()
    expect(table.data.value).toEqual([{ id: 7, name: 'x' }])
    expect(table.total.value).toBe(1)
  })

  it('M3：responseAdapter 返回非法结构 → 错误态 + requestError 回调（fail-fast）', async () => {
    const deps = makeDeps()
    const onRequestError = vi.fn()
    deps.props.requestApi = vi.fn().mockResolvedValue({ wrong: true })
    deps.props.responseAdapter = () => ({ bad: 1 }) as never
    deps.props.requestError = onRequestError
    const table = useTable(deps)
    await table.refresh()
    expect(table.error.value).toBeTruthy()
    expect(String(table.error.value?.message)).toContain('结构非法')
    expect(onRequestError).toHaveBeenCalled()
  })

  // v3.1.4 review 新增：rows computed（data 的 Record 视角投影）
  it('v3.1.4：rows 是 data 的 Record 视角投影，data=null 时返回空数组', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    // 初始 data === null
    expect(table.data.value).toBeNull()
    expect(table.rows.value).toEqual([])
    // refresh 后 data 填充，rows 同步
    await table.refresh()
    expect(table.rows.value).toEqual([{ id: 1, name: 'a' }])
  })

  // v3.1.4 review 新增：rowKey 缺失时 WeakSet 引用去重
  it('v3.1.4：rowKey 缺失时 setSelectedRows 按对象引用去重（WeakSet 兜底）+ warn', () => {
    const deps = makeDeps()
    delete (deps.props as { rowKey?: string }).rowKey // 显式删除 rowKey
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = useTable(deps)
    const row1 = { id: 1, name: 'a' }
    const row2 = { id: 2, name: 'b' }
    // 同一对象引用重复传入：去重保留 1 个
    table.setSelectedRows([row1, row1, row2, row2])
    expect(table.getSelectedRows()).toEqual([row1, row2])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rowKey 缺失'))
    warnSpy.mockRestore()
  })

  // v3.5 PR2：服务端筛选 filterParamsAdapter
  describe('v3.5 PR2 服务端筛选', () => {
    it('setFilter 更新 filterState，filterParamsAdapter 存在时回第 1 页 + 触发请求', async () => {
      const deps = makeDeps()
      const adapter = vi.fn((filters: Record<string, (string | number | boolean)[]>) => ({
        statusList: filters.status,
      }))
      deps.props.filterParamsAdapter = adapter
      const table = useTable(deps)
      await table.refresh()
      // 翻到第 2 页验证回第 1 页逻辑
      table.setPage(2)
      await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))

      table.setFilter({ status: ['paid'] })
      await vi.waitFor(() => expect(table.page.value).toBe(1))
      // adapter 被调用 1 次，参数是 setFilter 入参
      expect(adapter).toHaveBeenCalledWith({ status: ['paid'] })
      // 请求带了 adapter 序列化结果
      expect(deps.props.requestApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusList: ['paid'] })
      )
      // filterState 快照
      expect(table.getFilterState()).toEqual({ status: ['paid'] })
    })

    it('无 filterParamsAdapter 时 setFilter 仅 UI 记忆，不触发额外请求', async () => {
      const deps = makeDeps()
      const table = useTable(deps)
      await table.refresh()
      const callsBefore = deps.props.requestApi.mock.calls.length
      table.setFilter({ status: ['paid'] })
      await new Promise((r) => setTimeout(r, 10))
      // 无 adapter → 无新请求
      expect(deps.props.requestApi.mock.calls.length).toBe(callsBefore)
      // filterState 仍被记录（UI 记忆 + expose）
      expect(table.getFilterState()).toEqual({ status: ['paid'] })
    })

    it('resetFilter 仅清空 filterState（不触发请求；编排层 reset 路径统一切页+刷新）', async () => {
      const deps = makeDeps()
      const adapter = vi.fn((filters: Record<string, (string | number | boolean)[]>) => ({
        statusList: filters.status,
      }))
      deps.props.filterParamsAdapter = adapter
      const table = useTable(deps)
      await table.refresh()
      table.setFilter({ status: ['paid'] })
      await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))

      const callsBefore = deps.props.requestApi.mock.calls.length
      table.resetFilter()
      // resetFilter 仅清空 state，不触发新请求（编排层 reset 流程 setPage+refresh 已含一次）
      await new Promise((r) => setTimeout(r, 10))
      expect(deps.props.requestApi.mock.calls.length).toBe(callsBefore)
      // filterState 已清空
      expect(table.getFilterState()).toEqual({})
    })

    it('A3：resetFilter 同步调 el-table clearFilter() 清列头筛选 UI（防旧条件残留复活）', async () => {
      const deps = makeDeps()
      const table = useTable(deps)
      await table.refresh()
      const clearFilter = vi.fn()
      table.tableRef.value = { clearFilter } as never
      table.setFilter({ status: ['paid'] })

      table.resetFilter()
      // 列头筛选 UI（el-table 内部非受控状态）必须经官方 clearFilter 清除，
      // 否则 reset 后旧条件残留在列头，下次筛选操作静默回参
      expect(clearFilter).toHaveBeenCalledTimes(1)
      expect(table.getFilterState()).toEqual({})
    })

    it('A3：tableRef 为 null（vxe 引擎 / 未挂载）时 resetFilter 不抛错、仍清空 state', async () => {
      const deps = makeDeps()
      const table = useTable(deps)
      await table.refresh()
      table.setFilter({ status: ['paid'] })
      // tableRef 初始为 null（makeDeps 未同步 el 实例）——结构化可选调用须自然短路
      expect(() => table.resetFilter()).not.toThrow()
      expect(table.getFilterState()).toEqual({})
    })

    it('filterState 全空时 serializeFilters 返回空对象（不污染请求 params）', async () => {
      const deps = makeDeps()
      const adapter = vi.fn((filters: Record<string, (string | number | boolean)[]>) => ({
        statusList: filters.status,
      }))
      deps.props.filterParamsAdapter = adapter
      const table = useTable(deps)
      await table.refresh()
      // adapter 未被 setFilter 调用前未生效；空 filterState 时请求不带筛选字段
      expect(deps.props.requestApi).toHaveBeenLastCalledWith({
        pageNum: 1,
        pageSize: 10,
      })
    })

    it('setFilter merge 语义（hotfix-2）：element-plus 2.14.x filter-change 可能仅携带变化列，merge 兜底保留未变化列', async () => {
      const deps = makeDeps()
      deps.props.filterParamsAdapter = () => ({})
      const table = useTable(deps)
      await table.refresh()
      table.setFilter({ status: ['paid'], dept: ['tech'] })
      // 模拟 el-table 第二列变化时仅携带变化列（status 未出现在 newFilters 中）：
      // 旧覆盖式实现会丢失 status 列值；merge 语义下保留。
      table.setFilter({ dept: ['tech'] })
      expect(table.getFilterState()).toEqual({ status: ['paid'], dept: ['tech'] })
    })

    it('setFilter 空数组 = 显式清空该列（区分「该列未变」与「该列清空」）', async () => {
      const deps = makeDeps()
      deps.props.filterParamsAdapter = () => ({})
      const table = useTable(deps)
      await table.refresh()
      table.setFilter({ status: ['paid'], dept: ['tech'] })
      // 用户在 UI 上清掉 status 列筛选，el-table 发 { status: [], dept: ['tech'] }：
      // 空数组走 delete 路径，status 列从 filterState 移除。
      table.setFilter({ status: [], dept: ['tech'] })
      expect(table.getFilterState()).toEqual({ dept: ['tech'] })
    })
  })
})

describe('useTable / B4 props.pageSize 运行时跟随（density 同款 watch，docs/audit/2026-10-15）', () => {
  function makeReactiveDeps(pageSize = 10) {
    const requestApi = vi.fn().mockResolvedValue({ data: [], total: 0, pageNum: 1, pageSize })
    // 生产环境 props 是响应式对象 —— 模拟父级 v-model:page-size / 动态调整的运行时变更
    const props = reactive({
      columns: [{ prop: 'name', label: '名称' }],
      requestApi,
      pageSize,
      rowKey: 'id',
    }) as never
    return { props, requestApi, columns: {} as never, getSearchParams: () => ({}) }
  }

  it('props.pageSize 运行时变化 → pageSize 跟随（此前只读初始化，e923cb8 density 改造的同类漏网）', async () => {
    const deps = makeReactiveDeps(10)
    const table = useTable(deps)
    expect(table.pageSize.value).toBe(10)
    ;(deps.props as unknown as { pageSize: number }).pageSize = 20
    await nextTick()
    expect(table.pageSize.value).toBe(20)
  })

  it('pageSize 运行时变化触发自动刷新（既有 [page, pageSize] watcher 联动）', async () => {
    const deps = makeReactiveDeps(10)
    const table = useTable(deps)
    await table.refresh()
    expect(deps.requestApi).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize: 10 }))
    ;(deps.props as unknown as { pageSize: number }).pageSize = 20
    await nextTick()
    await vi.waitFor(() =>
      expect(deps.requestApi).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize: 20 }))
    )
  })
})

describe('useTable / D(#9) 持久化快照恢复筛选', () => {
  // 本 describe 为顶层独立块 —— 自定义最小 makeDeps（与主 describe 同语义）
  function makeDeps() {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1, name: 'a' }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    return {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi,
        pageSize: 10,
        rowKey: 'id',
      } as never,
      columns: {} as never,
      getSearchParams: () => ({ name: '' }),
    }
  }

  it('initialState.filterState → filterState 初值（路由返回场景恢复列头筛选）', () => {
    const deps = makeDeps()
    const table = useTable({
      ...deps,
      initialState: { filterState: { status: ['paid'] } } as never,
    })
    expect(table.getFilterState()).toEqual({ status: ['paid'] })
  })

  it('initialState 无 filterState → 缺省空筛选（向后兼容 v1 快照）', () => {
    const deps = makeDeps()
    const table = useTable({ ...deps, initialState: { page: 2 } as never })
    expect(table.getFilterState()).toEqual({})
    expect(table.page.value).toBe(2)
  })
})
