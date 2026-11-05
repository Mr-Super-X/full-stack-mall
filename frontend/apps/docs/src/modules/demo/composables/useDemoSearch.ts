/**
 * demo sidebar 搜索 composable：承担匹配 + 分组过滤 + 折叠快照维护。
 *
 * 设计要点：
 *  - filteredGroups：keyword 空时透传原 groups；非空时按 label/name 子串过滤，空组丢弃
 *  - 不修改 opts.collapsedGroups（搜索期间 toggleGroup 在 DocLayout 守卫内不响应），
 *    实现「不污染用户折叠偏好」的折叠快照机制
 *  - isSearchActive：trim 后非空即搜索激活态
 *
 * 使用方：DocLayout.vue。groups 字段类型为 Ref<DemoSearchGroup<T>[]>，
 * 既兼容 ComputedRef（DocLayout 现有 sidebarGroups）也兼容 ref。
 */
// computed 由 unplugin-auto-import 注入（§1.6）；类型 Ref/ComputedRef 不在注入清单，须显式 type import
import type { ComputedRef, Ref } from 'vue'

export interface DemoSearchItem {
  /** demo 的组件名（PascalCase），如 XFormBeforeChange */
  name: string
  /** demo 的完整显示名（getSidebarLabel 产出），如 "XFormBeforeChange 字段值拦截·3 层" */
  label: string
  /** demo 的路由 path */
  path: string
}

export interface DemoSearchGroup<T extends DemoSearchItem> {
  title: string
  items: T[]
}

export interface UseDemoSearchOptions<T extends DemoSearchItem> {
  groups: Ref<DemoSearchGroup<T>[]>
  keyword: Ref<string>
  collapsedGroups: Ref<Set<string>>
}

export interface UseDemoSearchReturn<T extends DemoSearchItem> {
  filteredGroups: ComputedRef<DemoSearchGroup<T>[]>
  isSearchActive: ComputedRef<boolean>
  clearKeyword: () => void
}

export function useDemoSearch<T extends DemoSearchItem>(
  opts: UseDemoSearchOptions<T>
): UseDemoSearchReturn<T> {
  const filteredGroups = computed<DemoSearchGroup<T>[]>(() => {
    const kw = opts.keyword.value.trim().toLowerCase()
    if (kw === '') return opts.groups.value
    return opts.groups.value
      .map((g) => ({
        title: g.title,
        items: g.items.filter(
          (i) => i.label.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw)
        ),
      }))
      .filter((g) => g.items.length > 0)
  })
  const isSearchActive = computed(() => opts.keyword.value.trim() !== '')
  return {
    filteredGroups,
    isSearchActive,
    clearKeyword: () => {
      opts.keyword.value = ''
    },
  }
}
