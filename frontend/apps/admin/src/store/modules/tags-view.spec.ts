// tags-view store 单测
//
// 覆盖：
//   - addView：基本去重 + 同名更新 path
//   - removeView：基本删除 + affix 拒绝删除
//   - closeOthers：保留 current + affix
//   - closeAll：仅保留 affix
//   - cachedViews 与 visitedViews 同步性
//   - addRouteView：跳过无 name 路由 + 跳过 meta.noTags 声明路由（系统页/Home/演示页）

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTagsViewStore, type TagView } from './tags-view'
import type { RouteLocationNormalized } from 'vue-router'

function makeTag(overrides: Partial<TagView> = {}): TagView {
  return {
    name: 'A',
    path: '/a',
    title: '页面 A',
    affix: false,
    ...overrides,
  }
}

/** 构造 addRouteView 接受的 RouteLocationNormalized 简化版（只填 store 用到的字段）。 */
function makeRoute(
  name: string | null,
  meta: Record<string, unknown> = {}
): RouteLocationNormalized {
  return {
    name,
    fullPath: `/mock/${String(name)}`,
    meta,
  } as unknown as RouteLocationNormalized
}

describe('useTagsViewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addView', () => {
    it('基本添加 + cachedViews 同步', () => {
      const store = useTagsViewStore()
      store.addView(makeTag({ name: 'A' }))

      expect(store.visitedViews).toHaveLength(1)
      expect(store.visitedViews[0]?.name).toBe('A')
      expect(store.cachedViews).toContain('A')
    })

    it('同名重复添加：不新增 + 更新 path', () => {
      const store = useTagsViewStore()
      store.addView(makeTag({ name: 'A', path: '/a/1' }))
      store.addView(makeTag({ name: 'A', path: '/a/2' }))

      expect(store.visitedViews).toHaveLength(1)
      expect(store.visitedViews[0]?.path).toBe('/a/2')
      expect(store.cachedViews).toEqual(['A'])
    })
  })

  describe('removeView', () => {
    it('基本删除 + cachedViews 同步移除', () => {
      const store = useTagsViewStore()
      store.addView(makeTag({ name: 'A' }))
      store.addView(makeTag({ name: 'B' }))

      const ok = store.removeView(makeTag({ name: 'A' }))

      expect(ok).toBe(true)
      expect(store.visitedViews.map((v) => v.name)).toEqual(['B'])
      expect(store.cachedViews).toEqual(['B'])
    })

    it('affix tag 拒绝删除', () => {
      const store = useTagsViewStore()
      const pinned = makeTag({ name: 'Pinned', path: '/pinned', affix: true })
      store.addView(pinned)
      store.addView(makeTag({ name: 'A' }))

      const ok = store.removeView(pinned)

      expect(ok).toBe(false)
      expect(store.visitedViews.map((v) => v.name)).toEqual(['Pinned', 'A'])
      expect(store.cachedViews).toEqual(['Pinned', 'A'])
    })

    it('删除不存在的 tag 返回 false', () => {
      const store = useTagsViewStore()
      const ok = store.removeView(makeTag({ name: 'X' }))
      expect(ok).toBe(false)
    })
  })

  describe('closeOthers', () => {
    it('保留 current + 所有 affix tag', () => {
      const store = useTagsViewStore()
      store.addView(makeTag({ name: 'Pinned', affix: true, path: '/pinned' }))
      store.addView(makeTag({ name: 'A', path: '/a' }))
      store.addView(makeTag({ name: 'B', path: '/b' }))
      store.addView(makeTag({ name: 'C', path: '/c' }))

      store.closeOthers(makeTag({ name: 'B' }))

      expect(store.visitedViews.map((v) => v.name)).toEqual(['Pinned', 'B'])
      expect(store.cachedViews).toEqual(['Pinned', 'B'])
    })
  })

  describe('closeAll', () => {
    it('仅保留 affix tag', () => {
      const store = useTagsViewStore()
      store.addView(makeTag({ name: 'Pinned', affix: true }))
      store.addView(makeTag({ name: 'A' }))
      store.addView(makeTag({ name: 'B' }))

      store.closeAll()

      expect(store.visitedViews.map((v) => v.name)).toEqual(['Pinned'])
      expect(store.cachedViews).toEqual(['Pinned'])
    })
  })

  describe('addRouteView', () => {
    it('无 name 的路由不加入（layout 包装 / 404）', () => {
      const store = useTagsViewStore()
      store.addRouteView(makeRoute(null))
      expect(store.visitedViews).toEqual([])
      expect(store.cachedViews).toEqual([])
    })

    it('带 meta.affix === true 的路由标记为 affix', () => {
      const store = useTagsViewStore()
      store.addRouteView(makeRoute('Pinned', { title: '固定页', affix: true }))
      expect(store.visitedViews[0]?.affix).toBe(true)
    })

    it('首页 Home 不加入页签（meta.noTags；即使路由残留 affix 标记，afterEach 路径也不能加入）', () => {
      const store = useTagsViewStore()
      store.addRouteView(makeRoute('Home', { title: '首页', affix: true, noTags: true }))
      expect(store.visitedViews).toEqual([])
      expect(store.cachedViews).toEqual([])
    })

    it('系统页（403/404/500）不加入页签（meta.noTags）', () => {
      const store = useTagsViewStore()
      // P4 起 Login 迁 apps/auth（历史场景：退出登录 afterEach 把 Login 加进页签，已消失）
      for (const name of ['Forbidden', 'NotFound', 'ServerError']) {
        store.addRouteView(makeRoute(name, { title: name, noTags: true }))
      }
      expect(store.visitedViews).toEqual([])
      expect(store.cachedViews).toEqual([])
    })

    it('任意 name 只要 meta.noTags 为真即不加入页签（机制级回归）', () => {
      const store = useTagsViewStore()
      // 回归：workbench"能力演示"跳免登录验收页不污染页签的机制。
      // Home/H5Demo/BigDemo 系列已随 P3 各应用抽离，admin 不再注册这些路由——
      // 用合成 name 覆盖「noTags 真值即排除」的纯机制，不绑定已迁出的具体路由名
      for (const name of ['H5Demo', 'BigDemo']) {
        store.addRouteView(makeRoute(name, { title: name, requiresAuth: false, noTags: true }))
      }
      expect(store.visitedViews).toEqual([])
      expect(store.cachedViews).toEqual([])
    })

    it('noTags 排除不影响普通业务页加入', () => {
      const store = useTagsViewStore()
      store.addRouteView(makeRoute('NotFound', { title: '404', noTags: true }))
      store.addRouteView(makeRoute('Workbench', { title: '工作台' }))
      expect(store.visitedViews.map((v) => v.name)).toEqual(['Workbench'])
    })
  })
})
