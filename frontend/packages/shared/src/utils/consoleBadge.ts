/**
 * 控制台 badge 徽章工具：模拟 GitHub README 的彩色徽章样式。
 *
 * 角色：纯展示工具，**仅用于开发期** console 输出（如 vite 启动时打印版本/环境/构建时间）。
 * 生产环境不调用（避免 console 噪音 + 性能损耗）。
 *
 * 依赖：浏览器 DevTools 对 `%c` 格式说明符 + CSS 样式的支持（所有现代浏览器均支持）。
 *
 * 实现原理：
 * - `console.log` 第一个参数是带 `%c` 的格式串，后续参数为对应位置的 CSS 样式
 * - 左半圆角用 `border-radius: 3px 0 0 3px`，右半圆角用 `0 3px 3px 0`，让两块拼成完整胶囊
 *
 * @see [`App.vue`](../../App.vue) 或 main.ts 中 vite 启动信息打印
 * @group 调试辅助
 */

/**
 * 在控制台输出类似 GitHub README 的彩色 badge。
 *
 * 视觉布局：`bgColor1` 是左侧标签（label）背景，`bgColor2` 是右侧内容（value）背景，
 * 两段以 1px 拼接 + 半圆角形成完整胶囊。
 *
 * @param label   左侧标签（如 "Environment"、"Version"）
 * @param value   右侧内容（如 "production"、"1.1.0"）
 * @param bgColor1 左侧标签背景色（CSS color 字符串，如 "#606060"）
 * @param bgColor2 右侧内容背景色（如 "RGB(66,192,46)"）
 *
 * @example
 * ```ts
 * showBadge('Environment', 'production', '#606060', 'RGB(66,192,46)')
 * showBadge('Version', '1.1.0', '#606060', 'RGB(20,117,178)')
 * ```
 *
 * @group 调试辅助
 */
export function showBadge(label: string, value: string, bgColor1: string, bgColor2: string): void {
  console.log(
    '%c '.concat(label, ' %c ').concat(value, ' '),
    'padding: 1px; border-radius: 3px 0 0 3px; color: #fff; background: '.concat(bgColor1, ';'),
    'padding: 1px; border-radius: 0 3px 3px 0; color: #fff; background: '.concat(bgColor2, ';')
  )
}
