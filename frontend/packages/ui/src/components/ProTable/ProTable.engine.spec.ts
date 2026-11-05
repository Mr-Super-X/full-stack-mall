/**
 * ProTable v2.1 引擎切换 spec —— vxe 分支渲染 / 加载失败回退 / vxe 事件适配
 *
 * 覆盖计划 P5：
 * - 引擎切换：tableEngine='vxe-table' 渲染 VxeTableBody 解析出的 vxe 组件（stub）
 * - fallback 路径：loadVxeTable reject → engine-fallback → 回退渲染 ElTable
 * - checkbox 合并选区：checkbox-change / checkbox-all 合并为 selection-change（决策 4）
 * - sort-change 负载适配：{ field, order } → { prop, order: 'ascending'|'descending' }（决策 4）
 * - 列设置重排：列序变化全量 remount 列组件（vxe 按挂载序注册列，Vue 移动实例不触发重注册）
 *
 * mock 策略：vi.hoisted + vi.mock 按用例控制 loadVxeTable 行为（resolve stub 模块 / reject），
 * 避免真实 import vxe-table（大文件 + jsdom 渲染不确定性）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, onMounted } from 'vue' // vue（render 函数建 stub）
import { mount, flushPromises } from '@vue/test-utils'
import { ElDropdown } from 'element-plus' // v3.5：密度改下拉后 command 事件直发（文字按钮已移除）
import ProTable from './ProTable.vue'
import VxeTableBody from './components/VxeTableBody.vue'
import ColSetting from './components/ColSetting.vue'
import type { ProTableProps, ProColumn } from './types'

// vi.hoisted：vi.mock 工厂提升到文件顶部，可变 mock 函数须经 hoisted 透出才能按用例配置
const vxeMocks = vi.hoisted(() => ({
  loadVxeTable: vi.fn(),
}))

vi.mock('./composables/useVxeTable', () => ({
  useVxeTable: () => ({
    loadVxeTable: vxeMocks.loadVxeTable,
    isLoaded: () => false,
    reset: () => {},
  }),
}))

/** VxeTable stub 的 recalculate spy 列表 —— setup 返回 render 函数时实例不暴露方法，改用模块级收集 */
const vxeRecalculateSpies: Array<ReturnType<typeof vi.fn>> = []

/** VxeTable stub：接收 VxeTableBody 模板绑定的事件（emits 声明后 $emit 才受控） */
const VxeTableStub = defineComponent({
  name: 'VxeTableStub',
  emits: ['sort-change', 'checkbox-change', 'checkbox-all', 'cell-dblclick'],
  setup(_, { slots, expose }) {
    // recalculate spy：锁定「密度切换后编排层触发 vxe 行高重算」（行高变量测量有缓存）。
    // 经 expose 透出以模拟真实 vxe v4（setup 返回 $xeTable，recalculate 在实例代理上可用）
    const recalculate = vi.fn()
    vxeRecalculateSpies.push(recalculate)
    expose({ recalculate })
    return () => h('div', { class: 'vxe-table-stub' }, slots.default?.())
  },
})

/**
 * VxeColumn stub：透出 field/title 绑定值供断言；default 插槽提供 vxe 风格 scope。
 * mountLog 模拟真实 vxe-table 的列注册机制（assembleColumn 在挂载时按 DOM 序注册），
 * 用于锁定「列序变化必须 remount 列组件」的修复（key 带序位）
 */
const vxeColumnMountLog: string[] = []

const VxeColumnStub = defineComponent({
  name: 'VxeColumnStub',
  props: {
    field: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  setup(props, { slots }) {
    onMounted(() => {
      vxeColumnMountLog.push(props.field)
    })
    return () =>
      h('div', { class: 'vxe-column-stub', 'data-field': props.field }, [
        h('span', { class: 'vxe-column-stub__title' }, props.title),
        slots.default?.({ row: {}, rowIndex: 0, $columnIndex: 0 }),
      ])
  },
})

/** 解析成功时 loadVxeTable 返回的模块形状（VxeTableBody 用具名导出 VxeTable / VxeColumn） */
const stubVxeModule = { VxeTable: VxeTableStub, VxeColumn: VxeColumnStub }

const nonEmptyApi: ProTableProps['requestApi'] = async () => ({
  data: [{ id: '1', name: '甲' }],
  total: 1,
  pageNum: 1,
  pageSize: 10,
})

function makeProps(overrides: Partial<ProTableProps> = {}): ProTableProps {
  return {
    columns: [{ prop: 'name', label: '名称' }],
    requestApi: nonEmptyApi,
    ...overrides,
  } as ProTableProps
}

describe('ProTable v2.1 引擎切换', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('引擎切换：vxe-table 渲染 stub 组件 + 列映射（toVxeColumnProps 派生 field/title）', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(ProTable, {
      props: makeProps({ tableEngine: 'vxe-table' }),
    })
    await flushPromises()
    await nextTick()

    const stub = wrapper.findComponent(VxeTableStub)
    expect(stub.exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElTable' }).exists()).toBe(false)
    // 列映射：ProColumn { prop: 'name', label: '名称' } → VxeColumn { field: 'name', title: '名称' }
    const colStub = wrapper.findComponent(VxeColumnStub)
    expect(colStub.exists()).toBe(true)
    expect(colStub.props('field')).toBe('name')
    expect(colStub.props('title')).toBe('名称')
  })

  it('fallback 路径：loadVxeTable reject → warn + 回退渲染 ElTable', async () => {
    vxeMocks.loadVxeTable.mockRejectedValue(new Error('chunk load failed'))
    const wrapper = mount(ProTable, {
      props: makeProps({ tableEngine: 'vxe-table' }),
    })
    await flushPromises()
    await nextTick()

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎加载失败'),
      expect.anything()
    )
    expect(wrapper.findComponent({ name: 'ElTable' }).exists()).toBe(true)
  })

  it('checkbox 合并选区：checkbox-change + checkbox-all 合并为 selection-change', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const rows = [
      { id: '1', name: '甲' },
      { id: '2', name: '乙' },
      { id: '3', name: '丙' },
    ]
    const columns: ProColumn[] = [
      { prop: 'name', label: '名称', type: 'selection' },
      { prop: 'name', label: '名称' },
    ]
    const wrapper = mount(VxeTableBody, {
      props: { rows, columns, rowEdit: null, cellSpan: null },
    })
    await flushPromises()
    await nextTick()

    const stub = wrapper.findComponent(VxeTableStub)
    expect(stub.exists()).toBe(true)

    // 单选：勾选第 1 行 → selection-change 含 1 行
    stub.vm.$emit('checkbox-change', { row: rows[0], checked: true })
    await nextTick()
    let emitted = wrapper.emitted('selection-change')
    expect(emitted?.at(-1)?.[0]).toEqual([rows[0]])

    // 全选：勾选全部 3 行 → 合并后 3 行（单选行不重复）
    stub.vm.$emit('checkbox-all', { checked: true, rows })
    await nextTick()
    emitted = wrapper.emitted('selection-change')
    expect(emitted?.at(-1)?.[0]).toEqual(rows)

    // 单选取消：取消第 1 行 → 剩 2 行
    stub.vm.$emit('checkbox-change', { row: rows[0], checked: false })
    await nextTick()
    emitted = wrapper.emitted('selection-change')
    expect(emitted?.at(-1)?.[0]).toEqual([rows[1], rows[2]])
  })

  it('sort-change 负载适配：{ field, order: asc } → { prop, order: ascending }', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(VxeTableBody, {
      props: {
        rows: [{ id: '1', name: '甲' }],
        columns: [{ prop: 'name', label: '名称' }],
        rowEdit: null,
        cellSpan: null,
      },
    })
    await flushPromises()
    await nextTick()

    const stub = wrapper.findComponent(VxeTableStub)
    stub.vm.$emit('sort-change', { field: 'amount', order: 'asc' })
    await nextTick()
    expect(wrapper.emitted('sort-change')?.at(-1)?.[0]).toEqual({
      prop: 'amount',
      order: 'ascending',
    })

    // 清除排序：order 为 null → 内部 order 归一化为 null
    stub.vm.$emit('sort-change', { field: 'amount', order: null })
    await nextTick()
    expect(wrapper.emitted('sort-change')?.at(-1)?.[0]).toEqual({ prop: 'amount', order: null })
  })

  it('vxe 引擎下列设置 / 密度可用：ColSetting 渲染 + 按钮桥接正常', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(ProTable, {
      props: makeProps({ tableEngine: 'vxe-table' }),
    })
    await flushPromises()
    await nextTick()

    // 列设置：vxe 引擎下 ColSetting 同样渲染（v-if 引擎限制已移除，数据层引擎无关）
    expect(wrapper.findComponent(ColSetting).exists()).toBe(true)
    await wrapper.find('[data-test="col-setting-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.findComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(true)

    // 密度：切换按钮更新根 div data-density（vxe 行高走 CSS 变量 --vxe-ui-table-row-height-* 覆盖，
    // 测量结果有缓存，需触发 vxe recalculate 重算行高）
    // v3.5：密度改为 ElDropdown，向 TableHeader 内的 ElDropdown 直发 command 事件（与点击菜单项等价）
    wrapper.findComponent(ElDropdown).vm.$emit('command', 'compact')
    await nextTick()
    expect(wrapper.find('.vv-pro-table').attributes('data-density')).toBe('compact')
    expect(vxeRecalculateSpies.at(-1)).toHaveBeenCalled()
  })

  it('列设置拖拽排序后列组件全量 remount（key 带序位，对齐 vxe 按挂载序注册列的机制）', async () => {
    vxeColumnMountLog.length = 0
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const columns: ProColumn[] = [
      { prop: 'a', label: '甲' },
      { prop: 'b', label: '乙' },
      { prop: 'c', label: '丙' },
    ]
    const wrapper = mount(VxeTableBody, {
      props: { rows: [], columns, rowEdit: null, cellSpan: null },
    })
    await flushPromises()
    await nextTick()
    // 初始按挂载序注册（模拟 vxe assembleColumn）
    expect(vxeColumnMountLog).toEqual(['a', 'b', 'c'])

    // 模拟列设置拖拽排序：列数组重排（ProTable 编排层经 sortedColumnsLoose 透传）
    await wrapper.setProps({
      columns: [columns[1], columns[2], columns[0]],
    })
    await nextTick()

    // 重排后必须全量 remount：vxe-table 只在列挂载时按 DOM 序注册 staticColumns，
    // 若 Vue 仅移动组件实例（key 不含序位），注册序不变 → 表头列序不更新（历史 bug）。
    // 只断言 remount 集合而非顺序：真实 vxe 的 assembleColumn 在挂载钩子里读 DOM 位置
    // 取插入下标，与钩子触发顺序无关；Vue 调度器不保证 remount 触发序等于 vnode 序
    expect(vxeColumnMountLog.slice(0, 3)).toEqual(['a', 'b', 'c'])
    expect([...vxeColumnMountLog.slice(3)].sort()).toEqual(['a', 'b', 'c'])
    expect(vxeColumnMountLog).toHaveLength(6)
    // DOM 顺序同步为新列序
    expect(wrapper.findAll('.vxe-column-stub').map((el) => el.attributes('data-field'))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  // ─────────────────────────────────────────────────────────
  // v3.5 PR1-B：双引擎 capability matrix —— 树形 + 行拖拽能力对等
  // ─────────────────────────────────────────────────────────
  it('v3.5 PR1-B capability matrix：vxe + enableTree mount 不崩溃（vxe 引擎补齐树形）', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(ProTable, {
      props: makeProps({
        tableEngine: 'vxe-table',
        enableTree: { defaultExpandDepth: 1 },
      }),
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.findComponent(VxeTableBody).exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B capability matrix：vxe + enableRowDrag mount 不崩溃（vxe 引擎补齐拖拽）', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(ProTable, {
      props: makeProps({
        tableEngine: 'vxe-table',
        enableRowDrag: { handle: '__all__' },
      }),
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.findComponent(VxeTableBody).exists()).toBe(true)
    wrapper.unmount()
  })

  it('v3.5 PR1-B capability matrix：el + enableTree mount 仍正常（回归保护）', async () => {
    const wrapper = mount(ProTable, {
      props: makeProps({
        enableTree: { defaultExpandDepth: 1 },
      }),
    })
    await flushPromises()
    await nextTick()
    // el 分支 mount 成功 + VxeTableBody 不挂载（engine=element-plus 不命中 v-else-if）
    expect(wrapper.findComponent(VxeTableBody).exists()).toBe(false)
    wrapper.unmount()
  })

  it('v3.5 PR1-B capability matrix：vxe + 树形 + 拖拽 三者冲突 warn（行拖拽退化）', async () => {
    vxeMocks.loadVxeTable.mockResolvedValue(stubVxeModule)
    const wrapper = mount(ProTable, {
      props: makeProps({
        tableEngine: 'vxe-table',
        enableTree: { defaultExpandDepth: 1 },
        enableRowDrag: true,
      }),
    })
    await flushPromises()
    await nextTick()
    // 三者冲突 → 启动 debug sortablejs 与 vxe tree-node 行结构冲突（v3.5 hotfix-3：warn 降级 debug）
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎 + 树形 + 行拖拽 同时启用')
    )
    expect(wrapper.findComponent(VxeTableBody).exists()).toBe(true)
    wrapper.unmount()
  })
})
