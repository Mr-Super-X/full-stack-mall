/**
 * ProTable 持久化数据形状校验（v3.1.4 review 新增）
 *
 * 项目角色：localStorage 注入数据（使用方篡改 / 跨标签页竞态 / 低版本残留结构）
 * 的形状守卫。原 useColumns 直接 `Local.get(key) as PersistedSetting | null`
 * 强转，篡改后的非法数据（如 `order: 123` / `fixed: 'x'`）会让下游
 * `Object.fromEntries(123)` / `Array.sort` 抛错或返回错乱。
 *
 * 统一守卫：拒绝任何不符合约定的数据（fail-safe），避免「半合法对象」让组件崩。
 * 校验失败时调用方应丢弃数据 + 清 localStorage（与 useStatePersist 同模式）。
 *
 * @see [`../useColumns`](../useColumns.ts) 唯一消费方
 * @see [`../useStatePersist`](../useStatePersist.ts) 同模式参考实现
 * @group ProTable 工具
 */

/**
 * 校验结果细化标记 —— 让消费方根据失败原因决定是否 console.warn（开发自检）
 * vs 静默丢弃（线上环境）。
 */
export type ValidationFailureReason =
  | 'not-object' // 顶层非对象
  | 'order-not-string-array' // order 不是 string[]
  | 'visible-not-record' // visible 不是 Record<string, boolean>
  | 'visible-bad-value' // visible 某值非 boolean
  | 'fixed-not-record' // fixed 不是 Record
  | 'fixed-bad-value' // fixed 某值非 'left' | 'right'

/**
 * 校验 ProTable 列设置持久化结构（useColumns PersistedSetting）。
 *
 * 设计要点：
 * - 全部字段 optional —— 旧版本快照缺字段不视为非法（向前兼容）
 * - 逐字段深校验：order 项非 string / visible 值非 boolean / fixed 值非合法 enum 一律拒绝
 * - 失败返回 false + 写入 console.warn 理由（与 useStatePersist 的 fail-fast 一致）
 *
 * @example
 * ```ts
 * const raw = Local.get(storageKey)
 * if (!isValidPersistedSetting(raw)) {
 *   Local.remove(storageKey) // fail-safe：丢弃 + 清理
 *   return null
 * }
 * ```
 *
 * @param raw 任意未知值（localStorage 读出）
 * @returns true = 形状合法；false = 非法（已 console.warn 原因）
 */
export function isValidPersistedSetting(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    warnInvalid('not-object', raw)
    return false
  }
  const s = raw as Record<string, unknown>

  // order?: string[] —— 缺省跳过；非数组 / 元素非 string 一律拒绝
  if (s.order !== undefined) {
    if (!Array.isArray(s.order) || !s.order.every((i) => typeof i === 'string')) {
      warnInvalid('order-not-string-array', raw)
      return false
    }
  }

  // visible?: Record<string, boolean>
  if (s.visible !== undefined) {
    if (typeof s.visible !== 'object' || s.visible === null || Array.isArray(s.visible)) {
      warnInvalid('visible-not-record', raw)
      return false
    }
    for (const v of Object.values(s.visible as Record<string, unknown>)) {
      if (typeof v !== 'boolean') {
        warnInvalid('visible-bad-value', raw)
        return false
      }
    }
  }

  // fixed?: Record<string, 'left' | 'right'>
  if (s.fixed !== undefined) {
    if (typeof s.fixed !== 'object' || s.fixed === null || Array.isArray(s.fixed)) {
      warnInvalid('fixed-not-record', raw)
      return false
    }
    for (const v of Object.values(s.fixed as Record<string, unknown>)) {
      if (v !== 'left' && v !== 'right') {
        warnInvalid('fixed-bad-value', raw)
        return false
      }
    }
  }

  return true
}

/**
 * 内部 warn —— 仅开发期输出（生产环境 console.warn 由构建剔除，保留最小噪音）。
 * 失败原因清晰可定位（区别于 useStatePersist 的 silent fail）。
 */
function warnInvalid(reason: ValidationFailureReason, raw: unknown): void {
  console.warn(`[ProTable] useColumns 持久化数据形状非法（${reason}），已丢弃:`, raw)
}
