import { watch, type Ref } from 'vue'
import type { ProColumn } from '../types'

/** useCellSpan 选项（spec §5.3 单元格合并）。@group ProTable Composables */
export interface UseCellSpanOptions {
  /** 列定义（响应式：数据/列变化时自动重算） */
  columns: Ref<ProColumn[]> | ProColumn[]
  /** 表格数据（响应式） */
  data: Ref<Record<string, unknown>[]> | Record<string, unknown>[]
  maxMergeSpan?: number
}

/** 统一转 Ref（v2.0 修复：让 ProTable.vue 传快照时也能响应式重算） */
function toRef<T>(v: Ref<T> | T): Ref<T> {
  if (v !== null && typeof v === 'object' && 'value' in (v as object)) return v as Ref<T>
  return ref(v as T) as Ref<T>
}

/**
 * 单元格合并 composable（spec §5.3）。
 * 包装 element-plus spanMethod 协议 + 缓存 + 合并上限。
 * 三种合并模式：同列相邻值自动纵向合并 / 自定义 judge / 跨列合并（_spanTarget 标记）。
 * v2.0：自动监听 columns/data 变化并重建缓存。
 * @group ProTable Composables
 */
export function useCellSpan(options: UseCellSpanOptions) {
  const maxMerge = options.maxMergeSpan ?? 10
  const cache = new Map<number, { rowspan: number; colspan: number }>()
  const columnsRef = toRef(options.columns)
  const dataRef = toRef(options.data)

  const judgeRows = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    col: ProColumn
  ): boolean => {
    try {
      if (col.span?.judge) return col.span.judge(a, b)
      return a[col.prop] === b[col.prop]
    } catch (err) {
      console.warn('[useCellSpan] judge 抛错，降级为不合并:', err)
      return false
    }
  }

  const buildCache = () => {
    cache.clear()
    const cols = columnsRef.value
    const rows = dataRef.value ?? []
    cols.forEach((col, colIdx) => {
      if (!col.span || col.span.direction === 'column') return
      let runStart = 0
      let runLength = 1
      for (let i = 1; i <= rows.length; i++) {
        const isEnd = i === rows.length
        const prevSame = !isEnd && judgeRows(rows[i - 1]!, rows[i]!, col)
        const isSplit = isEnd || !prevSame || runLength >= maxMerge
        if (isSplit && runLength > 1) {
          for (let j = runStart; j < runStart + runLength; j++) {
            cache.set(
              j * 1000 + colIdx,
              j === runStart ? { rowspan: runLength, colspan: 1 } : { rowspan: 0, colspan: 1 }
            )
          }
        }
        if (isSplit) {
          runStart = i
          runLength = 1
        } else {
          runLength++
        }
      }
    })
  }

  // 跨列合并：业务方在 row._spanTarget 标记「合并到该列」
  const spanMethod = (params: {
    row: Record<string, unknown>
    column: { property: string }
    rowIndex: number
    columnIndex: number
  }): { rowspan: number; colspan: number } => {
    const colProp = params.column?.property
    if (params.row._spanTarget) {
      // 当前列 = 合并目标列（接受 colspan）
      if (colProp === params.row._spanTarget) {
        // 当前列必须有 span.direction='column' 才合法
        const currentCol = columnsRef.value.find((c) => c.prop === colProp)
        return currentCol?.span?.direction === 'column'
          ? { rowspan: 1, colspan: 2 }
          : { rowspan: 1, colspan: 1 }
      }
      // 当前列 = 被合并掉的列（隐藏）
      return { rowspan: 0, colspan: 0 }
    }
    return cache.get(params.rowIndex * 1000 + params.columnIndex) ?? { rowspan: 1, colspan: 1 }
  }

  /**
   * v2.0 视觉标记：返回 cell className 用于 el-table cell-class-name
   * - 'is-merge-rowspan' = 行合并锚点 cell（rowspan > 1，蓝色）
   * - 'is-merge-colspan' = 列合并锚点 cell（colspan > 1，绿色）
   * - 'is-merge-rowspan is-merge-judge' = 自定义 judge 合并（橙色）
   */
  const cellClassName = (params: {
    row: Record<string, unknown>
    column: { property: string }
    rowIndex: number
    columnIndex: number
  }): string => {
    const r = spanMethod(params)
    if (r.rowspan > 1) {
      // 自定义 judge 合并 → 橙色（判定依据：该列声明了 span.judge，而非硬编码列名）
      const col = columnsRef.value.find((c) => c.prop === params.column?.property)
      if (col?.span?.judge) return 'is-merge-rowspan is-merge-judge'
      return 'is-merge-rowspan'
    }
    if (r.colspan > 1) return 'is-merge-colspan'
    return ''
  }

  // v2.0：响应式重建缓存（columns/data 任意变化时重算）
  watch([columnsRef, dataRef], () => buildCache(), { immediate: true, deep: true, flush: 'post' })

  return { spanMethod, cellClassName, resetCache: buildCache }
}
