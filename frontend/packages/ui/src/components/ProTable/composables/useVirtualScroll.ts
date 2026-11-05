/**
 * useVirtualScroll —— 虚拟滚动引擎分支（v3.0.1 升级：el-table-v2 真虚拟化）
 *
 * 职责：
 * - 收敛 boolean|Config 形态为 Config
 * - 提供 el-table-v2 引擎分支的完整 props
 * - 强隔离校验：与其他能力（行内编辑/树形/汇总/合并/拖拽）+ vxe-table 引擎冲突时 warn + 忽略
 *
 * v3.1.3 review 重构：
 * - 移除 setup 阶段直接 mutate `options.engine.value = 'element-plus'` 的反模式（违反 Vue 单向数据流）。
 * - 改为暴露 `engineConflict: Ref<'vxe-table-incompatible' | null>` 标记冲突，由编排层
 *   `ProTable.vue` 在拿到该标记后通过 `useEngineFallback.handleEngineFallback()` 触发回退。
 * - 行为等价：virtualized + vxe-table 仍自动回落到 element-plus，但 mutate 主体由编排层负责，
 *   引擎数据流可追踪（单一来源 = useEngineFallback.effectiveEngine）。
 *
 * @group ProTable composables
 */
import { computed, ref, type Ref } from 'vue'
import type { ProTableProps, TableEngine, VirtualScrollConfig } from '../types'

export interface UseVirtualScrollOptions {
  props: ProTableProps
  engine: Ref<TableEngine>
  enableRowEdit: boolean
}

export interface UseVirtualScrollReturn {
  enabled: Ref<boolean>
  config: Ref<VirtualScrollConfig>
  /** 给 ElementTableBody / VxeTableBody 的 props（v1 引擎用，v2 分支不消费） */
  tableProps: Ref<Record<string, unknown>>
  /** v3.0.1 新增：给 ElementTableV2Body 的 v2 配置 */
  v2TableConfig: Ref<{
    width: number | 'auto'
    height: number
    estimatedRowHeight: number
  }>
  /**
   * v3.1.3 review：virtualized 与 vxe-table 冲突标记 —— 由编排层 useEngineFallback 接管回退。
   * 编排层在 setup 早期读取此标记并触发 handleEngineFallback，useVirtualScroll 不再 mutate options.engine.value。
   */
  engineConflict: Ref<'vxe-table-incompatible' | null>
}

const DEFAULT_ROW_HEIGHT = 48
const DEFAULT_OVERSCAN = 10
const DEFAULT_V2_HEIGHT = 500

/**
 * v3.0.1 升级：虚拟化启用时启用 el-table-v2 引擎分支
 *
 * 已知限制（强隔离策略）：
 * - 行内编辑 / 树形 / 汇总 / 合并 / 拖拽 与 v2 不兼容，启用时 warn + 忽略
 * - vxe-table 引擎不支持 v2，启用时 warn + 由编排层回落到 element-plus（v3.1.3 review）
 */
export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const enabled = computed(() => Boolean(options.props.virtualized))

  const config = computed<VirtualScrollConfig>(() => {
    const v = options.props.virtualized
    return typeof v === 'object' && v !== null ? v : {}
  })

  // v3.1.3 review：不再 mutate options.engine.value，仅标记冲突供编排层接管
  const engineConflict = ref<'vxe-table-incompatible' | null>(null)
  if (enabled.value && options.engine.value === 'vxe-table') {
    engineConflict.value = 'vxe-table-incompatible'
    console.warn(
      '[ProTable] virtualized + tableEngine="vxe-table" 不兼容，编排层将自动回落到 element-plus 引擎'
    )
  }

  // v3.1.3 review：启动期一次性冲突 warn（其他能力）
  if (enabled.value) {
    const conflicts: string[] = []
    if (options.enableRowEdit) conflicts.push('enableRowEdit')
    if (options.props.enableTree) conflicts.push('enableTree')
    if (options.props.enableSummary) conflicts.push('enableSummary')
    if (options.props.enableCellSpan) conflicts.push('enableCellSpan')
    if (options.props.enableRowDrag) conflicts.push('enableRowDrag')
    if (conflicts.length > 0) {
      console.warn(`[ProTable] virtualized 模式下以下能力被忽略: ${conflicts.join(', ')}`)
    }
  }

  /** v1 引擎用 tableProps（v2 分支不消费） */
  const tableProps = computed<Record<string, unknown>>(() => {
    if (!enabled.value) return {}
    const rowHeight = config.value.rowHeight ?? DEFAULT_ROW_HEIGHT
    const overscan = config.value.overscan ?? DEFAULT_OVERSCAN
    if (options.engine.value === 'element-plus') {
      return {
        // 复用 DEFAULT_V2_HEIGHT 单点常量：两处 500 同源，改默认值不会漏改
        height: DEFAULT_V2_HEIGHT,
        rowHeight,
        _overscan: overscan,
      }
    }
    return {
      'scroll-y': { gt: overscan, rowHeight },
    }
  })

  /** v3.0.1 新增：v2 引擎配置 */
  const v2TableConfig = computed(() => ({
    width: config.value.width ?? ('auto' as const),
    height: config.value.height ?? DEFAULT_V2_HEIGHT,
    estimatedRowHeight: config.value.rowHeight ?? DEFAULT_ROW_HEIGHT,
  }))

  return { enabled, config, tableProps, v2TableConfig, engineConflict }
}
