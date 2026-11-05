/**
 * use-reaction —— reaction 应用 + 联动执行预算（防循环联动卡死）
 *
 * 为什么需要预算：reaction 允许写 model 副作用，deep watch 会再次触发 runner，
 * 一旦构成环（A 改 B、B 改 A）将无限刷入 Vue 调度队列，页面卡死且无报错。
 * 预算耗尽降级为 console.error，把"卡死"转为"可诊断错误"。
 *
 * 应用策略：sync / debounce / throttle + 可选 deps 精确监听。
 *
 * @group 表单编排：联动
 */
import { nextTick, watch } from 'vue'
import { debounce, get, throttle } from 'lodash-es'
import type { SchemaNode } from '../types'
import { applyReactionFields } from './apply-reaction-fields'
// 注意：第 5 参缺省值故意引用 @deprecated 模块级 API —— 旧调用方不传 resolve 时
// 必须回退模块级表保持行为不变，这是向后兼容设计
import { resolveFunctionExpression, type ExpressionScope } from './use-expression'
import { walkSchema, type WalkSchemaOptions } from '../utils/walk-schema'

/** 单 flush 内 reaction 最大执行次数 —— 必须低于 Vue 调度器自身递归上限（100），
 *  先一步拦截避免 "Maximum recursive updates exceeded" 未处理异常把卡死降级为 console.error */
export const DEFAULT_REACTION_BUDGET = 50

/** 联动执行预算：每个表单实例一份，nextTick 后自动重置。耗尽返回 false 跳过本次执行 */
export interface ReactionBudget {
  /** 单 flush 内允许的最大执行次数（XFormProps.reactionBudget 透传） */
  readonly max: number
  /** 尝试进入预算,返回 true=允许, false=预算已耗尽 */
  enter: () => boolean
}

/** 创建一份 reaction 执行预算（参数化 max，供 XFormProps.reactionBudget 透传）
 *
 * @param max 单 flush 内 reaction 最大执行次数，默认 DEFAULT_REACTION_BUDGET (50)
 */
export function createBudget(max: number = DEFAULT_REACTION_BUDGET): ReactionBudget {
  let count = 0
  let resetScheduled = false
  return {
    max,
    enter() {
      if (count >= max) return false
      count++
      if (!resetScheduled) {
        resetScheduled = true
        void nextTick(() => {
          count = 0
          resetScheduled = false
        })
      }
      return true
    },
  }
}

/** H1 修复：standalone 函数 / '{{ }}' 形态的 disabled/hidden 视为 reaction 源
 * （克隆阶段由 applyReactions 归一化为 reaction 条目求值，与 README「✅ 完整（推荐）」承诺对齐） */
function hasReactiveStandaloneField(o: SchemaNode): boolean {
  return (
    typeof o.disabled === 'function' ||
    (typeof o.disabled === 'string' && o.disabled.startsWith('{{')) ||
    typeof o.hidden === 'function' ||
    (typeof o.hidden === 'string' && o.hidden.startsWith('{{'))
  )
}

/** 是否含 reaction 字段（含字段时才需启用 watchEffect）—— 经 walkSchema 四向遍历（M5 统一） */
export function containsReaction(schema: SchemaNode | SchemaNode[]): boolean {
  let found = false
  walkSchema(schema, (node) => {
    if (node.reaction || hasReactiveStandaloneField(node)) {
      found = true
      return false
    }
  })
  return found
}

/**
 * 应用 reaction：按需注册 watch（仅函数/函数表达式字符串）；求值错误 → console.error
 *
 * - strategy: 'sync'(默认) | 'debounce' | 'throttle' + delay
 *   - 'debounce': 依赖停止变化 delay ms 后执行一次（适合远程搜索）
 *   - 'throttle': delay ms 内最多执行一次（适合实时保存）
 * - deps: string[] —— 声明后精确 watch 这些路径；未声明保持 deep watch 整棵 model 旧行为
 * @param resolve H2：实例级表达式解析器（缺省回退模块级，向后兼容旧调用方）；
 *   透传给全部递归子树，保证嵌套节点与顶层节点用同一份沙箱
 * @param walkOpts M6：walkSchema 方向开关（缺省全开）。顶层 traverse 传
 *   `{ includeArrayItemSchema: false }` 跳过 array.itemSchema —— 行级 reaction 由
 *   render-array-node.ts 在 renderRow 内按行实例化注册（model 上下文 = 行对象），
 *   若顶层不跳过，registerNodeReaction 会先 delete 行内节点 reaction 并用根 model
 *   注册一份错误 watcher（行内相对 deps 在根 model 不可达、_effect(root) 污染根 model）
 */
export function applyReactions(
  node: SchemaNode,
  model: Record<string, unknown>,
  stoppers: (() => void)[],
  budget: ReactionBudget = createBudget(),
  resolve: ExpressionScope['resolveFunctionExpression'] = resolveFunctionExpression,
  walkOpts?: WalkSchemaOptions
): void {
  walkSchema(
    node,
    (n) => {
      registerNodeReaction(n, model, stoppers, budget, resolve)
    },
    walkOpts
  )
}

/** 单节点：H1 归一化 standalone 函数/'{{ }}'形态 disabled/hidden → reaction 条目，按需注册 watch */
function registerNodeReaction(
  node: SchemaNode,
  model: Record<string, unknown>,
  stoppers: (() => void)[],
  budget: ReactionBudget,
  resolve: ExpressionScope['resolveFunctionExpression']
): void {
  // H1 修复：standalone 函数/'{{ }}'形态 disabled/hidden 归一化为 reaction 条目。
  // 背景：字段级 disabled/hidden 此前只有字面量 boolean 被实现层消费 —— 函数形态被
  // render-form-item/render-schema-node/render-visual-container 原样 spread 进组件 props
  // （dev 报 prop type 警告 + 字段永久禁用），hidden 函数形态被 use-render-root 当 truthy
  // 恒隐藏。归一化后走既有 watch 求值管线，boolean 写回 node，全部消费点自动正确。
  // 合并优先级：node.reaction 已有同名 key 时以 reaction 为准（显式配置优先于简写）。
  const standaloneReactive: Record<string, unknown> = {}
  for (const key of ['disabled', 'hidden'] as const) {
    const raw = (node as Record<string, unknown>)[key]
    if (typeof raw === 'function' || (typeof raw === 'string' && raw.startsWith('{{'))) {
      if (node.reaction?.[key] === undefined) standaloneReactive[key] = raw
      delete (node as Record<string, unknown>)[key]
    }
  }
  if (node.reaction || Object.keys(standaloneReactive).length > 0) {
    // 保存本地引用：watchEffect 立即同步执行时 node.reaction 已被 delete
    const reactionConfig = {
      ...node.reaction,
      ...standaloneReactive,
    } as NonNullable<SchemaNode['reaction']>
    delete node.reaction
    const hasDynamic = Object.values(reactionConfig).some(
      (v) => typeof v === 'function' || (typeof v === 'string' && v.startsWith('{{'))
    )
    if (hasDynamic) {
      const strategy = reactionConfig.strategy ?? 'sync'
      const delay = typeof reactionConfig.delay === 'number' ? reactionConfig.delay : 0
      const deps = Array.isArray(reactionConfig.deps)
        ? reactionConfig.deps.filter((d): d is string => typeof d === 'string')
        : null
      const runner = (): void => {
        if (!budget.enter()) {
          console.error(
            `[XForm] reaction 单批次执行超过 ${budget.max} 次，疑似循环联动` +
              '（reaction 写入 model 又触发自身）。本批次已跳过，请检查联动链或声明 deps 缩小监听范围。'
          )
          return
        }
        try {
          applyReactionFields(node, reactionConfig, model, resolve)
        } catch (err) {
          console.error('[XForm] reaction evaluation error:', err)
        }
      }
      // 声明 deps → 精确监听路径（浅比较每次求值的快照数组）；
      // 未声明 → 向后兼容：deep watch 整棵 model
      // D(#7)：deps 路径声明后 watchOpts 同样 deep —— deps 指向对象路径（如 'user'）时，
      // Vue 依赖追踪锚定 model.user 引用，user.age 等内部变化不重算 source（reaction 不触发）。
      // deep 让对象路径内部嵌套变化可触发；标量 deps 无内部结构，触发点不变（成本仅深比较）
      const source = deps && deps.length > 0 ? () => deps.map((d) => get(model, d)) : () => model
      const watchOpts = { deep: true as const }
      let stop: () => void
      if (strategy === 'debounce' && delay > 0) {
        const debounced = debounce(runner, delay)
        stop = watch(source, () => debounced(), watchOpts)
      } else if (strategy === 'throttle' && delay > 0) {
        const throttled = throttle(runner, delay)
        stop = watch(source, () => throttled(), watchOpts)
      } else {
        // sync(默认):保持向后兼容 —— setup 时立即同步跑一次 + watch 订阅后续变化
        runner()
        stop = watch(source, runner, watchOpts)
      }
      stoppers.push(stop)
    } else {
      applyReactionFields(node, reactionConfig, model, resolve)
    }
  }
}
