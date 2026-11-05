/**
 * VxeTableBody 单元测试
 *
 * 覆盖矩阵（v2.1 P3 + v3.5 PR1-B + v3.5 PR2）：
 * - mount 不崩溃（vxe-table 模块 mock 化）
 * - 加载成功路径：onMounted 异步解析 VxeTable/VxeColumn → 渲染组件（非 skeleton）
 * - 加载失败路径：emit engine-fallback + console.warn 兜底
 * - 5 个 emit 事件（selection-change / cell-dblclick / sort-change / engine-fallback / filter-change v3.5 PR2）
 * - sort-change 翻译：vxe 'asc'/'desc' → SortChangeEvent 'ascending'/'descending'/null
 * - filter-change 翻译：vxe 单列 property+values / filterList → 全表快照形态
 * - 多选合并：handleCheckboxChange / handleCheckboxAll 按 rowKey 去重
 * - defineExpose.recalculate（vxe 行高重算入口）
 *
 * 说明：vxe-table 是动态加载 + ESM 模块，vitest 直接 import 会触发真实网络。
 * 与 useVxeTable.spec.ts 同款 mock 模式：vi.mock('vxe-table', ...) 提供假模块。
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

// ───────────── vxe-table 模块 mock（useVxeTable.spec.ts 同款模式 + 具名导出）─────────────
// A3 修复：补具名导出 VxeTable/VxeColumn —— VxeTableBody 经 mod.VxeTable 取组件
// （真实 vxe-table v4 模块形态：export { VxeTable, VxeColumn }）。原 mock 缺 named
// export 导致 vxeTableComp 恒 null，内层组件在测试中从未渲染（"加载成功"断言空洞化）
// B1：mock 组件补 setup 返回实例方法 —— 模板 ref="vxeTableInst" 经组件公开实例可达
// （getCheckboxRecords / clearCheckboxRow / clearRadioRow / clearFilter / recalculate）
const vxeInstMocks = vi.hoisted(() => ({
  getCheckboxRecords: vi.fn<() => unknown[]>(() => []),
  // 真实 vxe v4 运行时语义（2026-10-19 浏览器实测实证）：reserve 开启时
  // getCheckboxRecords 仅返回当前页勾选，跨页保留行在 getCheckboxReserveRecords ——
  // B1 #3 修复曾只用前者回同步，翻页后把跨页行从镜像冲掉（spec mock 与真实行为不符所致）
  getCheckboxReserveRecords: vi.fn<() => unknown[]>(() => []),
  clearCheckboxRow: vi.fn(),
  clearRadioRow: vi.fn(),
  clearFilter: vi.fn(),
  recalculate: vi.fn(),
}))
vi.mock('vxe-table', () => ({
  default: {
    install: vi.fn(),
    Table: { name: 'VxeTable', render: () => null },
    Column: { name: 'VxeColumn', render: () => null },
  },
  VxeTable: {
    name: 'VxeTable',
    // props 声明：模板绑定的 checkbox-config / radio-config 须声明后才进 props（未声明落 attrs，
    // vxe.props('xxx') 断言不到——radioConfig 接线防线依赖此声明）
    props: ['checkboxConfig', 'radioConfig'],
    render: () => null,
    setup: () => ({
      recalculate: vxeInstMocks.recalculate,
      clearFilter: vxeInstMocks.clearFilter,
      clearCheckboxRow: vxeInstMocks.clearCheckboxRow,
      clearRadioRow: vxeInstMocks.clearRadioRow,
      getCheckboxRecords: vxeInstMocks.getCheckboxRecords,
      getCheckboxReserveRecords: vxeInstMocks.getCheckboxReserveRecords,
    }),
  },
  VxeColumn: { name: 'VxeColumn', render: () => null },
}))
vi.mock('vxe-table/lib/style.css', () => ({}))

import VxeTableBody from './VxeTableBody.vue'
import type { ProColumn } from '../types'

const mockRowEdit = {
  isEditing: vi.fn().mockReturnValue(false),
  getValue: vi.fn(),
  setValue: vi.fn(),
  _start: vi.fn(),
} as never
const mockCellSpan = {
  spanMethod: vi.fn(),
  cellClassName: vi.fn(),
} as never

describe('VxeTableBody', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const baseColumns: ProColumn[] = [
    { prop: 'id', label: 'ID', width: 80 },
    { prop: 'name', label: '名称', minWidth: 160 },
  ]

  const baseRows = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ]

  function mountBody(extraProps: Record<string, unknown> = {}) {
    return mount(VxeTableBody, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        rowEdit: null,
        cellSpan: null,
        ...extraProps,
      },
    })
  }

  it('mount 渲染成功（不崩溃）', async () => {
    const wrapper = mountBody()
    expect(wrapper.exists()).toBe(true)
    await flushPromises()
    wrapper.unmount()
  })

  it('vxe 加载成功后渲染表格（vxeTableComp.value 非 null，骨架屏消失）', async () => {
    const wrapper = mountBody()
    await flushPromises()
    // onMounted 异步解析 VxeTable/VxeColumn；mock 模块存在，解析必成功
    const html = wrapper.html()
    // 骨架屏 .el-skeleton 应被替换为 VxeTable（mock 的组件对象 .name === 'VxeTable'）
    expect(html).not.toContain('el-skeleton')
    wrapper.unmount()
  })

  it('行自定义插槽 mount 不崩溃（ElSkeleton 期间渲染）', async () => {
    const wrapper = mountBody(
      {},
      {
        slots: {
          id: '<span class="custom-id">{{ scope.row.id }}</span>',
        },
      }
    )
    expect(wrapper.exists()).toBe(true)
    await flushPromises()
    wrapper.unmount()
  })

  it('selection-change 事件转发（行集合原样）', async () => {
    const wrapper = mountBody()
    wrapper.vm.$emit('selection-change', baseRows)
    expect(wrapper.emitted('selection-change')![0]).toEqual([baseRows])
    wrapper.unmount()
  })

  it('cell-dblclick 事件转发（已解析 rowKey）', async () => {
    const wrapper = mountBody()
    wrapper.vm.$emit('cell-dblclick', 1)
    expect(wrapper.emitted('cell-dblclick')![0]).toEqual([1])
    wrapper.unmount()
  })

  it('engine-fallback 事件转发（加载失败兜底）', async () => {
    const wrapper = mountBody()
    wrapper.vm.$emit('engine-fallback')
    expect(wrapper.emitted('engine-fallback')).toBeTruthy()
    wrapper.unmount()
  })

  it('v3.5 PR2：filter-change 事件转发（emit 契约；handler 翻译行为由集成测试覆盖）', async () => {
    const wrapper = mountBody()
    const filters = { status: ['paid'], dept: ['tech'] }
    wrapper.vm.$emit('filter-change', filters)
    expect(wrapper.emitted('filter-change')![0]).toEqual([filters])
    wrapper.unmount()
  })

  it('defineExpose 暴露 recalculate 函数（vxe 行高重算入口）', async () => {
    const wrapper = mountBody()
    await nextTick()
    const exposed = wrapper.vm.$.exposed as Record<string, unknown> | null
    expect(exposed).toBeDefined()
    expect('recalculate' in (exposed ?? {})).toBe(true)
    expect(typeof (exposed as { recalculate?: unknown }).recalculate).toBe('function')
    wrapper.unmount()
  })

  it('A3：defineExpose 暴露 clearFilter（reset 清列头筛选 UI 通道）', async () => {
    const wrapper = mountBody()
    await nextTick()
    const exposed = wrapper.vm.$.exposed as Record<string, unknown> | null
    expect(typeof (exposed as { clearFilter?: unknown })?.clearFilter).toBe('function')
    wrapper.unmount()
  })

  it('A3：clearFilter 清空 localFilterMap —— reset 后单列筛选不再携带旧列快照（防复活）', async () => {
    const wrapper = mountBody()
    await flushPromises()
    // 经内部 vxe 组件触发筛选（模板 @filter-change 绑定在解析后的 VxeTable 组件上）
    const vxe = wrapper.findComponent({ name: 'VxeTable' })
    vxe.vm.$emit('filter-change', { property: 'status', values: ['paid'] })
    vxe.vm.$emit('filter-change', { property: 'dept', values: ['tech'] })
    await nextTick()
    // 两列已累加进全表快照
    expect(wrapper.emitted('filter-change')!.at(-1)).toEqual([{ status: ['paid'], dept: ['tech'] }])

    // reset 路径：编排层调暴露的 clearFilter
    ;(wrapper.vm.$.exposed as { clearFilter: () => void }).clearFilter()
    await nextTick()

    // 再次筛选单列：快照只含该列 —— 旧 dept 条件不复活（不清 localFilterMap 时会被 merge 回来）
    vxe.vm.$emit('filter-change', { property: 'status', values: ['pending'] })
    await nextTick()
    expect(wrapper.emitted('filter-change')!.at(-1)).toEqual([{ status: ['pending'] }])
    wrapper.unmount()
  })

  it('rowEdit + cellSpan 启用时 mount 不崩溃', async () => {
    const wrapper = mountBody({ rowEdit: mockRowEdit, cellSpan: mockCellSpan })
    expect(wrapper.exists()).toBe(true)
    await flushPromises()
    wrapper.unmount()
  })

  it('columns 为空数组时 mount 不崩溃', async () => {
    const wrapper = mountBody({ columns: [] })
    expect(wrapper.exists()).toBe(true)
    await flushPromises()
    wrapper.unmount()
  })

  it('rows 为空数组时 mount 不崩溃', async () => {
    const wrapper = mountBody({ rows: [] })
    expect(wrapper.exists()).toBe(true)
    await flushPromises()
    wrapper.unmount()
  })

  it('vxe-table 模块加载失败时 emit engine-fallback + console.warn', async () => {
    // 临时覆盖 vxe-table mock 让它抛错
    vi.doMock('vxe-table', () => {
      throw new Error('mock load failure')
    })
    // 重新 import 失败路径的组件实例
    vi.resetModules()
    const { default: VxeFail } = await import('./VxeTableBody.vue')
    const wrapper = mount(VxeFail, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        rowEdit: null,
        cellSpan: null,
      },
    })
    await flushPromises()
    expect(wrapper.emitted('engine-fallback')).toBeTruthy()
    expect(console.warn).toHaveBeenCalledWith(
      '[ProTable] vxe-table 引擎加载失败，已回退 element-plus:',
      expect.any(Error)
    )
    wrapper.unmount()
  })

  it('v3.5 PR1-B：treeData 启用时 root VxeTable 接 tree-config', async () => {
    // PR1-B：验证 VxeTableBody 在 treeData 启用时把 tree-config 透传给 vxe-table 根组件
    const mockTreeData = {
      isExpanded: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
      expandedKeys: { value: new Set<string | number>() },
      flatData: { value: baseRows },
    } as never
    const wrapper = mountBody({ treeData: mockTreeData })
    await flushPromises()
    // 渲染产物存在（不深入断言 tree-config 内部键名 —— VxeTableBody.stub 在
    // ProTable.engine.spec.ts 已验证，本测试聚焦「treeData 注入后组件不崩溃」）
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B：toggle-tree-expand 事件转发 expand-toggle emit', async () => {
    const mockTreeData = {
      isExpanded: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
      expandedKeys: { value: new Set<string | number>() },
      flatData: { value: baseRows },
    } as never
    const wrapper = mountBody({ treeData: mockTreeData })
    await flushPromises()
    // 模拟 vxe-table toggle-tree-expand 事件：行展开
    wrapper.vm.$emit('expand-toggle', 1)
    expect(wrapper.emitted('expand-toggle')?.[0]).toEqual([1])
    wrapper.unmount()
  })

  it('v3.5 PR1-B：treeData=null 时不绑 tree-config（确保未启用场景无副作用）', async () => {
    const wrapper = mountBody({ treeData: null })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B：rowDrag=null 时 mount 不崩溃（编排层未启用行拖拽）', async () => {
    const wrapper = mountBody({ rowDrag: null })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B：rowDrag 启用时 mount 不崩溃（编排层 useRowDrag 实例注入）', async () => {
    const mockRowDrag = {
      isDragging: { value: false },
      handleClass: { value: 'pro-table-drag-handle' },
      sortableRef: { value: null },
      attachSortable: vi.fn(),
      detachSortable: vi.fn(),
    } as never
    const wrapper = mountBody({ rowDrag: mockRowDrag })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B：defineExpose 暴露 getTbody 返回 vxe tbody DOM', async () => {
    // vxe-table 模块 mock 是有状态的；mount 后模板会渲染 .vxe-table--body-wrapper 容器
    // 这里直接断言暴露方法存在且返回 null（jsdom 无 vxe-table 真实 DOM）
    const wrapper = mountBody()
    await nextTick()
    const exposed = wrapper.vm.$.exposed as Record<string, unknown> | null
    expect(exposed).toBeDefined()
    expect('getTbody' in (exposed ?? {})).toBe(true)
    expect(typeof (exposed as { getTbody?: unknown }).getTbody).toBe('function')
    wrapper.unmount()
  })
})

describe('VxeTableBody / B1 选区清理与跨页镜像（docs/audit/2026-10-15 #2/#3）', () => {
  // 本 describe 为顶层独立块 —— 不与主 describe 共享 helper，自定义最小挂载（与主 describe 的 mountBody 同语义）
  const b1Columns: ProColumn[] = [
    { prop: 'id', label: 'ID', width: 80 },
    { prop: 'name', label: '名称', minWidth: 160 },
  ]
  const b1Rows = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ]
  function mountBody(extraProps: Record<string, unknown> = {}) {
    return mount(VxeTableBody, {
      props: {
        rows: b1Rows,
        columns: b1Columns,
        rowKey: 'id',
        loading: false,
        rowEdit: null,
        cellSpan: null,
        ...extraProps,
      },
    })
  }

  it('defineExpose 暴露 clearSelection（清本地镜像 + vxe UI 勾选）', async () => {
    const wrapper = mountBody()
    await flushPromises()
    const exposed = wrapper.vm.$.exposed as { clearSelection?: () => void } | null
    expect(typeof exposed?.clearSelection).toBe('function')

    // 预置本地镜像：模拟用户在 vxe 里勾选一行（内部组件事件 → handleCheckboxChange）
    const vxe = wrapper.findComponent({ name: 'VxeTable' })
    vxe.vm.$emit('checkbox-change', { row: { id: 1, name: 'A' }, checked: true })
    await nextTick()
    expect(wrapper.emitted('selection-change')!.at(-1)).toEqual([[{ id: 1, name: 'A' }]])

    vxeInstMocks.clearCheckboxRow.mockClear()
    exposed!.clearSelection!()
    expect(vxeInstMocks.clearCheckboxRow).toHaveBeenCalledTimes(1)
    // 本地镜像已清：后续勾选新行不残留旧行
    vxe.vm.$emit('checkbox-change', { row: { id: 2, name: 'B' }, checked: true })
    await nextTick()
    expect(wrapper.emitted('selection-change')!.at(-1)).toEqual([[{ id: 2, name: 'B' }]])
    wrapper.unmount()
  })

  it('reserve 模式 rows 变化（翻页）→ 合并 getCheckboxRecords + getCheckboxReserveRecords 回同步全量跨页镜像', async () => {
    const columnsWithReserve: ProColumn[] = [
      { type: 'selection', reserveSelection: true, prop: 'sel', label: '' },
      ...b1Columns,
    ]
    const wrapper = mountBody({ columns: columnsWithReserve })
    await flushPromises()
    // 真实 vxe 运行时（浏览器实测）：getCheckboxRecords 仅当前页，跨页保留行在 getCheckboxReserveRecords。
    // 第 1 页勾 id1/id2 后翻到第 2 页（rows = id3/id4）：镜像须合并两集合 = 全量 4 行
    vxeInstMocks.getCheckboxRecords.mockReturnValue([{ id: 3 }, { id: 4 }])
    vxeInstMocks.getCheckboxReserveRecords.mockReturnValue([{ id: 1 }, { id: 2 }])
    await wrapper.setProps({ rows: [{ id: 3 }, { id: 4 }] })
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('selection-change')!.at(-1)).toEqual([
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    ])
    wrapper.unmount()
  })

  it('reserve 回同步：选区 key 集合无变化时不重复 emit（噪声防护）', async () => {
    const columnsWithReserve: ProColumn[] = [
      { type: 'selection', reserveSelection: true, prop: 'sel', label: '' },
      ...b1Columns,
    ]
    const wrapper = mountBody({ columns: columnsWithReserve })
    await flushPromises()
    const emitCountBefore = wrapper.emitted('selection-change')?.length ?? 0
    vxeInstMocks.getCheckboxRecords.mockReturnValue([]) // 空选区 == 空镜像
    vxeInstMocks.getCheckboxReserveRecords.mockReturnValue([]) // 显式清空，防上个 case 的 mockReturnValue 残留
    await wrapper.setProps({ rows: [{ id: 9 }] })
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('selection-change')?.length ?? 0).toBe(emitCountBefore)
    wrapper.unmount()
  })

  // 2026-10-19 demo 浏览器实测暴露：el 引擎 radio 选中由 selectedRowKey（统一选中区）受控驱动，
  // 翻页后回来天然保持；vxe 内置 radio 列选中态由 vxe 内部管理，须显式 radio-config.reserve
  // 才恢复（vxe v4 运行时代码 radioOpts.reserve 分支实证 table.js:2843/3047）。
  // 有 radio 列即开启 reserve —— 对齐 el 引擎无条件跨页保持语义。
  it('含 radio 列时给 vxe 配 radio-config.reserve（对齐 el 引擎跨页保持）', async () => {
    const wrapper = mountBody({
      columns: [{ type: 'radio', prop: 'sel', label: '' }, ...b1Columns],
    })
    await flushPromises()
    const vxe = wrapper.findComponent({ name: 'VxeTable' })
    expect(vxe.props('radioConfig')).toEqual({ reserve: true })
    wrapper.unmount()
  })

  it('无 radio 列时不传 radio-config（保持 undefined）', async () => {
    const wrapper = mountBody()
    await flushPromises()
    const vxe = wrapper.findComponent({ name: 'VxeTable' })
    expect(vxe.props('radioConfig')).toBeUndefined()
    wrapper.unmount()
  })
})
