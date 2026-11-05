/**
 * build-on-bindings 单元测试
 *
 * 覆盖：
 * - node.on 缺失 → 返回空对象
 * - 函数事件：直接透传
 * - 函数表达式字符串：解析后包装（自动注入 model）
 * - 解析失败的字符串：跳过该事件
 * - propKey 命名：onClick / onChange / onUpdate:modelValue（vue 约定）
 * - model=undefined：函数表达式仍传 {} 占位
 */
import { describe, expect, it } from 'vitest'
import { buildOnBindings } from './build-on-bindings'
import type { SchemaNode } from '../types'

describe('buildOnBindings', () => {
  it('node.on 缺失 → 返回空对象', () => {
    const node: SchemaNode = { component: 'Input' }
    expect(buildOnBindings(node, {})).toEqual({})
  })

  it('node.on 是空对象 → 返回空对象', () => {
    const node: SchemaNode = { component: 'Input', on: {} }
    expect(buildOnBindings(node, {})).toEqual({})
  })

  it('函数事件 → 直接透传', () => {
    const onClick = () => undefined
    const node: SchemaNode = { component: 'Input', on: { click: onClick } }
    const result = buildOnBindings(node, {})
    expect(result.onClick).toBe(onClick)
  })

  it('propKey 命名遵循 vue 约定：on<EventName>', () => {
    const node: SchemaNode = {
      component: 'Input',
      on: {
        click: () => undefined,
        change: () => undefined,
        input: () => undefined,
        blur: () => undefined,
      },
    }
    const result = buildOnBindings(node, {})
    expect(result).toHaveProperty('onClick')
    expect(result).toHaveProperty('onChange')
    expect(result).toHaveProperty('onInput')
    expect(result).toHaveProperty('onBlur')
  })

  it('函数表达式字符串 → 解析后包装（自动注入 model + 透传额外参数）', () => {
    const node: SchemaNode = {
      component: 'Input',
      on: { change: '{{ (m, v) => `${m.email}:${v}` }}' },
    }
    const model: Record<string, unknown> = { email: 'a@b.com' }
    const result = buildOnBindings(node, model)
    expect(result.onChange).toBeTypeOf('function')
    // 调用时传 'newValue' 作为 v，表达式返回拼接字符串
    const ret = (result.onChange as (...args: unknown[]) => unknown)('newValue')
    expect(ret).toBe('a@b.com:newValue')
  })

  it('表达式只取 model（不取额外参数）', () => {
    const node: SchemaNode = {
      component: 'Input',
      on: { change: '{{ (m) => m.value }}' },
    }
    const model: Record<string, unknown> = { value: 42 }
    const result = buildOnBindings(node, model)
    expect((result.onChange as (...args: unknown[]) => unknown)()).toBe(42)
  })

  it('模型 undefined → 函数表达式仍可调用（传空对象占位）', () => {
    const node: SchemaNode = {
      component: 'Input',
      on: { change: '{{ (m, v) => v }}' },
    }
    const result = buildOnBindings(node, undefined)
    expect(result.onChange).toBeTypeOf('function')
    expect(() => (result.onChange as (...args: unknown[]) => unknown)('x')).not.toThrow()
  })

  it('解析失败的字符串 → 跳过该事件（不含 propKey）', () => {
    const node: SchemaNode = {
      component: 'Input',
      on: { change: 'not a function expression' },
    }
    const result = buildOnBindings(node, {})
    expect(result).not.toHaveProperty('onChange')
  })

  it('多事件混合：函数 + 表达式 + 失败', () => {
    const onClick = () => undefined
    const node: SchemaNode = {
      component: 'Input',
      on: {
        click: onClick,
        change: '{{ (m) => m.x * 2 }}',
        blur: 'invalid',
      },
    }
    const model: Record<string, unknown> = { x: 10 }
    const result = buildOnBindings(node, model)
    expect(result.onClick).toBe(onClick)
    expect(result.onChange).toBeTypeOf('function')
    expect(result).not.toHaveProperty('onBlur')
    // 表达式读取 model.x 计算
    expect((result.onChange as (...args: unknown[]) => unknown)()).toBe(20)
  })

  it('update:modelValue 事件（vue v-model 内部事件）→ propKey=onUpdate:modelValue', () => {
    const fn = () => undefined
    const node: SchemaNode = { component: 'Input', on: { 'update:modelValue': fn } }
    const result = buildOnBindings(node, {})
    expect(result['onUpdate:modelValue']).toBe(fn)
  })

  it('H2：注入 resolveFunctionExpression 优先于模块级（on 字符串表达式）', () => {
    const node = {
      component: 'Input',
      name: 'a',
      on: { customEvent: '{{ () => tag() }}' },
    } as unknown as Parameters<typeof buildOnBindings>[0]
    // as never 兼容泛型签名：注入解析器任何表达式都返回 () => 'INJECTED'
    const injected = () => (() => 'INJECTED') as never
    const bindings = buildOnBindings(node, {}, injected)
    expect((bindings as Record<string, unknown>).onCustomEvent).toBeInstanceOf(Function)
    expect(((bindings as Record<string, unknown>).onCustomEvent as () => string)()).toBe('INJECTED')
  })
})
