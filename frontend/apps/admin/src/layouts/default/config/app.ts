/**
 * Default 布局 UI 功能开关（复刻 vue-element-plus-admin 的 appConfig.ui）。
 *
 * 集中管理布局内各功能的显隐：面包屑 / 折叠按钮 / 主题切换 / 语言切换 /
 * 页签图标 / 页脚 / 侧栏手风琴（uniqueOpened）。
 * 业务方按项目需要在此关闭对应功能，组件内消费 `ui.xxx`。
 *
 * @see [`../components/ToolHeader.vue`](../components/ToolHeader.vue) 主要消费方
 * @group 布局：Default
 */

export const defaultLayoutConfig = {
  /** 品牌标题（Logo / 页脚展示） */
  title: '企业中后台管理',
  ui: {
    /** 面包屑 */
    breadcrumb: true,
    /** 面包屑是否展示图标 */
    breadcrumbIcon: true,
    /** 侧栏折叠按钮（hamburger） */
    hamburger: true,
    /** 头部主题切换按钮 */
    theme: true,
    /** 头部语言切换下拉 */
    locale: true,
    /** 页签是否展示图标 */
    tagsViewIcon: true,
    /** 是否渲染页脚 */
    footer: true,
    /** 侧栏手风琴模式（vertical 菜单同时只展开一个子菜单） */
    uniqueOpened: false,
  },
} as const
