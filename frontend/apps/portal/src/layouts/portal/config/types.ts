/**
 * 顶部导航配置类型（PortalNav 使用）。
 *
 * 2026-10-20 企业官网改造：导航项从「路由/外链/子菜单」模型收窄为「页面锚点」模型，
 * 点击行为统一为平滑滚动（见 PortalNav.vue）。
 *
 * @see [`../components/PortalNav.vue`](../components/PortalNav.vue) 渲染消费方
 * @see [`./nav.ts`](./nav.ts) PORTAL_NAV 配置
 * @group 布局：Portal
 */

/**
 * 顶部导航项（锚点模型）。
 *
 * - anchor 为页面内区块选择器（如 '#features'），点击平滑滚动过去
 * - key 同时是区块元素 id（不含 #），scroll-spy 用它回写高亮
 */
export interface PortalNavItem {
  key: string
  label: string
  /** 页面内锚点选择器（如 '#features'），对应区块元素 id = key */
  anchor: string
}
