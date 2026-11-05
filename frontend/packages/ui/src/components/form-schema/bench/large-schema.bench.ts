/**
 * 大 schema 性能基准 —— 100+ 字段
 *
 * 测量项:
 * 1. mount 时间(useSchemaRenderer + useRenderSchemaNode)
 * 2. 单字段输入响应时间(model 写入 → 模板更新)
 * 3. reaction 执行时间(debounce 300ms 跑完一轮)
 * 4. 100 字段全部更新一轮时间
 *
 * 性能基准对照(不强制阈值):
 * - mount < 100ms(桌面)
 * - 输入响应 < 16ms(60fps)
 * - 100 字段批量更新 < 50ms
 *
 * @group XForm 基准
 */
import { describe, bench, beforeEach } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useSchemaRenderer } from '../composables/use-schema-renderer'
import { useRenderSchemaNode } from '../composables/render-schema-node'
import type { SchemaNode } from '../types'

/** 生成 N 个字段的 schema(Input + required rule) */
function buildSchema(fieldCount: number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < fieldCount; i++) {
    children.push({
      label: `字段 ${i + 1}`,
      name: `field${i}`,
      component: 'Input',
      rules: [{ required: true, message: `字段 ${i + 1} 必填`, trigger: 'blur' }],
    } as SchemaNode)
  }
  return {
    column: 2,
    children,
  }
}

describe('P3-B 大 schema 性能基准', () => {
  // ─── mount 时间 ───
  bench(
    'mount 100 字段 schema(useSchemaRenderer + renderSchemaNode)',
    () => {
      const schema = buildSchema(100)
      const model = reactive({})
      const scope = effectScope()
      scope.run(() => {
        const { reactiveSchema } = useSchemaRenderer({
          schema: ref(schema),
          components: ref({}),
          formData: ref(model),
        })
        const render = useRenderSchemaNode({
          model,
          components: {},
          beforeChange: undefined,
          rules: {},
          render: (n) => n as never,
        })
        render(reactiveSchema.value as SchemaNode)
      })
      scope.stop()
    },
    { iterations: 10 }
  )

  bench(
    'mount 200 字段 schema',
    () => {
      const schema = buildSchema(200)
      const model = reactive({})
      const scope = effectScope()
      scope.run(() => {
        const { reactiveSchema } = useSchemaRenderer({
          schema: ref(schema),
          components: ref({}),
          formData: ref(model),
        })
        const render = useRenderSchemaNode({
          model,
          components: {},
          beforeChange: undefined,
          rules: {},
          render: (n) => n as never,
        })
        render(reactiveSchema.value as SchemaNode)
      })
      scope.stop()
    },
    { iterations: 5 }
  )

  // ─── 单字段输入响应 ───
  describe('单字段输入响应时间', () => {
    let model: Record<string, unknown>

    beforeEach(() => {
      const schema = buildSchema(100)
      model = reactive({})
      effectScope().run(() => {
        useSchemaRenderer({
          schema: ref(schema),
          components: ref({}),
          formData: ref(model),
        })
      })
    })

    bench('100 字段 schema 单字段输入(model[field0] = "x")', async () => {
      model.field0 = 'x'
      await nextTick()
    })
  })

  // ─── reaction 执行时间 ───
  describe('reaction 时间(100 字段都有 reaction)', () => {
    bench('100 字段 reaction 全部执行一次', () => {
      const schema: SchemaNode = {
        column: 2,
        children: Array.from(
          { length: 100 },
          (_, i) =>
            ({
              label: `字段 ${i}`,
              name: `field${i}`,
              component: 'Input',
              reaction: {
                // reaction 读 model 字段 + 写 node.disabled
                disabled: (m: Record<string, unknown>) => String(m[`field${i}`] ?? '').length > 5,
              },
            }) as SchemaNode
        ),
      }
      const model = reactive<Record<string, unknown>>({})
      // 模拟 reaction 同步执行 100 次
      const children = schema.children as SchemaNode[]
      children.forEach((n) => {
        if (n.reaction?.disabled && typeof n.reaction.disabled === 'function') {
          ;(n.reaction.disabled as (m: Record<string, unknown>) => boolean)(model)
        }
      })
    })
  })
})
