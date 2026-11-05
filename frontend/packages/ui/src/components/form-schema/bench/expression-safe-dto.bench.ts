/**
 * 表达式沙箱性能基准（架构审查 #7）
 *
 * 测量项：
 * 1. 同一 model 引用连续调用 compiled() N 次（模拟同 tick 多字段 reaction 同时触发）
 *    —— 优化前每次全量深拷贝 toSafeDto；优化后本轮 tick 缓存复用
 * 2. 不同 model 引用各调用一次（模拟跨 tick 每次重新拷贝，行为保持验证）
 *
 * 对照基线（不强制阈值，仅供回归对比）：
 * - 100 字段 model × 100 次 compiled 调用：优化前 ~O(N×M)，优化后 ~O(M) + 99 次引用比较
 *
 * @group XForm 基准
 */
import { describe, bench } from 'vitest'
import { reactive } from 'vue'
import { createExpressionScope } from '../composables/use-expression'

/** 构造 N 字段的 model */
function buildModel(fieldCount: number): Record<string, unknown> {
  const m: Record<string, unknown> = {}
  for (let i = 0; i < fieldCount; i++) m[`field${i}`] = `value-${i}`
  return m
}

describe('表达式沙箱 toSafeDto 缓存基准（架构审查 #7）', () => {
  bench(
    '100 字段 model × 100 次 compiled 调用（同 tick 缓存命中）',
    () => {
      const scope = createExpressionScope()
      const compiled =
        scope.resolveFunctionExpression<(m: unknown) => unknown>('{{ (m) => m.field0 }}')
      if (!compiled) throw new Error('compile failed')
      const model = reactive(buildModel(100))
      for (let i = 0; i < 100; i++) {
        compiled(model)
      }
    },
    { iterations: 20 }
  )

  bench(
    '100 字段 model × 100 次 compiled 调用（跨 tick：每次新建 model）',
    () => {
      const scope = createExpressionScope()
      const compiled =
        scope.resolveFunctionExpression<(m: unknown) => unknown>('{{ (m) => m.field0 }}')
      if (!compiled) throw new Error('compile failed')
      for (let i = 0; i < 100; i++) {
        // 每次新建 model 引用，模拟跨 tick 的 model 变化 → 缓存失效，每次重新深拷贝
        compiled(reactive(buildModel(100)))
      }
    },
    { iterations: 20 }
  )
})
