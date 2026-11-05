/**
 * importCsv —— 零依赖 CSV 解析导入（spec 2026-09-18 §3.4，设计 D7）
 *
 * 项目角色：ProTable 配套导入工具。File → 行数据 Record[]，转义反转 + 表头列名映射。
 * 仅负责「文件 → 行数据」；上传 / 服务端校验 / 错误明细回显归业务层（组件不内建的理由）。
 *
 * @see [`./exportCsv`](./exportCsv.ts) 导出（转义正向）
 * @group ProTable 工具
 */
import type { CsvColumn } from './exportCsv'

/** importCsv 选项 */
export interface ImportCsvOptions {
  /**
   * 列映射 —— label 匹配 CSV 表头列名，prop 作为输出行对象的 key。
   * 表头中出现未声明的列名时忽略（容错：模板多列不报错）；
   * 声明的列在表头中缺失时输出 undefined（业务层校验补全）。
   */
  columns: CsvColumn[]
  /**
   * 文件大小上限（字节）—— 缺省不设限（保持既有行为）。
   * 2026-09-18 review：file.text() 一次性读入内存，字符串 + rows 二维数组 + 输出对象
   * 约为文件体积的数倍，低内存设备大文件会 OOM。业务侧若面向大文件导入场景，
   * 应显式设限（如 50 * 1024 * 1024）并由调用方捕获提示用户。
   */
  maxFileSize?: number
}

/**
 * RFC4180 全文状态机解析 —— 一次扫描产出 rows → cells 二维数组。
 *
 * 为什么不用 split('\n')：引号内换行（备注字段）不是行边界，必须先做引号感知切分。
 * 状态机规则：
 * - 字段起始 '"' 进入引号态（引号本身不入值）
 * - 引号态内 '"' 后紧跟 '"' 是转义字面引号（doubling 反转）
 * - 引号态内 '"' 单独出现退出引号态
 * - 引号态外 ',' 切 cell、'\n' 切 row（'\r' 跳过，兼容 \r\n）
 */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
      i++
      continue
    }
    cell += ch
    i++
  }
  // 尾行无换行结尾时兜底收尾
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/**
 * 解析 CSV 文件为行数据。
 *
 * 业务意图：导入模板 → 结构化行 → 业务层逐行校验后提交后端。
 * 空文件 / 只有表头的文件返回 []（不抛错——空导入是合法业务输入）。
 *
 * @param file 用户选择的 .csv 文件（input[type=file] 或拖拽来源）
 * @param options 列映射（label → prop）
 * @returns 行对象数组（值均为 string，类型转换归业务层）
 */
export async function importCsv(
  file: File,
  options: ImportCsvOptions
): Promise<Record<string, unknown>[]> {
  // 大小守卫（可选）：超限抛 RangeError 由业务层捕获提示（职责边界：utils 只负责解析）
  if (options.maxFileSize !== undefined && file.size > options.maxFileSize) {
    throw new RangeError(
      `[importCsv] 文件大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过上限 ${(options.maxFileSize / 1024 / 1024).toFixed(1)}MB`
    )
  }
  const raw = await file.text()
  // 去 BOM（Excel 保存的 CSV 常带 UTF-8 BOM）
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const rows = parseCsvText(text)
  // noUncheckedIndexedAccess：rows[0] 索引访问不随 length 检查 narrowing，显式守卫
  const headerRow = rows[0]
  if (headerRow === undefined) return []

  const labelToProp = new Map(options.columns.map((c) => [c.label, c.prop]))
  const header = headerRow.map((h) => h.trim())
  // 剔除全空数据行（Excel 尾部常带空行）
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== ''))

  return dataRows.map((cells) => {
    const obj: Record<string, unknown> = {}
    header.forEach((label, idx) => {
      const prop = labelToProp.get(label)
      if (prop) obj[prop] = cells[idx] ?? ''
    })
    return obj
  })
}
