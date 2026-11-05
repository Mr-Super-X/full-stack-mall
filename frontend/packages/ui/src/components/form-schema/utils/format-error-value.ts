/**
 * format-error-value —— XFormErrorToastItem 用的字段值格式化纯函数
 *
 * 抽离原因：
 * 1. 单元测试友好 —— 无 Vue 依赖，可直接 vitest
 * 2. 复用性 —— 同一对象只 stringify 一次,避免组件内 valueTooltip + formatValue 重复调用
 * 3. 集中 magic number 与边界处理
 *
 * @group XForm 工具
 */

/** 显示截断阈值 —— 24 字符覆盖常见 id / name / 短文本 */
export const VALUE_DISPLAY_MAX = 24

/**
 * 安全 JSON 序列化 —— 不可序列化值（循环引用等）返回 null 占位
 *
 * 修复背景：循环引用对象（如 backend 错误 detail.value 含 self-ref）会抛 TypeError，
 * 此前的 :title 属性无 try/catch 导致整 toast 渲染崩溃。
 */
export function tryJsonStringify(v: unknown): string | null {
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

/** 截断字符串（超长省略号） */
function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** 单值元数据 —— 一次计算多处复用 */
export interface ValueMeta {
  /** 卡片主显示用（截断后） */
  display: string
  /** tooltip 显示原值 */
  tooltip: string
}

/**
 * 格式化字段值 —— 数组/对象用 tryJsonStringify，长字符串截断
 *
 * 与 JSON.stringify(v) 调用次数 O(1)：display 和 tooltip 共享同一 JSON 结果。
 *
 * tooltip 行为约定：所有值都走 JSON.stringify 序列化（含 string），
 * 这样 tooltip 显示的是「该值在 JSON 视角下的精确表示」(如字符串带引号)，
 * 与开发者在 console 中看到的形式一致。
 */
export function getValueMeta(v: unknown): ValueMeta {
  if (v === null) return { display: 'null', tooltip: 'null' }
  if (v === undefined) return { display: 'undefined', tooltip: 'undefined' }
  if (typeof v === 'string') {
    // 字符串走 JSON.stringify —— tooltip 显示 `"a@b.com"` 形式（带引号）
    // display 走 truncate 但去掉两端引号 —— 视觉上更自然
    return {
      display: truncate(v, VALUE_DISPLAY_MAX),
      tooltip: JSON.stringify(v),
    }
  }
  if (typeof v === 'object') {
    const json = tryJsonStringify(v)
    if (json === null) return { display: '[unserializable]', tooltip: '[unserializable]' }
    return { display: truncate(json, VALUE_DISPLAY_MAX), tooltip: json }
  }
  const str = String(v)
  return { display: str, tooltip: str }
}
