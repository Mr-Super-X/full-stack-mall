/**
 * exportCsv —— 零依赖 CSV 导出（spec 2026-09-18 §3.4，设计 D7）
 *
 * 项目角色：ProTable 配套导出工具。BOM + RFC4180 引号转义，Excel 直接打开中文不乱码。
 * 仅负责「行数据 → 文件下载」，服务端大文件导出（异步任务）不在此范围。
 *
 * @see [`./importCsv`](./importCsv.ts) 导入（转义反转）
 * @group ProTable 工具
 */
import dayjs from 'dayjs' // 第三方工具库（不在 AutoImport 列表，显式 import）

/** CSV 列定义 —— 表头 label + 行字段 prop 的映射关系 */
export interface CsvColumn {
  /** 行数据字段名（导入时为输出 key） */
  prop: string
  /** CSV 表头列名（导入时按此匹配表头） */
  label: string
  /** 自定义取值（缺省 row[prop]；用于金额格式化 / 枚举翻译 / 字段拼接） */
  value?: (row: Record<string, unknown>) => string | number
}

/** exportCsv 选项 */
export interface ExportCsvOptions {
  /** 列定义（表头顺序 = 数组顺序） */
  columns: CsvColumn[]
  /** 下载文件名（缺省 export-YYYYMMDD-HHmmss.csv） */
  filename?: string
  /** 是否写 UTF-8 BOM（默认 true —— Excel 打开中文 CSV 不乱码的前提） */
  bom?: boolean
}

/**
 * UTF-8 BOM —— Excel 依赖此前缀识别 UTF-8 编码。
 * 用转义序列而非字面量 U+FEFF：字面量 BOM 在编辑器往返 / git / 格式化工具链中
 * 会被静默剥离（2026-09-18 review HIGH：注释声称显式转义但实现是字面量，已修正），
 * 导致 bom 默认开启却静默失效、Excel 中文乱码极难排查。
 */
const BOM = '﻿'

/** RFC4180 单元格转义：含 , " 换行 的字段整体加引号，内部引号 doubling */
function escapeCell(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/** 取单元格文本：null/undefined → 空串（CSV 无 null 概念），其余 String 化 */
function cellText(row: Record<string, unknown>, col: CsvColumn): string {
  const v = col.value ? col.value(row) : row[col.prop]
  if (v === null || v === undefined) return ''
  return String(v)
}

/**
 * 导出 CSV 并触发浏览器下载。
 *
 * 业务意图：把当前表格行（或任意行集合）落为 CSV 文件，列序/表头文案/取值方式由 columns 声明。
 * 不处理分页全量（业务自行拉全量数据后传入 rows）。
 *
 * @param rows 行数据
 * @param options 列定义 + 文件名 + BOM 开关
 */
export function exportCsv(rows: Record<string, unknown>[], options: ExportCsvOptions): void {
  const { columns, bom = true } = options
  const filename = options.filename ?? `export-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
  const headerLine = columns.map((c) => escapeCell(c.label)).join(',')
  const bodyLines = rows.map((row) => columns.map((c) => escapeCell(cellText(row, c))).join(','))
  const content = [headerLine, ...bodyLines].join('\r\n')
  const blob = new Blob([`${bom ? BOM : ''}${content}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
