/**
 * useSummary 单元测试
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSummary } from './useSummary'

describe('useSummary', () => {
  it('sum 聚合：金额合计', () => {
    const columns = ref([
      { prop: 'name', label: 'Name' },
      { prop: 'amount', label: 'Amount' },
    ])
    const data = ref([
      { name: 'A', amount: 100 },
      { name: 'B', amount: 200 },
      { name: 'C', amount: 300 },
    ] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: { columns: { amount: { aggregate: 'sum' } } },
    })
    expect(summaryRows.value[0]).toBe('合计')
    expect(summaryRows.value[1]).toBe('600')
  })

  it('avg 聚合：平均金额', () => {
    const columns = ref([{ prop: 'amount', label: 'Amount' }])
    const data = ref([{ amount: 100 }, { amount: 200 }, { amount: 300 }] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: { columns: { amount: { aggregate: 'avg' } } },
    })
    expect(summaryRows.value[0]).toBe('200')
  })

  it('count 聚合：行数', () => {
    const columns = ref([{ prop: 'id', label: 'ID' }])
    const data = ref([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: { columns: { id: { aggregate: 'count' } } },
    })
    expect(summaryRows.value[0]).toBe('4')
  })

  it('max / min 聚合', () => {
    const columns = ref([{ prop: 'val', label: 'Val' }])
    const data = ref([{ val: 10 }, { val: 50 }, { val: 30 }] as never)
    const { summaryRows: maxRows } = useSummary({
      columns,
      data,
      config: { columns: { val: { aggregate: 'max' } } },
    })
    expect(maxRows.value[0]).toBe('50')

    const { summaryRows: minRows } = useSummary({
      columns,
      data,
      config: { columns: { val: { aggregate: 'min' } } },
    })
    expect(minRows.value[0]).toBe('10')
  })

  it('未声明聚合的列：返回空字符串（首列除外，显示 label）', () => {
    const columns = ref([
      { prop: 'name', label: 'Name' },
      { prop: 'amount', label: 'Amount' },
    ])
    const data = ref([{ name: 'A', amount: 100 }] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: { columns: { amount: { aggregate: 'sum' } } },
    })
    expect(summaryRows.value[0]).toBe('合计') // 首列 label
    expect(summaryRows.value[1]).toBe('100')
  })

  it('data 为空时：全空字符串占位', () => {
    const columns = ref([{ prop: 'amount', label: 'Amount' }])
    const data = ref<never[]>([])
    const { summaryRows } = useSummary({
      columns,
      data,
      config: { columns: { amount: { aggregate: 'sum' } } },
    })
    expect(summaryRows.value).toEqual([''])
  })

  it('自定义 formatter 优先级高于默认', () => {
    const columns = ref([{ prop: 'amount', label: 'Amount' }])
    const data = ref([{ amount: 100 }, { amount: 200 }] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: {
        columns: {
          amount: {
            aggregate: 'sum',
            formatter: (v) => `¥${v}`,
          },
        },
      },
    })
    expect(summaryRows.value[0]).toBe('¥300')
  })

  it('自定义 label', () => {
    const columns = ref([
      { prop: 'name', label: 'Name' }, // 首列无 cfg → 显示 label
      { prop: 'amount', label: 'Amount' },
    ])
    const data = ref([{ name: 'A', amount: 100 }] as never)
    const { summaryRows } = useSummary({
      columns,
      data,
      config: {
        label: '本页汇总',
        columns: { amount: { aggregate: 'sum' } },
      },
    })
    // 首列无 cfg 时返回 config.label 作为占位（实际渲染由 SummaryRow 决定）
    expect(summaryRows.value[0]).toBe('本页汇总')
    expect(summaryRows.value[1]).toBe('100')
  })
})
