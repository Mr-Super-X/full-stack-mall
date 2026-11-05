/**
 * exportCsv 单元测试（spec 2026-09-18 §3.5 测试矩阵）
 *
 * 覆盖场景：
 * 1) 生成 Blob 内容：表头 + 行数据 + \r\n 行分隔
 * 2) UTF-8 BOM 前缀（默认写入，bom:false 时不写）
 * 3) RFC4180 转义：含逗号/引号/换行的字段加引号，引号 doubling
 * 4) null/undefined 字段导出为空串
 * 5) value 自定义取值（枚举翻译/格式化）
 * 6) 文件名缺省格式 export-*.csv；显式 filename 透传
 * 7) 触发下载：a[download].click + createObjectURL/revokeObjectURL 配对
 *
 * jsdom 不实现 URL.createObjectURL，用 vi.stubGlobal 打桩并捕获 Blob 供内容断言。
 *
 * @group ProTable 工具测试
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { exportCsv, type CsvColumn } from './exportCsv'

const columns: CsvColumn[] = [
  { prop: 'name', label: '姓名' },
  { prop: 'amount', label: '金额' },
]

/** 捕获下载产物：blob 内容 + a 标签行为 */
function stubDownload() {
  const captured: { blob: Blob; filename: string } = { blob: new Blob(), filename: '' }
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      captured.blob = blob
      return 'blob:mock-url'
    }),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set').mockImplementation(function (
    this: HTMLAnchorElement,
    v: string
  ) {
    captured.filename = v
  })
  return { captured, clickSpy }
}

describe('exportCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('生成 Blob 内容：表头 + 行数据 + \\r\\n 分隔', async () => {
    const { captured } = stubDownload()
    exportCsv(
      [
        { name: '甲', amount: 100 },
        { name: '乙', amount: 200 },
      ],
      { columns, filename: 't.csv' }
    )
    const text = await captured.blob.text()
    expect(text).toContain('姓名,金额')
    expect(text).toContain('甲,100')
    expect(text).toContain('乙,200')
    expect(text.split('\r\n')).toHaveLength(3) // 表头 + 2 行
  })

  it('默认写 UTF-8 BOM，bom:false 时不写', async () => {
    const a = stubDownload()
    exportCsv([{ name: '甲' }], { columns, filename: 't.csv' })
    // 断言底层字节而非 blob.text() —— TextDecoder 规范会 strip 开头 BOM（ignoreBOM 默认 false）
    const bufA = new Uint8Array(await a.captured.blob.arrayBuffer())
    expect([bufA[0], bufA[1], bufA[2]]).toEqual([0xef, 0xbb, 0xbf])

    const b = stubDownload()
    exportCsv([{ name: '甲' }], { columns, filename: 't.csv', bom: false })
    const bufB = new Uint8Array(await b.captured.blob.arrayBuffer())
    expect(bufB[0]).not.toBe(0xef)
  })

  it('RFC4180 转义：逗号/引号/换行字段加引号，引号 doubling', async () => {
    const { captured } = stubDownload()
    exportCsv([{ name: '含,逗号', amount: '说"引号"' }], { columns, filename: 't.csv' })
    const text = await captured.blob.text()
    expect(text).toContain('"含,逗号"')
    expect(text).toContain('"说""引号"""')
  })

  it('null/undefined 字段导出为空串', async () => {
    const { captured } = stubDownload()
    exportCsv([{ name: null, amount: undefined }], { columns, filename: 't.csv' })
    const text = await captured.blob.text()
    expect(text).toContain(',')
    const line = text.split('\r\n')[1] ?? ''
    expect(line.startsWith(',')).toBe(true) // 首字段空
    expect(line.endsWith(',')).toBe(true) // 次字段空
  })

  it('value 自定义取值（枚举翻译）', async () => {
    const { captured } = stubDownload()
    exportCsv([{ status: 'paid' }], {
      columns: [
        {
          prop: 'status',
          label: '状态',
          value: (r) => (r['status'] === 'paid' ? '已支付' : '未支付'),
        },
      ],
      filename: 't.csv',
    })
    const text = await captured.blob.text()
    expect(text).toContain('已支付')
  })

  it('文件名：缺省 export- 前缀 .csv 后缀，显式 filename 透传', () => {
    const { captured } = stubDownload()
    exportCsv([], { columns })
    expect(captured.filename).toMatch(/^export-\d{8}-\d{6}\.csv$/)

    const b = stubDownload()
    exportCsv([], { columns, filename: '订单明细.csv' })
    expect(b.captured.filename).toBe('订单明细.csv')
  })

  it('触发下载：click 调用 + createObjectURL/revokeObjectURL 配对', () => {
    const { clickSpy } = stubDownload()
    exportCsv([{ name: '甲' }], { columns, filename: 't.csv' })
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
