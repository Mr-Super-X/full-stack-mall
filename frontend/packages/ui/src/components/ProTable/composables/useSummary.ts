/**
 * useSummary —— 客户端汇总行计算（v3.0 新增能力 5a）
 *
 * 职责：
 * - 根据 columns 声明的聚合函数（sum / avg / count / max / min）计算汇总行
 * - data 变化时自动重算（watch table.data）
 * - 输出 summaryRows：与 columns 同序的"汇总值数组"（每个元素是该列汇总值）
 *
 * 设计决策 R4：客户端聚合（columns 声明聚合函数，不依赖后端；自包含可测）
 *
 * @see [`./useCellSpan`](./useCellSpan.ts) 同模式的可计算型 composable
 * @group ProTable composables
 */
import { computed, watch, type Ref } from 'vue'
import type { ProColumn, SummaryAggregate, SummaryConfig, ColumnSummaryConfig } from '../types'

export interface UseSummaryOptions<T extends object = Record<string, unknown>> {
  columns: Ref<ProColumn<T>[]>
  data: Ref<T[] | null>
  config: SummaryConfig
}

export interface UseSummaryReturn {
  /** 汇总行数据（与 columns 数组顺序一致，每元素是该列汇总值字符串） */
  summaryRows: Ref<string[]>
  /** 配置：列级汇总（按 prop 索引） */
  columnSummary: Ref<Map<string, ColumnSummaryConfig>>
  /** 是否启用 */
  enabled: Ref<boolean>
}

/**
 * 默认格式化：保留 2 位小数 + 千分位（金额场景）
 */
function defaultFormat(value: number): string {
  if (!Number.isFinite(value)) return ''
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/**
 * 默认 label
 */
const DEFAULT_LABEL = '合计'

/**
 * 聚合函数实现（纯函数，便于单测）
 */
function aggregate(values: number[], type: SummaryAggregate): number {
  if (values.length === 0) return 0
  switch (type) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'count':
      return values.length
    case 'max':
      return Math.max(...values)
    case 'min':
      return Math.min(...values)
    default:
      return 0
  }
}

/**
 * 单行记录按 prop 提取数值（数字字段）
 */
function getNumericValue(row: Record<string, unknown>, prop: string): number {
  const v = row[prop]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function useSummary<T extends object = Record<string, unknown>>(
  options: UseSummaryOptions<T>
): UseSummaryReturn {
  const enabled = computed(() => Boolean(options.config))
  const columnSummary = computed<Map<string, ColumnSummaryConfig>>(() => {
    return new Map(Object.entries(options.config.columns ?? {}))
  })

  /**
   * 计算汇总行（每个 columns 元素对应一个汇总值）
   * data 为空或 columns 无汇总声明时，全空字符串占位
   */
  const summaryRows = computed<string[]>(() => {
    if (!enabled.value) return []
    const cols = options.columns.value
    const rows = (options.data.value ?? []) as unknown as Record<string, unknown>[]
    if (rows.length === 0) return cols.map(() => '')

    return cols.map((col, idx) => {
      const cfg = columnSummary.value.get(col.prop)
      // 第一列：渲染 config.label（默认 "合计"）；其余无汇总声明的列空字符串
      if (!cfg) {
        return idx === 0 ? (options.config.label ?? DEFAULT_LABEL) : ''
      }
      const values = rows.map((r) => getNumericValue(r, col.prop))
      const result = aggregate(values, cfg.aggregate)
      return cfg.formatter ? cfg.formatter(result, rows) : defaultFormat(result)
    })
  })

  /**
   * data 变化时主动触发 summaryRows 重算（reactive 已自动追踪，
   * 此 watch 仅为调试可观测性 + 未来扩展 hook 点）
   */
  watch(
    () => options.data.value?.length,
    () => {
      // 主动 read summaryRows（已通过 computed 自动追踪，此处仅语义明确）
      void summaryRows.value
    }
  )

  return { summaryRows, columnSummary, enabled }
}
