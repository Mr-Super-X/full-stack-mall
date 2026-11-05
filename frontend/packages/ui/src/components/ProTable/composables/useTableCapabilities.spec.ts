/**
 * useTableCapabilities 单元测试
 *
 * 验证：4 能力条件启用 / 启动校验 / v2 expose 方法转发
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useTableCapabilities } from './useTableCapabilities'

describe('useTableCapabilities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('所有能力 prop 未启用时 4 个 composable 全部为 null', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(result.rowEdit).toBeNull()
    expect(result.treeData).toBeNull()
    expect(result.cellSpan).toBeNull()
    expect(result.rowDrag).toBeNull()
  })

  it('enableRowEdit=true 时 rowEdit composable 被实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableRowEdit: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(result.rowEdit).not.toBeNull()
  })

  it('enableRowEdit=false 时 rowEdit composable 不实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableRowEdit: false,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(result.rowEdit).toBeNull()
  })

  it('enableCellSpan=true 时 cellSpan composable 被实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableCellSpan: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(result.cellSpan).not.toBeNull()
  })

  it('extendedExpose.startEdit 在 rowEdit 未启用时为 noop', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(() => result.extendedExpose.startEdit('row-1')).not.toThrow()
  })

  it('extendedExpose.saveEdit 在 rowEdit 未启用时返回 false', async () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    const r = await result.extendedExpose.saveEdit('row-1')
    expect(r).toBe(false)
  })

  it('extendedExpose.expandNode 在 treeData 未启用时为 noop', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
    })
    expect(() => result.extendedExpose.expandNode('row-1')).not.toThrow()
    expect(() => result.extendedExpose.collapseNode('row-1')).not.toThrow()
  })

  it('extendedExpose.setRowOrder 在未挂载 table 时为 noop', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref(null) },
    })
    expect(() => result.extendedExpose.setRowOrder([])).not.toThrow()
  })

  /* ── v3.5 PR1-B：vxe 引擎能力矩阵（树形 + 拖拽均补齐） ── */

  it('vxe 引擎 + enableTree：treeData 正常实例化（v3.5 PR1-B 补齐树形）', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableTree: { defaultExpandDepth: 1 },
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(result.treeData).not.toBeNull()
  })

  it('vxe 引擎 + enableRowDrag：rowDrag 正常实例化（v3.5 PR1-B 补齐拖拽）', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableRowDrag: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(result.rowDrag).not.toBeNull()
  })

  it('vxe 引擎 + enableTree + enableRowDrag 三者共存：hotfix-7 取消守卫后双能力均挂载', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableTree: true,
        enableRowDrag: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    // v3.5 hotfix-7 取消 isVxeTreeConflict 守卫（vxe 行结构修复后实测 sortablejs 可挂载），
    // treeData 仍生效；rowDrag 也正常挂载，不再降级 null
    expect(result.treeData).not.toBeNull()
    expect(result.rowDrag).not.toBeNull()
  })

  it('vxe 引擎 + enableRowEdit：rowEdit 正常实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableRowEdit: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(result.rowEdit).not.toBeNull()
  })

  it('vxe 引擎 + enableCellSpan：cellSpan 正常实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableCellSpan: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(result.cellSpan).not.toBeNull()
  })

  it('element 引擎 + enableTree：不受 vxe 忽略逻辑影响，treeData 正常实例化', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableTree: { defaultExpandDepth: 1 },
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('element-plus'),
    })
    expect(result.treeData).not.toBeNull()
  })

  // v3.5 PR1-B：vxe + 树形 + 拖拽 三者冲突 → setup 立即 warn；纯树形/纯拖拽不再 warn
  it('vxe 引擎 + enableTree + enableRowDrag 时 setup 立即 warn（三者冲突）', () => {
    useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableTree: true,
        enableRowDrag: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    // setup 同步调用 → debug 立即记录（v3.5 hotfix-3：warn 降级 debug，减少 demo 噪音）
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎 + 树形 + 行拖拽 同时启用')
    )
  })

  it('vxe 引擎 + 纯 enableTree 时不 warn（v3.5 PR1-B 起 vxe 支持树形）', () => {
    useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableTree: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎暂不支持树形')
    )
  })

  it('vxe 引擎 + 纯 enableRowDrag 时不 warn（v3.5 PR1-B 起 vxe 支持拖拽）', () => {
    useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableRowDrag: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎暂不支持行拖拽')
    )
  })
})

describe('useTableCapabilities D(#4/#10) vxe 汇总守卫 + 拖拽文案', () => {
  // 本 describe 为顶层独立块 —— 自带 console spy（主 describe 的 beforeEach 不覆盖此处）
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D(#4)：vxe 引擎 + enableSummary → warn + summary 不实例化（VxeTableBody 无汇总渲染接线）', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableSummary: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(result.summary).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('enableSummary'))
  })

  it('D(#4)：element-plus 引擎 + enableSummary → summary 正常实例化（回归）', () => {
    const result = useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        enableSummary: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('element-plus'),
    })
    expect(result.summary).not.toBeNull()
  })

  it('D(#10)：vxe+树形+拖拽 的 debug 文案为「兼容性观察中」（不再谎称已忽略行拖拽）', () => {
    useTableCapabilities({
      props: {
        columns: [],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
        tableEngine: 'vxe-table',
        enableTree: true,
        enableRowDrag: true,
      } as never,
      columns: { allColumns: ref([]) },
      table: { data: ref([]) },
      engine: ref('vxe-table'),
    })
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('vxe-table 引擎 + 树形 + 行拖拽 同时启用')
    )
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('兼容性观察中'))
    // 旧文案「已自动忽略行拖拽」与实现矛盾（hotfix-7 起拖拽照常挂载），不得再出现
    const allArgs = (console.debug as ReturnType<typeof vi.fn>).mock.calls.flat()
    expect(allArgs.some((a) => String(a).includes('已自动忽略行拖拽'))).toBe(false)
  })
})
