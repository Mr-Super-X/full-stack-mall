/**
 * use-model-expression-rerender —— model 依赖表达式的重渲兜底
 *
 * 为什么需要：顶层 readonly / disabled / 字段 permission 的函数或 '{{ }}' 表达式形态，
 * 经表达式沙箱 toSafeDtoCached 深拷贝 model 为安全 DTO 求值 —— 深拷贝切断响应式追踪，
 * 这些表达式的宿主 computed（如 useTopLevelFields.readonly）只依赖 props.model 引用 +
 * reactiveSchema.value，model 字段 mutation 不触发重算（2026-09-18 用户反馈
 * xform-expression demo「锁定整表只读 / 角色切换权限三态」失效根因）。
 *
 * 机制：仅当 schema 含「model 依赖表达式」时，挂 watch(model, triggerRender, {deep:true}) ——
 * model 任一字段变化时 bump reactiveSchema 引用，强制所有依赖它的顶层 computed 重算，
 * 表达式重新求值读到新 model 副本。
 *
 * 为什么按需而非无条件：无这类表达式的纯 v-model 表单不需要每次按键整表重渲
 * （字段级重渲隔离是性能卖点，无条件 deep watch 会摧毁它）。
 *
 * @group 表单编排：联动
 */
import { watch, type Ref } from 'vue'
import type { SchemaNode } from '../types'
import { walkSchema } from '../utils/walk-schema'

/** 判定某值是否为「依赖 model 的表达式」——函数或 '{{ }}' 字符串形态 */
function isModelDependentExpression(v: unknown): boolean {
  return typeof v === 'function' || (typeof v === 'string' && v.startsWith('{{'))
}

/**
 * 检测 schema 是否含「依赖 model 的表达式」——
 * 顶层 readonly / disabled（函数/'{{ }}'）或任一字段 permission（函数/'{{ }}'）。
 * 命中任一即需 model 变化时 triggerRender。
 */
export function hasModelDependentExpression(
  schema: SchemaNode | SchemaNode[] | undefined
): boolean {
  if (!schema) return false
  let found = false
  // 顶层 readonly/disabled（仅容器/单节点形态有顶层语义；数组形态无顶层 readonly/disabled）
  if (!Array.isArray(schema)) {
    if (isModelDependentExpression((schema as SchemaNode).readonly)) return true
    if (isModelDependentExpression((schema as SchemaNode).disabled)) return true
  }
  walkSchema(schema, (n) => {
    if (isModelDependentExpression(n.permission)) {
      found = true
      return false // early-exit
    }
  })
  return found
}

/** useModelExpressionRerender 入参 */
export interface UseModelExpressionRerenderOptions {
  /** schema 响应式视图（reactiveSchema） */
  schema: Ref<SchemaNode | SchemaNode[]>
  /** 表单数据（props.model 响应式引用） */
  model: Ref<Record<string, unknown> | undefined>
  /** 强制重渲（useSchemaRenderer.triggerRender） */
  triggerRender: () => void
  /**
   * model 变化回调（可选）—— 调用方 bump 自己的 epoch 计数器，
   * 经 renderOpts 注入 renderToComponent 强制整树 SchemaField 重跑（permission 等
   * slot 闭包内求值的表达式靠此重算）；不传则仅 triggerRender（顶层 readonly/disabled 足够）
   */
  onModelChange?: () => void
}

/**
 * useModelExpressionRerender —— model 依赖表达式的重渲兜底
 *
 * 仅当 schema 含 model 依赖表达式时挂 watch；否则 no-op（零开销）。
 * watch 为 deep（model 是嵌套 reactive），仅这类表达式存在的表单承担该成本。
 */
export function useModelExpressionRerender(opts: UseModelExpressionRerenderOptions): void {
  // schema 引用换代时重新评估是否需挂 watch（schema 可能从含表达式变为不含）
  let stop: (() => void) | null = null
  watch(
    () => opts.schema.value,
    (schema) => {
      stop?.()
      stop = null
      if (!hasModelDependentExpression(schema)) return
      stop = watch(
        () => opts.model.value,
        () => {
          opts.onModelChange?.()
          opts.triggerRender()
        },
        { deep: true }
      )
    },
    { immediate: true }
  )
}
