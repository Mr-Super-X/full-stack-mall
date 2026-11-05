/**
 * engine 适配器（spec 决策 4：首次挂载锁定）
 *
 * 职责：把 ProTableProps.tableEngine 在 setup 阶段一次性解析成 Ref，
 * 后续 prop 修改无效（JSDoc 明确约束）。
 *
 * v2.1 起 vxe-table 引擎实装：原「vxe 回退 element-plus」分支已删除；
 * 引擎模块加载失败时的运行时回退由 VxeTableBody 的 engine-fallback 承担
 * （spec §九 #7：表格是页面主内容，引擎故障不应白屏）。
 *
 * @see [`../composables/useTable`](../composables/useTable.ts) 消费方
 * @see [`../components/VxeTableBody.vue`](../components/VxeTableBody.vue) 加载失败回退
 * @group ProTable adapters
 */
import { ref, type Ref } from 'vue'
import type { TableEngine } from '../types'

/**
 * 解析 tableEngine prop → Ref（setup 一次性捕获）
 *
 * @param prop 组件 prop（可能未传，缺省 'element-plus'）
 * @returns Ref<TableEngine>，整个组件生命周期内不变（引擎加载失败的运行时回退除外）
 */
export function resolveEngine(prop: TableEngine | undefined): Ref<TableEngine> {
  return ref<TableEngine>(prop ?? 'element-plus')
}
