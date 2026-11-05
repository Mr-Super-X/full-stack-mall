/**
 * withHidden 单元测试
 * 覆盖：
 * - 返回 display:none + aria-hidden=true 的 div wrapper
 * - 内含原 vnode
 */
import { describe, it, expect } from 'vitest'
import { h, type VNode } from 'vue'
import { withHidden } from './with-hidden'

describe('withHidden', () => {
  it('返回一个 div wrapper', () => {
    const inner = h('span', 'content')
    const result = withHidden(inner)
    expect(result).toBeDefined()
    expect(result.type).toBe('div')
  })

  it('div 上有 display: none 样式', () => {
    const inner = h('span', 'content')
    const result = withHidden(inner) as unknown as { props?: Record<string, unknown> }
    expect(result.props?.style).toBe('display: none')
  })

  it('div 上有 aria-hidden=true', () => {
    const inner = h('span', 'content')
    const result = withHidden(inner) as unknown as { props?: Record<string, unknown> }
    expect(result.props?.['aria-hidden']).toBe('true')
  })

  it('children 数组中包含原 vnode', () => {
    const inner = h('span', 'content')
    const result = withHidden(inner) as unknown as { children?: VNode[] }
    expect(result.children).toBeDefined()
    expect(result.children).toHaveLength(1)
    expect(result.children?.[0]).toBe(inner)
  })

  it('嵌套调用 withHidden 仍是合法的 vnode', () => {
    const inner = h('input')
    const hidden1 = withHidden(inner)
    const hidden2 = withHidden(hidden1)
    expect(hidden2).toBeDefined()
    expect(hidden2.type).toBe('div')
  })
})
