/**
 * 侧栏拖拽调宽的常量与边界钳制（纯函数，无副作用）。
 *
 * 为什么独立成文件：钳制逻辑被三处消费——拖拽手柄（实时反馈）、布局壳（渲染宽度）、
 * store 字段回灌（localStorage 持久化值不可信），抽离避免三份拷贝漂移。
 *
 * 边界取值依据：
 * - 下限 160px：展开态需容纳 图标(≈24px) + 菜单文字(≈7 字) + 内边距；低于此文字截断无意义
 *   （再窄应使用折叠态 72px 而非拖窄展开态）
 * - 上限 480px：1366px 视口下约占 35%，再宽会实质挤占工作区（参考 vue-element-plus-admin
 *   同类实现的常用上限）
 * - 默认值 224px：**必须与 default-tokens.scss 的 --left-menu-max-width 保持一致**，
 *   两处真源；tokens 调整时需同步本文件
 *
 * @see [`../components/SidebarResizer.vue`](../components/SidebarResizer.vue) 拖拽手柄消费方
 * @see [`../index.vue`](../index.vue) 布局壳渲染宽度消费方
 * @group 布局：Default
 */

/** 侧栏默认展开宽度（px），对齐 --left-menu-max-width */
export const MENU_DEFAULT_WIDTH = 224
/** 拖拽可调宽度下限（px） */
export const MENU_MIN_WIDTH = 160
/** 拖拽可调宽度上限（px） */
export const MENU_MAX_WIDTH = 480

/**
 * 把任意输入宽度钳制到合法区间；null/undefined/非有限数回退默认值。
 * store 持久化值与用户拖拽值都经过此处，保证渲染与落库的宽度必然可用。
 */
export function clampMenuWidth(width: number | null | undefined): number {
  if (width == null || !Number.isFinite(width)) {
    return MENU_DEFAULT_WIDTH
  }
  return Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, Math.round(width)))
}
