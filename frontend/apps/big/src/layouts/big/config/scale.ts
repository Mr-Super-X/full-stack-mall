/**
 * big layout scale 运行时（纯计算层，运行时零 Vue 依赖，便于单测与 layout 自包含）。
 *
 * 与 h5 rem 适配的本质差异：
 *   - h5：改全局 html fontSize（模块级快照/恢复保证零残留）
 *   - big：只算数不碰 DOM——结果交给 index.vue 绑定到自有容器 style，
 *     容器随 layout 销毁，天然零残留，无需快照机制
 *
 * 设计稿尺寸契约：路由 meta.bigScreen = { width, height }（缺省 1920×1080），
 * 同 layout 内跳转（1920 页 ↔ 9000 页）由 index.vue watch meta 热切换。
 *
 * @see [`../index.vue`](../index.vue) 生命周期驱动方（onMounted/onUnmounted + watch meta）
 * @group 布局：Big
 */

import type { InjectionKey, Ref } from 'vue'

/** 大屏设计稿尺寸（px） */
export interface BigScreenDesignSize {
  width: number
  height: number
}

/** 默认设计稿尺寸：1920×1080（16:9，覆盖 1920/2560/4K 三档 16:9 视口） */
export const DEFAULT_BIG_SCREEN_SIZE: BigScreenDesignSize = { width: 1920, height: 1080 }

/** resize / pageshow 重算防抖间隔（ms） */
export const BIG_SCALE_RESIZE_DELAY = 150

/** scale 计算结果（含居中留白偏移，视口坐标系 px） */
export interface BigScaleMetrics {
  scale: number
  offsetX: number
  offsetY: number
}

/** provide 给大屏页面的完整状态（metrics + 生效的设计稿尺寸） */
export interface BigScaleState extends BigScaleMetrics {
  designWidth: number
  designHeight: number
}

/**
 * demo 组件（BigChart）inject 当前 scale 的契约。
 * 默认值见 BigChart（不在 big layout 内时 scale=1 回退，组件可独立预览）。
 */
export const BIG_SCALE_STATE_KEY: InjectionKey<Readonly<Ref<BigScaleState>>> =
  Symbol('big-scale-state')

/** 尺寸是否合法（正有限数） */
function isValidSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * 计算等比缩放与居中偏移。
 *
 * 算法：scale = min(vw/dw, vh/dh)——取较小者保证完整可见，剩余空间均分居中（留白）。
 * 防御：视口非法（0/负数/NaN/Infinity——如隐藏 iframe、预渲染、或调用方误算 9000/0）
 * 回退 scale=1 保持现状，等 resize/pageshow 自愈；
 *       设计稿尺寸非法回退默认 1920×1080（调用方传错不应让整屏塌陷）。
 *       注：`NaN <= 0` 为 false——视口守卫必须走 isValidSize 而非 `<= 0` 判断。
 *
 * 回退语义说明（有意设计）：本函数 width/height **逐维独立回退**（一维非法只回退该维），
 * 与 resolveBigScreenSize 的「任一非法整体回退」不同——meta 入口已保证要么全合法要么全默认，
 * 本函数作为独立导出工具保持逐维宽容（如 width 合法 height 误传时仍尊重 width）。
 */
export function computeBigScale(
  design: BigScreenDesignSize,
  viewportWidth: number,
  viewportHeight: number
): BigScaleMetrics {
  const dw = isValidSize(design.width) ? design.width : DEFAULT_BIG_SCREEN_SIZE.width
  const dh = isValidSize(design.height) ? design.height : DEFAULT_BIG_SCREEN_SIZE.height
  if (!isValidSize(viewportWidth) || !isValidSize(viewportHeight)) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const scale = Math.min(viewportWidth / dw, viewportHeight / dh)
  return {
    scale,
    offsetX: (viewportWidth - dw * scale) / 2,
    offsetY: (viewportHeight - dh * scale) / 2,
  }
}

/**
 * 从 route.meta 收窄 bigScreen 声明（RouteMeta 索引签名类型为 unknown，必须运行时守卫）。
 * 任何非法形态（非对象/非数字/非正数/NaN）一律回退默认 1920×1080。
 */
export function resolveBigScreenSize(meta: unknown): BigScreenDesignSize {
  if (typeof meta !== 'object' || meta === null) return DEFAULT_BIG_SCREEN_SIZE
  const raw = (meta as Record<string, unknown>).bigScreen
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BIG_SCREEN_SIZE
  const { width, height } = raw as Record<string, unknown>
  if (isValidSize(width) && isValidSize(height)) return { width, height }
  return DEFAULT_BIG_SCREEN_SIZE
}
