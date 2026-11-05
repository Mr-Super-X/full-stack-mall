/**
 * 内置单元格格式化器预设 —— v3.1 新增（adapters 层）。
 *
 * 角色：把高频格式化场景（时间 / 金额千分位 / 百分比 / 布尔标签）收敛为
 * `formatter: 'dateTime'` 这类预设 key，消除业务方重复实现。
 * cell-render（el/vxe 引擎）与 ElementTableV2Body（v2 引擎）共用本适配层，
 * 保证三引擎格式化行为一致。
 *
 * 输入容错原则：非法值（非数字金额、非法日期、null/undefined）一律原样字符串化返回，
 * 不做吞错也不抛错 —— 单元格渲染失败不应拖垮整张表格。
 *
 * @see [`./cell-render`](./cell-render.ts) 消费方（优先级链 formatter 分支）
 * @group ProTable adapters
 */
import { h } from 'vue' // vue 底层 API（CLAUDE.md §1.6.1）
import { ElTag } from 'element-plus' // 第三方 UI 库组件（TS 代码中需显式 import）
import { dayjs } from '@vv/shared' // 项目日期工具（框架无关）
import type { ColumnFormatterPreset, ProColumn } from '../types'

/** 预设格式化函数签名 —— 对齐 ProColumn.formatter 函数形态（row/column/cellValue/index 四参） */
type PresetFormatter = (
  cellValue: unknown,
  row: Record<string, unknown>,
  column: ProColumn,
  index: number
) => string | ReturnType<typeof h>

/**
 * 非法日期守卫 —— dayjs 对非法输入也返回对象（isValid() 为 false），
 * 此处显式校验：非法输入原样返回，避免单元格出现 "Invalid Date"
 */
function formatDateSafe(cellValue: unknown, format: string): string | null {
  const parsed = dayjs(cellValue as never)
  if (!parsed.isValid()) return null
  return parsed.format(format)
}

/** 金额千分位 —— 与 useSummary 默认格式对齐（保留 2 位小数 + 千分位） */
function formatAmount(cellValue: unknown): string | null {
  const num = Number(cellValue)
  if (cellValue === null || cellValue === undefined || cellValue === '' || Number.isNaN(num)) {
    return null
  }
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 百分比 —— 0.1567 → '15.67%'（输入按小数语义处理，1 = 100%） */
function formatPercent(cellValue: unknown): string | null {
  const num = Number(cellValue)
  if (cellValue === null || cellValue === undefined || cellValue === '' || Number.isNaN(num)) {
    return null
  }
  return `${(num * 100).toFixed(2)}%`
}

/** 布尔真值集合 —— true / 1 / '1' / 'true' 视为真（兼容后端 0/1 数字约定） */
const TRUTHY_VALUES = new Set<unknown>([true, 1, '1', 'true'])

/**
 * 预设表 —— key 即 ColumnFormatterPreset 的字符串字面量。
 * 实现为函数表而非 switch：新增预设只需加一行，符合开闭原则
 */
const CELL_FORMATTERS: Record<ColumnFormatterPreset, PresetFormatter> = {
  /** 完整日期时间：2026-09-16 14:30:00 */
  dateTime: (v) => formatDateSafe(v, 'YYYY-MM-DD HH:mm:ss') ?? String(v ?? ''),
  /** 日期：2026-09-16 */
  date: (v) => formatDateSafe(v, 'YYYY-MM-DD') ?? String(v ?? ''),
  /** 时间：14:30:00 */
  time: (v) => formatDateSafe(v, 'HH:mm:ss') ?? String(v ?? ''),
  /** 金额千分位：1234567.891 → '1,234,567.89' */
  amount: (v) => formatAmount(v) ?? String(v ?? ''),
  /** 百分比：0.1567 → '15.67%' */
  percent: (v) => formatPercent(v) ?? String(v ?? ''),
  /** 布尔标签：真 → 绿色"是" / 假 → 灰色"否"（ElTag VNode） */
  boolTag: (v) =>
    h(ElTag, { type: TRUTHY_VALUES.has(v) ? 'success' : 'info' }, () =>
      TRUTHY_VALUES.has(v) ? '是' : '否'
    ),
}

/**
 * 解析 formatter 为可执行函数 —— 函数形态原样返回，预设 key 查表返回
 *
 * @param formatter ProColumn.formatter（函数或预设 key；undefined 返回 null）
 * @returns 可执行格式化函数；无法解析（非法 key 等）返回 null 走 fallback
 */
export function resolveFormatter(
  formatter: unknown
):
  | ((row: Record<string, unknown>, col: ProColumn, value: unknown, index: number) => unknown)
  | null {
  if (typeof formatter === 'function') return formatter as never
  if (typeof formatter === 'string' && formatter in CELL_FORMATTERS) {
    const preset = CELL_FORMATTERS[formatter as ColumnFormatterPreset]
    return (_row, _col, value, index) => preset(value, _row, _col, index)
  }
  return null
}
