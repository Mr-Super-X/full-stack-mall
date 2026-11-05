/**
 * walkSchema 单元测试
 *
 * 覆盖（M5 公共遍历器契约）：
 * - 四向递归：children（数组/单对象）、node.slots（skip 函数值）、formItem.slots（isSchemaNodeLike 守卫）、array itemSchema
 * - 访问顺序锁定：本节点 → array.itemSchema → children → node.slots → formItem.slots（DFS 先序）
 * - early-exit：visit 返回 false 终止整个遍历
 * - opts 三方向独立关闭（保持各调用方既有遍历范围等价，见批次 3-2 计划）
 * - 数组根节点入口、守卫跳过 string / VNode-like / 非节点对象
 *
 * 设计：visitor 收集访问节点 name，断言收集序列 —— 直接锁定「遍历范围 + 顺序」两个契约。
 */
import { describe, expect, it } from 'vitest'
import type { SchemaNode } from '../types'
import { walkSchema } from './walk-schema'

/** 收集访问过的节点 name 序列（无名节点跳过，便于断言顺序） */
function collectNames(schema: Parameters<typeof walkSchema>[0]): string[] {
  const names: string[] = []
  walkSchema(schema, (n) => {
    if (n.name) names.push(n.name)
  })
  return names
}

/** 造最小节点（SchemaNode 31 字段全可选） */
function n(name: string, extra: Partial<SchemaNode> = {}): SchemaNode {
  return { component: 'Input', name, ...extra }
}

describe('walkSchema', () => {
  it('访问根节点自身', () => {
    expect(collectNames(n('root'))).toEqual(['root'])
  })

  it('数组根节点入口', () => {
    expect(collectNames([n('a'), n('b')])).toEqual(['a', 'b'])
  })

  it('children 数组与单对象均递归', () => {
    const schema = n('root', { children: [n('c1'), n('c2', { children: n('c2-1') })] })
    expect(collectNames(schema)).toEqual(['root', 'c1', 'c2', 'c2-1'])
  })

  it('array itemSchema：单对象与数组形态均递归', () => {
    const single = n('arr1', { kind: 'array', array: { itemSchema: n('item-a') } })
    const multi = n('arr2', {
      kind: 'array',
      array: { itemSchema: [n('item-b'), n('item-c')] },
    })
    expect(collectNames([single, multi])).toEqual(['arr1', 'item-a', 'arr2', 'item-b', 'item-c'])
  })

  it('node.slots：函数值 skip，SchemaNode 与数组值递归', () => {
    const schema = n('root', {
      children: n('slot-parent', {
        slots: {
          header: () => 'fn',
          default: n('slot-node'),
          footer: [n('slot-f1'), n('slot-f2')],
        } as never,
      }),
    })
    expect(collectNames(schema)).toEqual(['root', 'slot-parent', 'slot-node', 'slot-f1', 'slot-f2'])
  })

  it('node.slots：退化节点（仅 reaction 单字段、无 component/name 等标识）也必须下钻', () => {
    // 反向守卫契约：不能用正例启发式，否则 containsReaction 漏判 slots 内 reaction
    // （use-reaction.spec 四向用例覆盖此形态，此处锁定 walkSchema 层守卫语义）
    const schema = n('root', {
      slots: { default: { reaction: { hidden: true } } as never } as never,
    })
    const visited: SchemaNode[] = []
    walkSchema(schema, (node) => {
      visited.push(node)
    })
    expect(visited.some((v) => (v as unknown as Record<string, unknown>).reaction)).toBe(true)
  })

  it('formItem.slots：SchemaNode 递归；string / VNode 值被守卫跳过', () => {
    const schema = n('root', {
      formItem: {
        slots: {
          label: n('label-node'),
          // VNode：__v_isVNode 标记 → shouldSkipSlotValue 反向守卫跳过
          extra: { __v_isVNode: true } as never,
          text: 'plain string' as never,
        } as never,
      },
    })
    expect(collectNames(schema)).toEqual(['root', 'label-node'])
  })

  it('访问顺序：本节点 → array.itemSchema → children → node.slots → formItem.slots', () => {
    const schema = n('root', {
      kind: 'array',
      array: { itemSchema: n('item') },
      children: n('child'),
      slots: { default: n('slot') } as never,
      formItem: { slots: { label: n('fi-slot') } as never } as never,
    })
    expect(collectNames(schema)).toEqual(['root', 'item', 'child', 'slot', 'fi-slot'])
  })

  it('early-exit：visit 返回 false 终止整个遍历（后续节点不再访问）', () => {
    const schema = n('root', { children: [n('a'), n('b'), n('c')] })
    const visited: string[] = []
    walkSchema(schema, (node) => {
      if (node.name) visited.push(node.name)
      if (node.name === 'a') return false
    })
    expect(visited).toEqual(['root', 'a'])
  })

  it('opts.includeNodeSlots: false 关闭 node.slots 方向', () => {
    const schema = n('root', {
      children: n('child', { slots: { default: n('slot-node') } as never }),
    })
    const names: string[] = []
    walkSchema(
      schema,
      (node) => {
        if (node.name) names.push(node.name)
      },
      { includeNodeSlots: false }
    )
    expect(names).toEqual(['root', 'child'])
  })

  it('opts.includeFormItemSlots: false 关闭 formItem.slots 方向', () => {
    const schema = n('root', { formItem: { slots: { label: n('fi') } as never } as never })
    const names: string[] = []
    walkSchema(
      schema,
      (node) => {
        if (node.name) names.push(node.name)
      },
      { includeFormItemSlots: false }
    )
    expect(names).toEqual(['root'])
  })

  it('opts.includeArrayItemSchema: false 关闭 array itemSchema 方向', () => {
    const schema = n('arr', { kind: 'array', array: { itemSchema: n('item') } })
    const names: string[] = []
    walkSchema(
      schema,
      (node) => {
        if (node.name) names.push(node.name)
      },
      { includeArrayItemSchema: false }
    )
    expect(names).toEqual(['arr'])
  })

  it('registerAsyncOptions 等价形态：关闭 formItem.slots + array itemSchema 两向', () => {
    // 对应 use-schema-renderer.ts registerAsyncOptions 既有遍历范围（children/slots 两向）
    const schema = n('root', {
      children: n('child', {
        slots: { default: n('slot-node') } as never,
        formItem: { slots: { label: n('fi') } as never } as never,
      }),
      kind: 'array',
      array: { itemSchema: n('item') },
    })
    const names: string[] = []
    walkSchema(
      schema,
      (node) => {
        if (node.name) names.push(node.name)
      },
      { includeFormItemSlots: false, includeArrayItemSchema: false }
    )
    expect(names).toEqual(['root', 'child', 'slot-node'])
  })

  it('buildIndex 等价形态：关闭 node.slots 方向', () => {
    // 对应 use-schema-index.builder.ts 既有遍历范围（children/formItem.slots/array itemSchema 三向）
    const schema = n('root', {
      children: n('child', {
        slots: { default: n('slot-node') } as never,
        formItem: { slots: { label: n('fi') } as never } as never,
      }),
      kind: 'array',
      array: { itemSchema: n('item') },
    })
    const names: string[] = []
    walkSchema(
      schema,
      (node) => {
        if (node.name) names.push(node.name)
      },
      { includeNodeSlots: false }
    )
    expect(names).toEqual(['root', 'item', 'child', 'fi'])
  })

  it('undefined / 空数组根：安全返回不访问', () => {
    const names: string[] = []
    walkSchema(undefined, (node) => {
      if (node.name) names.push(node.name)
    })
    walkSchema([], (node) => {
      if (node.name) names.push(node.name)
    })
    expect(names).toEqual([])
  })
})
