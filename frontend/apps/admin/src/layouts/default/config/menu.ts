import type { RouteRecordNormalized, Router } from 'vue-router'
import { resolveRouteTitle } from '@/router/helpers'
import type { MenuNode } from './types'
import type { TagView } from '@/store/modules/tags-view'

/**
 * 路由 → 菜单树派生（复刻 vue-element-plus-admin 的 Menu / routerHelper 逻辑）。
 *
 * 为什么需要本模块：vue-router 5 的 `router.getRoutes()` 会把嵌套 children
 * **平铺**进返回列表（子记录排在父记录前，children 字段保留相对路径），
 * 因此菜单树构建分两步：
 *   1. 过滤出"父记录"（有 children 的根布局记录，见 buildMenuTree 注释）
 *   2. 递归把父记录及其 children 转成 MenuNode（path 一律解析为绝对路径）
 *
 * 过滤语义（对齐本项目 RouteMeta，参考仓的 meta.hidden 对应本项目 meta.visible）：
 *   - meta.visible === false 或 meta.menuVisible === false → 菜单隐藏
 *   - meta.requiresAuth === false（登录页等空白页）→ 不进后台菜单
 *   - 白名单/错误页 name（Forbidden / NotFound / ServerError）→ 不进菜单
 *   - path 含动态段（:param / catch-all）→ 跳过
 *
 * @see [`./types.ts`](./types.ts) MenuNode 类型
 * @see [`../components/AppMenu.vue`](../components/AppMenu.vue) 树渲染 + 单子项提升消费方
 * @see [`../components/PrimaryNav.vue`](../components/PrimaryNav.vue) 顶层节点消费方
 * @group 布局：Default
 */

/** 白名单/错误页路由名（与 router/whitelist.ts 保持同步，见 docs/07；P4 起 Login 迁 apps/auth，不在 admin 路由表中） */
const EXCLUDED_ROUTE_NAMES = new Set(['Forbidden', 'NotFound', 'ServerError'])

/** 判断是否为外链 URL（http/https/ftp 协议头） */
export function isUrl(path: string): boolean {
  return /^(https?:|ftp:)\/\//.test(path)
}

/**
 * 解析子路由的绝对路径（复刻参考仓 routerHelper.pathResolve）。
 *
 * - 外链原样返回
 * - 以 `/` 开头的绝对路径原样返回
 * - 空 path（index 子路由）解析为父路径本身（vue-router 约定），去尾斜杠
 * - 相对路径拼接到父路径下（处理父路径尾部斜杠边界）
 */
export function pathResolve(parentPath: string, path: string): string {
  if (isUrl(path)) return path
  if (path.startsWith('/')) return path
  // 空 path 不拼接 `${base}/`：'/home/' 幽灵路径会让 index 子路由在菜单里出现重复项
  if (!path) return parentPath.replace(/\/+$/, '') || '/'
  const base = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath
  return `${base}/${path}`
}

/** 路由 meta 的菜单可见性判定（visible/menuVisible 双字段，见 RouteMeta 定义） */
function isMenuHidden(meta: Record<string, unknown>): boolean {
  return meta.visible === false || meta.menuVisible === false
}

/** 该记录是否应进入后台菜单（名称白名单 + 免登录页 + 动态段排除） */
function isExcludedRecord(record: RouteRecordNormalized): boolean {
  const name = typeof record.name === 'string' ? record.name : ''
  if (EXCLUDED_ROUTE_NAMES.has(name)) return true
  if (isMenuHidden(record.meta as Record<string, unknown>)) return true
  // requiresAuth === false 的页面（登录页等空白布局页）不属于后台菜单
  if (record.meta.requiresAuth === false) return true
  if (record.path.includes(':')) return true
  return false
}

/** 把单条路由记录转为 MenuNode（children 递归，path 解析为绝对路径）。不可见返回 null。 */
function toMenuNode(
  record: RouteRecordNormalized,
  parentPath: string,
  t?: (key: string) => string
): MenuNode | null {
  if (isExcludedRecord(record)) return null
  const fullPath = pathResolve(parentPath, record.path)
  const icon = (record.meta.icon as string | undefined) ?? undefined
  const node: MenuNode = {
    path: fullPath,
    title: resolveRouteTitle(record, t),
    // exactOptionalPropertyTypes：undefined 不入对象，用条件展开
    ...(icon ? { icon } : {}),
  }
  // alwaysShow：单子项时也保留父菜单分组（参考仓同名 meta，RouteMeta 索引签名透传）
  if (record.meta.alwaysShow === true) node.alwaysShow = true

  const children = (record.children ?? [])
    .map((c) => toMenuNode(c as RouteRecordNormalized, fullPath, t))
    .filter((c): c is MenuNode => c !== null)
  if (children.length > 0) node.children = children

  // index 子路由（path: ''）与父记录解析为同一路径，本质是同一菜单项——布局父记录
  // 自身无 meta，标题/图标继承自子项，保证 PrimaryNav（mixed/dual 模式消费顶层
  // 节点 title）与 AppMenu 单子项提升显示一致
  if (children.length === 1) {
    const [only] = children
    if (only && only.path === fullPath) {
      if (!node.title) node.title = only.title
      if (!node.icon && only.icon) node.icon = only.icon
    }
  }
  return node
}

/**
 * 从 router 实例派生完整菜单树（顶层节点 = 各业务模块根路由）。
 *
 * 顶层判定为什么是「有 children 的父记录」而非「不在任何 children 里」：
 * vue-router 5 平铺返回时，index 子路由（path: ''，如 home 模块）解析后与
 * 父记录同 path——若按"不在 childPaths 里"过滤，父子两条记录会同时成为
 * 顶层产生重复菜单项。叶子记录（无 children）天然被「有 children」条件
 * 剔除；childPaths 集合仅用于防御深嵌套（中间层记录既有 children 又挂在
 * 别人的 children 下）。
 *
 * @param router vue-router 实例
 * @param t i18n 翻译函数（可选，缺省时 resolveRouteTitle 走 title/name 兜底链）
 */
export function buildMenuTree(router: Router, t?: (key: string) => string): MenuNode[] {
  const records = router.getRoutes()

  // 收集所有"作为其他记录 children 出现"的解析后路径 → 防御深嵌套中间层。
  // 注意：空 path（index 子路由）不参与收集——其解析结果就是父路径本身，
  // 计入会让父记录被自己的 childPaths 守卫误杀（home 模块即此形态）
  const childPaths = new Set<string>()
  for (const record of records) {
    for (const child of record.children ?? []) {
      if (child.path) childPaths.add(pathResolve(record.path, child.path))
    }
  }

  // 末道过滤：子项全被排除的父记录（如仅含动态段子路由的 /detail）是无菜单意义的幽灵分组
  return records
    .filter((r) => r.path !== '/' && (r.children?.length ?? 0) > 0 && !childPaths.has(r.path))
    .map((r) => toMenuNode(r, '/', t))
    .filter((n): n is MenuNode => n !== null && (n.children?.length ?? 0) > 0)
}

/**
 * 单子项提升判定（复刻参考仓 helper.hasOneShowingChild）。
 *
 * 语义：children 经可见性过滤后
 *   - 恰好 1 个可见子项 → 提升为顶层菜单项（显示子项标题，路径指向子项）
 *   - 0 个可见子项 → 父项自身作为菜单项（noShowingChildren 标记）
 *   - 多个 → 保持父菜单分组
 *
 * @returns oneShowingChild 为 true 时 onlyChild 为应提升渲染的节点
 */
export function resolveSingleChild(node: MenuNode): {
  oneShowingChild: boolean
  // 类型显式允许 undefined（exactOptionalPropertyTypes 下可选属性不能显式赋 undefined）
  onlyChild?: MenuNode | undefined
} {
  const children = node.children ?? []
  if (children.length === 1) return { oneShowingChild: true, onlyChild: children[0] }
  if (children.length === 0) return { oneShowingChild: true, onlyChild: node }
  return { oneShowingChild: false }
}

/**
 * 提取 affix 固定页签（复刻参考仓 TagsView/helper.filterAffixTags）。
 *
 * 直接遍历路由记录（MenuNode 已丢失 meta.affix，无法基于菜单树收集），
 * 把 meta.affix === true 的视图路由转为页签对象，
 * 供 TagsView 初始化时预置（固定页签无需访问过也常驻）。
 */
export function filterAffixRoutes(router: Router, t?: (key: string) => string): TagView[] {
  const tags: TagView[] = []
  for (const record of router.getRoutes()) {
    if (typeof record.name !== 'string') continue
    if (record.meta.affix !== true) continue
    if (isExcludedRecord(record)) continue
    tags.push({
      name: record.name,
      path: record.path,
      title: resolveRouteTitle(record, t),
      // titleKey 一并携带：title 是挂载时的快照，UI 层 t(titleKey) 才能随语言热切换
      ...((record.meta as { titleKey?: string }).titleKey
        ? { titleKey: (record.meta as { titleKey?: string }).titleKey }
        : {}),
      affix: true,
    })
  }
  return tags
}

/**
 * 计算主导航选中后的跳转路径（复刻参考仓 Layout.firstRoutePath）。
 *
 * 取第一个可见叶子节点的绝对路径（递归深入 children 到底），
 * 无 children 时返回节点自身路径。外链由调用方识别后新窗口打开。
 */
export function firstRoutePath(node: MenuNode): string {
  const [first] = node.children ?? []
  if (first) return firstRoutePath(first)
  return node.path
}
