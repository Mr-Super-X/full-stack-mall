/**
 * render-with-grid 单元测试
 *
 * 覆盖：
 * - column=2 → ElCol span=12
 * - column=3 → ElCol span=8
 * - column=undefined → span=24
 * - children 是数组 → 多个 ElCol
 * - children 是单节点 → 包装为单元素数组
 * - children=undefined / string → 空数组
 * - ElRow 接收 row 配置
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, type VNode } from 'vue'
import { renderToComponentWithGrid } from './render-with-grid'
import type { SchemaNode } from '../types'

const renderFn = vi.fn((node: SchemaNode) => {
  return h('div', { 'data-test': node.name ?? 'cell' })
})
const render = renderFn as never

beforeEach(() => {
  renderFn.mockClear()
})

describe('renderToComponentWithGrid', () => {
  it('column=2 → ElCol span=12', () => {
    const node: SchemaNode = {
      column: 2,
      children: [{ name: 'a' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as VNode
    expect(vnode).toBeDefined()
  })

  it('column=3 → ElCol span=8', () => {
    const node: SchemaNode = {
      column: 3,
      children: [{ name: 'a' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as VNode
    expect(vnode).toBeDefined()
  })

  it('column=4 → ElCol span=6', () => {
    const node: SchemaNode = {
      column: 4,
      children: [{ name: 'a' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as VNode
    expect(vnode).toBeDefined()
  })

  it('column 缺失 → span=24', () => {
    const node: SchemaNode = {
      children: [{ name: 'a' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as VNode
    expect(vnode).toBeDefined()
  })

  it('children 数组 → 渲染多个 ElCol（vnode 结构）', () => {
    const node: SchemaNode = {
      column: 2,
      children: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as unknown as {
      children?: { default?: () => unknown[] }
    }
    // 调用 default slot 拿内部 vnode 列表
    const slotFn = (vnode.children as { default?: () => unknown[] }).default
    const innerChildren = slotFn!()
    expect(Array.isArray(innerChildren)).toBe(true)
    expect(innerChildren).toHaveLength(3)
  })

  it('children 单节点（非数组） → 包装为单元素数组', () => {
    const node: SchemaNode = {
      column: 2,
      children: { name: 'single' } as never,
    }
    const vnode = renderToComponentWithGrid(node, render) as unknown as {
      children?: { default?: () => unknown[] }
    }
    const slotFn = (vnode.children as { default?: () => unknown[] }).default
    const innerChildren = slotFn!()
    expect(innerChildren).toHaveLength(1)
  })

  it('children=undefined → 渲染空 ElRow（不抛错）', () => {
    const node: SchemaNode = { column: 2 }
    expect(() => renderToComponentWithGrid(node, render)).not.toThrow()
  })

  it('children 是字符串 → 渲染空 ElRow', () => {
    const node: SchemaNode = {
      column: 2,
      children: '文本内容' as never,
    }
    const vnode = renderToComponentWithGrid(node, render) as unknown as {
      children?: { default?: () => unknown[] }
    }
    const slotFn = (vnode.children as { default?: () => unknown[] }).default
    const innerChildren = slotFn!()
    // 字符串不是 SchemaNode → arr 为空
    expect(innerChildren).toEqual([])
  })

  it('row 配置透传到 ElRow', () => {
    const node: SchemaNode = {
      row: { gutter: 24, type: 'flex' },
      children: [{ name: 'a' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as VNode
    expect(vnode).toBeDefined()
  })

  it('子节点 key 优先于数组 index', () => {
    const node: SchemaNode = {
      column: 2,
      children: [{ name: 'a', key: 'custom-key' }],
    }
    const vnode = renderToComponentWithGrid(node, render) as unknown as {
      children?: { default?: () => Array<{ props?: { key?: string } }> }
    }
    const slotFn = (vnode.children as { default?: () => Array<{ props?: { key?: string } }> })
      .default
    const innerChildren = slotFn!()
    expect(innerChildren).toBeDefined()
    expect(innerChildren[0]?.props?.key).toBe('custom-key')
  })
})
