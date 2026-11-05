/**
 * ProTable composables 公共工具（v3.0 新增）
 *
 * 项目角色：跨多个 composable 复用的"精确属性选择"工具。原 useTableCapabilities 内私有实现，
 * 抽到 _utils 后供 useTable / useColumns 等复用，消除 DRY 违规（v3.0 M 公共抽取）。
 *
 * @see [`./useTableCapabilities`](../useTableCapabilities.ts) pickDefined / asConfig 原使用者
 * @group ProTable 工具
 */

/**
 * 过滤 undefined 字段（exactOptionalPropertyTypes 兼容）。
 *
 * 用法：从对象中只挑出已定义的字段，避免 spread undefined 触发 TS 报错。
 *
 * @example
 * ```ts
 * const cfg = pickDefined(props.enableRowEdit as RowEditConfig, ['onSave', 'onSaved'])
 * // cfg 类型：Pick<RowEditConfig, 'onSave' | 'onSaved'> 但仅含已定义的字段
 * ```
 *
 * @param src 源对象
 * @param keys 要筛选的键列表
 * @returns 含已定义字段的 Partial 对象
 */
export function pickDefined<T extends object>(src: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

/**
 * 收敛 boolean | Config 双形态为 Config 形式。
 *
 * ProTable props 设计约定：`enableXxx?: boolean | XxxConfig`。
 * - 传 true / undefined → 用 fallback（默认配置）
 * - 传 Config 对象 → 透传
 *
 * @example
 * ```ts
 * const config = asConfig(props.enableRowEdit, {})
 * // config 类型：RowEditConfig，prop 为 boolean 时返回 fallback
 * ```
 *
 * @param v boolean / Config 联合形态
 * @param fallback 当 v 不是 Config 时的默认值
 * @returns 标准 Config 形式
 */
export function asConfig<T extends object>(v: boolean | T | undefined, fallback: T): T {
  return typeof v === 'object' && v !== null ? v : fallback
}

/**
 * 泛型数组 → Record<string, unknown>[] 转换（cast 边界收敛）。
 *
 * 用法：ProTable 多处需要把 `T[]`（业务行类型）传给非泛型 composable（如 useRowDrag / useCellSpan），
 * 手动 `as unknown as Record<string, unknown>[]` 散落各处，本工具集中此边界。
 *
 * @example
 * ```ts
 * const recordArr = castToRecordArray(newOrder) // Record<string, unknown>[]
 * table.data.value = recordArr as T[]
 * ```
 *
 * @param arr 业务行数组
 * @returns Record 视角数组（运行时同一引用）
 */
export function castToRecordArray<T extends object>(arr: T[]): Record<string, unknown>[] {
  return arr as unknown as Record<string, unknown>[]
}
