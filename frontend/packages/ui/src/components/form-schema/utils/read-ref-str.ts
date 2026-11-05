/**
 * readRefStr —— 解包 el-form 内部 ref-like 字符串字段
 *
 * element-plus 的 ElFormItemContext 内部把字段状态包成 ref<string> / ComputedRef<...>，
 * 部分字段（如 propString）类型又是 `string | { value?: string }`（plain object）。
 * XForm 调用方需要统一处理这三种形态：
 * - string：直接返回
 * - Ref / ComputedRef / plain object with value：读 .value 并断言为 string
 * - undefined / null / 其他：返回 undefined
 *
 * 历史：原实现分别存在于 use-form-instance / use-form-validation / use-set-field-error 三处，
 * 重复维护成本高，统一到此处消除重复。
 *
 * @see types/TYPE-CAST-AUDIT.md（已登记的 6 处使用）
 *
 * @group XForm 工具
 */

/** 允许的输入类型：string 或任意带 .value 字段的对象（含 Ref / ComputedRef / plain object） */
export type ReadRefStrInput = string | { value?: unknown } | undefined | null

/**
 * 从 string | Ref<string> | { value?: string } | undefined 中解包出 string
 *
 * @param v 待解包的值
 * @returns 解包后的 string，若输入非 string 或 value 非 string 则返回 undefined
 */
export function readRefStr(v: ReadRefStrInput): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'value' in v) {
    const x = (v as { value?: unknown }).value
    return typeof x === 'string' ? x : undefined
  }
  return undefined
}
