/**
 * useTableEngineDom —— 表格引擎 DOM 访问层 composable（v3.0 新增）
 *
 * 项目角色：把 ProTable.vue setup 阶段的"模板 ref → tbody DOM"内联查询收敛到独立 composable。
 * 当前消费方是 useRowDrag（v2.0 行拖拽需要 tbody DOM 挂载点）。
 *
 * 设计动机：
 * - 原 ProTable.vue 内联 getTbody 函数（~5 行）违反 CLAUDE.md §一 #11 Hook 拆分
 * - 单测无法独立验证 DOM 查询逻辑
 * - 多能力层（drag / virtual scroll）都可能需要 DOM 访问 → 集中点
 *
 * v3.5 PR1-B：双引擎 tbody 查询 —— 接收 el + vxe 两个 ref + effectiveEngine 选择器；
 * effectiveEngine.value === 'vxe-table' 时走 vxe tbody 查询路径，
 * 否则走 el tbody（与 v3.0 行为兼容）。
 *
 * @see [`./useRowDrag`](./useRowDrag.ts) 消费方
 * @see [`./useVirtualScroll`](./useVirtualScroll.ts) 同形态消费者（v3.0 新增）
 * @group ProTable composables
 */
import { type ComponentPublicInstance, type Ref, type ComputedRef } from 'vue'
import type { TableEngine } from '../types'

export interface UseTableEngineDomOptions {
  /**
   * element-plus 引擎模板 ref（ElementTableBody 实例）
   *
   * v3.5 PR1-B 改为可选：vxe 引擎单独走 proTableVxe 路径
   */
  proTableEl: Ref<{
    $el?: HTMLElement
    elTable?: ComponentPublicInstance | null
  } | null>
  /** v3.5 PR1-B：vxe-table 引擎模板 ref（VxeTableBody 实例）—— 通过 defineExpose.getTbody 拿 tbody */
  proTableVxe?: Ref<{ getTbody?: () => HTMLElement | null } | null>
  /** v3.5 PR1-B：当前生效引擎（vxe-table 时走 vxe 路径） */
  effectiveEngine?: ComputedRef<TableEngine> | Ref<TableEngine>
}

export interface UseTableEngineDomReturn {
  /** 获取当前引擎的 tbody DOM（行拖拽 / 虚拟滚动挂载点） */
  getTbody: () => HTMLElement | null
}

/**
 * v3.0 M5 抽取：从 ProTable.vue setup 内联查询改为 composable，
 * 便于单测覆盖和未来多能力层复用（v3.0 虚拟滚动等）
 *
 * v3.5 PR1-B：effectiveEngine 决定走 el 还是 vxe 路径。
 * vxe 路径优先调 proTableVxe.getTbody（VxeTableBody 内部 querySelector
 * .vxe-table--body-wrapper tbody）；未传 proTableVxe 时退化走 el 路径
 * （保持向后兼容单测）。
 *
 * v3.5 hotfix-7：vxe 路径加 fallback —— 实测 VxeTableBody 是 generic 组件，
 * template ref `ref="proTableVxe"` 在某些 Vue 版本对 generic 组件不绑（实测
 * proTableVxe.value === null），useRowDrag.attachSortable 取 tbody 永远 null
 * → sortablejs 不挂载 → 行拖拽不可用。
 *
 * 兜底：proTableVxe.value 缺失或 getTbody 返回 null 时，全局 querySelector 找
 * `.vxe-table .vxe-table--body-wrapper .vxe-table--body tbody`（vxe-table v4
 * 真实 DOM 路径），退化路径保证行拖拽始终能挂载。
 */
export function useTableEngineDom(options: UseTableEngineDomOptions): UseTableEngineDomReturn {
  function getTbody(): HTMLElement | null {
    const isVxe = options.effectiveEngine?.value === 'vxe-table'
    if (isVxe) {
      // vxe-table 引擎：经 VxeTableBody defineExpose 暴露的 getTbody 拿 tbody
      // 该 getter 内部已处理 onMounted 前 fallback（模板根 div ref query）
      const vxeTbody = options.proTableVxe?.value?.getTbody?.() ?? null
      if (vxeTbody) return vxeTbody
      // 兜底：proTableVxe ref 未绑 / getTbody 返回 null 时，全局 querySelector
      return document.querySelector(
        '.vxe-table .vxe-table--body-wrapper .vxe-table--body tbody'
      ) as HTMLElement | null
    }
    const root = options.proTableEl.value?.$el
    if (!root || typeof root.querySelector !== 'function') return null
    return root.querySelector('.el-table__body tbody') as HTMLElement | null
  }
  return { getTbody }
}
