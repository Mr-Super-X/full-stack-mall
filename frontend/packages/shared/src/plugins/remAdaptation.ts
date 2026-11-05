/**
 * REM 适配 viewport 幂等插件（@vv/shared 单源）。
 *
 * 文件角色：viewport meta「幂等确保」插件的跨 app 单源实现（原 apps/admin 与
 * apps/h5 的 plugins/remAdaptation.ts 曾逐字重复两份，P5 收敛于此）。
 *
 * 职责边界（为何这么薄）：
 *   - 本插件只做「viewport meta 幂等确保」这一件全局一次性的事。
 *   - html fontSize 动态计算 / 宽屏限宽 / resize 监听**故意不在 install 执行**——
 *     本工程多布局共存（default / portal / h5 / big），install 时全局设置会泄漏：
 *     从 h5 页返回后台时 html 内联 width/margin 残留会挤压 default 布局；
 *     激活/恢复由 apps/h5 的 layouts/h5/config/rem.ts 绑定 h5 layout 生命周期承担。
 *
 * 两 app 接线差异（plugins/index.ts 的 remAdaptation 开关均保留各自语义）：
 *   - admin 的 index.html **不**静态声明 viewport meta，依赖本插件 install 时创建
 *     （app.use 序列先于 app.mount，首帧渲染前 meta 已就位）——admin 确需保留本插件；
 *   - h5 的 index.html 已静态声明（双保险），content 须与本文件 VIEWPORT_CONTENT 保持一致。
 *
 * @group 插件：REM 适配
 */

import type { App } from 'vue'

/**
 * viewport meta content 唯一事实源（各 app index.html 不再静态拷贝，install 时创建——
 * app.use 序列先于 app.mount，首帧渲染前 meta 已就位）。
 * 幂等检查只查存在性：宿主 HTML 自带不同 content 的 meta 时尊重宿主（只兜"缺失"）。
 */
const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'

/**
 * 确保 viewport meta 存在（幂等）。
 * install 是唯一创建路径（各 app plugins/index.ts 默认启用，可用 remAdaptation: false 关闭——
 * 关闭即自担 viewport 责任，适用于宿主 HTML 自行管理的场景）。
 * 业务方经 default export 的 install 间接受用；具名导出供测试与 apps/h5 的 h5 layout 直调。
 */
export function ensureViewportMeta(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('meta[name="viewport"]')) return
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'viewport')
  meta.setAttribute('content', VIEWPORT_CONTENT)
  document.head.appendChild(meta)
}

export default {
  /** Vue 插件 install：仅确保 viewport meta。无可配项（关闭走各 app plugins/index.ts 的 false 开关） */
  install(_app: App): void {
    ensureViewportMeta()
  },
}
