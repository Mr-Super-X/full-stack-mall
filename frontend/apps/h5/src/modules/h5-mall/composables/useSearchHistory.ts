// ref 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 搜索历史（localStorage `mall:search-history`，上限 10 条，去重置顶）。
 * 隐私模式/SSR 下 localStorage 写入失败静默降级为内存态，不抛错打断搜索流程。
 */
const HISTORY_KEY = 'mall:search-history'
const HISTORY_LIMIT = 10

export function useSearchHistory(): {
  list: Ref<string[]>
  add: (keyword: string) => void
  clear: () => void
} {
  const list = ref<string[]>(readHistory())

  function readHistory(): string[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
    } catch {
      return []
    }
  }

  function persist(value: string[]): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(value))
    } catch {
      // 隐私模式/存储超限：内存态兜底，不抛错（读不出来的信息增量注释）
    }
  }

  /** 加入历史：trim、空跳过、去重置顶、上限裁剪；写失败静默降级 */
  function add(keyword: string): void {
    const kw = keyword.trim()
    if (!kw) return
    list.value = [kw, ...list.value.filter((k) => k !== kw)].slice(0, HISTORY_LIMIT)
    persist(list.value)
  }

  function clear(): void {
    list.value = []
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // 同上：写失败静默降级
    }
  }

  return { list, add, clear }
}
