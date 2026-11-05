/**
 * importCsv / parseCsvText 单元测试（spec 2026-09-18 §3.5 测试矩阵）
 *
 * 覆盖场景：
 * 1) 表头列名映射 prop，值均为 string
 * 2) 引号转义反转：doubling 引号 → 字面引号，引号内含逗号/换行不切分
 * 3) BOM 去除（Excel 保存的 CSV 带 ﻿）
 * 4) 空文件 / 仅表头 → []（合法业务输入不抛错）
 * 5) 全空数据行剔除（Excel 尾部空行）
 * 6) 表头未声明列忽略（模板多列容错）
 * 7) 声明列缺失 → undefined（业务层校验补全）
 *
 * @group ProTable 工具测试
 */
import { describe, it, expect } from 'vitest'
import { importCsv, parseCsvText, type ImportCsvOptions } from './importCsv'
import type { CsvColumn } from './exportCsv'

const columns: CsvColumn[] = [
  { prop: 'name', label: '姓名' },
  { prop: 'amount', label: '金额' },
]

function makeOptions(overrides: Partial<ImportCsvOptions> = {}): ImportCsvOptions {
  return { columns, ...overrides }
}

function csvFile(content: string): File {
  return new File([content], 'test.csv', { type: 'text/csv' })
}

describe('parseCsvText', () => {
  it('基础切分：逗号切 cell、换行切 row', () => {
    expect(parseCsvText('a,b\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('引号内逗号不切分，doubling 引号转字面引号', () => {
    expect(parseCsvText('"含,逗号","说""引号"""')).toEqual([['含,逗号', '说"引号"']])
  })

  it('引号内换行不切行（备注字段多行）', () => {
    expect(parseCsvText('a,b\n"第一行\n第二行",x')).toEqual([
      ['a', 'b'],
      ['第一行\n第二行', 'x'],
    ])
  })

  it('\\r\\n 兼容与尾行无换行兜底', () => {
    expect(parseCsvText('a,b\r\n1,2\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('空字符串返回 []', () => {
    expect(parseCsvText('')).toEqual([])
  })
})

describe('importCsv', () => {
  it('表头列名映射 prop，值均为 string', async () => {
    const rows = await importCsv(csvFile('姓名,金额\n甲,100'), makeOptions())
    expect(rows).toEqual([{ name: '甲', amount: '100' }])
  })

  it('BOM 去除', async () => {
    const rows = await importCsv(csvFile('﻿姓名,金额\n甲,100'), makeOptions())
    expect(rows).toEqual([{ name: '甲', amount: '100' }])
  })

  it('空文件 / 仅表头返回 []', async () => {
    expect(await importCsv(csvFile(''), makeOptions())).toEqual([])
    expect(await importCsv(csvFile('姓名,金额\n'), makeOptions())).toEqual([])
  })

  it('全空数据行剔除', async () => {
    const rows = await importCsv(csvFile('姓名,金额\n甲,100\n,,\n\n'), makeOptions())
    expect(rows).toEqual([{ name: '甲', amount: '100' }])
  })

  it('表头未声明列忽略（模板多列容错）', async () => {
    const rows = await importCsv(csvFile('姓名,金额,备注\n甲,100,x'), makeOptions())
    expect(rows).toEqual([{ name: '甲', amount: '100' }])
  })

  it('声明列在表头缺失 → undefined（业务层校验补全）', async () => {
    const rows = await importCsv(csvFile('姓名\n甲'), makeOptions())
    expect(rows).toEqual([{ name: '甲', amount: undefined }])
  })

  it('引号字段整体解析（含逗号）', async () => {
    const rows = await importCsv(csvFile('姓名,金额\n"含,逗号",100'), makeOptions())
    expect(rows).toEqual([{ name: '含,逗号', amount: '100' }])
  })
})
