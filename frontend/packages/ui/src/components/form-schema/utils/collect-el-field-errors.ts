/**
 * collectElFieldErrors —— 从 el-form fields 提取 validateState=error 的字段详情
 *
 * element-plus 的 ElFormItemContext 内部字段状态是 ref-like（propString / validateState /
 * validateMessage 可能是 string、Ref<string> 或 { value?: string }），XForm 三处调用方
 * （use-form-instance validateField / use-form-validation validateForm / validateDetail）
 * 此前各自手写同一套 toRaw + readRefStr 扫描逻辑，EP 3.0 升级需同步改 3 处。
 * 统一收敛到本工具后，升级 diff 面收敛到 1 处。
 *
 * @see types/TYPE-CAST-AUDIT.md（element-plus 内部结构属受控断言区）
 *
 * @group XForm 工具
 */
import { toRaw, type Ref } from 'vue'
import { readRefStr } from './read-ref-str'

/** 字段错误详情 —— errorBus.details / console.error 诊断输出载体 */
export interface ElFieldErrorDetail {
  field: string
  message: string
  value?: unknown
}

/** 解包 ref-like 字段值为 unknown（element-plus ElFormItemContext.fieldValue 是 ComputedRef<unknown>） */
function readRefVal(v: unknown): unknown {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object' && 'value' in v) {
    return (v as { value: unknown }).value
  }
  return v
}

/**
 * 从 el-form fields 提取 validateState=error 的字段详情
 *
 * @param ef 含 fields 数组的 el-form 实例（宽松结构签名）
 * @param opts.filterNames 可选过滤集合 —— 仅保留命中的字段名（validateField 场景）
 * @param opts.includeValue 可选 —— true 时解包 fieldValue 一并返回（诊断输出用实际值而非 ref）
 */
export function collectElFieldErrors(
  ef: { fields?: unknown[] },
  opts: { filterNames?: Set<string>; includeValue?: boolean } = {}
): ElFieldErrorDetail[] {
  const details: ElFieldErrorDetail[] = []
  for (const f of ef.fields ?? []) {
    const raw = toRaw(f) as {
      propString?: string | Ref<string>
      prop?: string | Ref<string>
      validateState?: string | Ref<string>
      validateMessage?: string | Ref<string>
      fieldValue?: unknown
    }
    if (readRefStr(raw.validateState) !== 'error') continue
    const msg = readRefStr(raw.validateMessage)
    if (!msg) continue
    const fieldName = readRefStr(raw.propString) || readRefStr(raw.prop)
    if (!fieldName) continue
    if (opts.filterNames && !opts.filterNames.has(fieldName)) continue
    details.push({
      field: fieldName,
      message: msg,
      ...(opts.includeValue ? { value: readRefVal(raw.fieldValue) } : {}),
    })
  }
  return details
}
