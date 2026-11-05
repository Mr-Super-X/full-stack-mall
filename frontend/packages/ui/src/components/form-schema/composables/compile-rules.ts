/**
 * 校验规则编译：字符串规则名查表 + 未注册警告（拼写错误静默降级极难排查，必须显式告警）；
 * 必需字段默认 message 自动注入（label-aware，避免英文 message 透出）；
 * crossValidator 规则拆分（XForm 扩展键不进 el-form，audit 2026-10-15 遗留 P1 根治）。
 *
 * @group 表单编排：校验
 */
import type { SchemaNode, XFormProps } from '../types'

/**
 * XForm 跨字段扩展键 —— 只属于 XForm 自有 cross 校验三路径（反向 watch / 正向 blur-change /
 * validateForm 批量），不透传给 el-form：async-validator 对非纯 required 规则默认 type:'string'
 * （rule.type || 'string'），number 目标字段保存时会被误拦「is not a string」
 */
const CROSS_EXTENSION_KEYS = ['crossValidator', 'dependsOn', 'deps', 'debounceMs'] as const

/**
 * async-validator 校验实质键：cross 扩展键剔除后，仅剩调度/展示键（trigger/message）的规则
 * 对 el-form 无意义，整体丢弃（空规则对象进 async-validator 会触发「Please specify a type」）
 */
const VALIDATION_SUBSTANCE_KEYS = [
  'required',
  'pattern',
  'min',
  'max',
  'len',
  'range',
  'enum',
  'type',
  'validator',
  'whitespace',
  'format',
] as const

/** 命名字符串规则未注册时静默降级为必填，排障极其困难 —— 必须显式告警暴露（通常是拼写错误） */
function warnUnknownRule(name: string): Record<string, unknown> {
  // 'required' 是 DSL 惯用简写（rules: 'required' ≡ [{ required: true }]，文档化行为），
  // 不属于拼写错误，静默放行；其余未命中名才告警
  if (name === 'required') return { required: true }
  console.error(
    `[XForm] 命名校验规则 "${name}" 未在 props.rules 中注册，已降级为 { required: true }（请检查拼写或注册该规则）`
  )
  return { required: true }
}

/**
 * 剔除 cross 扩展键，返回可供 el-form 消费的字段校验部分；
 * 返回 null 表示剔除后无校验实质（纯 cross 规则）——整体丢弃，由 XForm cross 三路径全权接管
 */
function stripCrossExtensions(rule: Record<string, unknown>): Record<string, unknown> | null {
  const rest = { ...rule }
  for (const key of CROSS_EXTENSION_KEYS) delete rest[key]
  return VALIDATION_SUBSTANCE_KEYS.some((key) => key in rest) ? rest : null
}

/**
 * 校验规则编译：把 schema DSL 的规则数组归一化为 async-validator 可消费的对象数组。
 *
 * 行为：
 * - 字符串 `'required'` 在 propsRules 表里查表，未命中时降级为 `{ required: true }`（warnUnknownRule）
 * - 自动注入默认 message：与 builders.ts:90 的 `required(message = '必填')` 对齐；
 *   仅当 `required === true && !message` 时注入，**用户显式 message 不覆盖**
 * - label 可选：传入时 message = `${label}必填`（如「订单号必填」），未传时退化「必填」保持向后兼容
 * - async-validator 默认 message「orderNo is required」是英文，element-plus zhCn 不含此翻译，
 *   ElConfigProvider locale 改不了这一项；必须在编译层注入
 */
export function compileRules(
  rules: SchemaNode['rules'],
  propsRules: XFormProps['rules'],
  label?: string
): Array<Record<string, unknown>> {
  if (!rules) return []
  return (Array.isArray(rules) ? rules : [rules])
    .map((r) =>
      typeof r === 'string'
        ? (propsRules?.[r] ?? warnUnknownRule(r))
        : (r as Record<string, unknown>)
    )
    .flatMap((r) => {
      // cross 规则拆分（必须在 message 注入前）：纯 cross 整条不进 el-form；
      // 混合规则（crossValidator + required 等同条）剔除扩展键后保留字段校验部分，
      // 防止整条过滤导致必填校验静默丢失（数据正确性回归）
      // （as 断言同既有 line 41 惯例：RuleItem ↔ Record 互操作，归因 TYPE-CAST-AUDIT C1）
      if (typeof r !== 'object' || r === null || !('crossValidator' in r)) return [r]
      const stripped = stripCrossExtensions(r as Record<string, unknown>)
      return stripped === null ? [] : [stripped]
    })
    .map((r) => {
      // required: true 且无 message 时注入「<label>必填」，label 缺失时退化「必填」
      if (r.required === true && r.message === undefined) {
        return { ...r, message: label ? `${label}必填` : '必填' }
      }
      return r
    })
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
}
