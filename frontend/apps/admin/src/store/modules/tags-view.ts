/**
 * 多页签状态管理。
 *
 * 设计要点：
 *   - visitedViews: 已访问路由的 UI 渲染列表（按访问顺序）
 *   - cachedViews: 实际进入 keep-alive 的 name 列表（与 visitedViews 同步，但排除已关闭的非 affix）
 *   - affix: meta.affix === true 的路由（如 Workbench 工作台首页）始终保留，用户无法关闭
 *   - 不持久化：避免换账号看到上个账号的 tab（设计取舍）
 *
 * 路由参数变化策略（如 /user/1 → /user/2）：
 *   - 同一 name 在 visitedViews 中只保留一条，path 更新到最新
 *   - cachedViews 不变（keep-alive 缓存复用，组件实例仍在）
 *
 * @see [`../../layouts/default/components/TagsView.vue`](../../layouts/default/components/TagsView.vue) UI 渲染
 * @see [`../../router/guards/remote-menu.ts`](../../router/guards/remote-menu.ts) 触发 addRouteView
 * @group 状态管理：多页签
 */

import type { RouteLocationNormalized } from 'vue-router'

export interface TagView {
  /** 路由 name（字符串化），作为唯一键 */
  name: string
  /** 完整路径（含 query），用于路由切换 */
  path: string
  /** 渲染名（meta.title || name）。有 titleKey 时 UI 层应优先 t(titleKey) 实现语言热切换 */
  title: string
  /** i18n 键（meta.titleKey），存在时页签/面包屑等 UI 随语言切换实时翻译 */
  titleKey?: string
  /** 菜单图标（Element Plus 图标名，页签前缀图标用） */
  icon?: string
  /** meta.affix === true 时为固定 tag（如 Home），不可关闭 */
  affix?: boolean
}

/**
 * 不出现在多页签的路由名。
 *
 * meta.noTags 声明式排除（2026-10-15 起，替代原 NO_TAGS_ROUTE_NAMES 硬编码名单）：
 *   - 系统页（403/404/500）：出现在多页签中没有承载意义。P4 起 Login 迁 apps/auth，
 *     不再注册于 admin（历史上需排除是因守卫跳登录页时 afterEach 会把 Login 加入页签，
 *     该场景随跨应用整页跳转一并消失）。
 *   - Home：portal 落地页，经顶部导航/Logo 返回即可，无页签上下文切换需求，
 *     产品决策刻意完全排除（含其曾标记的 affix 固定形态）。
 *   - Home/免登录演示页（H5Demo、BigDemo 系列）：已随 P3 各应用抽离随迁，
 *     admin 内不再注册，此处仅保留历史语义说明（原 workbench"能力演示"直达场景）。
 *
 * 不复用守卫白名单 isWhiteListed 的原因：dev 模式白名单包含全部 demo 路由名
 * （demo 页免登录但属正常业务页，页签应正常展示），按白名单过滤会误伤 demo 页签。
 *
 * 注意：noTags 仅约束 toTag（afterEach 动态加入路径）。affix 预置走
 * filterAffixRoutes 直读路由表，不经 toTag——若给 noTags 路由配 meta.affix，
 * 仍会被 TagsView 初始化钉进页签，两处需同步维护。
 */

/**
 * 把 RouteLocationNormalized 转为 TagView。
 *
 * 排除两类路由：
 *   - 无 name：layout 包裹层、404 catch-all 兜底
 *   - meta.noTags 声明排除：系统页 / 门户落地页 / 免登录演示页（路由作者声明）
 *
 * @returns TagView 或 null（路由无 name 或为系统页时）
 */
function toTag(route: RouteLocationNormalized): TagView | null {
  if (!route.name) return null
  if (route.meta?.noTags) return null
  const icon = route.meta?.icon as string | undefined
  const titleKey = (route.meta as { titleKey?: string }).titleKey
  return {
    name: String(route.name),
    path: route.fullPath,
    title: (route.meta?.title as string | undefined) ?? String(route.name),
    // exactOptionalPropertyTypes：undefined 不入对象，用条件展开
    ...(titleKey ? { titleKey } : {}),
    ...(icon ? { icon } : {}),
    affix: route.meta?.affix === true,
  }
}

export const useTagsViewStore = defineStore('tags-view', () => {
  const visitedViews = ref<TagView[]>([])
  const cachedViews = ref<string[]>([])

  /** 添加一个 tag；同名已存在则更新 path（路由参数变化场景）。 */
  function addView(view: TagView): void {
    const existing = visitedViews.value.find((v) => v.name === view.name)
    if (existing) {
      existing.path = view.path
      return
    }
    visitedViews.value.push(view)
    if (!cachedViews.value.includes(view.name)) {
      cachedViews.value.push(view.name)
    }
  }

  /** 移除一个 tag；affix=true 时拒绝（返回 false 表示没删成）。 */
  function removeView(view: TagView): boolean {
    const target = visitedViews.value.find((v) => v.name === view.name)
    if (!target) return false
    if (target.affix) return false

    visitedViews.value = visitedViews.value.filter((v) => v.name !== view.name)
    cachedViews.value = cachedViews.value.filter((n) => n !== view.name)
    return true
  }

  /** 关闭其他：保留当前 tag 与所有 affix tag。 */
  function closeOthers(view: TagView): void {
    visitedViews.value = visitedViews.value.filter((v) => v.affix || v.name === view.name)
    cachedViews.value = cachedViews.value.filter(
      (n) => visitedViews.value.findIndex((v) => v.name === n) !== -1
    )
  }

  /** 关闭全部：仅保留 affix tag。 */
  function closeAll(): void {
    visitedViews.value = visitedViews.value.filter((v) => v.affix)
    cachedViews.value = cachedViews.value.filter(
      (n) => visitedViews.value.findIndex((v) => v.name === n) !== -1
    )
  }

  /** 关闭左侧：保留当前 tag 及其右侧 + 所有 affix tag。 */
  function closeLeft(view: TagView): void {
    const index = visitedViews.value.findIndex((v) => v.name === view.name)
    if (index < 0) return
    visitedViews.value = visitedViews.value.filter((v, i) => v.affix || i >= index)
    cachedViews.value = visitedViews.value.map((v) => v.name)
  }

  /** 关闭右侧：保留当前 tag 及其左侧 + 所有 affix tag。 */
  function closeRight(view: TagView): void {
    const index = visitedViews.value.findIndex((v) => v.name === view.name)
    if (index < 0) return
    visitedViews.value = visitedViews.value.filter((v, i) => v.affix || i <= index)
    cachedViews.value = visitedViews.value.map((v) => v.name)
  }

  /** 从 keep-alive 缓存中剔除指定 name（页签"刷新"用：剔除后重挂载组件） */
  function removeCachedView(name: string): void {
    cachedViews.value = cachedViews.value.filter((n) => n !== name)
  }

  /** router.afterEach 钩子入口（仅展示用），已处理路由无 name 的情况。 */
  function addRouteView(route: RouteLocationNormalized): void {
    const tag = toTag(route)
    if (tag) addView(tag)
  }

  return {
    visitedViews,
    cachedViews,
    addView,
    removeView,
    closeOthers,
    closeAll,
    closeLeft,
    closeRight,
    removeCachedView,
    addRouteView,
  }
})
