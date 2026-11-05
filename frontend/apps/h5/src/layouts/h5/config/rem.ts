/**
 * h5 rem 运行时适配（纯 TS，无 Vue 依赖，便于单测与 layout 自包含）。
 *
 * 激活/恢复模型：activateRem() 保存进入前 html 内联样式并接管，deactivateRem()
 * 原样写回——离开 h5 布局后对 default / portal 零残留。
 *
 * 为何用 window.innerWidth 而非 documentElement.clientWidth（参考代码的坑）：
 *   clientWidth 是 html 元素自身宽度，宽屏限宽（html.style.width = 540px）生效后
 *   读到的恒为 540 —— 从宽屏 resize 回窄屏时读到残留值，fontSize 计算错误。
 *   innerWidth 永远是视口宽度，不受 html 内联 width 影响。
 *
 * @see [`../index.vue`](../index.vue) 生命周期驱动方（setup 顶层激活 / onUnmounted 恢复）
 * @see `@vv/config/postcss.ts` 编译时 px→rem 换算约定
 * @group 布局：H5
 */

/** 宽屏限宽阈值（px）：视口宽超过此值时页面限宽居中 */
export const H5_REM_MAX_WIDTH = 540
/** resize / pageshow 重算防抖间隔（ms） */
export const H5_REM_RESIZE_DELAY = 300
/** rem 换算除数：1rem = 生效宽度 / 10（与 packages/config/src/postcss.ts 的 rootValue = 设计稿宽/10 配套） */
const REM_DIVISOR = 10

/** 进入 h5 前的 html 内联样式快照（deactivate 时原样写回） */
interface HtmlInlineSnapshot {
  fontSize: string
  width: string
  margin: string
}

// 模块级单例是有意设计：html 元素全局只有一个，activate/deactivate 语义天然全局互斥
let snapshot: HtmlInlineSnapshot | null = null
let recalcTimer: ReturnType<typeof setTimeout> | undefined

/** 按当前视口宽重算并应用 html fontSize / 限宽居中 */
function applyRootMetrics(): void {
  const html = document.documentElement
  const viewportWidth = window.innerWidth
  // 隐藏 iframe / 预渲染等极端场景 innerWidth 可能为 0：跳过本次计算保持现状，
  // 等页面可见后的 resize/pageshow 自愈（写 0px 会导致全部 rem 元素塌陷）
  if (viewportWidth <= 0) return
  const effectiveWidth = Math.min(viewportWidth, H5_REM_MAX_WIDTH)
  html.style.fontSize = `${effectiveWidth / REM_DIVISOR}px`

  if (viewportWidth > H5_REM_MAX_WIDTH) {
    html.style.width = `${H5_REM_MAX_WIDTH}px`
    html.style.margin = '0 auto'
  } else {
    // 宽屏 resize 回窄屏时必须清掉限宽内联，否则页面被锁在 540px
    html.style.width = ''
    html.style.margin = ''
  }
}

function scheduleRecalc(): void {
  clearTimeout(recalcTimer)
  recalcTimer = setTimeout(applyRootMetrics, H5_REM_RESIZE_DELAY)
}

/** bfcache 恢复（pageshow persisted）时视口可能已变化，需重算 */
function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleRecalc()
}

/** 激活 rem 适配：保存快照 → 立即计算 → 挂监听。重复调用幂等（先恢复旧状态再激活） */
export function activateRem(): void {
  if (snapshot !== null) deactivateRem()
  const html = document.documentElement
  snapshot = {
    fontSize: html.style.fontSize,
    width: html.style.width,
    margin: html.style.margin,
  }
  applyRootMetrics()
  window.addEventListener('resize', scheduleRecalc)
  window.addEventListener('pageshow', onPageShow)
}

/** 停用 rem 适配：写回快照、移除监听、清防抖定时器。未激活时调用为空操作 */
export function deactivateRem(): void {
  if (snapshot === null) return
  const html = document.documentElement
  html.style.fontSize = snapshot.fontSize
  html.style.width = snapshot.width
  html.style.margin = snapshot.margin
  snapshot = null
  clearTimeout(recalcTimer)
  window.removeEventListener('resize', scheduleRecalc)
  window.removeEventListener('pageshow', onPageShow)
}
