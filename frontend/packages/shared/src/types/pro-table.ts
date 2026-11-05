/**
 * ProTable requestApi 契约类型 —— 组件（@vv/ui）与数据源（@vv/mock / app api 模块）
 * 之间的共享数据契约，单源放在 @vv/shared（依赖方向铁律：mock/ui 都允许依赖 shared，
 * 但 mock 绝不可反向依赖 ui——本文件即该铁律的类型侧落地点，2026-10-23 架构审查 P0）。
 *
 * 历史：两类型原定义于 packages/ui/src/components/ProTable/types/index.ts，
 * @vv/mock 的 pro-table 数据源经 '@components/ProTable/types' 别名（tsconfig paths
 * 直指 ui 源码）消费——别名让包边界在类型侧不可见，ui 内部文件位移会直接炸 mock 的
 * type-check。现 ui 侧改为 import + re-export（对外 API 不变，存量消费方零改动）。
 *
 * @group ProTable 契约
 */

/**
 * ProTable requestApi 响应结构 —— 后端约定（data + total + pageNum + pageSize）。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 *
 * @group ProTable 契约
 */
export interface ProTableResponse<T extends object = Record<string, unknown>> {
  data: T[]
  total: number
  pageNum: number
  pageSize: number
}

/**
 * ProTable requestApi 方法签名。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 *
 * @group ProTable 契约
 */
export type ProTableRequestApi<T extends object = Record<string, unknown>> = (
  params: Record<string, unknown>
) => Promise<ProTableResponse<T>>
