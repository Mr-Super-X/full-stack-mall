/**
 * use-schema-renderer —— schema 整体替换 + identity-preserving clone + markRaw 包装
 *
 * 关键责任：
 * - 监听 schema 引用换代；旧 schema 走 cloneDeepWith 复刻，新 schema 走 identity-preserving 浅克隆
 * - identity-preserving clone：component 字段保持引用（避免 Vue 整字段 remount）
 * - markRaw(component)：用户传 Component 对象时排除响应式追踪（消除 "reactive object" 警告）
 *
 * @group 表单编排：渲染
 */
import { watch, ref, reactive, markRaw, onScopeDispose, type Ref } from 'vue'
import { cloneDeepWith } from 'lodash-es'
import { trackTriggerRender } from './use-dev-runtime'

/**
 * identity-preserving clone：行为同 cloneDeep，但不深入 component 字段 ——
 * 组件定义对象（options object）被深克隆后身份丢失，Vue 视为不同组件导致整字段 remount；
 * 保持引用后配合顶层稳定 key，schema 重建时同 key 节点走 patch 而非 remount。
 * 函数（reaction/validator/source）cloneDeep 本就按引用拷贝，无需特殊处理。
 *
 * markRaw 包裹：用户传 component 为 Component 对象（如 `component: ElIcon`）时，
 * 后续 reactive(cloned) 会把组件对象也变 Proxy，触发 Vue 警告
 * "Component that was made a reactive object"。
 * markRaw 排除响应式追踪，保留 Vue 内部组件优化的同时消除警告。
 */
function cloneSchema<T>(value: T): T {
  return cloneDeepWith(value, (val, key) => {
    if (key === 'component' && val !== null && typeof val === 'object') return markRaw(val)
    return undefined // 其余字段走默认深克隆
  })
}
import type { SchemaNode, XFormProps } from '../types'
import {
  containsReaction,
  applyReactions,
  createBudget,
  DEFAULT_REACTION_BUDGET,
  type ReactionBudget,
} from './use-reaction'
import { useAsyncOptions, resolveAsyncOptionsProp } from './use-async-options'
import type { ExpressionScope } from './use-expression'
import { walkSchema } from '../utils/walk-schema'

interface UseSchemaRendererOptions {
  schema: Ref<SchemaNode | SchemaNode[]>
  components: Ref<Record<string, unknown> | undefined>
  formData: Ref<Record<string, unknown>>
  beforeChange?: XFormProps['beforeChange']
  /**
   * 单 flush 内 reaction 最大执行次数（阶段 P2-3 透传入口）
   * - 默认 50（与 DEFAULT_REACTION_BUDGET 一致，向后兼容）
   * - 大型 schema reaction 链较长时可调高
   * - 严格排查循环联动时可调小
   * @see ./use-reaction.ts
   */
  reactionBudget?: number
  /**
   * H2：实例级表达式解析器（composer 用 createExpressionScope() 创建，每实例一份）。
   * 注入后 reaction 管线全部节点用实例私有沙箱求值，缺省回退模块级（向后兼容）。
   * @see ./use-expression.ts createExpressionScope
   */
  resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']
}

/**
 * 核心编排 composable
 *
 * - watch(schema, deep)：schema 变化时按需克隆 + 注册 reaction watchEffect
 * - onScopeDispose：卸载时清理所有 watchEffect
 */
export function useSchemaRenderer(opts: UseSchemaRendererOptions) {
  // 用 ref 而非 shallowRef：reaction watchEffect 会修改 cloned schema 内部属性（如 node.ignore）
  // shallowRef 不深度响应，修改内部属性不会触发模板重渲染
  const reactiveSchema = ref<SchemaNode | SchemaNode[]>({})
  const stoppers: (() => void)[] = []
  const asyncStoppers: (() => void)[] = []

  watch(
    () => opts.schema.value,
    (val) => {
      stoppers.forEach((s) => s())
      stoppers.length = 0
      asyncStoppers.forEach((s) => s())
      asyncStoppers.length = 0
      // 数组 schema → 包 children（XForm 不再独立处理 normalize）
      const normalized = Array.isArray(val) ? ({ children: val } as SchemaNode) : val
      const hasRx = containsReaction(normalized)
      const hasAsync = containsAsyncOptions(normalized)
      // 用 reactive 包装 cloned：reaction / asyncOptions 会修改 cloned.ignore / label / props 等内部属性，
      // vue 才能追踪到变化触发模板重渲染（plain object 不响应）
      const cloned = hasRx || hasAsync ? reactive(cloneSchema(normalized)) : cloneSchema(normalized)
      // 注册异步选项 watcher（在 reaction traverse 之前，避免 reaction 覆盖 props）
      registerAsyncOptions(cloned, opts.formData, asyncStoppers)
      if (hasRx) {
        // 阶段 P2-3：reactionBudget 透传到 reaction 执行预算（默认 50 向后兼容）
        const budget: ReactionBudget = createBudget(opts.reactionBudget ?? DEFAULT_REACTION_BUDGET)
        traverse(
          cloned as SchemaNode,
          opts.formData.value,
          stoppers,
          budget,
          opts.resolveFunctionExpression
        )
      }
      reactiveSchema.value = cloned
    },
    { immediate: true, deep: true }
  )

  onScopeDispose(() => {
    stoppers.forEach((s) => s())
    stoppers.length = 0
    asyncStoppers.forEach((s) => s())
    asyncStoppers.length = 0
  })

  return {
    reactiveSchema,
    /**
     * 阶段 3.1：强制触发 reactiveSchema 重渲染
     * 关键:不仅 triggerRef 通知依赖,还要**改变 reactiveSchema 引用** —
     * 否则顶层 computed topLevelNodes 重算但返回**同一引用**,Vue 不触发模板重渲染
     * （Vue 3 优化：computed 返回值引用未变时依赖方不重新执行 render）
     */
    triggerRender: () => {
      trackTriggerRender()
      reactiveSchema.value = { ...reactiveSchema.value } as SchemaNode | SchemaNode[]
    },
  }
}

function traverse(
  node: SchemaNode | SchemaNode[],
  model: Record<string, unknown>,
  stoppers: (() => void)[],
  budget: ReactionBudget,
  resolve?: ExpressionScope['resolveFunctionExpression']
): void {
  if (Array.isArray(node)) {
    node.forEach((n) => traverse(n, model, stoppers, budget, resolve))
    return
  }
  // M6：跳过 array.itemSchema —— 行级 reaction 由 render-array-node.ts 在 renderRow 内
  // 按行实例化注册（model 上下文 = 行对象，行内相对 deps 才有值）。若此处不跳过，
  // registerNodeReaction 会先 delete 行内节点 reaction 并用根 model 注册一份错误
  // watcher（行内 deps 在根 model 不可达、sync 立即执行 _effect(root) 污染根 model），
  // renderArrayNode 拿到的 itemSchema 已无 reaction 字段，行级 applyReactions 空跑。
  // 嵌套 array（itemSchema 内再嵌 array）同理由内层 renderArrayNode 递归接管。
  applyReactions(node, model, stoppers, budget, resolve, { includeArrayItemSchema: false })
}

/**
 * 注册 schema 中所有异步选项节点
 *
 * - 为每个含 asyncOptions 的节点创建请求状态
 * - 状态变化时同步到 node.props（Select/Cascader → options；TreeSelect → data；loading → loading）
 * - 返回的 stop 函数由调用方在 schema 变化/组件卸载时统一调用
 */
function registerAsyncOptions(
  node: SchemaNode | SchemaNode[],
  model: Ref<Record<string, unknown>>,
  stoppers: (() => void)[]
): void {
  // 遍历范围保持既有行为：只走 children + node.slots 两向，故意不遍历
  // formItem.slots 与 array.itemSchema —— 既有实现漏遍历这两处的 asyncOptions，
  // 行为修复（补遍历后可能改变请求触发时机）不属本批次，M5 只统一遍历器
  walkSchema(
    node,
    (n) => {
      if (!n.asyncOptions) return
      const state = useAsyncOptions(n, model)
      stoppers.push(state.stop)
      const stopState = watch(
        () => [state.data.value, state.loading.value],
        () => {
          const targetProp = resolveAsyncOptionsProp(n)
          // Autocomplete/ElAutocomplete 无 loading prop（EP 未声明）——统一注入会触发
          // XForm prop 校验「未声明键 loading」警告（docs/audit 2026-10-19 浏览器实测暴露）。
          // loading 态由 Autocomplete 输入框自身交互体现，跳过注入；其余组件（Select 等）保留。
          const compName = typeof n.component === 'string' ? n.component : null
          if (compName !== 'Autocomplete' && compName !== 'ElAutocomplete') {
            n.props = { ...(n.props ?? {}), loading: state.loading.value }
          }
          if (targetProp) {
            n.props = { ...n.props, [targetProp]: state.data.value }
          }
        },
        { immediate: true, deep: true }
      )
      stoppers.push(stopState)
    },
    { includeFormItemSlots: false, includeArrayItemSchema: false }
  )
}

/** 检查 schema 中是否含 asyncOptions 字段（含字段时才需启用 reactive）—— 经 walkSchema 四向遍历（M5 统一） */
function containsAsyncOptions(node: SchemaNode | SchemaNode[]): boolean {
  let found = false
  walkSchema(node, (n) => {
    if (n.asyncOptions) {
      found = true
      return false
    }
  })
  return found
}
