/**
 * dayjs 通用封装（基础通用，待业务场景明确后再扩展）
 *
 * 设计要点：
 * - 统一项目 locale（'zh-CN' | 'en-US'）与 dayjs locale（'zh-cn' | 'en'）的桥接
 * - 提供 5 个最常用格式化工具：formatDate / formatRelative / daysFromNow / isToday / parseDate
 * - 注册最常用 plugin：relativeTime（fromNow）+ customParseFormat（自定义格式解析）
 * - 不复用具体业务场景（如"距今多久"、"列表时间格式化"），留待业务明确后再扩展
 *
 * 后续可加（不在本次范围）：
 * - utc / timezone plugin（跨时区场景）
 * - duration plugin（时长累加）
 * - isSame / isAfter / isBefore 工具
 * - 与项目 store 的 locale 同步（自动跟随 appStore.locale 切换 dayjs.locale）
 *
 * @see [`src/locales/index.ts`](../locales/index.ts) 项目 locale 类型定义
 * @see [`src/store/modules/app`](../../store/modules/app) locale 切换
 * @group 日期工具
 */

import dayjs, { type Dayjs, type ConfigType } from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import relativeTime from 'dayjs/plugin/relativeTime'
import customParseFormat from 'dayjs/plugin/customParseFormat'

// 注册常用 plugin（仅一次，导入即生效）
dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)

/** 项目级 locale 类型，与 src/locales/index.ts / appStore.locale 保持一致 */
export type AppLocale = 'zh-CN' | 'en-US'

/** 将项目 locale 映射到 dayjs locale */
function toDayjsLocale(locale: AppLocale): 'zh-cn' | 'en' {
  return locale.startsWith('zh') ? 'zh-cn' : 'en'
}

/** dayjs 输入类型：Date / 数字时间戳 / ISO 字符串 / 另一个 Dayjs */
export type DateInput = ConfigType

/**
 * 格式化日期
 * @param date 日期输入（Date / 数字 / 字符串 / Dayjs）
 * @param format 格式串，默认 'YYYY-MM-DD HH:mm:ss'
 * @param locale 项目 locale（影响月份/星期的本地化文案）
 */
export function formatDate(
  date: DateInput,
  format = 'YYYY-MM-DD HH:mm:ss',
  locale: AppLocale = 'en-US'
): string {
  return dayjs(date).locale(toDayjsLocale(locale)).format(format)
}

/**
 * 相对时间（如 "2 小时前" / "2 hours ago"），底层用 dayjs.fromNow()
 */
export function formatRelative(date: DateInput, locale: AppLocale = 'en-US'): string {
  return dayjs(date).locale(toDayjsLocale(locale)).fromNow()
}

/**
 * 距今多少天（date 距 now 的天数）
 * - 未来日期 → 正数（如明天返回 1）
 * - 过去日期 → 负数（如昨天返回 -1）
 * - 今天 → 0
 *
 * 实现用 date.diff(now) 而非 now.diff(date)：让语义与函数名"date 距 now"一致。
 */
export function daysFromNow(date: DateInput): number {
  return dayjs(date).diff(dayjs(), 'day')
}

/**
 * 是否今天（按本地日期判断，与 locale 无关）
 */
export function isToday(date: DateInput): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

/**
 * 按指定格式解析日期字符串
 * @returns 有效的 Dayjs 实例（调用方需自行 .isValid() 校验）
 */
export function parseDate(input: string, format: string, locale: AppLocale = 'en-US'): Dayjs {
  return dayjs(input, format, toDayjsLocale(locale))
}

/** 直接导出 dayjs 以便高级场景（如链式调用） */
export { dayjs }
