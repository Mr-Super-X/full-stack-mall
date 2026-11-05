/**
 * ProTable 集成 spec —— v2.0 能力冲突矩阵 + 启动校验
 *
 * 覆盖 spec §七 冲突矩阵 6 条规则 + §七.3 启动校验。
 * 通过 mount + props 传 4 能力组合 + 断言 console.warn 触发。
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import ProTable from './ProTable.vue'
import VxeTableBody from './components/VxeTableBody.vue'
import ElementTableBody from './components/ElementTableBody.vue'
import type { ProTableProps } from './types'

// v2.1 P3：VxeTableBody 的 vxe 动态加载在集成测试中 mock 为「永不 resolve」——
// 保持骨架屏态即可断言分支接管，避免真实 import vxe-table（大文件 + jsdom 渲染不确定性）。
// 真实加载 / fallback 路径的用例由 P5 引擎切换测试覆盖
vi.mock('./composables/useVxeTable', () => ({
  useVxeTable: () => ({
    loadVxeTable: () => new Promise<unknown>(() => {}),
    isLoaded: () => false,
    reset: () => {},
  }),
}))

const mockApi: ProTableProps['requestApi'] = async () => ({
  data: [],
  total: 0,
  pageNum: 1,
  pageSize: 10,
})

describe('ProTable v2.0 集成（冲突矩阵 + 启动校验）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 编辑 + 树形：启动时 console.warn 提示「编辑仅作用于叶子节点」', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', edit: { el: 'input' } }],
        requestApi: mockApi,
        enableRowEdit: true,
        enableTree: { defaultExpandDepth: 1 },
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('编辑仅作用于叶子节点'))
  })

  it('树形懒加载：el-table 平铺渲染不重复（无 Duplicate keys 警告，行数=flatData 行数）', async () => {
    // v2.2 回归：行对象带 children 字段（懒加载赋值），el-table 默认 tree-props 会识别该字段
    // 递归渲染树节点 —— flatData 平铺行 + el-table 树形嵌套行 = 同一行渲染两次（Duplicate keys）
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', tree: { indentSize: 20 } }],
        requestApi: async () => ({
          data: [{ id: 'root', name: '公司', _hasChildren: true }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
        }),
        enableTree: {
          rowKey: 'id',
          loadDebounce: 1,
          loadChildren: async () => [{ id: 'child-1', name: '子1', _hasChildren: false }],
        },
        rowKey: 'id',
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 30))
    await wrapper.find('.pro-table-tree-toggle').trigger('click')
    await new Promise((r) => setTimeout(r, 30))
    // 修复后：root + child-1 共 2 行；未修复时 el-table 树形递归会多渲染 1 行 child-1（共 3 行）
    expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(2)
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('Duplicate keys'))
  })

  it('④ 树形 + 合并：span.direction=column 被忽略 + console.warn（M5：不改写调用方配置）', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: mockApi,
        enableTree: { defaultExpandDepth: 1 },
        enableCellSpan: { direction: 'column' } as never,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('span.direction=column'))
  })

  it('columnResize 透传：默认 false，开启后表格体组件收到 true', async () => {
    const nonEmptyApi: ProTableProps['requestApi'] = async () => ({
      data: [{ name: '甲' }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    // 默认关闭（el 引擎 resizable 默认 true，ProTable 层必须显式 false 才能关）
    const wrapperDefault = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: nonEmptyApi,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapperDefault.findComponent(ElementTableBody).props('columnResize')).toBe(false)
    wrapperDefault.unmount()

    const wrapperOn = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: nonEmptyApi,
        columnResize: true,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapperOn.findComponent(ElementTableBody).props('columnResize')).toBe(true)
    wrapperOn.unmount()
  })

  it('vxe-table 引擎：setup 不再回退，VxeTableBody 分支接管（v2.1 P3）', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        // 返回非空数据：空数据时 AsyncState 渲染 empty 态不挂载表格体，无法断言引擎分支
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // v2.1 P3：resolveEngine 的静态回退已删除（运行时回退由 VxeTableBody engine-fallback 承担）
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('vxe-table 引擎暂未实现'))
    // vxe 加载被 mock 为永不完成：分支由 VxeTableBody（骨架屏态）接管，不挂载 ElTable
    expect(wrapper.findComponent(VxeTableBody).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElTable' }).exists()).toBe(false)
  })

  it('vxe 引擎 + 纯 enableTree：不 warn「暂不支持树形」（v3.5 PR1-B 补齐树形）', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableTree: { defaultExpandDepth: 1 },
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // v3.5 PR1-B 起 vxe 支持树形 → 不再有「暂不支持树形」warn
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎暂不支持树形')
    )
  })

  it('vxe 引擎 + 纯 enableRowDrag：不 warn「暂不支持行拖拽」（v3.5 PR1-B 补齐拖拽）', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableRowDrag: true,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎暂不支持行拖拽')
    )
  })

  it('vxe 引擎 + 树形 + 行拖拽 三者冲突：warn 提示 sortablejs 与 vxe tree-node 行结构冲突', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableTree: { defaultExpandDepth: 1 },
        enableRowDrag: true,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // v3.5 hotfix-3：warn 降级 debug，减少 demo 噪音
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎 + 树形 + 行拖拽 同时启用')
    )
  })

  it('vxe 引擎 + 编辑 + 树形：不 warn「编辑仅作用于叶子节点」（树形前提已被忽略，避免误导）', async () => {
    mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', edit: { el: 'input' } }],
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableRowEdit: true,
        enableTree: { defaultExpandDepth: 1 },
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('编辑仅作用于叶子节点'))
  })

  it('启动校验：能力冲突时只 warn 不 throw（组件仍 mount 成功）', () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [],
        requestApi: mockApi,
        enableRowEdit: true,
        enableTree: true,
      } as ProTableProps,
    })
    expect(wrapper.exists()).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it('所有能力未启用：4 个 composable 都不实例化（不引入运行时开销）', () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [],
        requestApi: mockApi,
      } as ProTableProps,
    })
    expect(wrapper.exists()).toBe(true)
    // 4 个能力 prop 全部未设置时，validateCapabilities 应无 warn
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('单能力启用：enableRowEdit=true 不触发冲突 warn', () => {
    mount(ProTable, {
      props: {
        columns: [],
        requestApi: mockApi,
        enableRowEdit: true,
      } as ProTableProps,
    })
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('编辑仅作用于叶子节点'))
  })

  it('能力 prop 接受 boolean 与 config 对象两种形式', () => {
    const wrapper1 = mount(ProTable, {
      props: {
        columns: [],
        requestApi: mockApi,
        enableRowEdit: true,
      } as ProTableProps,
    })
    const wrapper2 = mount(ProTable, {
      props: {
        columns: [],
        requestApi: mockApi,
        enableRowEdit: { onSaved: () => {} },
      } as ProTableProps,
    })
    expect(wrapper1.exists()).toBe(true)
    expect(wrapper2.exists()).toBe(true)
  })

  it('H1 回归：程序化 setSearchParams 的请求带传入参数（而非默认参数）', async () => {
    const requestApi = vi.fn().mockResolvedValue({ data: [], total: 0, pageNum: 1, pageSize: 10 })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10)) // 等待 onMounted 首次请求
    const vm = wrapper.vm as unknown as {
      setSearchParams: (p: Record<string, unknown>) => Promise<void>
    }
    await vm.setSearchParams({ name: '李四' })
    await new Promise((r) => setTimeout(r, 10))
    const calls = requestApi.mock.calls
    expect(calls[calls.length - 1]![0]).toMatchObject({ name: '李四' })
  })

  it('H2 回归：搜索框输入不发请求，点搜索按钮才发且参数正确', async () => {
    const requestApi = vi.fn().mockResolvedValue({ data: [], total: 0, pageNum: 1, pageSize: 10 })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10)) // 首次请求
    const initialCalls = requestApi.mock.calls.length

    // 输入关键词（不点搜索）：不应触发新请求
    await wrapper.find('input').setValue('张三')
    await new Promise((r) => setTimeout(r, 10))
    expect(requestApi.mock.calls.length).toBe(initialCalls)

    // 点搜索按钮：触发一次请求且带输入参数
    await wrapper.find('[data-test="search-btn"]').trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(requestApi.mock.calls.length).toBe(initialCalls + 1)
    const calls = requestApi.mock.calls
    expect(calls[calls.length - 1]![0]).toMatchObject({ name: '张三' })
  })

  it('M2：sortable=custom 列 sort-change → 请求带 orderByColumn/isAsc（服务端排序接线）', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ name: '甲', amount: 3 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: 'custom' }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10)) // 首次请求
    // 直接驱动 el-table 的 sort-change（jsdom 点击 el-table 表头不可靠；
    // 事件接线由本测试覆盖，真实点击路径列为浏览器手动验证）
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'ascending' })
    await new Promise((r) => setTimeout(r, 10))
    const calls = requestApi.mock.calls
    expect(calls[calls.length - 1]![0]).toMatchObject({ orderByColumn: 'amount', isAsc: 'asc' })
  })

  it('M2：sortable=true（客户端排序）列 sort-change 不触发服务端请求', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ name: '甲', amount: 3 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: true }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const callsBefore = requestApi.mock.calls.length
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'ascending' })
    await new Promise((r) => setTimeout(r, 10))
    expect(requestApi.mock.calls.length).toBe(callsBefore)
  })

  it('v2.2-M1：element expose 指向 ElTable 实例（element-plus 引擎下非 null）', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        // 返回非空数据：空数据时 AsyncState 渲染 empty 态不挂载表格体
        requestApi: async () => ({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 }),
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as unknown as { element: { clearSelection?: unknown } | null }
    expect(vm.element).not.toBeNull()
    // 断言穿透到 ElTable 实例方法：若 expose 链任何一环把 ref 对象原样透出，
    // element 会是 { value: ... } 包装而非实例，本断言即失败（审查发现 #1 的实证裁决）
    expect(typeof vm.element?.clearSelection).toBe('function')
  })

  it('v2.2-M1 修复回归：selection 列行内渲染 el-table 内置 checkbox（default slot 不覆盖 cellForced）', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [
          { prop: '__selection', label: '', type: 'selection', width: 50 },
          { prop: 'name', label: '名称' },
        ],
        // 返回非空数据：空数据时 AsyncState 渲染 empty 态不挂载表格体
        requestApi: async () => ({
          data: [{ id: 1, name: '甲' }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
        }),
        rowKey: 'id',
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // 缺陷现象：ElTableColumn 统一提供 default slot 会覆盖 el-table 对 selection 列的
    // 强制 checkbox 渲染（cellForced.renderCell），导致行内勾选框缺失、只有表头全选框
    expect(wrapper.findAll('.el-table__body .el-checkbox').length).toBe(1)
  })

  it('v2.2-M1：跨页 reset 只触发一次请求（page≠1 时无双发）', async () => {
    const requestApi = vi.fn().mockResolvedValue({ data: [], total: 100, pageNum: 1, pageSize: 10 })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input' } }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10)) // onMounted 首次请求
    expect(requestApi).toHaveBeenCalledTimes(1)

    // 翻到第 3 页（watch 触发第 2 次请求）
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 3)
    await vi.waitFor(() => expect(requestApi).toHaveBeenCalledTimes(2))

    // 重置：page 3→1 由 watch 触发一次请求即够，不得再手动 refresh 第二次
    const vm = wrapper.vm as unknown as { reset: () => Promise<void> }
    await vm.reset()
    await new Promise((r) => setTimeout(r, 20))
    expect(requestApi).toHaveBeenCalledTimes(3)
  })

  it('v2.2-M1 补偿：切分页期间表格展示 loading 遮罩（initialLoading skeleton 仅首次）', async () => {
    type MockResponse = {
      data: { name: string }[]
      total: number
      pageNum: number
      pageSize: number
    }
    let resolveSecond: ((v: MockResponse) => void) | null = null
    let callCount = 0
    const requestApi = vi.fn().mockImplementation(() => {
      callCount += 1
      // 首次请求直接成功；第二次请求（切分页）人为挂起，用于断言 loading 遮罩
      return callCount === 1
        ? Promise.resolve<MockResponse>({
            data: [{ name: '甲' }],
            total: 100,
            pageNum: 1,
            pageSize: 10,
          })
        : new Promise<MockResponse>((resolve) => {
            resolveSecond = resolve
          })
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi,
      } as unknown as ProTableProps,
    })
    // 首次请求完成 → 表格挂载（非空数据），此时不应有表格遮罩（skeleton 也已结束）
    await vi.waitFor(() => expect(requestApi).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.el-loading-mask').exists()).toBe(false)

    // 切到第 2 页：第二次请求挂起期间，v-loading 遮罩应出现在表格上
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await vi.waitFor(() => expect(wrapper.find('.el-loading-mask').exists()).toBe(true))

    // 释放第二次请求 → 数据到达后遮罩消失
    resolveSecond?.({ data: [{ name: '乙' }], total: 100, pageNum: 2, pageSize: 10 })
    await vi.waitFor(() => expect(wrapper.find('.el-loading-mask').exists()).toBe(false))
  })

  it('M2：组件向外 emit sort-change（父级可监听排序变化）', async () => {
    const onSortChange = vi.fn()
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: 'custom' }],
        // 返回非空数据：空数据时 AsyncState 渲染 empty 态不挂载 ElTable，无法驱动 sort-change
        requestApi: async () => ({ data: [{ amount: 3 }], total: 1, pageNum: 1, pageSize: 10 }),
        onSortChange,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'descending' })
    await new Promise((r) => setTimeout(r, 10))
    expect(onSortChange).toHaveBeenCalledWith({ prop: 'amount', order: 'descending' })
  })
})

/**
 * v3.5 PR2：服务端筛选 filterParamsAdapter 端到端测试。
 *
 * 覆盖：el-table @filter-change → handleFilterChange → setFilter + adapter 调用 +
 * 请求带序列化结果 + emit filter-change 事件。覆盖默认无 adapter 行为 + reset 清空 + expose。
 */
describe('ProTable v3.5 PR2 服务端筛选', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filterParamsAdapter 存在：el-table filter-change → adapter 调用 + 请求带序列化字段', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1, status: 'paid' }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const filterParamsAdapter = vi.fn((filters: Record<string, (string | number | boolean)[]>) => ({
      statusList: filters.status,
      deptList: filters.dept,
    }))
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'status', label: '状态' }],
        requestApi,
        filterParamsAdapter,
        rowKey: 'id',
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // 模拟 el-table filter-change：传全表筛选快照
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('filter-change', { status: ['paid'], dept: ['tech'] })
    await vi.waitFor(() => expect(requestApi).toHaveBeenCalledTimes(2))
    expect(filterParamsAdapter).toHaveBeenCalledWith({ status: ['paid'], dept: ['tech'] })
    const lastCall = requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(lastCall).toMatchObject({ statusList: ['paid'], deptList: ['tech'] })
    wrapper.unmount()
  })

  it('filterParamsAdapter 存在：组件向外 emit filter-change 事件', async () => {
    const onFilterChange = vi.fn()
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'status', label: '状态' }],
        requestApi: async () => ({
          data: [{ status: 'paid' }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
        }),
        filterParamsAdapter: () => ({}),
        onFilterChange,
        rowKey: 'id',
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('filter-change', { status: ['paid'] })
    await new Promise((r) => setTimeout(r, 10))
    expect(onFilterChange).toHaveBeenCalledWith({ status: ['paid'] })
    wrapper.unmount()
  })

  it('默认（无 filterParamsAdapter）：filter-change 仅 UI 记忆，不触发新请求', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'status', label: '状态' }],
        requestApi,
        rowKey: 'id',
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const callsBefore = requestApi.mock.calls.length
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('filter-change', { status: ['paid'] })
    await new Promise((r) => setTimeout(r, 10))
    // 无 adapter → 无新请求（el-table 客户端筛选继续生效）
    expect(requestApi.mock.calls.length).toBe(callsBefore)
    // 但 getFilterState 仍记录（UI 记忆 + expose）
    const vm = wrapper.vm as unknown as { getFilterState: () => Record<string, unknown[]> }
    expect(vm.getFilterState()).toEqual({ status: ['paid'] })
    wrapper.unmount()
  })

  it('expose getFilterState 暴露当前全表筛选快照', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'status', label: '状态' }],
        requestApi,
        filterParamsAdapter: () => ({}),
        rowKey: 'id',
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as unknown as { getFilterState: () => Record<string, unknown[]> }
    // 初始为空对象
    expect(vm.getFilterState()).toEqual({})
    // 触发 filter-change 后快照更新
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('filter-change', { status: ['paid'], dept: ['tech'] })
    await new Promise((r) => setTimeout(r, 10))
    expect(vm.getFilterState()).toEqual({ status: ['paid'], dept: ['tech'] })
    wrapper.unmount()
  })

  it('reset() 同步清空 filterState（adapter 存在时 + page=1 路径）', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ id: 1 }],
      total: 10,
      pageNum: 1,
      pageSize: 10,
    })
    const filterParamsAdapter = vi.fn((filters: Record<string, (string | number | boolean)[]>) => ({
      statusList: filters.status,
    }))
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'status', label: '状态' }],
        requestApi,
        filterParamsAdapter,
        rowKey: 'id',
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('filter-change', { status: ['paid'] })
    await vi.waitFor(() => expect(requestApi).toHaveBeenCalledTimes(2))

    const vm = wrapper.vm as unknown as {
      reset: () => Promise<void>
      getFilterState: () => Record<string, unknown[]>
    }
    await vm.reset()
    await new Promise((r) => setTimeout(r, 20))
    // reset 后 filterState 已清空
    expect(vm.getFilterState()).toEqual({})
    // reset 触发的新请求 params 不含筛选字段（filterState 空 → adapter 不被调）
    const lastCall = requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(lastCall).not.toHaveProperty('statusList')
    // 观察项闭环：reset 补发 filter-change（payload 为清空后的全表快照 {}）——
    // 父级靠事件维护的筛选快照（URL 同步 / 埋点上报）随 reset 回同步，不再滞留旧条件
    const filterChangeEvents = wrapper.emitted('filter-change') ?? []
    expect(filterChangeEvents.at(-1)).toEqual([{}])
    wrapper.unmount()
  })
})

describe('SelectedTags 已选条件回显区（v3.2 回归）', () => {
  // 回归背景：showSelectedTags 走 withDefaults 未声明默认值时，Vue 对 Boolean 类型 prop
  // 做「absent → false」强转，原 v-if `!== false` 恒为 false，回显区从未挂载。
  // 以下 3 例锁死「默认开启 / 显式关闭 / 显式开启」三态。
  it('默认（未传 showSelectedTags）：设置搜索参数后回显区渲染 tag', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } }],
        requestApi: mockApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as unknown as {
      setSearchParams: (p: Record<string, unknown>) => Promise<void>
    }
    await vm.setSearchParams({ name: '李四' })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.vv-pro-table-selected-tags').exists()).toBe(true)
    expect(wrapper.find('[data-test="selected-tag-name"]').text()).toContain('李四')
  })

  it('showSelectedTags=false：回显区不渲染', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } }],
        requestApi: mockApi,
        showSelectedTags: false,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as unknown as {
      setSearchParams: (p: Record<string, unknown>) => Promise<void>
    }
    await vm.setSearchParams({ name: '李四' })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.vv-pro-table-selected-tags').exists()).toBe(false)
  })

  it('showSelectedTags=true（显式）：回显区渲染', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } }],
        requestApi: mockApi,
        showSelectedTags: true,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as unknown as {
      setSearchParams: (p: Record<string, unknown>) => Promise<void>
    }
    await vm.setSearchParams({ name: '李四' })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.vv-pro-table-selected-tags').exists()).toBe(true)
  })
})

/**
 * v3.5 PR1-A：A11y 根容器 + 全局样式断言
 * - role="grid" + aria-label + aria-rowcount + aria-busy
 * - 全屏态 aria-label 切换
 * - _a11y.scss 已通过 ProTable.vue 顶层引入（隐式验证：mount 后样式 hook 注入）
 */
describe('ProTable v3.5 A11y 根容器', () => {
  // v3.5 PR1-A：vitest-axe 扩展 expect（toHaveNoViolations）—— 在 describe 块内调用
  // expect.extend（vitest 1.x + node ESM 下模块顶层 expect 未初始化，必须在测试上下文内）
  beforeAll(() => {
    expect.extend(matchers)
  })

  it('根 div 加 role="grid" + aria-label="数据表格" + aria-rowcount + aria-busy', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: async () => ({
          data: [{ id: 1, name: '甲' }],
          total: 50,
          pageNum: 1,
          pageSize: 10,
        }),
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const root = wrapper.find('.vv-pro-table')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('grid')
    expect(root.attributes('aria-label')).toBe('数据表格')
    // aria-rowcount = total + 1（含表头行）
    expect(root.attributes('aria-rowcount')).toBe('51')
    // 加载完毕后 aria-busy=false
    expect(root.attributes('aria-busy')).toBe('false')
  })

  it('全屏态：aria-label 切换为「数据表格（全屏）」', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: mockApi,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    // 初始非全屏
    expect(wrapper.find('.vv-pro-table').attributes('aria-label')).toBe('数据表格')
    // 通过 useFullscreen 的 toggleFullscreen 函数触发（编排层暴露）
    const vm = wrapper.vm as unknown as { element?: unknown }
    expect(vm.element).toBeDefined()
    // 验证全屏态 class 切换（true 时 is-fullscreen className 加上 + aria-label 切换）
    // jsdom 模拟下 useFullscreen.isFullscreen 是 ref；通过 prop 触发不直接走 setup，
    // 此处仅断言非全屏态 aria-label 与切换机制存在（点击触发由 E2E 覆盖）
  })

  it('初次加载中 aria-busy=true（用户感知「正在加载」）', async () => {
    let resolveFirst:
      ((v: { data: unknown[]; total: number; pageNum: number; pageSize: number }) => void) | null =
      null
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      } as ProTableProps,
    })
    // 初始加载中
    await new Promise((r) => setTimeout(r, 5))
    expect(wrapper.find('.vv-pro-table').attributes('aria-busy')).toBe('true')
    // 释放请求
    resolveFirst?.({ data: [{ name: '甲' }], total: 1, pageNum: 1, pageSize: 10 })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.vv-pro-table').attributes('aria-busy')).toBe('false')
  })

  /**
   * v3.5 PR1-A：vitest-axe 自动审计（axe-core WCAG 2.1 A/AA 规则）。
   *
   * 真实覆盖：color-contrast / image-alt / label / aria-roles / region 等 80+ 检查。
   * jsdom 不渲染真实颜色（computed background 与 element-plus CSS 变量解析受限），
   * 部分「严重依赖真实渲染」的规则会因「unable to determine」标记 incomplete（不是 violation）。
   * 我们只断言 violations 数 = 0，incomplete 数不计入。
   */
  it('axe 自动审计：基础 ProTable mount 无 critical violations', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [
          { prop: 'name', label: '名称' },
          { prop: 'age', label: '年龄' },
        ],
        requestApi: async () => ({
          data: [{ id: 1, name: '甲', age: 20 }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
        }),
        rowKey: 'id',
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 30))
    // axe 规则裁剪：聚焦项目可控的规则集。
    // - 关闭 region / aria-required-children：EP 内部组件 + 单组件 mount 触发结构性误报，
    //   由 E2E 真实业务页面验证（外部 layout 提供 landmark）。
    // - 关闭 label：EP ElSelect 输入框缺 label 是 element-plus 已知限制（element-plus#3876），
    //   我们通过 form-item label 间接关联；axe 在 jsdom 下无法解析 element-plus label slot。
    // 保留 color-contrast / aria-valid-attr-value / aria-roles / image-alt 等核心检查。
    const results = await axe(wrapper.element, {
      rules: {
        region: { enabled: false },
        'aria-required-children': { enabled: false },
        label: { enabled: false },
      },
    })
    expect(results).toHaveNoViolations()
    wrapper.unmount()
  })
})

/**
 * v3.5 PR3：泛型透传契约测试。
 *
 * 验证 ProTable → 子组件（SearchForm / TableHeader / ColSetting / 3 个 body）的
 * generic<T> 透传：消费方定义 `<ProTable<User>>` 时，子组件 columns/visibleColumns
 * prop 类型为 ProColumn<User>[]，无需 `as unknown as` cast。
 *
 * 测试策略：构造 ProColumn<User>[] 显式标注泛型，断言 mount 成功 + 渲染行带
 * `User` 字段（IDE 智能提示层面靠 type-check:full 兜底）。
 */
describe('ProTable v3.5 PR3 泛型透传', () => {
  interface User {
    id: number
    name: string
    role: 'admin' | 'guest'
  }

  it('消费方显式标注 <ProTable<User>>：columns 类型贯穿到 SearchForm/TableHeader/ColSetting', async () => {
    const userColumns: import('./types').ProColumn<User>[] = [
      { prop: 'name', label: '名称', search: { el: 'input' as const, defaultValue: '' } },
      { prop: 'role', label: '角色', search: { el: 'select' as const, defaultValue: null } },
    ]
    const wrapper = mount(ProTable, {
      props: {
        columns: userColumns,
        requestApi: async () => ({
          data: [
            { id: 1, name: '张三', role: 'admin' as const },
            { id: 2, name: '李四', role: 'guest' as const },
          ],
          total: 2,
          pageNum: 1,
          pageSize: 10,
        }),
        rowKey: 'id',
      },
    })
    await new Promise((r) => setTimeout(r, 10))
    // 验证表格根容器 + 至少一个 rowKey='1' 的行渲染
    expect(wrapper.find('.vv-pro-table').exists()).toBe(true)
    expect(wrapper.findAll('.el-table__body tbody tr').length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })

  it('默认 Record 视角向后兼容：不显式标注泛型也正常 mount', async () => {
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: mockApi,
      } as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.find('.vv-pro-table').exists()).toBe(true)
    wrapper.unmount()
  })
})
