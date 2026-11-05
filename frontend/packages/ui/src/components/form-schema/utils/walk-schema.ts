/**
 * walkSchema —— schema 树公共遍历器（M5：消除 5+ 处手写的四向递归）
 *
 * 为什么存在：此前 containsReaction / applyReactions / containsAsyncOptions /
 * registerAsyncOptions / collectCrossRuleFields / buildIndex 各自手写同一套
 * 「children / slots / formItem.slots / array.itemSchema」递归 —— 新增一种容器
 * 字段类型需同步改 5+ 处，漏一处即静默漏 reaction / 漏校验 / 漏索引。
 * 统一后新增容器类型只需改本文件一处（开闭原则）。
 *
 * 访问顺序：本节点 → array.itemSchema → children → node.slots → formItem.slots（DFS 先序）。
 * 注意：旧 use-reaction.ts 手写版 array 方向在最后，本统一版提前到本节点之后 ——
 * contains* 只判「是否存在」不受影响；applyReactions 的 watch 注册顺序变化由
 * use-reaction.spec 全量用例兜底（@see ../composables/use-reaction.ts）。
 *
 * slots 值守卫：采用「反向判定」—— 只跳过真实 VNode（__v_isVNode 标记），
 * 其余对象/数组一律下钻。不能用「正例启发式」（必须有 component/name/... 字段），
 * 否则退化节点（如 slots 里只有 { reaction } 单字段的对象）会被漏遍历，
 * use-reaction.spec 四向用例即覆盖此形态。
 *
 * @group 表单编排：工具
 */
import type { SchemaNode } from '../types'

/**
 * walkSchema 遍历方向开关 —— 各调用方历史形成的遍历范围不一致且不一致是有行为的
 * （如 buildIndex 补 node.slots 会改变 fieldNames / byName / dirty 追踪范围），
 * 故以 opts 保持各调用方既有范围等价，零行为变化。
 */
export interface WalkSchemaOptions {
  /** 遍历 node.slots（默认 true）。函数/string/VNode 值 skip，其余对象递归 */
  includeNodeSlots?: boolean
  /** 遍历 formItem.slots（默认 true）。string/VNode 值 skip，其余对象递归 */
  includeFormItemSlots?: boolean
  /** 遍历 array.itemSchema（默认 true） */
  includeArrayItemSchema?: boolean
}

/**
 * 深度优先遍历 schema 树：visit 每个 SchemaNode。
 *
 * - visit 返回 false 终止整个遍历（early-exit，供 contains* 探测用）
 * - 数组根节点 / children 数组 / 单对象形态均支持
 * - slots 函数值、string 值、真实 VNode 一律 skip（@see shouldSkipSlotValue）
 *
 * @param visit 访问回调；返回 false 终止遍历
 * @param opts 方向开关（缺省全开）
 */
export function walkSchema(
  node: SchemaNode | SchemaNode[] | string | undefined,
  visit: (n: SchemaNode) => void | false,
  opts?: WalkSchemaOptions
): void {
  const includeNodeSlots = opts?.includeNodeSlots ?? true
  const includeFormItemSlots = opts?.includeFormItemSlots ?? true
  const includeArrayItemSchema = opts?.includeArrayItemSchema ?? true

  /** 内部递归：返回 false 表示上游已请求终止，逐层短路 */
  const walk = (n: SchemaNode | SchemaNode[] | string | undefined): boolean => {
    if (!n || typeof n === 'string') return true
    if (Array.isArray(n)) {
      for (const child of n) {
        if (!walk(child)) return false
      }
      return true
    }
    if (visit(n) === false) return false
    // 顺序：array.itemSchema → children → node.slots → formItem.slots
    if (includeArrayItemSchema && n.kind === 'array' && n.array) {
      if (!walk(n.array.itemSchema)) return false
    }
    if (n.children) {
      if (Array.isArray(n.children)) {
        for (const child of n.children) {
          if (!walk(child)) return false
        }
      } else if (typeof n.children === 'object') {
        if (!walk(n.children)) return false
      }
    }
    if (includeNodeSlots && n.slots) {
      for (const slot of Object.values(n.slots)) {
        if (typeof slot === 'function') continue
        if (!shouldSkipSlotValue(slot) && !walk(slot)) return false
      }
    }
    if (includeFormItemSlots && n.formItem && typeof n.formItem === 'object' && n.formItem.slots) {
      for (const v of Object.values(n.formItem.slots)) {
        if (typeof v === 'function') continue
        if (!shouldSkipSlotValue(v) && !walk(v)) return false
      }
    }
    return true
  }

  walk(node)
}

/**
 * 判定 slots 值是否应跳过 —— SchemaSlot 类型擦除后无法 TS 收窄。
 * 反向守卫：只有真实 VNode（__v_isVNode 标记）和非对象值（string/number/null 等）跳过；
 * 其余对象/数组一律下钻。不能用「正例启发式」（必须有 component/name/... 字段），
 * 否则退化节点（如 slots 里仅有 { reaction } 单字段的对象）会被漏遍历，
 * use-reaction.spec 四向用例即覆盖此形态。
 */
function shouldSkipSlotValue(v: unknown): boolean {
  if (!v || typeof v !== 'object') return true
  if (Array.isArray(v)) return false
  return '__v_isVNode' in (v as Record<string, unknown>)
}
