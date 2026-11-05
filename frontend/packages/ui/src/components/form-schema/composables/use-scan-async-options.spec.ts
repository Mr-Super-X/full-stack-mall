/**
 * scanAsyncOptionsUnsupported 单元测试
 *
 * 覆盖：
 * - 空 schema（对象/数组形态）→ 空清单
 * - asyncOptions 在 children 常规位置 → 可达，不告警
 * - asyncOptions 在 array.itemSchema 内 → 命中并带字段名
 * - asyncOptions 在 formItem.slots 内 → 命中
 * - 混合场景 → 只报不可达节点
 * - 未命名节点 → （未命名节点）兜底描述
 */
import { describe, expect, it } from 'vitest'
import type { SchemaNode } from '../types'
import { scanAsyncOptionsUnsupported } from './use-scan-async-options'

/** 占位 asyncOptions 配置（扫描只判存在性，source 不会被调用） */
const ASYNC = { source: async () => [] } as never

describe('scanAsyncOptionsUnsupported', () => {
  it('空 schema（对象/数组形态）→ 空清单', () => {
    expect(scanAsyncOptionsUnsupported({ children: [] })).toEqual([])
    expect(scanAsyncOptionsUnsupported([])).toEqual([])
  })

  it('asyncOptions 在 children 常规位置 → 可达，不告警', () => {
    const schema: SchemaNode[] = [{ component: 'Select', name: 'city', asyncOptions: ASYNC }]
    expect(scanAsyncOptionsUnsupported(schema)).toEqual([])
  })

  it('asyncOptions 在 array.itemSchema 内 → 命中并带字段名', () => {
    const schema: SchemaNode = {
      kind: 'array',
      name: 'items',
      array: {
        itemSchema: {
          children: [{ component: 'Select', name: 'productId', asyncOptions: ASYNC }],
        },
      },
    }
    expect(scanAsyncOptionsUnsupported(schema)).toEqual(['字段 "productId"'])
  })

  it('asyncOptions 在 formItem.slots 内 → 命中', () => {
    const schema: SchemaNode = {
      component: 'Input',
      name: 'a',
      formItem: {
        slots: { default: { component: 'Select', name: 'inner', asyncOptions: ASYNC } },
      },
    }
    expect(scanAsyncOptionsUnsupported(schema)).toEqual(['字段 "inner"'])
  })

  it('混合场景 → 只报不可达节点，可达节点不误报', () => {
    const schema: SchemaNode[] = [
      { component: 'Select', name: 'ok', asyncOptions: ASYNC },
      {
        kind: 'array',
        name: 'rows',
        array: {
          itemSchema: { children: [{ component: 'Select', name: 'bad', asyncOptions: ASYNC }] },
        },
      },
    ]
    expect(scanAsyncOptionsUnsupported(schema)).toEqual(['字段 "bad"'])
  })

  it('未命名节点 → （未命名节点）兜底描述', () => {
    const schema: SchemaNode = {
      kind: 'array',
      name: 'rows',
      array: {
        itemSchema: { children: [{ component: 'Select', asyncOptions: ASYNC }] },
      },
    }
    expect(scanAsyncOptionsUnsupported(schema)).toEqual(['（未命名节点）'])
  })
})
