import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { buildVModelBindings, resolveBeforeChangeChain } from './build-vmodel-bindings'
import type { BeforeChangeCtx, SchemaNode } from '../types'

const baseNode = (name = 'phone'): SchemaNode => ({
  name,
  component: 'Input',
})

const makeCtx = (name = 'phone'): BeforeChangeCtx => ({
  name,
  setFieldValue: vi.fn(),
  setFieldError: vi.fn(),
  abort: vi.fn(),
})

describe('resolveBeforeChangeChain', () => {
  it('returns newVal unchanged when no hooks configured', async () => {
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx())
    expect(result).toBe('abc')
  })

  it('layer 1 (props.beforeChange) return value replaces v', async () => {
    const layer1 = vi.fn((_n: unknown, v: unknown) => `L1(${v})`)
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), {
      layer1: layer1 as never,
    })
    expect(result).toBe('L1(abc)')
    expect(layer1).toHaveBeenCalledOnce()
  })

  it('layer 1 returning undefined passes original v to next layer', async () => {
    const layer1 = vi.fn(() => undefined)
    const layer3 = vi.fn((_n: unknown, v: unknown) => `L3(${v})`)
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), {
      layer1: layer1 as never,
      fieldBeforeChange: layer3 as never,
    })
    expect(result).toBe('L3(abc)')
  })

  it('layer 1 Promise.resolve awaits before passing to next', async () => {
    const layer1 = vi.fn((_n: unknown, v: unknown) => Promise.resolve(`async-${v}`))
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), {
      layer1: layer1 as never,
    })
    expect(result).toBe('async-abc')
  })

  it('layer 1 Promise.reject throws, chain aborts', async () => {
    const layer1 = vi.fn(() => Promise.reject(new Error('cancel')))
    await expect(
      resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), {
        layer1: layer1 as never,
      })
    ).rejects.toThrow('cancel')
  })

  it('layer 1 sync throw is caught, original v passed to next layer', async () => {
    const layer1 = vi.fn(() => {
      throw new Error('boom')
    })
    const layer3 = vi.fn((_n: unknown, v: unknown) => `L3(${v})`)
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), {
      layer1: layer1 as never,
      fieldBeforeChange: layer3 as never,
    })
    expect(result).toBe('L3(abc)')
  })

  it('layer 2 (namespace rules) matches by RegExp pattern', async () => {
    const handler = vi.fn((_n: unknown, v: unknown) => `phone-${v}`)
    const node = baseNode('phone')
    const result = await resolveBeforeChangeChain(node, '123', '', {}, makeCtx('phone'), {
      namespaceRules: [{ pattern: /^phone$/, handler: handler as never }],
    })
    expect(result).toBe('phone-123')
  })

  it('layer 2 matches array path with regex', async () => {
    const handler = vi.fn((_n: unknown, v: unknown) =>
      typeof v === 'string' ? v.replace(/\s/g, '') : v
    )
    const node = baseNode('items[0].phone')
    const result = await resolveBeforeChangeChain(
      node,
      '138 0013 8000',
      '',
      {},
      makeCtx('items[0].phone'),
      {
        namespaceRules: [{ pattern: /^items\[\d+\]\.phone$/, handler: handler as never }],
      }
    )
    expect(result).toBe('13800138000')
  })

  it('layer 2 multiple matches run in array order (chained)', async () => {
    const h1 = vi.fn((_n: unknown, v: unknown) => `[1]${v}`)
    const h2 = vi.fn((_n: unknown, v: unknown) => `[2]${v}`)
    const result = await resolveBeforeChangeChain(baseNode('x'), 'a', '', {}, makeCtx('x'), {
      namespaceRules: [
        { pattern: /^x$/, handler: h1 as never },
        { pattern: /^x$/, handler: h2 as never },
      ],
    })
    expect(result).toBe('[2][1]a')
  })

  it('layer 2 non-matching rules skip', async () => {
    const handler = vi.fn((_n: unknown, v: unknown) => `nope-${v}`)
    const result = await resolveBeforeChangeChain(
      baseNode('phone'),
      'a',
      '',
      {},
      makeCtx('phone'),
      {
        namespaceRules: [{ pattern: /^email$/, handler: handler as never }],
      }
    )
    expect(result).toBe('a')
    expect(handler).not.toHaveBeenCalled()
  })

  it('layer 3 (field.beforeChange) executes with 5 args', async () => {
    const handler = vi.fn((_n: unknown, v: unknown) => `field-${v}`)
    const node: SchemaNode = { ...baseNode(), beforeChange: handler as never }
    const ctx = makeCtx()
    const result = await resolveBeforeChangeChain(node, 'a', 'b', { phone: 'a' }, ctx)
    expect(handler).toHaveBeenCalledWith(node, 'a', 'b', { phone: 'a' }, ctx)
    expect(result).toBe('field-a')
  })

  it('3 layers chain: L1 -> L2 -> L3 sequentially', async () => {
    const l1 = vi.fn((_n: unknown, v: unknown) => `${v}-L1`)
    const l2h = vi.fn((_n: unknown, v: unknown) => `${v}-L2`)
    const node: SchemaNode = {
      ...baseNode('x'),
      beforeChange: vi.fn((_n: unknown, v: unknown) => `${v}-L3`) as never,
    }
    const result = await resolveBeforeChangeChain(node, 'a', '', {}, makeCtx('x'), {
      layer1: l1 as never,
      namespaceRules: [{ pattern: /^x$/, handler: l2h as never }],
    })
    expect(result).toBe('a-L1-L2-L3')
  })

  it('ctx.setFieldValue mutates model side effect', async () => {
    const model: Record<string, unknown> = {}
    const ctx: BeforeChangeCtx = {
      name: 'city',
      setFieldValue: (n, v) => {
        model[n] = v
      },
      setFieldError: vi.fn(),
      abort: vi.fn(),
    }
    const handler = vi.fn(
      (_n: unknown, v: unknown, _o: unknown, _all: unknown, c: BeforeChangeCtx) => {
        c.setFieldValue('district', null)
        return v
      }
    )
    const node: SchemaNode = { ...baseNode('city'), beforeChange: handler as never }
    await resolveBeforeChangeChain(node, '北京', '', model, ctx)
    expect(model.district).toBeNull()
  })

  it('ctx.setFieldError is callable', async () => {
    const setFieldError = vi.fn()
    const ctx: BeforeChangeCtx = {
      name: 'phone',
      setFieldValue: vi.fn(),
      setFieldError,
      abort: vi.fn(),
    }
    const handler = vi.fn(
      (_n: unknown, v: unknown, _o: unknown, _all: unknown, c: BeforeChangeCtx) => {
        c.setFieldError('phone', '格式错误')
        return v
      }
    )
    const node: SchemaNode = { ...baseNode('phone'), beforeChange: handler as never }
    await resolveBeforeChangeChain(node, 'abc', '', {}, ctx)
    expect(setFieldError).toHaveBeenCalledWith('phone', '格式错误')
  })

  it('ctx.abort marks chain as aborted (handler invoked)', async () => {
    const abort = vi.fn()
    const ctx: BeforeChangeCtx = {
      name: 'phone',
      setFieldValue: vi.fn(),
      setFieldError: vi.fn(),
      abort,
    }
    const handler = vi.fn(
      (_n: unknown, v: unknown, _o: unknown, _all: unknown, c: BeforeChangeCtx) => {
        c.abort()
        return v
      }
    )
    const node: SchemaNode = { ...baseNode('phone'), beforeChange: handler as never }
    await resolveBeforeChangeChain(node, 'abc', '', {}, ctx)
    expect(abort).toHaveBeenCalled()
  })
})

describe('buildVModelBindings', () => {
  it('writes layer1-returned value to model on update event', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn((_n: unknown, v: unknown) => `L1(${v})`)
    const bindings = buildVModelBindings(baseNode('phone'), model, {
      layer1: layer1 as never,
    })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('L1(new)')
  })

  it('writes original value when no hooks configured', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const bindings = buildVModelBindings(baseNode('phone'), model)
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('new')
  })

  it('awaits Promise.resolve before writing to model', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn((_n: unknown, v: unknown) => Promise.resolve(`async-${v}`))
    const bindings = buildVModelBindings(baseNode('phone'), model, {
      layer1: layer1 as never,
    })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('async-new')
  })

  it('does not write when Promise.reject', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn(() => Promise.reject(new Error('cancel')))
    const bindings = buildVModelBindings(baseNode('phone'), model, {
      layer1: layer1 as never,
    })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('old')
  })

  it('onValueChange fires after write', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const onValueChange = vi.fn()
    const layer1 = vi.fn((_n: unknown, v: unknown) => `L1(${v})`)
    const node = baseNode('phone')
    const bindings = buildVModelBindings(node, model, {
      layer1: layer1 as never,
      onValueChange,
    })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(onValueChange).toHaveBeenCalledWith(node, 'L1(new)')
  })
})
