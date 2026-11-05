import type { LayoutMode } from '@vv/shared'

/**
 * Default 布局配置类型。
 *
 * @see [`./app.ts`](./app.ts) ui 功能开关配置
 * @see [`./menu.ts`](./menu.ts) 路由 → 菜单树派生
 * @group 布局：Default
 */

export type { LayoutMode }

/**
 * 菜单树节点（AppMenu / PrimaryNav 渲染用）。
 *
 * 由 `buildMenuTree()` 从 router.getRoutes() 派生：
 * - path 一律为绝对路径（外链保留完整 URL）
 * - title 已按 resolveRouteTitle 解析（titleKey → title → name）
 */
export interface MenuNode {
  /** 绝对路径（外链为完整 URL） */
  path: string
  /** 展示标题（i18n 已解析） */
  title: string
  /** Element Plus 图标名（meta.icon） */
  icon?: string
  /**
   * 单子项时也保留父菜单分组（参考仓 meta.alwaysShow 同名语义）。
   * false/缺失时，仅一个可见子项的父菜单会被"提升"为单菜单项。
   */
  alwaysShow?: boolean
  children?: MenuNode[]
}
