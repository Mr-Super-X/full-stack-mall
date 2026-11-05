/**
 * render-visual-container 单元测试
 *
 * 覆盖：
 * - 基本渲染：Card 容器包 children
 * - 有 row/column → 走 grid 渲染
 * - 自定义 slots 转发
 * - defaultValue props 合并（componentProps + node.props）
 * - 异步 props 合并（asyncProps）
 * - disabled / key 透传
 */
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { ElCard } from 'element-plus'
import { renderVisualContainer } from './render-visual-container'
import type { RenderSchemaNodeOptions } from './render-schema-node'
import type { SchemaNode } from '../types'

function makeOpts(overrides?: Partial<RenderSchemaNodeOptions>): RenderSchemaNodeOptions {
  return {
    model: {} as never,
    components: {},
    beforeChange: undefined,
    beforeChangeRules: undefined,
    rules: {},
    componentProps: undefined,
    render: vi.fn((node: SchemaNode) => {
      if (!node) return undefined
      return h('div', { 'data-test': node.name ?? 'card-child' })
    }) as never,
    ...overrides,
  }
}

describe('renderVisualContainer', () => {
  it('Card 容器 + children → 渲染 Card 包 children', () => {
    const node: SchemaNode = {
      component: 'Card',
      props: { title: '卡片标题' },
      children: [{ name: 'fieldA' }],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    expect(vnode).toBeDefined()
  })

  it('有 row 配置 → 走 grid 渲染', () => {
    const node: SchemaNode = {
      component: 'Card',
      row: { gutter: 24 },
      children: [{ name: 'f1' }, { name: 'f2' }],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    expect(vnode).toBeDefined()
  })

  it('有 column 配置 → 走 grid 渲染', () => {
    const node: SchemaNode = {
      component: 'Card',
      column: 2,
      children: [{ name: 'f1' }],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    expect(vnode).toBeDefined()
  })

  it('自定义 slots → 转发给容器', () => {
    const node: SchemaNode = {
      component: 'Card',
      slots: {
        header: { component: 'span', children: '自定义 header' },
      },
      children: [],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    expect(vnode).toBeDefined()
  })

  it('node.props 透传到容器', () => {
    const node: SchemaNode = {
      component: 'Card',
      props: { shadow: 'always' },
      children: [],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    const props = (vnode as unknown as { props: { shadow?: string } }).props
    expect(props.shadow).toBe('always')
  })

  it('componentProps 默认值（按组件名注入）', () => {
    const node: SchemaNode = { component: 'Card', children: [] }
    const opts = makeOpts({
      componentProps: { Card: { shadow: 'hover' } },
    })
    const vnode = renderVisualContainer(node, ElCard, opts, {})
    const props = (vnode as unknown as { props: { shadow?: string } }).props
    expect(props.shadow).toBe('hover')
  })

  it('node.props 优先级高于 componentProps 默认值', () => {
    const node: SchemaNode = {
      component: 'Card',
      props: { shadow: 'never' }, // 显式设置
      children: [],
    }
    const opts = makeOpts({
      componentProps: { Card: { shadow: 'hover' } }, // 默认值
    })
    const vnode = renderVisualContainer(node, ElCard, opts, {})
    const props = (vnode as unknown as { props: { shadow?: string } }).props
    expect(props.shadow).toBe('never') // node.props 覆盖
  })

  it('asyncProps 合并到容器 props', () => {
    const node: SchemaNode = { component: 'Card', children: [] }
    const asyncProps = { 'data-async': 'value' }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), asyncProps)
    const props = (vnode as unknown as { props: { 'data-async'?: string } }).props
    expect(props['data-async']).toBe('value')
  })

  it('disabled 字段级透传', () => {
    const node: SchemaNode = {
      component: 'Card',
      disabled: true,
      children: [],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    const props = (vnode as unknown as { props: { disabled?: boolean } }).props
    expect(props.disabled).toBe(true)
  })

  it('disabled 未设置 → 不传 disabled prop', () => {
    const node: SchemaNode = { component: 'Card', children: [] }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    const props = (vnode as unknown as { props: { disabled?: boolean } }).props
    expect(props.disabled).toBeUndefined()
  })

  it('key 透传（vnode diff 标识）', () => {
    const node: SchemaNode = {
      component: 'Card',
      key: 'card-1',
      children: [],
    }
    const vnode = renderVisualContainer(node, ElCard, makeOpts(), {})
    const props = (vnode as unknown as { props: { key?: string } }).props
    expect(props.key).toBe('card-1')
  })

  it('无 children 时渲染空容器', () => {
    const node: SchemaNode = { component: 'Card' }
    expect(() => renderVisualContainer(node, ElCard, makeOpts(), {})).not.toThrow()
  })
})
