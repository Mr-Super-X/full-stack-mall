/**
 * array-row-reaction —— array 行内 reaction 端到端回归（P0 修复）
 *
 * 背景：修复前 use-schema-renderer.ts 顶层 traverse 内的 applyReactions 会经 walkSchema
 * 递归进 array.itemSchema，对每个行内节点调 registerNodeReaction → delete node.reaction
 * 并用根 model 注册一份错误 watcher（行内相对 deps 在根 model 不可达、sync 立即执行
 * _effect(root) 污染根 model）。等到 renderArrayNode 执行时，cfg.itemSchema 的 reaction
 * 已被 delete，renderRow 里行级 applyReactions 拿到的是空 schema，注册 0 个 watcher
 * —— 行内 reaction 永远不触发。
 *
 * 修复：applyReactions 加 walkOpts 透传；顶层 traverse 传 { includeArrayItemSchema: false }；
 * 行级 reaction 由 render-array-node.ts renderRow 全权注册（model 上下文 = 行对象）。
 *
 * @group 表单编排：联动
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, effectScope, nextTick, reactive, ref, type Ref } from 'vue'
import { cloneDeepWith } from 'lodash-es'
import type { SchemaNode } from '../types'
import { useSchemaRenderer } from './use-schema-renderer'
import { renderArrayNode } from './render-array-node'
import { applyReactions, createBudget, containsReaction } from './use-reaction'
import { rewriteNamePath } from './array-row-key'

interface RowItem {
  name: string
  qty: number
  price: number
  taxed: boolean
  taxRate: number
  subtotal: number
}

/** 构造采购明细 schema（与 XFormReactionArrayRow.vue 形态一致，最小化字段） */
function makeSchema(effect?: (m: Record<string, unknown>) => void): SchemaNode {
  return {
    column: 1,
    children: [
      {
        kind: 'array',
        name: 'arrayRows',
        array: {
          itemSchema: {
            children: [
              { component: 'InputNumber', name: 'qty' },
              { component: 'Switch', name: 'taxed' },
              {
                component: 'InputNumber',
                name: 'taxRate',
                reaction: { hidden: (m: Record<string, unknown>) => !(m as RowItem).taxed },
              },
              {
                component: 'InputNumber',
                name: 'subtotal',
                props: { disabled: true },
                reaction: {
                  deps: ['qty', 'taxed'],
                  _effect:
                    effect ??
                    ((m: Record<string, unknown>) => {
                      const r = m as RowItem
                      r.subtotal = Number((r.qty * (r.taxed ? 1 + r.taxRate : 1)).toFixed(2))
                    }),
                },
              },
            ],
          },
        },
      },
    ],
  } as SchemaNode
}

/** 包装 makeSchema 允许注入 spy effect（测试用） */
function makeSchemaWithEffect(effect: (m: Record<string, unknown>) => void): SchemaNode {
  return makeSchema(effect)
}

function makeModel(): Record<string, unknown> {
  return reactive({
    arrayRows: [
      { name: 'A', qty: 1, price: 100, taxed: false, taxRate: 0.13, subtotal: 1 },
      { name: 'B', qty: 2, price: 50, taxed: true, taxRate: 0.06, subtotal: 2.12 },
    ],
  }) as Record<string, unknown>
}

/** 从 reactiveSchema 里取 array 节点（顶层 wrapper 是 { children: [...] }） */
function getArrayNode(reactiveSchema: SchemaNode | SchemaNode[]): SchemaNode {
  const root = reactiveSchema as SchemaNode
  return (root.children as SchemaNode[])[0]
}

/** 最小 render opts（renderArrayNode 必需字段） */
function makeRenderOpts(model: Record<string, unknown>) {
  return {
    model,
    components: ref({}) as Ref<Record<string, unknown> | undefined>,
    beforeChange: undefined,
    rules: undefined,
    // stub：不真正渲染内部字段，本 spec 只关心 reaction 注册与触发
    render: () => undefined,
  } as never
}

describe('array-row-reaction / 顶层 traverse 与行级 reaction 的协作', () => {
  it('顶层 traverse 跳过 array.itemSchema —— 行内节点 reaction 字段不被 delete', async () => {
    const scope = effectScope()
    const model = makeModel()
    const schema = ref(makeSchema())
    const { reactiveSchema } = scope.run(() =>
      useSchemaRenderer({
        schema,
        components: ref({}),
        formData: ref(model) as Ref<Record<string, unknown>>,
      })
    )!
    await nextTick()

    expect(containsReaction(reactiveSchema.value)).toBe(true)
    const itemChildren = (getArrayNode(reactiveSchema.value).array?.itemSchema as SchemaNode)
      .children as SchemaNode[]
    // 关键回归点：修复前顶层 applyReactions 会 delete 这两个节点的 reaction；
    // 修复后 reaction 字段保留，交给 renderArrayNode 行级注册
    expect(itemChildren[2].reaction).toBeDefined() // taxRate.hidden
    expect(itemChildren[3].reaction).toBeDefined() // subtotal._effect
    scope.stop()
  })

  it('renderArrayNode 行级注册 —— 改 row.qty 触发 _effect 重算 row.subtotal', async () => {
    const scope = effectScope()
    const model = makeModel()
    // spy 仅用于断言「_effect 确实被调用过」；精确次数受 Vue 调度去重 / re-render 影响，不据此断言
    const effectSpy = vi.fn((m: Record<string, unknown>) => {
      const r = m as RowItem
      r.subtotal = Number((r.qty * (r.taxed ? 1 + r.taxRate : 1)).toFixed(2))
    })
    const schema = ref(makeSchemaWithEffect((m: Record<string, unknown>) => effectSpy(m)))
    const { reactiveSchema } = scope.run(() =>
      useSchemaRenderer({
        schema,
        components: ref({}),
        formData: ref(model) as Ref<Record<string, unknown>>,
      })
    )!
    await nextTick()

    const arrayNode = getArrayNode(reactiveSchema.value)
    const rows = (model as { arrayRows: RowItem[] }).arrayRows

    // renderRow 被包在 ElCard default slot 内 —— 必须 mount 到 DOM 才执行
    // （仅调 renderArrayNode 返回 vnode 而不 mount，slot 函数惰性不执行，行级 applyReactions 不注册）
    const container = document.createElement('div')
    const app = createApp({ render: () => renderArrayNode(arrayNode, makeRenderOpts(model)) })
    app.mount(container)
    // sync 策略：mount 时对每行立即执行一次
    expect(effectSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(rows[0].subtotal).toBe(1) // 1 × 1（taxed=false 不加税率）
    expect(rows[1].subtotal).toBe(Number((2 * 1.06).toFixed(2))) // 2 × 1.06

    rows[0].qty = 5
    await nextTick()
    // 关键回归点：修复前 itemSchema.reaction 已被顶层 delete，rowStoppers 注册为 0，
    // qty 变化后 subtotal 永远保持初始值
    expect(rows[0].subtotal).toBe(5)

    rows[1].qty = 3
    await nextTick()
    // 行级 watcher 按行隔离：只重算自己那行
    expect(rows[1].subtotal).toBe(Number((3 * 1.06).toFixed(2)))
    expect(rows[0].subtotal).toBe(5) // 第一行未被波及

    app.unmount()
    scope.stop()
  })

  it('renderArrayNode 行级注册 —— taxRate.hidden 用行 model 求值并按行隔离', async () => {
    const scope = effectScope()
    const model = makeModel()
    const schema = ref(makeSchema())
    const { reactiveSchema } = scope.run(() =>
      useSchemaRenderer({
        schema,
        components: ref({}),
        formData: ref(model) as Ref<Record<string, unknown>>,
      })
    )!
    await nextTick()

    const arrayNode = getArrayNode(reactiveSchema.value)
    const rows = (model as { arrayRows: RowItem[] }).arrayRows

    // mount 触发 renderRow 内的行级 applyReactions 注册 + sync 立即求值
    const container = document.createElement('div')
    const app = createApp({ render: () => renderArrayNode(arrayNode, makeRenderOpts(model)) })
    app.mount(container)

    // 直接对两行手动跑行级 applyReactions，拿到 rewritten 副本验证 hidden 求值
    // （renderArrayNode 内部的 rewritten 不暴露，这里用同参数再构造一份做行为断言）
    const rowStoppers: (() => void)[] = []
    const rewritten0 = rewriteNamePath(
      arrayNode.array?.itemSchema,
      'arrayRows[0]',
      '.',
      'k0'
    ) as SchemaNode
    applyReactions(rewritten0, rows[0] as Record<string, unknown>, rowStoppers, createBudget())
    const rw0Children = (rewritten0.children as SchemaNode[])[2]
    expect(rw0Children.hidden).toBe(true) // row0.taxed=false → hidden=true

    const rewritten1 = rewriteNamePath(
      arrayNode.array?.itemSchema,
      'arrayRows[1]',
      '.',
      'k1'
    ) as SchemaNode
    applyReactions(rewritten1, rows[1] as Record<string, unknown>, rowStoppers, createBudget())
    const rw1Children = (rewritten1.children as SchemaNode[])[2]
    expect(rw1Children.hidden).toBe(false) // row1.taxed=true → hidden=false
    expect(rowStoppers.length).toBeGreaterThan(0)
    app.unmount()
    scope.stop()
  })

  it('applyReactions 默认行为向后兼容 —— 不传 walkOpts 仍递归 array.itemSchema', () => {
    const schema = makeSchema()
    // 用 cloneDeepWith 保留 reaction 里的函数（JSON.stringify 会丢函数导致 hasDynamic=false）
    const cloned = cloneDeepWith(schema, () => undefined) as SchemaNode
    const stoppers: (() => void)[] = []
    const model = reactive({ arrayRows: [{ qty: 1, taxed: false }] }) as Record<string, unknown>
    // 缺省第 6 参 = 全开 = 递归进 itemSchema（外部直接调用 applyReactions 的旧行为不变）
    applyReactions(cloned, model, stoppers, createBudget())
    const itemChildren = ((cloned.children as SchemaNode[])[0].array?.itemSchema as SchemaNode)
      .children as SchemaNode[]
    expect(itemChildren[3].reaction).toBeUndefined() // 被 registerNodeReaction delete
    expect(stoppers.length).toBeGreaterThan(0) // 且注册了 watcher
  })
})
