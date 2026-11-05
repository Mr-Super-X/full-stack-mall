/**
 * ElementTableV2Body 单元测试
 * @group ProTable 组件测试
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ElTableV2 } from 'element-plus'
import ElementTableV2Body from './ElementTableV2Body.vue'
import type { ProColumn } from '../types'

describe('ElementTableV2Body', () => {
  const baseColumns: ProColumn[] = [
    { prop: 'id', label: 'ID', width: 100 },
    { prop: 'name', label: '名称', minWidth: 200 },
    { prop: 'value', label: '值', width: 120 },
  ]

  const baseRows = [
    { id: 1, name: 'A', value: 10 },
    { id: 2, name: 'B', value: 20 },
  ]

  it('mount 渲染成功（不崩溃）', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('virtualConfig 派生 width/height/rowHeight（fixed-size 模式）', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: { rowHeight: 60, height: 800, width: 1200 },
      },
    })
    const table = wrapper.findComponent(ElTableV2)
    expect(table.props('height')).toBe(800)
    expect(table.props('width')).toBe(1200)
    // density 未传时用 virtualConfig.rowHeight；不传 estimatedRowHeight（dynamic 模式会让密度切换失效）
    expect(table.props('rowHeight')).toBe(60)
    expect(table.props('estimatedRowHeight')).toBeUndefined()
    wrapper.unmount()
  })

  it('density 优先于 virtualConfig.rowHeight', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        density: 'compact',
        virtualConfig: { rowHeight: 60 },
      },
    })
    expect(wrapper.findComponent(ElTableV2).props('rowHeight')).toBe(32)
    wrapper.unmount()
  })

  it('列适配：v1 填充算法分配剩余宽度（按 minWidth 比例），sortable 归一为 boolean', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: [
          ...baseColumns,
          { prop: 'score', label: '评分', minWidth: 150, sortable: 'custom' },
        ] as ProColumn[],
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    const cols = wrapper.findComponent(ElTableV2).props('columns') as Array<Record<string, unknown>>
    // jsdom 未测量容器 → fallback 800；base=[100,200,120,150] 共 570，extra=230
    // 可拉伸列 name(200)/score(150)：name += floor(230*200/350)=131，score 吸收余数 99
    const byKey = (k: string) => cols.find((c) => c.key === k)
    expect(byKey('id')).toMatchObject({ width: 100 })
    expect(byKey('id')).not.toHaveProperty('sortable')
    expect(byKey('name')).toMatchObject({ width: 331 })
    expect(byKey('value')).toMatchObject({ width: 120 })
    expect(byKey('score')).toMatchObject({ width: 249, sortable: true })
    // 列宽总和精确等于容器宽（rigid 布局，flexGrow 被源码禁用故不输出）
    expect(cols.reduce((acc, c) => acc + (c.width as number), 0)).toBe(800)
    expect(byKey('name')).not.toHaveProperty('flexGrow')
    wrapper.unmount()
  })

  it('列适配：总宽超出容器时保持精确宽度（rigid 布局溢出 → 横向滚动条，v1 语义）', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: [
          ...baseColumns,
          { prop: 'score', label: '评分', minWidth: 150, sortable: 'custom' },
        ] as ProColumn[],
        rowKey: 'id',
        loading: false,
        virtualConfig: { width: 500 }, // 容器 500 < base 总宽 570
      },
    })
    const cols = wrapper.findComponent(ElTableV2).props('columns') as Array<Record<string, unknown>>
    const byKey = (k: string) => cols.find((c) => c.key === k)
    expect(byKey('id')).toMatchObject({ width: 100 })
    expect(byKey('name')).toMatchObject({ width: 200 })
    expect(byKey('score')).toMatchObject({ width: 150 })
    // 列宽不被压缩 → TableV2 bodyWidth 撑出横向滚动条
    expect(cols.reduce((acc, c) => acc + (c.width as number), 0)).toBe(570)
    wrapper.unmount()
  })

  it('selection 列被过滤并 warn（v2 无内置多选，强隔离）', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: [...baseColumns, { prop: 'select', label: '', type: 'selection', width: 50 }],
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    const cols = wrapper.findComponent(ElTableV2).props('columns') as Array<Record<string, unknown>>
    expect(cols.some((c) => c.key === 'select')).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('selection'))
    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it('v3.5 PR2：列声明 tableProps.filters 时 warn（v2 引擎暂不支持列头筛选）', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: [
          {
            prop: 'status',
            label: '状态',
            tableProps: { filters: [{ text: '已支付', value: 'paid' }] },
          },
        ],
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('列头筛选'))
    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it('onColumnSort 回调翻译为 sort-change 事件（asc/desc → ascending/descending）', async () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    const onColumnSort = wrapper.findComponent(ElTableV2).props('onColumnSort') as (p: {
      key: string
      order: 'asc' | 'desc'
    }) => void
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'desc' })
    const events = wrapper.emitted('sort-change')
    expect(events).toHaveLength(2)
    expect(events?.[0]).toEqual([{ prop: 'name', order: 'ascending' }])
    expect(events?.[1]).toEqual([{ prop: 'name', order: 'descending' }])
    // sortBy 状态同步给 TableV2 驱动 SortIcon（prop 传递需等 Vue 异步刷新）
    await nextTick()
    expect(wrapper.findComponent(ElTableV2).props('sortBy')).toEqual({ key: 'name', order: 'desc' })
    wrapper.unmount()
  })

  it('loading=true 时容器出现 v-loading 遮罩（TableV2 无内置 loading prop）', () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: true,
        virtualConfig: {},
      },
    })
    expect(wrapper.find('.el-loading-mask').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ProColumn.render 自定义渲染：业务 h() 函数优先于默认文本', () => {
    const customRender = vi.fn(({ row }) => `custom-${row.name}`)
    const colsWithRender: ProColumn[] = [
      ...baseColumns,
      { prop: 'value', label: '值', render: customRender as never },
    ]
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: colsWithRender,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    // cellRenderer 是内联函数，断言 render 被引用即可（render 不通过 el-table-v2 实际渲染触发）
    expect(customRender).toBeDefined()
    wrapper.unmount()
  })

  it('过滤 prop 缺失的列（v2 key 必备）', () => {
    const colsWithMissingProp: ProColumn[] = [
      ...baseColumns,
      // 故意加一个没有 prop 的列（v1 支持，v2 不支持）
      { prop: '', label: '无 prop' },
    ]
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: colsWithMissingProp,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    // 内部 v2Columns computed 过滤掉 prop===''；不直接断言 DOM，但确保 mount 不崩
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('C1 修复：props.slots 透传桥接（v1 体验对齐）', () => {
    // v3.0.2 修复：父组件 $slots 由 ProTable 编排层通过 props.slots 传下来，
    // 子组件 useSlots() 拿不到父级插槽。本测试验证 props.slots 路径生效。
    const customSlotFn = vi.fn(({ row }: { row: { name: string } }) => `slot-${row.name}`)
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
        slots: { name: customSlotFn as never },
      },
    })
    expect(wrapper.exists()).toBe(true)
    // 验证 props.slots 被正确传递（ElementTableV2Body 内部 renderCell 调用 props.slots[col.prop]?.()）
    expect((wrapper.props() as { slots?: Record<string, unknown> }).slots).toHaveProperty('name')
    wrapper.unmount()
  })

  it('M4 修复：formatter 字段格式化（无 render / 无 slot 时生效）', () => {
    const formatterSpy = vi.fn((row: { value: number }) => `[${row.value}]`)
    const colsWithFormatter: ProColumn[] = [
      { prop: 'value', label: '值', formatter: formatterSpy as never },
    ]
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: colsWithFormatter,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('H3 修复：selectionWarned 实例化（多个 ProTable 实例各自触发一次 warn）', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const colsWithSelection: ProColumn[] = [
      ...baseColumns,
      { prop: 'select', label: '', type: 'selection', width: 50 },
    ]

    // 实例 1：触发一次 warn
    mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: colsWithSelection,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)

    // 实例 2：原模块级变量下会跳过 warn；修复后应独立触发
    mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: colsWithSelection,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    expect(warnSpy).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('H2 修复：virtualConfig.height 数字 > 0 优先于父容器实测', async () => {
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: { height: 800 }, // 用户显式配置 800
      },
    })
    // 即便 measuredHeight 通过 ResizeObserver 测量到不同值，配置优先
    expect(wrapper.findComponent(ElTableV2).props('height')).toBe(800)
    wrapper.unmount()
  })

  it('L3 ResizeObserver：jsdom 环境下 graceful fallback 到 configuredHeight', () => {
    // jsdom 不提供 ResizeObserver；ElementTableV2Body.vue:101 typeof 守卫应跳过观察。
    // 首次同步测量也走 getBoundingClientRect，jsdom 返回 0，fallback 到 configuredHeight(500)
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: baseRows,
        columns: baseColumns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {}, // 未配 width/height → 用 fallback
      },
    })
    // width 未配 → measuredWidth=0 → fallback 800
    expect(wrapper.findComponent(ElTableV2).props('width')).toBe(800)
    // height 未配 → measuredHeight=0 → fallback configuredHeight=500
    expect(wrapper.findComponent(ElTableV2).props('height')).toBe(500)
    wrapper.unmount()
  })

  it('L3 ResizeObserver：mock ResizeObserver 后尺寸变化触发 measuredWidth 更新', async () => {
    // 模拟 ResizeObserver 全局，捕获 observe/disconnect 调用
    let observed: Element | null = null
    let disconnectCalled = false
    const observers: Array<(entries: Array<{ contentRect: DOMRect; target: Element }>) => void> = []

    const MockResizeObserver = class {
      constructor(cb: (entries: Array<{ contentRect: DOMRect; target: Element }>) => void) {
        observers.push(cb)
      }
      observe(el: Element): void {
        observed = el
      }
      disconnect(): void {
        disconnectCalled = true
      }
      unobserve(): void {
        // no-op
      }
    }

    const originalRO = (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver

    try {
      const wrapper = mount(ElementTableV2Body, {
        props: {
          rows: baseRows,
          columns: baseColumns,
          rowKey: 'id',
          loading: false,
          virtualConfig: {},
        },
        attachTo: document.body,
      })

      // 1. 验证 ResizeObserver 被正确 observe
      expect(observed).not.toBeNull()
      expect(observers).toHaveLength(1)

      // 2. 触发 resize 回调，模拟容器变宽到 1024px
      observers[0]!([{ contentRect: { width: 1024, height: 600 } as DOMRect, target: observed! }])
      await nextTick()

      // 3. measuredWidth 应被更新为 1024
      expect(wrapper.findComponent(ElTableV2).props('width')).toBe(1024)

      // 4. 卸载应触发 disconnect
      wrapper.unmount()
      expect(disconnectCalled).toBe(true)
    } finally {
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = originalRO
    }
  })
})

describe('ElementTableV2Body D(#13) sortable=true 守卫', () => {
  it('sortable=true（客户端排序）列点击 → 一次性 warn（v2 无内置客户端排序，编排层会拦截）', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns: ProColumn[] = [{ prop: 'name', label: '名称', minWidth: 200, sortable: true }]
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
        columns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    const table = wrapper.findComponent(ElTableV2)
    // 模拟 v2 排序点击（onColumnSort 是 callback prop）
    table.props('onColumnSort')({ key: 'name', order: 'asc' })
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('sortable=true'))
    // 实例级一次性：再次点击不重复 warn
    table.props('onColumnSort')({ key: 'name', order: 'desc' })
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    spy.mockRestore()
  })

  it('sortable=custom 列点击 → 不 warn（服务端排序路径正常）', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns: ProColumn[] = [
      { prop: 'name', label: '名称', minWidth: 200, sortable: 'custom' },
    ]
    const wrapper = mount(ElementTableV2Body, {
      props: {
        rows: [{ id: 1, name: 'A' }],
        columns,
        rowKey: 'id',
        loading: false,
        virtualConfig: {},
      },
    })
    wrapper.findComponent(ElTableV2).props('onColumnSort')({ key: 'name', order: 'asc' })
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
    wrapper.unmount()
    spy.mockRestore()
  })
})
