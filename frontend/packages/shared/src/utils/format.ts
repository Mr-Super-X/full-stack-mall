/**
 * 通用格式化工具（与业务解耦的"轻量格式化"层）。
 *
 * 角色：utils 工具模块，提供三种常用展示格式化：日期（仅日期部分）、金额、文本截断。
 *
 * 与 `dayjs.ts` 的边界：
 * - 本文件：**硬编码输出格式**，零依赖、零开销
 * - `dayjs.ts`：支持任意格式串 + locale 桥接，含 dayjs 包依赖
 * 选型：列表/表格等固定展示场景用本文件；用户自定义格式/多语言场景用 dayjs。
 *
 * @group 格式化
 */

/**
 * 简易日期格式化（仅取日期部分 YYYY-MM-DD）。
 *
 * 与 `dayjs.formatDate`（完整日期 + 时间 + 自定义格式）的区别：
 * - 本函数：固定输出 `YYYY-MM-DD`，非法输入返回 `fallback`，**零依赖**
 * - `formatDate`：支持任意格式串 + locale 桥接，含 dayjs 依赖
 *
 * 典型场景：列表展示日期列快速渲染，无需引入 dayjs 整个库。
 *
 * @param input 日期输入（`string` 按 ISO 解析，`Date` 直接使用）
 * @param fallback 非法输入（如 `'invalid'`）的兜底字符串，默认 `'-'`
 * @returns 格式化后的日期字符串
 *
 * @example
 * ```ts
 * formatDateOnly('2026-08-26T10:30:00Z') // '2026-08-26'（注：按本地时区可能偏移）
 * formatDateOnly(new Date())              // 'YYYY-MM-DD'
 * formatDateOnly('invalid')               // '-'（fallback）
 * ```
 *
 * @group 格式化
 */
export function formatDateOnly(input: string | Date, fallback = '-'): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString().slice(0, 10)
}

/**
 * 金额格式化（人民币样式，千分位 + 两位小数）。
 *
 * 使用 `toLocaleString('zh-CN')` 而非手写千分位正则的原因：
 * - 自动遵循系统/区域设置（部分 Windows 中文环境默认小数位不同）
 * - 含千分位逗号 + 固定两位小数 + 四舍五入
 *
 * @param amount 数值金额（单位 = 元，非分）
 * @returns 形如 `'1,234.56'` 的字符串
 *
 * @example
 * ```ts
 * formatMoney(1234.5)    // '1,234.50'
 * formatMoney(0)         // '0.00'
 * formatMoney(-1234.567) // '-1,234.57'
 * ```
 *
 * @group 格式化
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 文本截断（超长时省略末尾）。
 *
 * 截断策略：保留前 `limit - 3` 个字符 + `'...'` 末尾，**保留语义可读性**。
 * 不使用 CSS `text-overflow: ellipsis` 的原因：纯字符串截断便于日志、复制粘贴、PDF 导出。
 *
 * @param text  原始文本
 * @param limit 最大长度（含省略号）；`text.length <= limit` 时原样返回
 * @returns 截断后的字符串
 *
 * @example
 * ```ts
 * truncate('Hello World', 8)  // 'Hello...'
 * truncate('Short', 100)      // 'Short'
 * ```
 *
 * @group 格式化
 */
export function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}
