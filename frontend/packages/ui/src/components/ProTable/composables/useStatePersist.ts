/**
 * useStatePersist —— 搜索参数 / 分页 / 排序状态的路由级持久化（v3.1 新增）。
 *
 * 解决场景：列表页 → 详情页 → 返回列表，搜索条件、页码、排序全部丢失需重填。
 * 依赖 tableKey 作为存储 key（与 useColumns 列设置持久化同一约定，互不干扰）。
 *
 * 恢复时机判定（用户决策：浏览器刷新不恢复，路由返回恢复）：
 * - localStorage 存状态快照；sessionStorage 存 alive 标记
 * - 组件 mounted 后写 alive 标记；window beforeunload（F5 刷新 / 关闭标签页）清标记
 * - 路由跳走组件卸载不触发 beforeunload → alive 保留 → 返回时 read() 命中 → 恢复快照
 * - F5 刷新触发 beforeunload → alive 已清 → read() 未命中 → 视为新会话，旧快照一并清除
 * - sessionStorage 按标签页隔离：新开标签页打开同页不会误恢复
 *
 * 时序约束：read() 必须在 useTable 创建之前同步调用（快照作为 initialState
 * 注入 ref 初值，避开 useTable 内 page watcher 双发问题）；attach() 在 setup 期
 * （read 之后、首次请求发出前）同步调用一次（D#17 修订：旧注释称「mounted 后」，
 * 实际 ProTable.vue setup 内同步调用 —— 写回监听须在用户交互前挂上）。
 * 首个 watch flush（post）时若状态已变也会写回，挂载时序不影响持久化完整性。
 *
 * v3.1.1 review 优化：
 * - 原实现 4 个独立 watch（searchParams/page/pageSize/sortState），各自触发 persist，
 *   高频搜索场景会出现"searchParams 变 + page 变"连续两次 JSON.stringify + Local.set
 * - 合并为单一 watch 监听 ref 数组 + `flush: 'post'`，同帧（microtask）多次变更合并为 1 次
 *
 * @see [`./useColumns`](./useColumns.ts) 同一 tableKey 存储约定（`:columns` 后缀）
 * @group ProTable composables
 */
import { watch, onScopeDispose, type Ref } from 'vue' // vue（生命周期/底层 API）
import { Local } from '@vv/shared' // 与 useColumns 同款封装（plan critical review #5）
import type { SortState, FilterValuesMap } from '../types'

/**
 * 快照结构 —— version 字段用于迁移：
 * - v1（v3.5 PR2 之前）：searchParams / page / pageSize / sortState，无筛选状态
 * - v2（D#9 起）：追加 filterState（列头筛选成一等持久化状态，与 sortState 待遇对等）。
 *   filterState 可选字段 —— v1 旧快照读时向后兼容（消费方 `?? {}` 缺省空筛选）
 */
export interface PersistedTableState {
  version: 1 | 2
  searchParams: Record<string, unknown>
  page: number
  pageSize: number
  sortState: SortState | null
  filterState?: FilterValuesMap
}

export interface UseStatePersistOptions {
  /** 存储 key 前缀（props.tableKey）；空串/undefined 时全部操作 no-op（未传 tableKey 不持久化） */
  tableKey: string | undefined
  /** 是否启用（props.statePersist） */
  enabled: boolean
}

/** attach 的监听源 —— 全部经 Ref 注入，composable 不感知 useSearch/useTable 内部结构 */
export interface PersistSources {
  searchParams: Ref<Record<string, unknown>>
  page: Ref<number>
  pageSize: Ref<number>
  sortState: Ref<SortState | null>
  /** D(#9)：列头筛选状态（filterState）—— v3.5 PR2 后筛选成一等状态，持久化与 sortState 对等 */
  filterState: Ref<FilterValuesMap>
}

export interface UseStatePersistReturn {
  /**
   * 读取快照 —— setup 早期同步调用。
   * @returns 命中（alive 标记在 + 快照结构合法）返回快照；否则 null（新会话/未启用/未传 tableKey）
   */
  read: () => PersistedTableState | null
  /** 挂载写回监听 —— mounted 后调用一次；未启用 / 未传 tableKey 时 no-op */
  attach: (sources: PersistSources) => void
}

export function useStatePersist(options: UseStatePersistOptions): UseStatePersistReturn {
  const active = Boolean(options.enabled && options.tableKey)
  const stateKey = active ? `${options.tableKey}:state` : ''
  const aliveKey = active ? `${options.tableKey}:state-alive` : ''

  /** sessionStorage 原生访问 —— 项目 Local 封装仅覆盖 localStorage；隐私模式可能抛错，整体 try 防御 */
  function readAlive(): boolean {
    try {
      return window.sessionStorage.getItem(aliveKey) === '1'
    } catch {
      return false
    }
  }
  function writeAlive(): void {
    try {
      window.sessionStorage.setItem(aliveKey, '1')
    } catch {
      /* 存储不可用时降级为「永不恢复」，不阻断表格主流程 */
    }
  }
  function clearAlive(): void {
    try {
      window.sessionStorage.removeItem(aliveKey)
    } catch {
      /* 同 readAlive */
    }
  }

  /** 快照结构校验（fail-safe：字段缺失/类型不符一律视为无快照，不部分恢复）。
   *  D(#9)：version 1（v1 旧结构，无 filterState）与 2 均合法；v2 若带 filterState 必须是对象 */
  function isValidSnapshot(raw: unknown): raw is PersistedTableState {
    if (!raw || typeof raw !== 'object') return false
    const s = raw as Record<string, unknown>
    const versionOk = s.version === 1 || s.version === 2
    const filterStateOk = s.filterState === undefined || typeof s.filterState === 'object'
    return (
      versionOk &&
      filterStateOk &&
      typeof s.searchParams === 'object' &&
      s.searchParams !== null &&
      typeof s.page === 'number' &&
      typeof s.pageSize === 'number' &&
      (s.sortState === null || typeof s.sortState === 'object')
    )
  }

  function read(): PersistedTableState | null {
    if (!active) return null
    if (!readAlive()) {
      // 新会话（F5 刷新 / 新标签页）：旧快照语义已过期，清除避免后续误恢复
      Local.remove(stateKey)
      return null
    }
    const raw: unknown = Local.get(stateKey)
    if (!isValidSnapshot(raw)) {
      Local.remove(stateKey)
      return null
    }
    return raw
  }

  function attach(sources: PersistSources): void {
    if (!active) return
    writeAlive()

    /** 合并写回（单一写入点，避免多 watcher 各自序列化） */
    function persist(): void {
      const snapshot: PersistedTableState = {
        version: 2,
        searchParams: { ...sources.searchParams.value },
        page: sources.page.value,
        pageSize: sources.pageSize.value,
        sortState: sources.sortState.value,
        filterState: { ...sources.filterState.value },
      }
      Local.set(stateKey, snapshot)
    }

    /**
     * 5 个 ref 合并为单一 watch，flush: 'post' 让同帧（microtask）多次变更合并为 1 次回调。
     * 例：用户修改 searchParams 后点击搜索按钮（触发 page 变化）→ microtask 内仅 1 次 persist。
     * deep: true 保留 searchParams 内部字段变化的响应性。
     */
    const stop = watch(
      [
        sources.searchParams,
        sources.page,
        sources.pageSize,
        sources.sortState,
        sources.filterState,
      ],
      persist,
      { deep: true, flush: 'post' }
    )

    // 刷新 / 关闭标签页：清 alive → 下次进入视为新会话不恢复。
    // 路由跳走（组件卸载）不触发 beforeunload，alive 保留，返回时恢复
    window.addEventListener('beforeunload', clearAlive)
    onScopeDispose(() => {
      stop()
      window.removeEventListener('beforeunload', clearAlive)
    })
  }

  return { read, attach }
}
