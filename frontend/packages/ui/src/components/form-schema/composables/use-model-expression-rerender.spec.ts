/**
 * use-model-expression-rerender 单元测试
 *
 * 覆盖：
 * - hasModelDependentExpression：顶层 readonly 函数/'{{ }}' / disabled / 字段 permission 各形态
 * - hasModelDependentExpression：字面量 / 无表达式 → false
 * - useModelExpressionRerender：含表达式时 model 变化触发 triggerRender
 * - useModelExpressionRerender：不含表达式时 model 变化不触发（no-op）
 * - schema 换代：从含表达式变为不含 → 停止 watch
 */
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import {
  hasModelDependentExpression,
  useModelExpressionRerender,
} from './use-model-expression-rerender'
import type { SchemaNode } from '../types'

describe('hasModelDependentExpression', () => {
  it('顶层 readonly 为函数 → true', () => {
    const s: SchemaNode = { readonly: (m: Record<string, unknown>) => m.locked === true }
    expect(hasModelDependentExpression(s)).toBe(true)
  })

  it('顶层 readonly 为 {{ }} 表达式 → true', () => {
    const s: SchemaNode = { readonly: '{{ (m) => m.locked === true }}' }
    expect(hasModelDependentExpression(s)).toBe(true)
  })

  it('顶层 disabled 为 {{ }} 表达式 → true', () => {
    const s: SchemaNode = { disabled: '{{ (m) => m.locked === true }}' }
    expect(hasModelDependentExpression(s)).toBe(true)
  })

  it('字段 permission 为函数 → true', () => {
    const s: SchemaNode = {
      children: [
        { name: 'a', permission: (m: Record<string, unknown>) => (m.r ? 'view' : 'edit') },
      ],
    }
    expect(hasModelDependentExpression(s)).toBe(true)
  })

  it('字段 permission 为 {{ }} 表达式 → true', () => {
    const s: SchemaNode = {
      children: [{ name: 'a', permission: "{{ (m) => m.role === 'admin' ? 'edit' : 'view' }}" }],
    }
    expect(hasModelDependentExpression(s)).toBe(true)
  })

  it('纯字面量 schema（readonly boolean / permission 字面量）→ false', () => {
    const s: SchemaNode = {
      readonly: true,
      children: [{ name: 'a', permission: 'view' }],
    }
    expect(hasModelDependentExpression(s)).toBe(false)
  })

  it('无 readonly/disabled/permission → false', () => {
    const s: SchemaNode = { children: [{ name: 'a', component: 'Input' }] }
    expect(hasModelDependentExpression(s)).toBe(false)
  })

  it('undefined schema → false', () => {
    expect(hasModelDependentExpression(undefined)).toBe(false)
  })

  it('reaction 表达式不算 model 依赖表达式（由 reaction 管线独立追踪）', () => {
    const s: SchemaNode = {
      children: [{ name: 'a', reaction: { hidden: '{{ (m) => m.x === 1 }}' } }],
    }
    expect(hasModelDependentExpression(s)).toBe(false)
  })
})

describe('useModelExpressionRerender', () => {
  it('含 model 依赖表达式时，model 变化触发 triggerRender', async () => {
    const scope = effectScope()
    const schema = ref<SchemaNode>({
      readonly: '{{ (m) => m.locked === true }}',
      children: [{ name: 'a' }],
    })
    const model = ref<Record<string, unknown> | undefined>(reactive({ locked: false }))
    const triggerRender = vi.fn()
    scope.run(() => {
      useModelExpressionRerender({ schema: schema as never, model, triggerRender })
    })
    await nextTick()
    expect(triggerRender).not.toHaveBeenCalled()
    // model 字段变化 → triggerRender
    ;(model.value as Record<string, unknown>).locked = true
    await nextTick()
    expect(triggerRender).toHaveBeenCalled()
    scope.stop()
  })

  it('不含 model 依赖表达式时，model 变化不触发 triggerRender（no-op 零开销）', async () => {
    const scope = effectScope()
    const schema = ref<SchemaNode>({ children: [{ name: 'a', component: 'Input' }] })
    const model = ref<Record<string, unknown> | undefined>(reactive({ locked: false }))
    const triggerRender = vi.fn()
    scope.run(() => {
      useModelExpressionRerender({ schema: schema as never, model, triggerRender })
    })
    await nextTick()
    ;(model.value as Record<string, unknown>).locked = true
    await nextTick()
    expect(triggerRender).not.toHaveBeenCalled()
    scope.stop()
  })

  it('schema 换代：从含表达式变为不含 → 停止 watch（后续 model 变化不再触发）', async () => {
    const scope = effectScope()
    const schema = ref<SchemaNode>({
      readonly: '{{ (m) => m.locked === true }}',
      children: [{ name: 'a' }],
    })
    const model = ref<Record<string, unknown> | undefined>(reactive({ locked: false }))
    const triggerRender = vi.fn()
    scope.run(() => {
      useModelExpressionRerender({ schema: schema as never, model, triggerRender })
    })
    await nextTick()
    ;(model.value as Record<string, unknown>).locked = true
    await nextTick()
    expect(triggerRender).toHaveBeenCalledTimes(1)
    // 换代为无表达式 schema
    schema.value = { children: [{ name: 'a', component: 'Input' }] }
    await nextTick()
    ;(model.value as Record<string, unknown>).locked = false
    await nextTick()
    expect(triggerRender).toHaveBeenCalledTimes(1) // 不再增加
    scope.stop()
  })

  it('onModelChange 回调在 model 变化时触发（permission 等 slot 闭包求值靠它重算）', async () => {
    const scope = effectScope()
    const schema = ref<SchemaNode>({
      children: [{ name: 'a', permission: "{{ (m) => m.role === 'admin' ? 'edit' : 'view' }}" }],
    })
    const model = ref<Record<string, unknown> | undefined>(reactive({ role: 'admin' }))
    const triggerRender = vi.fn()
    const onModelChange = vi.fn()
    scope.run(() => {
      useModelExpressionRerender({ schema: schema as never, model, triggerRender, onModelChange })
    })
    await nextTick()
    expect(onModelChange).not.toHaveBeenCalled()
    ;(model.value as Record<string, unknown>).role = 'viewer'
    await nextTick()
    expect(onModelChange).toHaveBeenCalled()
    expect(triggerRender).toHaveBeenCalled()
    scope.stop()
  })
})
