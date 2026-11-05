/**
 * useSchemaIndex 的纯函数 builder：一次遍历构建 byName / fieldNames / allNames /
 * crossRules / reverseIndex / dependsOnMap，DFS 顺序与 getNames() 保持一致。
 * cross rules 覆盖 children / array.itemSchema / formItem.slots；
 * trigger='manual' 的规则不进 reverseIndex（仅 validateForm 跑）。
 *
 * @group 表单编排：索引
 */
import type { SchemaNode, RuleItem } from '../types'
import { walkSchema } from '../utils/walk-schema'

/**
 * SchemaIndex —— schema 元数据中央索引（一次遍历构建的 6 张表）
 *
 * - byName: 字段名 → 节点（O(1) 查表）
 * - fieldNames / allNames: 不含 / 含 ignore 字段路径列表（DFS 顺序）
 * - crossRules: target → 跨字段规则（含 deps + trigger）
 * - reverseIndex: depField → 受影响的 target 字段名列表（反向触发用）
 * - dependsOnMap: target → deps 字段名列表
 *
 * @see ./use-schema-index.ts useSchemaIndex 包装响应式 ref + watch 重建
 */
export interface SchemaIndex {
  byName: Map<string, SchemaNode>
  /** 不含 ignore，DFS 顺序 */
  fieldNames: readonly string[]
  /** 含 ignore，DFS 顺序 */
  allNames: readonly string[]
  /** target field → cross rules（含 deps + trigger） */
  crossRules: Map<string, CrossRuleEntry[]>
  /** depField → 受影响的 target 字段名列表 */
  reverseIndex: Map<string, string[]>
  /** target → deps 字段名列表 */
  dependsOnMap: Map<string, string[]>
}

/**
 * CrossRuleEntry —— 跨字段规则条目（target / deps / rule 三元组）
 */
export interface CrossRuleEntry {
  target: string
  deps: string[]
  rule: RuleItem
  /**
   * 行模板标记（A1-反向，docs/audit/2026-10-15-engine-audit-summary）：
   * 规则节点来自 array.itemSchema 时置 true —— target/deps 为行内相对名
   * （渲染时才 rewriteNamePath 加 'items[i]' 前缀），反向触发收到全路径
   * 'items[0].qty' 需先按行前缀 concrete 化再执行
   */
  rowScoped?: boolean
}

/**
 * 构建索引 —— 一次遍历搞定所有查询表
 * 覆盖：children / array.itemSchema / formItem.slots
 *
 * @param namedRules D(#6)：props.rules 命名规则注册表 —— `rules: 'myRule'`（字符串引用
 *   注册表中含 crossValidator 的规则）经此解析进 crossRules/reverseIndex/dependsOnMap，
 *   与 use-validate 批量路径的 namedRules?.[r] 解析对齐（此前字符串规则静默漏配反向触发）
 */
export function buildIndex(
  schema: SchemaNode | SchemaNode[] | string | undefined,
  namedRules?: Record<string, RuleItem>
): SchemaIndex {
  const byName = new Map<string, SchemaNode>()
  const fieldNames: string[] = []
  const allNames: string[] = []
  const crossRules = new Map<string, CrossRuleEntry[]>()
  const reverseIndex = new Map<string, string[]>()
  const dependsOnMap = new Map<string, string[]>()
  const seenNames = new Set<string>()

  // A1-反向：收集所有 array.itemSchema 的后代节点 —— 其 cross rule 的 target/deps
  // 是行内相对名（渲染时才 rewriteNamePath 加 'items[i]' 前缀）。嵌套数组的内层
  // itemSchema 后代同样命中（运行时行前缀取自 changedField 本身，如 'orders[0].items[1]'）。
  // 遍历方向与主 walk 对齐（includeNodeSlots: false，与 buildIndex 主遍历一致）
  const rowScopedNodes = new Set<SchemaNode>()
  walkSchema(
    schema,
    (n) => {
      if (n.kind === 'array' && n.array?.itemSchema) {
        walkSchema(
          n.array.itemSchema,
          (x) => {
            rowScopedNodes.add(x)
          },
          { includeNodeSlots: false }
        )
      }
    },
    { includeNodeSlots: false }
  )

  walkSchema(
    schema,
    (n) => {
      const id = resolveFieldId(n)
      if (id) {
        allNames.push(id)
        if (!n.ignore && !seenNames.has(id)) {
          fieldNames.push(id)
          seenNames.add(id)
        }
        if (!byName.has(id)) byName.set(id, n)
      }
      if (!n.rules) return
      const arr = Array.isArray(n.rules) ? n.rules : [n.rules]
      for (const r of arr) {
        // D(#6)：字符串命名规则（rules: 'myRule'）经 namedRules 注册表解析 —— 与 use-validate
        // 批量路径 namedRules?.[r] 对齐；注册表缺失该名称时跳过（fail-safe，不抛错）
        const ri: RuleItem | undefined =
          typeof r === 'string' ? namedRules?.[r] : ((r as RuleItem) ?? undefined)
        if (!ri || typeof ri !== 'object' || !('crossValidator' in ri)) continue
        // deps 是 dependsOn 的别名（命名统一，PM 审查发现 4）：优先 dependsOn，回退 deps
        const raw = ri.dependsOn ?? ri.deps
        if (!raw) continue
        const target = resolveFieldId(n)
        if (!target) continue
        const deps = (Array.isArray(raw) ? raw : [raw]).filter(
          (d): d is string => typeof d === 'string'
        )
        if (deps.length === 0) continue
        const entry: CrossRuleEntry = { target, deps, rule: ri }
        if (rowScopedNodes.has(n)) entry.rowScoped = true
        const list = crossRules.get(target)
        if (list) list.push(entry)
        else crossRules.set(target, [entry])
        // 同一 target 挂多条 cross rule 时合并 deps（去重）—— 直接 set 会被后者整条覆盖
        const prevDeps = dependsOnMap.get(target)
        if (prevDeps) {
          for (const d of deps) if (!prevDeps.includes(d)) prevDeps.push(d)
        } else {
          dependsOnMap.set(target, [...deps])
        }
        const trigger = ri.trigger
        if (trigger === 'manual') continue // manual 仅 validateForm 跑，不进反向索引
        for (const d of deps) {
          const arr2 = reverseIndex.get(d)
          if (arr2) {
            if (!arr2.includes(target)) arr2.push(target)
          } else {
            reverseIndex.set(d, [target])
          }
        }
      }
    },
    // 遍历范围与既有行为一致：children / array.itemSchema / formItem.slots（不含 node.slots）
    { includeNodeSlots: false }
  )

  return {
    byName,
    fieldNames,
    allNames,
    crossRules,
    reverseIndex,
    dependsOnMap,
  }
}

/**
 * 解析字段 id：优先 name，没有则用 key
 * 与 XForm 原 getNames() 行为一致
 */
function resolveFieldId(n: SchemaNode): string | undefined {
  if (n.name) return n.name
  if (n.key !== undefined) return String(n.key)
  return undefined
}
