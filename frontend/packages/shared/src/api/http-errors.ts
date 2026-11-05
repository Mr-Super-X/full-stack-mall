import { HttpStatus } from '../enums/httpEnum.ts'
// 文案经 i18n 查表（2026-10-28 i18n 审计：逻辑层硬编码激活为 error.http.* 键）——
// 拦截器调用本函数时 i18n 已初始化（app 装配序），i18n.global.t 脱离 setup 可用
import { i18n } from '../locales/index.ts'

/**
 * HTTP 状态码 → 用户可见文案查表（i18n 化后形态）。
 *
 * 设计要点：
 * - 表格形式而非三元嵌套，方便单测与扩展（加状态码加一行即可）
 * - 命中 key → 返回对应文案；未命中按 5xx/4xx/status undefined 三档 fallback
 * - 三档 fallback 文案分开配置，避免所有错误都返回同一条 "网络异常" 的粗暴兜底
 * - 文案值为 i18n key（error.http.*），运行时按当前 locale 解析——zh-CN 键值照抄
 *   原硬编码，零行为变化；en-US 走翻译
 *
 * @see [`./types/error.ts`](./types/error.ts) ApiError 类型定义
 * @see [`./http.ts`](./http.ts) 错误归一化拦截器
 * @group 网络基建：错误处理
 */
const STATUS_MESSAGE_KEYS: Record<number, string> = {
  // 4xx 客户端错误
  [HttpStatus.BAD_REQUEST]: 'error.http.400',
  [HttpStatus.UNAUTHORIZED]: 'error.http.401',
  [HttpStatus.FORBIDDEN]: 'error.http.403',
  [HttpStatus.NOT_FOUND]: 'error.http.404',
  // 5xx 服务器错误
  [HttpStatus.SERVER_ERROR]: 'error.http.500',
  [HttpStatus.BAD_GATEWAY]: 'error.http.502',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'error.http.503',
  [HttpStatus.GATEWAY_TIMEOUT]: 'error.http.504',
}

export function resolveHttpStatusMessage(status: number | undefined): string {
  const t = i18n.global.t
  if (status === undefined) return t('error.http.network')
  const key = STATUS_MESSAGE_KEYS[status]
  if (key !== undefined) return t(key)
  if (status >= 500) return t('error.http.serverFallback')
  if (status >= 400) return t('error.http.clientFallback')
  return t('error.http.network')
}
