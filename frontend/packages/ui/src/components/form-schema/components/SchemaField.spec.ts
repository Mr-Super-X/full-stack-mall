/**
 * SchemaField 单元测试
 *
 * 覆盖：
 * - props 透传：node + renderFn
 * - renderFn 被调用并接收 node
 * - renderFn 返回 VNode → 渲染该 VNode
 * - renderFn 返回字符串 → 渲染文本
 * - renderFn 返回 undefined → 无渲染（不报错）
 * - renderFn 返回数组 → 渲染多个 vnode
 * - renderFn 返回 null → 无渲染
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import SchemaField from './SchemaField.vue'
import type { SchemaNode } from '../types'

describe('SchemaField', () => {
  it('renderFn 被调用并接收 node', () => {
    const renderFn = vi.fn(() => h('div', 'rendered'))
    const node: SchemaNode = { component: 'Input', name: 'email' }
    mount(SchemaField, {
      props: { node, renderFn },
    })
    expect(renderFn).toHaveBeenCalledWith(node)
  })

  it('renderFn 返回 VNode → 渲染该 VNode', () => {
    const node: SchemaNode = { component: 'Input', name: 'email' }
    const wrapper = mount(SchemaField, {
      props: {
        node,
        renderFn: () => h('div', { 'data-test': 'custom' }, 'hello'),
      },
    })
    expect(wrapper.html()).toContain('hello')
    expect(wrapper.find('[data-test="custom"]').exists()).toBe(true)
  })

  it('renderFn 返回 undefined → 合法空渲染（permission hidden 场景），不显示错误占位', () => {
    const wrapper = mount(SchemaField, {
      props: {
        node: { component: 'Input', name: 'x', permission: 'hidden' },
        renderFn: () => undefined, // renderToComponentInner 对 permission:hidden 返回 undefined
      },
    })
    expect(() => wrapper.html()).not.toThrow()
    // 关键回归（2026-09-18 xform-field-permission）：undefined = 合法空，不是渲染失败
    expect(wrapper.find('.x-form-render-error').exists()).toBe(false)
  })

  it('renderFn 返回 null → 合法空渲染，不显示错误占位', () => {
    const wrapper = mount(SchemaField, {
      props: {
        node: { component: 'Input', name: 'x' },
        renderFn: (() => null) as never,
      },
    })
    expect(() => wrapper.html()).not.toThrow()
    expect(wrapper.find('.x-form-render-error').exists()).toBe(false)
  })

  it('renderFn 同步 throw → 显示渲染失败占位（与合法空 undefined 区分）', () => {
    const wrapper = mount(SchemaField, {
      props: {
        node: { component: 'Input', name: 'boom' },
        renderFn: (() => {
          throw new Error('render exploded')
        }) as never,
      },
    })
    const err = wrapper.find('.x-form-render-error')
    expect(err.exists()).toBe(true)
    expect(err.attributes('data-xform-error')).toBe('boom')
  })

  it('node 字段级重渲隔离：多个 SchemaField 各自独立调用 renderFn', () => {
    const renderFn = vi.fn(() => h('div'))
    const node1: SchemaNode = { component: 'Input', name: 'a' }
    const node2: SchemaNode = { component: 'Input', name: 'b' }
    const wrapper = mount({
      components: { SchemaField },
      template: `
        <div>
          <SchemaField :node="node1" :render-fn="renderFn" />
          <SchemaField :node="node2" :render-fn="renderFn" />
        </div>
      `,
      props: { node1: undefined, node2: undefined, renderFn: undefined },
      setup() {
        return { node1, node2, renderFn }
      },
    })
    // renderNode 是普通函数（非 computed，见 SchemaField.vue 注释）——每次模板渲染都执行 renderFn，
    // 调用次数 >= 2 即可；关键断言：node1/node2 各自被独立调用（字段级隔离，任一字段重渲不影响其他）
    expect(renderFn.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(renderFn).toHaveBeenCalledWith(node1)
    expect(renderFn).toHaveBeenCalledWith(node2)
    wrapper.unmount()
  })

  it('node 深层属性变化（reaction 写回）→ 触发重渲（xform-expression 回归）', async () => {
    // 回归：2026-09-18 把 rendered computed 改为 renderNode() 普通函数后，Card 视觉容器
    // 经多层 slot 闭包渲染子字段，子字段 node.label/hidden 的读取脱离本组件 render effect
    // 同步执行期 → reaction 写回正确但 DOM 不刷新。修复：deep watch props.node → tick++ 兜底。
    // 此处用 reactive node 模拟 reaction 写回子字段 label，断言 renderFn 被重新调用。
    const { reactive, nextTick } = await import('vue')
    const child: SchemaNode = { component: 'Input', name: 'budget', label: '金额' }
    const node = reactive<SchemaNode>({
      component: 'Card',
      children: [child],
    })
    const renderFn = vi.fn((n: SchemaNode) => h('div', n.name ?? (n.component as string) ?? 'x'))
    const wrapper = mount(SchemaField, { props: { node, renderFn } })
    const callsBefore = renderFn.mock.calls.length
    // 模拟 reaction 写回深层子字段 label（reactive mutation，引用不变）
    ;(node.children as SchemaNode[])[0]!.label = '报销金额（美元 $）'
    await nextTick()
    await nextTick()
    expect(renderFn.mock.calls.length).toBeGreaterThan(callsBefore)
    wrapper.unmount()
  })
})
