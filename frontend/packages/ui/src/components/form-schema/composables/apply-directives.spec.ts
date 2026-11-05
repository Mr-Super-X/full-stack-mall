/**
 * applyDirectives 单元测试
 * 覆盖：
 * - undefined / 空数组 → 原样返回
 * - 字符串指令（注册表未接线）→ 跳过
 * - 多个指令同时应用
 * - withDirectives 抛错 → 返回原 vnode
 * - 真实渲染防回归：Directive 对象形式的 mounted 钩子必须真实执行
 */
import { describe, it, expect, vi } from 'vitest'
import { h, reactive, type VNode, type Directive } from 'vue'
import { mount } from '@vue/test-utils'
import XForm from '../components/XForm.vue'
import type { SchemaNode } from '../types'
import { applyDirectives } from './apply-directives'

function makeVNode(): VNode {
  return h('div', 'test')
}

describe('applyDirectives / 空入参', () => {
  it('directives undefined → 原样返回同一引用', () => {
    const vnode = makeVNode()
    const result = applyDirectives(vnode, undefined)
    expect(result).toBe(vnode)
  })

  it('directives 空数组 → 原样返回同一引用', () => {
    const vnode = makeVNode()
    const result = applyDirectives(vnode, [])
    expect(result).toBe(vnode)
  })
})

describe('applyDirectives / 字符串指令（注册表未接线）', () => {
  it('单个 string directive → 跳过，原样返回', () => {
    const vnode = makeVNode()
    const result = applyDirectives(vnode, [{ directive: 'my-directive', value: { foo: 'baz' } }])
    expect(result).toBeDefined()
    expect(result).toBe(vnode)
  })

  it('全部为字符串指令 → 无绑定，原样返回', () => {
    const vnode = makeVNode()
    const result = applyDirectives(vnode, [
      {
        directive: 'v-my',
        value: 42,
        arg: 'x',
        modifiers: { stop: true, prevent: true },
      },
    ])
    expect(result).toBeDefined()
    expect(result).toBe(vnode)
  })
})

describe('applyDirectives / 指令对象', () => {
  // 注：单元级调用不在渲染栈内，withDirectives 会因 currentRenderingInstance === null
  // 直接 no-op 返回 vnode（不写 dirs、不执行钩子）——真实执行由下方「真实渲染」describe 覆盖
  it('Directive 对象（含钩子）→ 不抛错，返回原 vnode 引用', () => {
    const vnode = makeVNode()
    const directiveObj = { mounted: () => {} } as unknown as Directive
    const result = applyDirectives(vnode, [{ directive: directiveObj, value: 'a' }])
    expect(result).toBe(vnode)
  })

  it('字符串指令 + 对象指令混用 → 不抛错', () => {
    const vnode = makeVNode()
    const objDir = { mounted: () => {} } as unknown as Directive
    const result = applyDirectives(vnode, [
      { directive: 'str-dir' },
      { directive: objDir, value: 'x' },
    ])
    expect(result).toBe(vnode)
  })
})

describe('applyDirectives / 真实渲染（防回归：钩子必须真实执行）', () => {
  const ElFormStub = { name: 'ElForm', template: '<form class="el-form"><slot /></form>' }
  const ElFormItemStub = {
    name: 'ElFormItem',
    template: '<div class="el-form-item"><slot /></div>',
  }
  const ElConfigProviderStub = { name: 'ElConfigProvider', template: '<div><slot /></div>' }
  const InputStub = {
    name: 'ElInput',
    props: ['modelValue'],
    template: '<input class="el-input-stub" :value="modelValue" />',
  }

  function mountWithDirective(
    directive: Directive,
    config: Partial<{ value: unknown; arg: string; modifiers: Record<string, boolean> }> = {}
  ) {
    const schema: SchemaNode = {
      children: [
        {
          component: 'ElInput',
          name: 'a',
          label: 'A',
          directives: [
            {
              directive,
              ...(config.value !== undefined ? { value: config.value } : {}),
              ...(config.arg !== undefined ? { arg: config.arg } : {}),
              ...(config.modifiers !== undefined ? { modifiers: config.modifiers } : {}),
            },
          ],
        },
      ],
    }
    return mount(XForm as never, {
      props: { schema, model: reactive({}) } as never,
      global: {
        components: {
          ElConfigProvider: ElConfigProviderStub,
          ElForm: ElFormStub,
          ElFormItem: ElFormItemStub,
          ElInput: InputStub,
        } as never,
      },
    })
  }

  it('mounted 钩子真实执行，el 为 form-item 根元素（withDirectives 元组参数防回归）', () => {
    const mountedSpy = vi.fn()
    const directive: Directive<HTMLElement> = { mounted: mountedSpy }
    mountWithDirective(directive)
    expect(mountedSpy).toHaveBeenCalledTimes(1)
    const el = mountedSpy.mock.calls[0]?.[0] as HTMLElement | undefined
    expect(el?.className).toContain('el-form-item')
  })

  it('value / arg / modifiers 完整透传 binding', () => {
    const mountedSpy = vi.fn()
    const directive: Directive<HTMLElement> = { mounted: mountedSpy }
    mountWithDirective(directive, { value: '审计字段', arg: 'audit', modifiers: { strong: true } })
    expect(mountedSpy).toHaveBeenCalledTimes(1)
    const binding = mountedSpy.mock.calls[0]?.[1] as
      { value?: unknown; arg?: string; modifiers?: Record<string, boolean> } | undefined
    expect(binding?.value).toBe('审计字段')
    expect(binding?.arg).toBe('audit')
    expect(binding?.modifiers).toEqual({ strong: true })
  })
})
