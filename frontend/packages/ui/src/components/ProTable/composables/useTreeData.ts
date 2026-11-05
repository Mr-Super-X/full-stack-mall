import { DEFAULT_ROW_KEY } from '../types' // 行 key 缺省值单一来源（review R7）
import type { TreeConfig } from '../types'
/** 树形数据节点结构 —— ProTable 内部状态字段以 _ 开头（业务不应读写）@group ProTable Composables */
export interface TreeNode extends Record<string, unknown> {
  id: string | number
  children?: TreeNode[]
  _hasChildren?: boolean
  _loaded?: boolean
  _level?: number
  /** v3.5 hotfix-8：父数组引用（dfs / lazy load 时注入）—— 用于嵌套数据拖拽 splice 定位 parent.children @group ProTable Composables */
  _parent?: TreeNode[]
}
/** 树形数据 composable（spec §5.2）@group ProTable Composables */
export function useTreeData(config: TreeConfig) {
  const expanded = ref<Set<string | number>>(new Set())
  const loading = ref<Set<string | number>>(new Set())
  const timers = new Map<string | number, ReturnType<typeof setTimeout>>()
  const cKey = config.childrenKey ?? 'children',
    rKey = config.rowKey ?? DEFAULT_ROW_KEY,
    dExp = config.defaultExpandDepth ?? 0
  const roots: TreeNode[] = []
  const seek = (
    k: string | number,
    ns: TreeNode[],
    acc: TreeNode[] = []
  ): { node: TreeNode; path: TreeNode[] } | null => {
    for (const n of ns) {
      if (n[rKey] === k) return { node: n, path: acc }
      if (n[cKey]) {
        const r = seek(k, n[cKey] as TreeNode[], [...acc, n])
        if (r) return r
      }
    }
    return null
  }
  const dfs = (ns: TreeNode[], lv: number, onVisit: (n: TreeNode, lv: number) => void): void => {
    for (const n of ns) {
      onVisit(n, lv)
      if (n[cKey] && Array.isArray(n[cKey])) {
        // v3.5 hotfix-8：给每个子节点注入 _parent 引用，便于 useRowDrag 嵌套 splice
        // （拖拽嵌套数据时 splice parent.children 数组而非 data 顶层）
        ;(n[cKey] as TreeNode[]).forEach((c) => {
          c._parent = n[cKey] as TreeNode[]
        })
        dfs(n[cKey] as TreeNode[], lv + 1, onVisit)
      }
    }
  }
  /** 触发 expanded 响应式（Set 的 add/delete 不会自动通知 ref，必须替换整个 Set） */
  const touchExpanded = (): void => {
    expanded.value = new Set(expanded.value)
  }
  /**
   * v2.0 扁平化树形数据：按 expanded 状态生成 el-table 可用的扁平数组
   * - 节点 _level=0 总是展示
   * - 已展开节点的 children 加入扁平数组（递归）
   * - 未展开节点的 children 不展示
   */
  const flatten = (ns: TreeNode[], out: TreeNode[]): void => {
    for (const n of ns) {
      out.push(n)
      if (expanded.value.has(n[rKey] as string | number) && n[cKey] && Array.isArray(n[cKey])) {
        flatten(n[cKey] as TreeNode[], out)
      }
    }
  }
  // flatData 为 computed：expanded Set 变化（touchExpanded 替换实例）即自动重算，
  // 消费方（ProTable 模板 / 行拖拽视图行映射）无须手动调 flattenData()（H4 归位）
  const flatData = computed<TreeNode[]>(() => {
    const out: TreeNode[] = []
    flatten(roots, out)
    return out
  })
  return {
    normalize(data: TreeNode[]) {
      roots.length = 0
      roots.push(...data)
      dfs(data, 0, (n, lv) => {
        n._level = lv
        if (dExp > 0 && lv <= dExp) expanded.value.add(n[rKey] as string | number)
      })
      touchExpanded() // 触发响应式
      // v2.0 修复：默认展开 + 搜索命中的节点若 _hasChildren=true 且未加载，自动触发懒加载（spec §5.2）
      for (const key of [...expanded.value]) {
        const r = seek(key, roots)
        if (r?.node._hasChildren && !r.node._loaded && config.loadChildren) {
          void config
            .loadChildren(r.node)
            .then((children) => {
              r.node[cKey] = children as TreeNode[]
              for (const c of children) {
                c._level = (r.node._level ?? 0) + 1
                // v3.5 hotfix-8：lazy load 子节点也注入 _parent 引用（与 dfs 同步）
                c._parent = children as TreeNode[]
              }
              r.node._loaded = true
              touchExpanded() // 触发响应式（flatData 重新计算）
            })
            .catch((err: unknown) => {
              console.error('[useTreeData] normalize auto load failed:', err)
            })
        }
      }
      return data
    },
    /** v2.0 已展开节点的扁平视图（computed，随 expanded 自动重算），el-table :data 直接使用 */
    flatData,
    isExpanded: (k: string | number) => expanded.value.has(k),
    expandAll: () => {
      const keys: (string | number)[] = []
      dfs(roots, 0, (n) => keys.push(n[rKey] as string | number))
      keys.forEach((k) => expanded.value.add(k))
      touchExpanded()
    },
    collapseAll: () => {
      expanded.value.clear()
      touchExpanded()
    },
    async toggle(k: string | number) {
      if (loading.value.has(k)) return
      if (expanded.value.has(k)) {
        expanded.value.delete(k)
        return
      }
      loading.value.add(k)
      try {
        const p = timers.get(k)
        if (p) clearTimeout(p)
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(async () => {
            timers.delete(k) // 触发即移除，防 Map 长会话累积（review R6）
            try {
              if (config.loadChildren) {
                const r = seek(k, roots)
                if (r?.node._hasChildren && !r.node._loaded) {
                  const cs = await config.loadChildren(r.node)
                  r.node[cKey] = cs as TreeNode[]
                  for (const c of cs) {
                    c._level = (r.node._level ?? 0) + 1
                    // v3.5 hotfix-8：toggle lazy load 子节点也注入 _parent
                    c._parent = cs as TreeNode[]
                  }
                  r.node._loaded = true
                }
              }
              resolve()
            } catch (e) {
              reject(e)
            }
          }, config.loadDebounce ?? 200)
          timers.set(k, t)
        })
        expanded.value.add(k)
        touchExpanded()
      } catch (err) {
        console.error('[useTreeData] lazy load failed:', err)
      } finally {
        loading.value.delete(k)
      }
    },
    async revealKeys(m: Set<string | number>) {
      for (const k of m) {
        const r = seek(k, roots)
        if (r) r.path.forEach((n) => expanded.value.add(n[rKey] as string | number))
        expanded.value.add(k)
      }
    },
    expandedKeys: computed(() => expanded.value),
    /** 资源清理：组件卸载时清掉懒加载挂起的 timer 与响应式状态（防内存泄漏） */
    dispose() {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      expanded.value.clear()
      loading.value.clear()
    },
  }
}
