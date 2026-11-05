/**
 * useStatePersist 单元测试 —— v3.1 搜索/分页/排序路由级持久化
 *
 * 覆盖矩阵：
 * - 未启用 / 未传 tableKey：read 恒 null、attach no-op（不抛错）
 * - alive 标记缺失（新会话）：read 返回 null 并清除旧快照
 * - alive 标记存在（路由返回）：read 返回 localStorage 快照
 * - 快照结构非法（version 不符/字段缺失）：read 返回 null 并清除
 * - attach 写 alive 标记 + 监听源变化写回 localStorage
 * - beforeunload 清除 alive（F5 刷新场景判定基础）
 * - scope dispose 清理 watcher 与 beforeunload 监听
 *
 * @group ProTable composables
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, effectScope, nextTick } from 'vue'
import { Local } from '@vv/shared'
import { useStatePersist, type PersistedTableState } from './useStatePersist'
import type { FilterValuesMap } from '../types'

const TABLE_KEY = 'test-table'

function makeSnapshot(overrides: Partial<PersistedTableState> = {}): PersistedTableState {
  return {
    version: 1,
    searchParams: { name: '张三' },
    page: 3,
    pageSize: 20,
    sortState: { prop: 'name', order: 'ascending' },
    ...overrides,
  }
}

/** 以独立 effectScope 包裹 attach（onScopeDispose 依赖组件上下文） */
function attachInScope(sources: Parameters<ReturnType<typeof useStatePersist>['attach']>[0]) {
  const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
  const scope = effectScope()
  // D(#9)：filterState 缺省 {} —— 旧调用方（v1 时代的测试）无筛选源时自动补齐
  scope.run(() => persist.attach({ filterState: ref({}), ...sources }))
  return { persist, dispose: () => scope.stop() }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('read 恢复时机', () => {
  it('未启用返回 null', () => {
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: false })
    sessionStorage.setItem(`${TABLE_KEY}:state-alive`, '1')
    Local.set(`${TABLE_KEY}:state`, makeSnapshot())
    expect(persist.read()).toBeNull()
  })

  it('未传 tableKey 返回 null', () => {
    const persist = useStatePersist({ tableKey: undefined, enabled: true })
    expect(persist.read()).toBeNull()
  })

  it('alive 标记缺失（F5 刷新场景）：返回 null 并清除旧快照', () => {
    Local.set(`${TABLE_KEY}:state`, makeSnapshot())
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
    expect(persist.read()).toBeNull()
    expect(Local.get(`${TABLE_KEY}:state`)).toBeNull()
  })

  it('alive 标记存在（路由返回场景）：返回快照', () => {
    const snapshot = makeSnapshot()
    sessionStorage.setItem(`${TABLE_KEY}:state-alive`, '1')
    Local.set(`${TABLE_KEY}:state`, snapshot)
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
    expect(persist.read()).toEqual(snapshot)
  })

  it('快照结构非法：返回 null 并清除', () => {
    sessionStorage.setItem(`${TABLE_KEY}:state-alive`, '1')
    Local.set(`${TABLE_KEY}:state`, { version: 99, page: 'x' })
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
    expect(persist.read()).toBeNull()
    expect(Local.get(`${TABLE_KEY}:state`)).toBeNull()
  })
})

describe('attach 写回', () => {
  it('attach 写入 alive 标记', () => {
    const { dispose } = attachInScope({
      searchParams: ref({}),
      page: ref(1),
      pageSize: ref(10),
      sortState: ref(null),
    })
    expect(sessionStorage.getItem(`${TABLE_KEY}:state-alive`)).toBe('1')
    dispose()
  })

  it('分页变化写回 localStorage 快照', async () => {
    const page = ref(1)
    const { dispose } = attachInScope({
      searchParams: ref({}),
      page,
      pageSize: ref(10),
      sortState: ref(null),
    })
    page.value = 5
    await nextTick()
    const saved = Local.get(`${TABLE_KEY}:state`) as PersistedTableState
    expect(saved.page).toBe(5)
    dispose()
  })

  it('搜索参数 / 排序变化写回快照', async () => {
    const searchParams = ref<Record<string, unknown>>({})
    const sortState = ref<PersistedTableState['sortState']>(null)
    const { dispose } = attachInScope({
      searchParams,
      page: ref(1),
      pageSize: ref(10),
      sortState,
    })
    searchParams.value = { status: 1 }
    sortState.value = { prop: 'amount', order: 'descending' }
    await nextTick()
    const saved = Local.get(`${TABLE_KEY}:state`) as PersistedTableState
    expect(saved.searchParams).toEqual({ status: 1 })
    expect(saved.sortState).toEqual({ prop: 'amount', order: 'descending' })
    dispose()
  })

  it('beforeunload 清除 alive（刷新后下次进入不恢复的判定基础）', () => {
    const { dispose } = attachInScope({
      searchParams: ref({}),
      page: ref(1),
      pageSize: ref(10),
      sortState: ref(null),
    })
    expect(sessionStorage.getItem(`${TABLE_KEY}:state-alive`)).toBe('1')
    window.dispatchEvent(new Event('beforeunload'))
    expect(sessionStorage.getItem(`${TABLE_KEY}:state-alive`)).toBeNull()
    dispose()
  })

  it('scope dispose 清理 beforeunload 监听与 watcher', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const page = ref(1)
    const { dispose } = attachInScope({
      searchParams: ref({}),
      page,
      pageSize: ref(10),
      sortState: ref(null),
    })
    dispose()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    // dispose 后翻页不再写回
    localStorage.clear()
    page.value = 9
    await nextTick()
    expect(Local.get(`${TABLE_KEY}:state`)).toBeNull()
  })

  it('未启用时 attach 为 no-op（不写 alive / localStorage）', () => {
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: false })
    const scope = effectScope()
    scope.run(() =>
      persist.attach({
        searchParams: ref({}),
        page: ref(1),
        pageSize: ref(10),
        sortState: ref(null),
      })
    )
    expect(sessionStorage.getItem(`${TABLE_KEY}:state-alive`)).toBeNull()
    scope.stop()
  })
})

describe('D(#9) filterState 参与路由级持久化', () => {
  it('attach 写回 v2 快照含 filterState（version 升 2）', async () => {
    const filterState = ref<FilterValuesMap>({ status: ['paid'] })
    const page = ref(1)
    const { dispose } = attachInScope({
      searchParams: ref({}),
      page,
      pageSize: ref(10),
      sortState: ref(null),
      filterState,
    })
    // 触发一次变更（watch 非 immediate）——筛选变化驱动写回
    filterState.value = { status: ['paid', 'refunded'] }
    await nextTick()
    const snap = Local.get(`${TABLE_KEY}:state`) as Record<string, unknown>
    expect(snap['version']).toBe(2)
    expect(snap['filterState']).toEqual({ status: ['paid', 'refunded'] })
    dispose()
  })

  it('v1 旧快照（无 filterState）读时向后兼容——恢复为 filterState {}', () => {
    sessionStorage.setItem(`${TABLE_KEY}:state-alive`, '1')
    // v1 旧快照结构（PR2 之前的持久化数据）：无 filterState 字段
    Local.set(`${TABLE_KEY}:state`, {
      version: 1,
      searchParams: {},
      page: 2,
      pageSize: 20,
      sortState: null,
    })
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
    const snap = persist.read()
    expect(snap?.page).toBe(2) // 其余字段照常恢复
    expect(snap?.filterState ?? {}).toEqual({}) // 筛选缺省为空（不报错不丢其余状态）
  })

  it('v2 快照 filterState 类型非法 → 视为无快照（fail-safe 一致性）', () => {
    sessionStorage.setItem(`${TABLE_KEY}:state-alive`, '1')
    Local.set(`${TABLE_KEY}:state`, {
      ...makeSnapshot({ version: 2 as never }),
      filterState: 'bad' as never,
    })
    const persist = useStatePersist({ tableKey: TABLE_KEY, enabled: true })
    expect(persist.read()).toBeNull()
  })
})
