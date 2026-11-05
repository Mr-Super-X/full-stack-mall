/**
 * array-row-key 单元测试
 *
 * 覆盖：
 * - rowKeyOf: 对象行 WeakMap 稳定 key
 * - rowKeyOf: 原始值行 fallback 到 'i' + index
 * - rowKeyOf: 同对象多次调用返回相同 key（WeakMap 持久化）
 * - rewriteNamePath: 基本前缀化 + sep 自定义
 * - rewriteNamePath: undefined / null / string 透传
 * - rewriteNamePath: 数组递归
 * - rewriteNamePath: 嵌套 children 递归
 * - rewriteNamePath: slots / formItem.slots 递归
 * - rewriteNamePath: keyPrefix 派生稳定 key
 * - rewriteNamePath: 用户显式 key 优先于 keyPrefix
 * - rewriteNamePath: 不传 keyPrefix 时不设置 key
 */
import { describe, expect, it } from 'vitest'
import { newShortUid, rewriteNamePath, rowKeyOf } from './array-row-key'
import type { SchemaNode } from '../types'

describe('rowKeyOf', () => {
  it('对象行 → 返回稳定 key（r 前缀）', () => {
    const row = { a: 1 }
    const k = rowKeyOf(row, 0)
    expect(k).toMatch(/^r[0-9a-f-]+$/)
  })

  it('同对象多次调用返回相同 key（WeakMap 持久化）', () => {
    const row = { a: 1 }
    expect(rowKeyOf(row, 0)).toBe(rowKeyOf(row, 0))
  })

  it('不同对象行 → 不同 key', () => {
    expect(rowKeyOf({ a: 1 }, 0)).not.toBe(rowKeyOf({ a: 2 }, 0))
  })

  it('原始值行（number）→ fallback 到 i + index', () => {
    expect(rowKeyOf(42, 5)).toBe('i5')
  })

  it('原始值行（string）→ fallback 到 i + index', () => {
    expect(rowKeyOf('text', 7)).toBe('i7')
  })

  it('null/undefined → fallback 到 i + index', () => {
    expect(rowKeyOf(null, 3)).toBe('i3')
    expect(rowKeyOf(undefined, 3)).toBe('i3')
  })

  it('WeakMap 隔离：行被 GC 后重新分配的对象 key 不同', () => {
    let row: { a: number } | null = { a: 1 }
    const k1 = rowKeyOf(row, 0)
    row = null // 移除强引用（实际 GC 由运行时决定）
    // 新对象分配 → 新 key（与 k1 不同）
    const k2 = rowKeyOf({ a: 1 }, 0)
    expect(k1).not.toBe(k2)
  })
})

describe('newShortUid', () => {
  it('返回 8 字符前缀字符串', () => {
    const u = newShortUid()
    expect(u).toMatch(/^[0-9a-z]{1,8}$/i)
  })

  it('多次调用返回不同值', () => {
    const uids = new Set([newShortUid(), newShortUid(), newShortUid()])
    expect(uids.size).toBeGreaterThanOrEqual(2)
  })
})

describe('rewriteNamePath', () => {
  it('基本单节点：name 前缀化', () => {
    const input: SchemaNode = { component: 'Input', name: 'qty' }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(out.name).toBe('items[0].qty')
  })

  it('自定义 sep', () => {
    const input: SchemaNode = { component: 'Input', name: 'qty' }
    const out = rewriteNamePath(input, 'items_0', '_') as SchemaNode
    expect(out.name).toBe('items_0_qty')
  })

  it('undefined 节点 → 原样返回 undefined', () => {
    expect(rewriteNamePath(undefined, 'p', '.')).toBeUndefined()
  })

  it('null 节点 → 原样返回 null', () => {
    expect(rewriteNamePath(null as never, 'p', '.')).toBeNull()
  })

  it('string 节点 → 原样返回', () => {
    expect(rewriteNamePath('text' as never, 'p', '.')).toBe('text')
  })

  it('数组递归：每个子节点 name 前缀化', () => {
    const input: SchemaNode[] = [
      { component: 'Input', name: 'a' },
      { component: 'Input', name: 'b' },
    ]
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode[]
    expect(out[0]?.name).toBe('items[0].a')
    expect(out[1]?.name).toBe('items[0].b')
  })

  it('空数组 → 空数组', () => {
    const out = rewriteNamePath([], 'p', '.')
    expect(out).toEqual([])
  })

  it('嵌套 children 递归', () => {
    const input: SchemaNode = {
      component: 'Card',
      children: [
        { component: 'Input', name: 'inner1' },
        { component: 'Input', name: 'inner2' },
      ],
    }
    const out = rewriteNamePath(input, 'root', '.') as SchemaNode
    const children = out.children as SchemaNode[]
    expect(children[0]?.name).toBe('root.inner1')
    expect(children[1]?.name).toBe('root.inner2')
  })

  it('slots 递归', () => {
    const input: SchemaNode = {
      component: 'Card',
      slots: {
        header: { component: 'Input', name: 'title' },
      },
    }
    const out = rewriteNamePath(input, 'root', '.') as SchemaNode
    const slotNode = out.slots?.header as SchemaNode
    expect(slotNode.name).toBe('root.title')
  })

  it('formItem.slots 递归', () => {
    const input: SchemaNode = {
      component: 'Card',
      formItem: {
        slots: {
          label: { component: 'Input', name: 'lbl' },
        },
      },
    }
    const out = rewriteNamePath(input, 'root', '.') as SchemaNode
    const slotNode = (out.formItem as { slots?: Record<string, SchemaNode> }).slots?.label
    expect(slotNode?.name).toBe('root.lbl')
  })

  it('keyPrefix 派生稳定 key（用户未显式配置）', () => {
    const input: SchemaNode = { component: 'Input', name: 'qty' }
    const out = rewriteNamePath(input, 'items[0]', '.', 'items#r9') as SchemaNode
    expect(out.name).toBe('items[0].qty')
    expect(out.key).toBe('items#r9.qty')
  })

  it('keyPrefix 不传 → 不设置 key（向后兼容）', () => {
    const input: SchemaNode = { component: 'Input', name: 'qty' }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(out.key).toBeUndefined()
  })

  it('用户显式配置 key → 优先于 keyPrefix 派生', () => {
    const input: SchemaNode = { component: 'Input', name: 'qty', key: 'userKey' }
    const out = rewriteNamePath(input, 'items[0]', '.', 'items#r9') as SchemaNode
    expect(out.key).toBe('userKey')
  })

  it('无 name 节点 → 不前缀化、不设置 key', () => {
    const input: SchemaNode = { component: 'Card' }
    const out = rewriteNamePath(input, 'root', '.', 'items#r9') as SchemaNode
    expect(out.name).toBeUndefined()
    expect(out.key).toBeUndefined()
  })

  it('slots 中函数式插槽 → 透传（不递归）', () => {
    const slotFn = () => null
    const input: SchemaNode = {
      component: 'Card',
      slots: { default: slotFn as never },
    }
    const out = rewriteNamePath(input, 'root', '.') as SchemaNode
    expect(out.slots?.default).toBe(slotFn)
  })
})
