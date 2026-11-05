import { describe, it, expect } from 'vitest'
import type { SchemaNode } from '../types'
import { applyReactionFields } from './apply-reaction-fields'

describe('applyReactionFields(node, reaction, model)', () => {
  it('字面量直接写入 node[key]', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(node, { label: '新标签' }, {})
    expect(node.label).toBe('新标签')
  })

  it('字符串函数表达式求值后写入 node[key]', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(node, { label: '{{ (m) => m.x ? "A" : "B" }}' }, { x: true })
    expect(node.label).toBe('A')
  })

  it('函数 reaction 求值后写入 node[key](P0 label 用法兼容)', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(
      node,
      { label: (m: Record<string, unknown>) => ((m.x as number) > 0 ? 'positive' : 'zero') },
      { x: 5 }
    )
    expect(node.label).toBe('positive')
  })

  it('元字段 strategy / delay 不写入 node(避免序列化时带元数据)', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(
      node,
      {
        strategy: 'debounce',
        delay: 300,
        label: '实际字段',
      },
      {}
    )
    expect(node.label).toBe('实际字段')
    // 元字段不应写入 node —— schema JSON 序列化时不应带元数据
    expect((node as Record<string, unknown>).strategy).toBeUndefined()
    expect((node as Record<string, unknown>).delay).toBeUndefined()
  })

  it('函数 reaction 副作用:写 model + 返回值赋给 node[key]', () => {
    const node: SchemaNode = {} as SchemaNode
    const m: Record<string, unknown> = { count: 0 }
    applyReactionFields(
      node,
      {
        searchResults: (model: Record<string, unknown>) => {
          // 副作用:写 model
          model.searchResults = ['Apple', 'Banana']
          // 返回值也会赋给 node.searchResults(冗余但保持兼容)
          return model.searchResults
        },
      },
      m
    )
    // 函数副作用生效
    expect(m.searchResults).toEqual(['Apple', 'Banana'])
    // 返回值也赋给 node(保持 P0 兼容)
    expect((node as Record<string, unknown>).searchResults).toEqual(['Apple', 'Banana'])
  })

  // ---- H5 回归：值未变化跳过写入 ----

  it('元字段 deps 不写入 node（与 strategy/delay 同为调度元数据）', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(node, { deps: ['a'], label: '实际字段' }, {})
    expect(node.label).toBe('实际字段')
    expect((node as Record<string, unknown>).deps).toBeUndefined()
  })

  it('值未变化时跳过写入（保持原引用，避免多余响应式通知）', () => {
    const node: SchemaNode = {} as SchemaNode
    applyReactionFields(node, { label: '旧' }, {})
    // 字面量重复写入相同值：内容相等，node 不变（无异常即正确，下方对象用例验证引用保持）
    applyReactionFields(node, { label: '旧' }, {})
    expect(node.label).toBe('旧')
  })

  it('对象值内容相等时保留首次写入的引用（不被同值新对象覆盖）', () => {
    const node: SchemaNode = {} as SchemaNode
    const first = { size: 'large' }
    applyReactionFields(node, { props: first }, {})
    const afterFirst = (node as Record<string, unknown>).props
    applyReactionFields(node, { props: { size: 'large' } }, {})
    // 同值新对象不应覆盖 —— 覆盖会产生一次无意义的响应式通知
    expect((node as Record<string, unknown>).props).toBe(afterFirst)
    // 值真正变化时正常覆盖
    applyReactionFields(node, { props: { size: 'small' } }, {})
    expect((node as Record<string, unknown>).props).toEqual({ size: 'small' })
  })
})
