/**
 * useSearch —— 搜索参数状态管理（spec §六数据流 / §九错误处理 #10 / 附录 A #1/#3/#4）
 *
 * 职责：
 * - 初始化 searchParams（合并 defaultValue + initParam）
 * - search() / reset() / setSearchParams() / getParams()
 * - serializeParams() 剔除 undefined / null / 空字符串（保留 0/false，附录 A #10）
 *
 * **fetchHook 注入设计**（plan critical review #3 修正）：通过 options 显式传入，
 * 不从 props 读取（避免 Object.assign(props, ...) 反 Vue 单向数据流）。
 * ProTable.vue setup 时把 fetchHook 闭包传给 useSearch 与 useTable。
 *
 * @see [`./useTable`](./useTable.ts) 消费方（共享 fetchHook 闭包）
 * @group ProTable composables
 */
import { ref, type Ref } from 'vue'
import type { ProTableProps } from '../types'

/** fetchHook 回调签名 —— 由 ProTable.vue setup 注入 */
export type FetchHook = (opts?: { reset?: boolean }) => Promise<void>

/**
 * 序列化参数：剔除 undefined / null / 空字符串（保留 0/false，附录 A #10）。
 * 全库唯一实现 —— useTable 请求组装时复用（第 1 步单源化，消除双份拷贝）。
 */
export function serializeParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out
}

export interface UseSearchOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
  fetchHook?: FetchHook
}

export interface UseSearchReturn {
  searchParams: Ref<Record<string, unknown>>
  /** 触发搜索（保留多选，附录 A #1；保留分页） */
  search: () => Promise<void>
  /** 重置到 defaultValue + 回到第 1 页 + 刷新（保留多选，附录 A #1） */
  reset: () => Promise<void>
  /** 获取当前 searchParams 快照 */
  getParams: () => Record<string, unknown>
  /** 程序化设置搜索参数 + 回到第 1 页 + 刷新（保留多选，附录 A #3） */
  setSearchParams: (params: Record<string, unknown>) => Promise<void>
  /**
   * 纯写搜索参数（不触发请求）—— 供搜索区输入控件双向绑定。
   * H2 修复：输入与请求解耦，只有「搜索按钮 / reset / 程序化 setSearchParams」才发请求。
   */
  updateParams: (params: Record<string, unknown>) => void
  /** 序列化参数（re-export 模块级 serializeParams，向后兼容） */
  serializeParams: (params: Record<string, unknown>) => Record<string, unknown>
}

export function useSearch<T extends object = Record<string, unknown>>(
  options: UseSearchOptions<T>
): UseSearchReturn {
  const { props, fetchHook } = options

  // 1) 先收集所有 search 配置列的 prop + defaultValue，
  // 再以 initParam 覆盖合并 —— 同名键时「固定查询参数」作为字段初始值生效（不被 ?? null 抹掉）。
  // 修复（review R1）：原实现先 spread initParam 再被 `defaultValue ?? null` 无条件覆盖，
  // 导致与搜索列同名的 initParam 键被改写为 null、经 serializeParams 剔除后永久丢失。
  const initialForm: Record<string, unknown> = {}
  for (const col of props.columns) {
    if (col.search) {
      initialForm[col.prop] = col.search.defaultValue ?? null
    }
  }
  Object.assign(initialForm, props.initParam ?? {})

  /** searchParams —— 全库唯一真相源（useTable 通过 getSearchParams 读取） */
  const searchParams = ref<Record<string, unknown>>(initialForm)

  /** 获取当前 searchParams 快照 */
  function getParams(): Record<string, unknown> {
    return { ...searchParams.value }
  }

  /** 触发搜索：保留分页（spec §三搜索参数变化时回第 1 页只针对 setSearchParams/reset） */
  async function search(): Promise<void> {
    if (fetchHook) await fetchHook()
  }

  /** 重置：恢复 defaultValue + 回到第 1 页 + 刷新（附录 A #1 不清多选） */
  async function reset(): Promise<void> {
    // v3.2 升级：re-assign ref value 触发响应式（SelectedTags 等下游消费方能感知变化）
    // 原版 `searchParams.value[col.prop] = ...` 是原地 mutation，ref 的 .value
    // 引用不变，下游 computed（依赖 props.searchParams）不会重算。
    const resetParams: Record<string, unknown> = { ...searchParams.value }
    for (const col of props.columns) {
      if (col.search) {
        // 回退顺序：字段 defaultValue → initParam 同名键（固定参数 reset 后恢复）→ null
        resetParams[col.prop] = col.search.defaultValue ?? props.initParam?.[col.prop] ?? null
      }
    }
    searchParams.value = resetParams
    if (fetchHook) await fetchHook({ reset: true })
  }

  /** 纯写搜索参数（不触发请求）—— 供搜索区输入控件绑定 */
  function updateParams(params: Record<string, unknown>): void {
    // v3.2 升级：同上 re-assign 而非原地 mutation
    searchParams.value = { ...searchParams.value, ...params }
  }

  /** 程序化设置：合并 + 回到第 1 页 + 刷新（附录 A #3 不清多选） */
  async function setSearchParams(params: Record<string, unknown>): Promise<void> {
    updateParams(params)
    if (fetchHook) await fetchHook({ reset: true })
  }

  return {
    searchParams,
    search,
    reset,
    getParams,
    setSearchParams,
    updateParams,
    serializeParams,
  }
}
