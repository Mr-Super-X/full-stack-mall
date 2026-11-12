/**
 * inheritContainerLabelWidth 单元测试
 * @see ./inherit-container-labelwidth.ts
 */
import { describe, expect, it } from 'vitest'
import type { SchemaNode } from '../types'
import { inheritContainerLabelWidth } from './inherit-container-labelwidth'

describe('inheritContainerLabelWidth', () => {
  it('容器 labelWidth 下推给未配置的字段', () => {
    const schema: SchemaNode = {
      children: [
        {
          labelWidth: '55px',
          children: [
            { component: 'Input', name: 'a', label: 'A' },
            { component: 'Input', name: 'b', label: 'B' },
          ],
        },
      ],
    }

    inheritContainerLabelWidth(schema)

    const container = schema.children as SchemaNode[]
    const fields = container[0].children as SchemaNode[]
    expect(fields[0].labelWidth).toBe('55px')
    expect(fields[1].labelWidth).toBe('55px')
  })

  it('字段级已配置 labelWidth 不被容器继承值覆盖', () => {
    const schema: SchemaNode = {
      children: [
        {
          labelWidth: '55px',
          children: [
            { component: 'Input', name: 'a', label: 'A', labelWidth: '120px' },
            { component: 'Input', name: 'b', label: 'B' },
          ],
        },
      ],
    }

    inheritContainerLabelWidth(schema)

    const fields = (schema.children as SchemaNode[])[0].children as SchemaNode[]
    expect(fields[0].labelWidth).toBe('120px')
    expect(fields[1].labelWidth).toBe('55px')
  })

  it('无 label 字段不继承（保持无 label 强制 0px 的防空白语义）', () => {
    const schema: SchemaNode = {
      children: [
        {
          labelWidth: '55px',
          children: [
            { component: 'Input', name: 'a' }, // 无 label
            { component: 'Input', name: 'b', label: '' }, // 空 label
            { component: 'Input', name: 'c', label: 'C' },
          ],
        },
      ],
    }

    inheritContainerLabelWidth(schema)

    const fields = (schema.children as SchemaNode[])[0].children as SchemaNode[]
    expect(fields[0].labelWidth).toBeUndefined()
    expect(fields[1].labelWidth).toBeUndefined()
    expect(fields[2].labelWidth).toBe('55px')
  })

  it('数组 itemSchema 根 labelWidth 传播进行内字段（规格行业务场景）', () => {
    const schema: SchemaNode = {
      children: [
        {
          kind: 'array',
          name: 'items',
          label: '规格',
          array: {
            itemSchema: {
              column: 3,
              labelWidth: '55px',
              children: [
                { component: 'Input', name: 'size', label: '尺码' },
                { component: 'InputNumber', name: 'price', label: '价格' },
              ],
            },
          },
        },
      ],
    }

    inheritContainerLabelWidth(schema)

    const arrayNode = (schema.children as SchemaNode[])[0]
    const itemFields = (arrayNode.array!.itemSchema as SchemaNode).children as SchemaNode[]
    expect(itemFields[0].labelWidth).toBe('55px')
    expect(itemFields[1].labelWidth).toBe('55px')
  })

  it('顶层 schema 的 labelWidth 不参与下推（el-form 全局默认语义保留）', () => {
    const schema: SchemaNode = {
      labelWidth: '90px',
      children: [
        { component: 'Input', name: 'a', label: 'A' },
        { component: 'Input', name: 'b', label: 'B' },
      ],
    }

    inheritContainerLabelWidth(schema)

    const fields = schema.children as SchemaNode[]
    expect(fields[0].labelWidth).toBeUndefined()
    expect(fields[1].labelWidth).toBeUndefined()
  })

  it('就近优先：内层容器 labelWidth 覆盖外层继承值', () => {
    const schema: SchemaNode = {
      children: [
        {
          labelWidth: '80px',
          children: [
            {
              labelWidth: '40px',
              children: [{ component: 'Input', name: 'a', label: 'A' }],
            },
            {
              children: [{ component: 'Input', name: 'b', label: 'B' }],
            },
          ],
        },
      ],
    }

    inheritContainerLabelWidth(schema)

    const outer = (schema.children as SchemaNode[])[0].children as SchemaNode[]
    expect((outer[0].children as SchemaNode[])[0].labelWidth).toBe('40px')
    expect((outer[1].children as SchemaNode[])[0].labelWidth).toBe('80px')
  })

  it('数组形态顶层 schema 同样处理', () => {
    const schema: SchemaNode[] = [
      {
        labelWidth: '55px',
        children: [{ component: 'Input', name: 'a', label: 'A' }],
      },
    ]

    inheritContainerLabelWidth(schema)

    const fields = schema[0].children as SchemaNode[]
    expect(fields[0].labelWidth).toBe('55px')
  })
})
