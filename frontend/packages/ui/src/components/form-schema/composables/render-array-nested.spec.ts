/**
 * P0-3 嵌套 array 路径前缀化测试
 *
 * 目的：验证 XForm 在外层 array + 内层 array 场景下，
 *       内层字段 name 正确前缀化为 list[i].subList[j].field，
 *       保证 el-form prop 路径正确。
 *
 * 渲染流程：
 * 1. 外层 array (items) 渲染 row 0 → rewriteNamePath(outerItemSchema, 'items[0]', '.')
 *    → 内层 array 节点 name='items[0].subItems'，但其 itemSchema.children[0].name='field'（待处理）
 * 2. opts.render 触发主调度 → renderArrayNode 处理内层 array 节点
 *    → rewriteNamePath(innerArray.array.itemSchema, 'items[0].subItems[0]', '.')
 *    → children[0].name='field' → 'items[0].subItems[0].field' ✓
 *
 * P0-3 增强：rewriteNamePath 加防重复前缀逻辑，避免嵌套 array 误用时重复前缀。
 *
 * @see ./array-row-key.ts rewriteNamePath
 * @see ./render-array-node.ts renderRow
 * @see docs/superpowers/plans/2026-09-04-form-schema-optimization.md Task 10
 */
import { describe, it, expect } from 'vitest'
import { rewriteNamePath } from './array-row-key'
import type { SchemaNode } from '../types'

describe('P0-3 嵌套 array 路径前缀化', () => {
  it('完整渲染流程：外层 + 内层 array 渲染后，字段 name 为 items[0].subItems[0].field', () => {
    const innerField: SchemaNode = { component: 'Input', name: 'field' }
    const innerArrayItemSchema: SchemaNode = { children: [innerField] }
    const innerArray: SchemaNode = {
      kind: 'array',
      name: 'subItems',
      array: { itemSchema: innerArrayItemSchema },
    }
    const outerItemSchema: SchemaNode = {
      column: 1,
      children: [innerArray],
    }

    // Step 1: 外层 array 渲染 row 0
    const firstRewrite = rewriteNamePath(outerItemSchema, 'items[0]', '.', 'items#r0')
    const innerArrayAfterFirst = firstRewrite.children?.[0]
    expect(innerArrayAfterFirst?.name).toBe('items[0].subItems')

    // 此时内层 array 节点的 itemSchema.children[0].name 未前缀（保持 'field'）
    const innerFieldBeforeSecond = (innerArrayAfterFirst as SchemaNode).array
      ?.itemSchema as SchemaNode
    expect(innerFieldBeforeSecond?.children?.[0]?.name).toBe('field')

    // Step 2: 内层 array 渲染 row 0（listName='items[0].subItems'，prefix='items[0].subItems[0]'）
    const secondRewrite = rewriteNamePath(
      (innerArrayAfterFirst as SchemaNode).array?.itemSchema,
      'items[0].subItems[0]',
      '.',
      'items[0].subItems#r0'
    )
    expect(secondRewrite.children?.[0]?.name).toBe('items[0].subItems[0].field')
  })

  it('防重复前缀：已前缀节点再调 rewriteNamePath 不会重复加前缀', () => {
    const innerArray: SchemaNode = {
      kind: 'array',
      name: 'subItems',
      array: {
        itemSchema: {
          children: [{ component: 'Input', name: 'field' }],
        },
      },
    }

    // 第一次：外层调用，prefix='items[0]'
    const first = rewriteNamePath(innerArray, 'items[0]', '.') as SchemaNode
    expect(first.name).toBe('items[0].subItems')

    // 第二次：内层 array 渲染时 prefix='items[0].subItems[0]'
    // 修复后：检测已前缀（name 以 'items[0].subItems' 开头）→ 跳过 → 保持 'items[0].subItems'
    const second = rewriteNamePath(first, 'items[0].subItems[0]', '.') as SchemaNode
    expect(second.name).toBe('items[0].subItems')
  })

  it('防重复前缀：未前缀节点正常加前缀', () => {
    const node: SchemaNode = { component: 'Input', name: 'qty' }
    const out = rewriteNamePath(node, 'items[0]', '.') as SchemaNode
    expect(out.name).toBe('items[0].qty')
  })

  it('防重复前缀：不同 prefix 链式前缀化（如 outer→inner→deep）', () => {
    // 场景：3 层嵌套字段，第一层加 prefix1，第二层加 prefix2（基于第一层结果）
    const node: SchemaNode = { component: 'Input', name: 'value' }
    const first = rewriteNamePath(node, 'a', '.') as SchemaNode
    expect(first.name).toBe('a.value')

    // 第二次用不同 prefix（'b'，不与 first.name 冲突）
    const second = rewriteNamePath(first, 'b', '.') as SchemaNode
    // 防重复检测：first.name='a.value' 不以 'b.' 开头 → 正常加 prefix → 'b.a.value'
    expect(second.name).toBe('b.a.value')
  })
})
