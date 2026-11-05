/**
 * 数组节点行身份与 name 路径前缀化工具：rewriteNamePath 把子 schema 的 name 路径前缀化为
 * `list[i].subName` 让 el-form 嵌套校验；rowKeyOf 按行对象身份（WeakMap）分配稳定 key，
 * 避免 index 作 key 时删/移行导致重挂载焦点丢失。
 *
 * @group 表单编排：渲染
 */
import type { SchemaNode } from '../types'

/**
 * 行级稳定 key —— 按行对象身份（WeakMap）分配，而非 index
 *
 * index 作 key 时删/移一行会导致后续所有行重挂载（焦点丢失、内部组件状态与校验状态错位）；
 * 对象行在 splice/move 后身份不变 → key 稳定 → Vue 只移动 DOM 不重挂载。
 * 原始值行（string/number）无对象身份，退回 index（极少见场景）。
 *
 * WeakMap 跨渲染存活是必要的：renderRow 每次渲染重建，key 必须跨渲染稳定；
 * 行对象被 GC 时条目自动回收，不会泄漏。
 *
 * 原 rowKeySeq 模块级计数器永增不回收（长时间运行下接近 2^53 上限），
 * 改为 crypto.randomUUID() 短码 —— 无全局计数器，UUID 重复概率可忽略。
 */
const rowKeyMap = new WeakMap<object, string>()

/** rowKeyOf —— 行级稳定 key（按行对象身份分配 WeakMap 索引，原始值行退回 index） */
export function rowKeyOf(row: unknown, index: number): string {
  if (row !== null && typeof row === 'object') {
    let k = rowKeyMap.get(row as object)
    if (!k) {
      k = `r${newShortUid()}`
      rowKeyMap.set(row as object, k)
    }
    return k
  }
  return `i${index}`
}

/**
 * 短 UUID 生成 —— 8 字符前缀，重复概率 1/2^32 = 可忽略
 * 优先使用 crypto.randomUUID()（Node 19+/所有现代浏览器），
 * 旧环境 fallback 到 time+random 组合
 */
export function newShortUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 把子 schema 的 name 路径前缀化，让 el-form 能按 list.0.qty 形式做嵌套校验
 *
 * - 递归处理 children / formItem.slots / slots
 * - 子节点为空 / 字符串时原样返回
 * - keyPrefix（可选）：按行对象身份生成 node.key —— name 是位置路径（校验用），
 *   key 是身份标识（vnode diff 用）；不传则保持原行为（key 不受影响）
 */
export function rewriteNamePath(
  sub: SchemaNode | SchemaNode[] | string | undefined,
  prefix: string,
  sep: string,
  keyPrefix?: string
): SchemaNode | SchemaNode[] | string | undefined {
  if (sub === undefined || sub === null) return sub
  if (typeof sub === 'string') return sub
  if (Array.isArray(sub)) {
    return sub.map((s) => rewriteNamePath(s, prefix, sep, keyPrefix) as SchemaNode)
  }
  const cloned: SchemaNode = { ...sub }
  const originalName = cloned.name
  if (originalName) {
    // P0-3 防重复前缀：嵌套 array 场景下，外层 array 已把内层 array 节点 name 加前缀
    // （如 'items[0].subItems'），内层 array 渲染时再调 rewriteNamePath 会重复加前缀。
    // 检测规则（覆盖嵌套 array + 普通重复前缀）：
    // - originalName === prefix（精确相等）
    // - prefix 以 originalName + '[' 开头（嵌套 array 行级 prefix，如 items[0].subItems[0]）
    // - prefix 以 originalName + sep 开头（普通嵌套前缀，如 items[0].subItems.field）
    const alreadyPrefixed =
      originalName === prefix ||
      prefix.startsWith(originalName + '[') ||
      prefix.startsWith(originalName + sep)
    if (!alreadyPrefixed) {
      cloned.name = `${prefix}${sep}${originalName}`
    }
    // 用户显式配置的 key 优先；否则用行身份前缀派生稳定 key
    if (keyPrefix && cloned.key === undefined) cloned.key = `${keyPrefix}${sep}${originalName}`
  }
  // 类型归因：递归后的子 schema union 与 SchemaNode 字面量在 children/slots/formItem.slots 三处
  // 不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；运行时已验证 el-form 嵌套路径校验通过，TS 层用 as never 兜底。
  if (cloned.children !== undefined) {
    cloned.children = rewriteNamePath(cloned.children, prefix, sep, keyPrefix) as never
  }
  if (cloned.slots) {
    const newSlots: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(cloned.slots)) {
      if (typeof v === 'function') {
        newSlots[k] = v
      } else if (v && typeof v === 'object') {
        newSlots[k] = rewriteNamePath(v, prefix, sep, keyPrefix)
      } else {
        newSlots[k] = v
      }
    }
    cloned.slots = newSlots as never
  }
  if (cloned.formItem && typeof cloned.formItem === 'object' && cloned.formItem.slots) {
    const newFormItemSlots: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(cloned.formItem.slots)) {
      if (typeof v === 'function') {
        newFormItemSlots[k] = v
      } else if (v && typeof v === 'object') {
        newFormItemSlots[k] = rewriteNamePath(v, prefix, sep, keyPrefix)
      } else {
        newFormItemSlots[k] = v
      }
    }
    cloned.formItem = { ...cloned.formItem, slots: newFormItemSlots as never }
  }
  return cloned
}
