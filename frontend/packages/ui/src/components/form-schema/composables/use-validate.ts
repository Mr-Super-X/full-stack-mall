import type { SchemaNode, RuleItem, ValidateOptions, ValidateResult } from '../types'
import type { ZodType } from 'zod'
import { get } from 'lodash-es'
import { walkSchema } from '../utils/walk-schema'
import { runCrossRule } from './cross-rule-runner'

/**
 * use-validate —— schema 静态校验 + 运行时跨字段校验 + zod 顶层校验
 *
 * 4 个导出函数（无 composable 状态，纯函数集）：
 * - validate: 静态 schema 合法性（component/on/rules/children 类型 + 递归）
 * - validateWithZod: 顶层 zod schema 校验（与 async-validator 并行入口）
 * - runCrossFieldValidation: 运行时跨字段校验（含 array.itemSchema 展开 + 异步）
 * - collectCrossRuleFields: 收集含 crossValidator 的字段节点（XForm 用于建 watcher）
 *
 * 不变量：crossValidator 抛错时 console.error 并跳过（避免一条错误规则阻断整张表单）
 *
 * @see ./use-form-validation.ts validateForm 主流程调用
 * @see ./use-cross-field-trigger.ts collectCrossRuleFields 使用方
 *
 * @group 表单编排：校验
 */
export function validate(
  schema: SchemaNode | SchemaNode[] | unknown,
  options: ValidateOptions = {}
): ValidateResult {
  const errors: ValidateResult['errors'] = []
  traverse(schema, [], errors, {
    validateFirst: options.validateFirst ?? false,
    knownComponents: options.knownComponents,
  })
  return { isValid: errors.length === 0, errors }
}

/**
 * 把 builtin 短名集合展开为「短名 + ElXxx 全名」两个集合，方便校验组件名时兼容两种写法
 * （与 element-plus-adapter.resolveElComponentName 的解析顺序对齐）
 */
function expandKnownComponents(known: ValidateOptions['knownComponents']): {
  names: Set<string>
} | null {
  if (!known) return null
  const names = new Set<string>()
  for (const short of known.builtin) {
    names.add(short)
    names.add(`El${short}`)
  }
  if (known.user) for (const u of known.user) names.add(u)
  return { names }
}

function traverse(
  node: unknown,
  keyPath: (string | number)[],
  errors: ValidateResult['errors'],
  ctx: {
    validateFirst: boolean
    knownComponents?: ValidateOptions['knownComponents']
  }
): void {
  if (ctx.validateFirst && errors.length > 0) return
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return
  const obj = node as Record<string, unknown>

  if ('component' in obj && obj.component !== undefined) {
    if (typeof obj.component !== 'string') {
      errors.push({ keyPath: [...keyPath, 'component'], message: 'component 必须是字符串' })
      if (ctx.validateFirst) return
    } else if (ctx.knownComponents) {
      // 阶段 1.3：组件名有效性校验 —— 短名 + ElXxx 全名 + userComponents 三类必须命中其一
      const known = expandKnownComponents(ctx.knownComponents)
      if (known && !known.names.has(obj.component)) {
        // 全小写 → 原生 HTML 标签（如 'a' / 'span'），渲染层直接作为 h() 标签名，视为合法
        if (obj.component !== obj.component.toLowerCase()) {
          const msg = `未知组件名 "${obj.component}" —— 不在 EL 组件集或 userComponents 中（请检查拼写或确认是否已在 components prop 注册）`
          if (import.meta.env.DEV) {
            // dev 模式：console.warn 立即可见，prod 仅推 errors（debug banner 仅 dev 显示）
            console.warn(
              `[XForm][validate] ${msg}\n  keyPath: ${[...keyPath, 'component'].join('.')}`
            )
          }
          errors.push({ keyPath: [...keyPath, 'component'], message: msg })
          if (ctx.validateFirst) return
        }
      }
    }
  }
  if (obj.on && typeof obj.on === 'object' && !Array.isArray(obj.on)) {
    for (const [k, v] of Object.entries(obj.on as Record<string, unknown>)) {
      if (ctx.validateFirst && errors.length > 0) return
      if (typeof v !== 'function' && typeof v !== 'string') {
        errors.push({ keyPath: [...keyPath, 'on', k], message: '事件回调必须为函数或函数表达式' })
      }
    }
  }
  if ('rules' in obj && obj.rules !== undefined) {
    const r = obj.rules
    const ok = typeof r === 'string' || (typeof r === 'object' && r !== null) || Array.isArray(r)
    if (!ok)
      errors.push({ keyPath: [...keyPath, 'rules'], message: 'rules 必须是 string/RuleItem/Array' })
  }
  if ('children' in obj && obj.children !== undefined) {
    const c = obj.children
    if (Array.isArray(c)) {
      c.forEach((child, i) => traverse(child, [...keyPath, 'children', i], errors, ctx))
    } else if (typeof c === 'object' && c !== null) {
      traverse(c, [...keyPath, 'children'], errors, ctx)
    } else if (typeof c !== 'string') {
      errors.push({ keyPath: [...keyPath, 'children'], message: 'children 类型非法' })
    }
  }
}

/** 顶层 zod schema 校验（与 async-validator 并行） */
export function validateWithZod(
  zodSchema: ZodType,
  formData: unknown
): { success: boolean; errors: import('zod').ZodError | null } {
  const result = zodSchema.safeParse(formData)
  return result.success ? { success: true, errors: null } : { success: false, errors: result.error }
}

/**
 * 运行时跨字段校验 —— 遍历 schema 中含 crossValidator 的节点（含 array.itemSchema 展开）
 * - 普通节点：node.name 直接用 lodash get 取 model 值
 * - 数组节点：按 model[name] 当前长度展开每个数组元素，把 itemSchema 内子节点 name 重写为 items[i].subName
 * - crossValidator 支持同步或异步：返回值可为 true / string / Promise<true | string>
 * - 失败时（返回非 true）收集到 errors
 * - crossValidator 抛错时 console.error 并跳过(避免一条错误规则阻断整张表单)
 * - 异步函数统一用 Promise.resolve 包一层：同步值通过 Promise.resolve 立即 resolve,不增加等待时间
 */
export async function runCrossFieldValidation(
  schema: SchemaNode | SchemaNode[] | string | undefined,
  model: Record<string, unknown>,
  /** 命名规则注册表（XForm props.rules）—— 字符串规则名里的 crossValidator 也需解析执行 */
  namedRules?: Record<string, RuleItem>
): Promise<ValidateResult> {
  const errors: ValidateResult['errors'] = []
  await traverseCross(schema, model, [], errors, namedRules)
  return { isValid: errors.length === 0, errors }
}

/**
 * 模型驱动的异步跨字段遍历 —— 不复用 walkSchema：
 * array 节点按 model[name] 当前行数展开 itemSchema（name 重写为 items[i].subName），
 * 遍历形状由运行时 model 决定而非 schema 静态结构，语义与静态遍历器本质不同。
 * @see ../utils/walk-schema.ts
 */
async function traverseCross(
  node: SchemaNode | SchemaNode[] | string | undefined,
  model: Record<string, unknown>,
  keyPath: (string | number)[],
  errors: ValidateResult['errors'],
  namedRules?: Record<string, RuleItem>,
  /**
   * 数组行前缀（形如 'rows[0]'）——itemSchema 后代字段的 name 统一在此拼接。
   * 2026-10-19 浏览器实测暴露的 A1 漏网：此前只在 traverseArrayItem 重写直接子节点的
   * name，itemSchema 为 column/row 布局对象（容器无 name）时 children 字段没加行前缀，
   * 批量 cross 的 dependsOn 取顶层 undefined 被空值跳过（rules 全静默通过）。
   */
  namePrefix = ''
): Promise<void> {
  if (!node) return
  if (typeof node === 'string') return
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      await traverseCross(node[i], model, [...keyPath, i], errors, namedRules, namePrefix)
    }
    return
  }

  // 行内后代字段：name 拼前缀成 items[i].subName 全路径（顶层节点 namePrefix 为空 = 原样）
  const effNode = namePrefix && node.name ? { ...node, name: `${namePrefix}.${node.name}` } : node

  // 数组节点：按 model[name] 当前长度展开每个元素，itemSchema 后代经 traverseArrayItem 透传行前缀
  // A2（docs/audit/2026-10-15）：必须 lodash get 取值——嵌套数组（array 套 array）时 name 已被
  // 重写为 'orders[0].items' 形式，直索引取不到（model 是嵌套结构，不是扁平 key 表）
  if (effNode.kind === 'array' && effNode.array && effNode.name) {
    const listRaw = get(model, effNode.name)
    if (Array.isArray(listRaw)) {
      for (let i = 0; i < listRaw.length; i++) {
        await traverseArrayItem(
          effNode.array!.itemSchema,
          `${effNode.name}[${i}]`,
          model,
          errors,
          namedRules
        )
      }
    }
    return
  }

  // 普通节点：检查 rules 内的 crossValidator
  if (effNode.rules && effNode.name) {
    await runNodeCrossRules(effNode, model, keyPath, errors, namedRules)
  }

  // 递归 children / formItem.slots（行前缀透传给后代）
  if (node.children) {
    if (Array.isArray(node.children)) {
      for (let i = 0; i < node.children.length; i++) {
        await traverseCross(
          node.children[i],
          model,
          [...keyPath, 'children', i],
          errors,
          namedRules,
          namePrefix
        )
      }
    } else if (typeof node.children === 'object') {
      await traverseCross(
        node.children,
        model,
        [...keyPath, 'children'],
        errors,
        namedRules,
        namePrefix
      )
    }
  }
  if (node.formItem && typeof node.formItem === 'object' && node.formItem.slots) {
    for (const [k, v] of Object.entries(node.formItem.slots)) {
      if (v && typeof v === 'object') {
        await traverseCross(
          v,
          model,
          [...keyPath, 'formItem', 'slots', k],
          errors,
          namedRules,
          namePrefix
        )
      }
    }
  }
}

async function traverseArrayItem(
  sub: SchemaNode | SchemaNode[] | string | undefined,
  prefix: string,
  model: Record<string, unknown>,
  errors: ValidateResult['errors'],
  namedRules?: Record<string, RuleItem>
): Promise<void> {
  if (!sub) return
  if (typeof sub === 'string') return
  if (Array.isArray(sub)) {
    for (const s of sub) {
      await traverseArrayItem(s, prefix, model, errors, namedRules)
    }
    return
  }
  // 行前缀经 traverseCross 的 namePrefix 统一拼接（直接子节点与 children 嵌套后代走同一路径）——
  // 不在此重写 sub.name，避免对象容器（column/row 布局的 itemSchema）的 children 漏前缀
  await traverseCross(sub, model, [], errors, namedRules, prefix)
}

async function runNodeCrossRules(
  node: SchemaNode,
  model: Record<string, unknown>,
  keyPath: (string | number)[],
  errors: ValidateResult['errors'],
  namedRules?: Record<string, RuleItem>
): Promise<void> {
  const rules = node.rules
  if (!rules) return
  // A1（docs/audit/2026-10-15）：行内字段 name 已被重写为 'rows[0].max' 全路径，
  // dependsOn 仍是相对路径（['min']）——须加行前缀，否则 get(model, 'min') 取到顶层 undefined
  // （fail 场景碰巧报错、pass 场景误报）。顶层字段无 '.' 时前缀为空 = 不重写。
  const prefix =
    node.name && node.name.includes('.') ? node.name.slice(0, node.name.lastIndexOf('.')) : ''
  const arr = Array.isArray(rules) ? rules : [rules]
  for (const r of arr) {
    // 字符串规则名 → 查注册表解析（'required' 简写无 crossValidator，自然跳过）
    const resolvedRule = typeof r === 'string' ? namedRules?.[r] : r
    if (typeof resolvedRule !== 'object' || resolvedRule === null) continue
    if (!resolvedRule.crossValidator || !(resolvedRule.dependsOn ?? resolvedRule.deps)) continue
    if (!node.name) continue
    // 副本重写 dependsOn（行内相对优先、顶层绝对回退），不污染 namedRules 注册表 / 原 rule 对象
    const rule = (prefix ? rewriteRuleDeps(resolvedRule, prefix, model) : resolvedRule) as RuleItem
    // 批量路径无空值跳过（空值照跑 crossValidator）——与其他两条路径的差异见 cross-rule-runner 文件头
    const outcome = await runCrossRule(rule, model, node.name)
    if (outcome.kind === 'fail') {
      errors.push({ keyPath: [...keyPath, node.name], message: outcome.message })
    }
    // pass / threw：不写 errors（threw 已在 runCrossRule 内 console.error）
  }
}

/**
 * A1：规则副本重写 dependsOn/deps（dependsOn 优先，deps 为别名，语义同 cross-rule-runner）。
 *
 * 路径语义「行内相对优先、顶层绝对回退」：dependsOn 写的是行内同名字段（'min'）时
 * 重写为 'rows[0].min' 按行取值；写的是顶层绝对路径（'max'，如"行小计 ≤ 全局上限"）
 * 时行内无此键，保留原路径。行内与顶层同键时取行内（就近原则）。
 */
function rewriteRuleDeps(rule: RuleItem, prefix: string, model: Record<string, unknown>): RuleItem {
  const resolve = (dep: string): string => {
    const rowRelative = `${prefix}.${dep}`
    return get(model, rowRelative) !== undefined ? rowRelative : dep
  }
  const clone = { ...rule }
  if (rule.dependsOn) {
    clone.dependsOn = Array.isArray(rule.dependsOn)
      ? rule.dependsOn.map(resolve)
      : resolve(rule.dependsOn)
  }
  if (rule.deps) {
    clone.deps = Array.isArray(rule.deps) ? rule.deps.map(resolve) : resolve(rule.deps)
  }
  return clone
}

/**
 * 收集 schema 中所有含 cross rule 的字段节点
 * - 递归 children / formItem.slots / array.itemSchema（不含 node.slots，与既有行为一致）
 * - 用于 XForm setup 时为这些字段建立独立 watcher(model 变化触发 cross rules)
 */
export function collectCrossRuleFields(
  schema: SchemaNode | SchemaNode[] | string | undefined
): SchemaNode[] {
  const result: SchemaNode[] = []
  walkSchema(
    schema,
    (n) => {
      if (!n.rules || !n.name) return
      const arr = Array.isArray(n.rules) ? n.rules : [n.rules]
      const hasCross = arr.some(
        (r) => typeof r === 'object' && r !== null && 'crossValidator' in r && 'dependsOn' in r
      )
      if (hasCross) result.push(n)
    },
    { includeNodeSlots: false }
  )
  return result
}
