/**
 * useColumns composable 单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) allColumns 返回所有列（含隐藏）
 * 2) sortedColumns 排除 hidden=true 的列
 * 3) searchColumns 仅返回带 search 配置的列
 * 4) toggleVisible 切换 hidden
 * 5) setColumnOrder 重新排序（含持久化 order 存在时的回归：拖拽后 sortedColumns 必须按新顺序渲染）
 * 6) resetToDefault 恢复默认列顺序
 *
 * @group ProTable composables 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useColumns } from './useColumns'
import { Local } from '@vv/shared'

// mock Local（plan critical review #5：Local 不在 auto-import，显式 mock 模块）；
// 说明符 '@utils/storage' 经 codemod 收敛为 '@vv/shared' barrel（2026-10-26）——
// 单点 mock 须 importOriginal 展开其余导出
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual,
    Local: {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    },
  }
})

describe('useColumns', () => {
  const makeProps = () =>
    ({
      columns: [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B', hidden: false },
        { prop: 'c', label: 'C' },
      ],
      tableKey: 'test',
    }) as never

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认无持久化数据（单测内可单独覆盖 mockReturnValue）
    vi.mocked(Local.get).mockReturnValue(null)
  })

  it('allColumns 返回所有列（含隐藏）', () => {
    const cols = useColumns({ props: makeProps() })
    expect(cols.allColumns.value).toHaveLength(3)
  })

  it('sortedColumns 排除 hidden=true 的列', () => {
    const props = {
      columns: [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B', hidden: true },
        { prop: 'c', label: 'C' },
      ],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'c'])
  })

  it('searchColumns 仅返回带 search 配置的列', () => {
    const props = {
      columns: [
        { prop: 'a', label: 'A', search: { el: 'input' } },
        { prop: 'b', label: 'B' },
      ],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })
    expect(cols.searchColumns.map((c) => c.prop)).toEqual(['a'])
  })

  it('toggleVisible 切换 hidden', () => {
    const cols = useColumns({ props: makeProps() })
    cols.toggleVisible('a')
    expect(cols.sortedColumns.value.find((c) => c.prop === 'a')).toBeUndefined()
  })

  it('setColumnOrder 重新排序（同步 allColumns 与 sortedColumns）', () => {
    const cols = useColumns({ props: makeProps() })
    cols.setColumnOrder(['c', 'a', 'b'])
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['c', 'a', 'b'])
    expect(cols.allColumns.value.map((c) => c.prop)).toEqual(['c', 'a', 'b'])
  })

  it('回归：存在持久化 order 时，setColumnOrder 后 sortedColumns 仍按新顺序渲染', () => {
    // 历史 bug：sortedColumns 按 setup 时的一次性 persisted.order 快照排序（非响应式），
    // 拖拽更新 allColumns 后表格仍按旧顺序渲染
    vi.mocked(Local.get).mockReturnValue({ order: ['a', 'b', 'c'] })
    const cols = useColumns({ props: makeProps() })
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'b', 'c'])
    cols.setColumnOrder(['b', 'c', 'a'])
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['b', 'c', 'a'])
  })

  it('setColumnOrder 容忍 order 缺失的列（按原相对顺序追加到尾部）', () => {
    const cols = useColumns({ props: makeProps() })
    cols.setColumnOrder(['c', 'a'])
    expect(cols.allColumns.value.map((c) => c.prop)).toEqual(['c', 'a', 'b'])
  })

  it('resetToDefault 恢复默认列顺序', () => {
    vi.mocked(Local.get).mockReturnValue({ order: ['c', 'b', 'a'] })
    const cols = useColumns({ props: makeProps() })
    cols.setColumnOrder(['b', 'c', 'a'])
    cols.resetToDefault()
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'b', 'c'])
  })

  it('review R11 回归：resetToDefault 后 searchColumns 与 allColumns 同源（非旧克隆快照）', () => {
    const props = {
      columns: [
        { prop: 'a', label: 'A', search: { el: 'input' } },
        { prop: 'b', label: 'B' },
      ],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })
    const before = cols.searchColumns[0]
    cols.resetToDefault()
    // 修复前：searchColumns 持有 reset 前的旧克隆对象；修复后：与 allColumns 同源于新克隆
    expect(cols.searchColumns[0]).not.toBe(before)
    expect(cols.searchColumns[0]).toBe(cols.allColumns.value[0])
    expect(cols.searchColumns.map((c) => c.prop)).toEqual(['a'])
  })

  it('H1 回归：未传 tableKey（无持久化）时 resetToDefault 仍重置内存状态', () => {
    // ColSetting 抽屉「恢复默认」按钮无条件渲染；早期实现 storageKey 为空时整体
    // return，导致无持久化场景下点击按钮毫无效果（内存列序/可见性不重置）。
    const props = {
      columns: [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
        { prop: 'c', label: 'C' },
      ],
      // 故意不传 tableKey
    } as never
    const cols = useColumns({ props })

    cols.setColumnOrder(['b', 'c', 'a'])
    cols.toggleVisible('a')
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['b', 'c'])

    cols.resetToDefault()

    // 内存状态全部回到初始（且不应抛错 / 不应写 localStorage）
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'b', 'c'])
    expect(cols.visibleKeys.value).toEqual(['a', 'b', 'c'])
    expect(Local.remove).not.toHaveBeenCalled()
  })

  it('M2：toggleVisible/toggleFixed 不修改外部 columns 常量（props 保护）', () => {
    const externalColumns = [
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: 'left' as const },
    ]
    const props = { columns: externalColumns, tableKey: 't' } as never
    const cols = useColumns({ props })

    cols.toggleVisible('a') // 隐藏 a
    cols.toggleFixed('b', 'right') // 改 b 的固定方向

    // 外部常量：结构与原值完全一致（hidden/fixed 均未被原地改写）
    expect(externalColumns).toEqual([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: 'left' },
    ])
    // 副本已生效：a 隐藏、b 固定到 right
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['b'])
    expect(cols.allColumns.value.find((c) => c.prop === 'b')?.fixed).toBe('right')
  })

  it('M2：两个实例共享同一 columns 常量时互不污染', () => {
    const sharedColumns = [
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B' },
    ]
    const props = { columns: sharedColumns, tableKey: 't' } as never
    const first = useColumns({ props })
    const second = useColumns({ props })

    first.toggleVisible('a')

    // 第二个实例的 a 列仍可见；外部常量也未变
    expect(second.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'b'])
    expect(sharedColumns.every((c) => c.hidden === undefined)).toBe(true)
  })

  it('v2.2-M1：加载持久化时回填 visible/fixed（列设置完整恢复）', () => {
    vi.mocked(Local.get).mockReturnValue({
      order: ['b', 'a', 'c'],
      visible: { a: true, b: false, c: true },
      fixed: { c: 'left' },
    })
    const cols = useColumns({ props: makeProps() })
    // visible 回填：b 不可见（order b,a,c 中 b 被过滤）
    expect(cols.visibleKeys.value).toEqual(['a', 'c'])
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a', 'c'])
    // fixed 回填：c 列固定到 left
    expect(cols.fixedKeys.value).toEqual(['c'])
    expect(cols.allColumns.value.find((c) => c.prop === 'c')?.fixed).toBe('left')
  })

  it('v2.2-M1：抽屉取消勾选后 persist 的 visible 与回填语义一致（round-trip）', () => {
    const cols = useColumns({ props: makeProps() })
    cols.setVisibleKeys(['a', 'c']) // 抽屉取消勾选 b
    const saved = vi.mocked(Local.set).mock.calls.at(-1)?.[1] as {
      visible: Record<string, boolean>
    }
    expect(saved.visible).toEqual({ a: true, b: false, c: true })
  })

  it('v2.2-M1：persisted.fixed 未收录的列恢复为不固定（覆盖 props 初始 fixed）', () => {
    // 场景：列 a 初始 fixed:'left'，用户在抽屉取消固定后 persist 的 fixed 为空对象，
    // 刷新后 a 不得回移为固定
    vi.mocked(Local.get).mockReturnValue({ fixed: {} })
    const props = {
      columns: [
        { prop: 'a', label: 'A', fixed: 'left' as const },
        { prop: 'b', label: 'B' },
      ],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })
    expect(cols.allColumns.value.find((c) => c.prop === 'a')?.fixed).toBeUndefined()
    expect(cols.fixedKeys.value).toEqual([])
  })

  it('v2.2-M1：resetToDefault 同步重置 fixedKeys（与列副本口径一致）', () => {
    vi.mocked(Local.get).mockReturnValue({ fixed: { b: 'left' } })
    const cols = useColumns({ props: makeProps() })
    expect(cols.fixedKeys.value).toEqual(['b'])
    cols.resetToDefault()
    // makeProps 无初始 fixed：恢复默认后 fixedKeys 应为空
    expect(cols.fixedKeys.value).toEqual([])
  })

  it('M2：外部 Ref<boolean> hidden 保持联动，手动 toggle 后本地优先', () => {
    const externalHidden = ref(false)
    const props = {
      columns: [{ prop: 'a', label: 'A', hidden: externalHidden }],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })

    // 外部程序化隐藏 → 副本联动（sortedColumns 排除 a）
    externalHidden.value = true
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual([])
    // 手动 toggle（用户经列设置面板）→ 本地优先于外部值，恢复显示
    cols.toggleVisible('a')
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['a'])
    // 外部 ref 本身不被改写
    expect(externalHidden.value).toBe(true)
  })

  // v3.0 C1 修复：resetToDefault 不破坏外部 Ref 响应性
  it('C1：resetToDefault 后外部 Ref<boolean> hidden 仍保持联动', () => {
    const externalHidden = ref(false)
    const props = {
      columns: [{ prop: 'name', label: 'Name', hidden: externalHidden }],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })

    // reset 前：外部隐藏 → 联动排除
    externalHidden.value = true
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual([])

    // 关键操作：resetToDefault 必须保留外部 Ref 响应性
    cols.resetToDefault()

    // reset 后：外部 ref 改回 false → 副本应再次显示
    externalHidden.value = false
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual(['name'])

    // 外部 ref 再次变 true → 副本应再次隐藏
    externalHidden.value = true
    expect(cols.sortedColumns.value.map((c) => c.prop)).toEqual([])
  })

  // v3.0 C2 修复：动态 Ref 列不污染 persist 持久化
  it('C2：外部 Ref<boolean> hidden 变化不写入 persist（仅静态列参与持久化）', () => {
    const externalHidden = ref(false)
    const props = {
      columns: [
        { prop: 'static1', label: 'Static1' },
        { prop: 'dynamic', label: 'Dynamic', hidden: externalHidden },
      ],
      tableKey: 't',
    } as never
    const cols = useColumns({ props })

    // 触发 persist：调用 setVisibleKeys 或其他写入路径
    cols.setVisibleKeys(['static1', 'dynamic'])
    const saved = vi.mocked(Local.set).mock.calls.at(-1)?.[1] as {
      visible: Record<string, boolean>
    }

    // 关键断言：persist 的 visible 仅含静态列，动态 Ref 列被排除
    expect(saved.visible).toEqual({ static1: true })
    expect('dynamic' in saved.visible).toBe(false)
  })
})
