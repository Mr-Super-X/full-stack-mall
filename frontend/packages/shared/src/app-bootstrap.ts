/**
 * 应用启动装配段（@vv/shared）。
 *
 * 文件角色：main.ts 首屏前置两步——品牌色 CSS 变量注入 + document.title 占位初始化
 * ——的单源实现。6 个 app 的 main.ts 曾逐字重复这两段（grep 实证 6/6），任一份漂移
 * 都会造成同构 app 首屏行为分化（品牌色闪烁 / 标题停留 index.html 静态默认值）。
 *
 * 下沉裁决与 setupProdMockIfNeeded（prod-mock.ts）同口径：包内不硬编码 app 名 /
 * 默认标题，各 app 默认标题由调用方传入；两函数均须在 createApp 之前同步调用——
 * 调用顺序即装配契约的一部分（详见各 app main.ts 头部装配顺序注释）。
 *
 * @group 应用入口：启动装配
 */

/**
 * 注入品牌色 CSS 变量：`--color-primary`（业务消费）。
 *
 * 为什么必须在 createApp 之前调用：组件挂载后 CSS 变量再生效会导致首屏闪烁。
 *
 * 只内联 `--color-primary` 单一变量的原因（2026-11-12 修复）：
 * element-overwrite/theme-vars.scss 的 :root 规则把 `--el-color-primary` 写成
 * `var(--color-primary)` 引用，EP 组件经引用链自动跟随品牌色，无需此处二次内联。
 * 此前双写 `--el-color-primary` 内联曾把 admin `[data-layout='default']` 布局级
 * EP 变量映射（teleport 弹层——date-picker 面板 / select 下拉等——的唯一主题来源）
 * 压死在 VITE_BRAND_COLOR 默认值 #409eff：内联优先级高于一切选择器，弹层主色
 * 不跟随布局主题（灯色阶未被双写，呈现蓝紫混搭）。
 *
 * 局限（同原设计）：--el-color-primary-light-3~9 灯色阶仍为编译期字面量，
 * hover/active 浅色阶不随品牌色联动；完整联动须改编译期 $color-primary。
 * 布局级品牌覆盖（如 admin default-tokens.scss 经 .vv-default-layout 容器 /
 * html[data-layout] 选择器施加的 mixin）优先级高于本注入，容器内外均不受影响——
 * 这正是引用链方案要保全的能力。
 *
 * 优先级：VITE_BRAND_COLOR > defaultColor（调用方传入）> '#409eff'（EP 默认蓝）。
 * 保留 `typeof document` 守卫是为 SSR 实验留兼容（与原 6 份内联段同语义，
 * 本模板 CSR 为主，守卫分支常规不命中）。
 *
 * @param defaultColor 调用方约定的默认品牌色；不传或空串（falsy）则兜底 '#409eff'
 * @see 各 app src/main.ts 首屏装配段（createApp 之前调用）
 */
export function injectBrandColor(defaultColor?: string): void {
  const brandColor = import.meta.env.VITE_BRAND_COLOR || defaultColor || '#409eff'
  if (typeof document !== 'undefined') {
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--color-primary', brandColor)
  }
}

/**
 * 初始化首屏 document.title 占位值。
 *
 * 为什么需要在 createApp 之前调用：与路由守卫 / 远程菜单异步加载并行，
 * 避免首屏标题短暂停留在 index.html 静态默认值；登录完成、首次跳转后由
 * router 按目标路由 meta.title（或 i18n key）覆盖，本设置仅作首屏占位，
 * 不影响运行时动态切换。
 *
 * 优先级：VITE_APP_TITLE > defaultTitle（各 app 默认标题由调用方传入——
 * 包内不硬编码 app 名，与骨架三件套同裁决）。
 *
 * @param defaultTitle 该 app 的默认标题（VITE_APP_TITLE 未配置/为空串时兜底）
 * @see router-title.ts resolveRouteTitle —— 运行时路由标题解析（跳转后覆盖占位值）
 */
export function initDocumentTitle(defaultTitle: string): void {
  document.title = import.meta.env.VITE_APP_TITLE || defaultTitle
}
