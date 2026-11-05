/**
 * use-scan-async-options —— asyncOptions 不可达位置 dev 扫描器
 *
 * 为什么存在：registerAsyncOptions 的遍历范围故意不含 formItem.slots 与 array.itemSchema
 * （M5 决策，行为修复另立批次），这两处的 asyncOptions 永远不会发起请求、也无任何报错 ——
 * 比报错更糟的是沉默。本扫描在 dev 校验阶段把沉默变为可见警告（console.warn + errorBus +
 * DebugBanner 三处同现）。
 *
 * 判定方法：四向全开遍历收集到的 asyncOptions 节点集合 − registerAsyncOptions 实际遍历
 * （children + node.slots 两向）集合 = 不可达节点集合。registerAsyncOptions 的遍历选项
 * 变化时本扫描自动跟随（同一 walkSchema 真源），不会出现第二处需要人肉同步的遍历表。
 *
 * @group 表单编排：开发态
 */
import type { SchemaNode } from '../types'
import { walkSchema } from '../utils/walk-schema'

/** registerAsyncOptions 的遍历选项（use-schema-renderer.ts 的唯一镜像） */
const REGISTER_WALK_OPTIONS = {
  includeFormItemSlots: false,
  includeArrayItemSchema: false,
} as const

/**
 * 扫描 asyncOptions 位于 registerAsyncOptions 不可达位置的节点
 *
 * @param schema 顶层 schema（对象或数组形态）
 * @returns 人读字段描述清单（如 `字段 "productId"`），空数组 = 全部可达
 */
export function scanAsyncOptionsUnsupported(schema: SchemaNode | SchemaNode[]): string[] {
  const reachable = new Set<SchemaNode>()
  walkSchema(
    schema,
    (n) => {
      if (n.asyncOptions) reachable.add(n)
    },
    REGISTER_WALK_OPTIONS
  )

  const unsupported: string[] = []
  walkSchema(schema, (n) => {
    if (!n.asyncOptions || reachable.has(n)) return
    unsupported.push(n.name ? `字段 "${n.name}"` : '（未命名节点）')
  })
  return unsupported
}
