/**
 * apply-default-values —— defaultValue 运行时填充工具
 *
 * 从 use-xform-composer 抽离。defaultValue 填充是运行时行为（非 dev 诊断），必须全环境生效；
 * dev 校验 + 表达式扫描已迁到 use-dev-runtime.ts，本文件只保留 model 填充逻辑。
 *
 * @group 表单编排：默认值
 */
import { onMounted, watch } from 'vue'
import { get, set } from 'lodash-es'
import type { SchemaNode, XFormProps } from '../types'

/** 数组 schema → 包 children 形态（统一为根节点） */
export function normalizeSchema(val: SchemaNode | SchemaNode[]): SchemaNode {
  return Array.isArray(val) ? ({ children: val } as SchemaNode) : val
}

/**
 * 递归应用 schema 节点 defaultValue 到 model
 *
 * - 仅在 model 字段未定义时填充（get 返回 undefined 才 set）
 * - lodash get/set 支持嵌套路径（'address.city'）
 * - 跳过 string / undefined / null 节点
 */
export function applyDefaults(
  node: SchemaNode | SchemaNode[] | string | undefined,
  model: Record<string, unknown> | undefined
): void {
  if (!model) return
  if (typeof node === 'string' || node === undefined || node === null) return
  if (Array.isArray(node)) {
    node.forEach((n) => applyDefaults(n, model))
    return
  }
  if (
    node.name !== undefined &&
    node.defaultValue !== undefined &&
    get(model, node.name) === undefined
  ) {
    set(model, node.name, node.defaultValue)
  }
  if (node.children) applyDefaults(node.children, model)
}

/**
 * 应用 defaultValue（schema 变化时）+ 同步 ElForm 初始值快照（仅首次）
 *
 * setup 期 immediate watch 触发时 elFormRef 尚未绑定，mounted 后再补一次快照同步。
 *
 * ⚠️ 快照只同步一次（首次挂载）——schema 后续 watch 触发（如业务把 schema 包成 computed
 * 依赖 model 字段，输入即重求值产生新 schema 引用）时**不得**再调 setInitialValues，否则
 * 会把当前脏 model 同步为 initialValue，导致 resetFields 回到脏值而非 mount 时初始值
 * （2026-09-18 用户反馈「点重置没反应」根因）。
 */
export function applyDefaultsAndSync(
  props: XFormProps,
  val: SchemaNode | SchemaNode[],
  setInitialValues: (initModel: Record<string, unknown>) => void,
  syncSnapshot = true
): void {
  const normalized = normalizeSchema(val)
  applyDefaults(normalized, props.model)
  if (syncSnapshot) setInitialValues(props.model ?? {})
}

/**
 * 注册 schema 变化 → applyDefaults（+ 首次快照同步）+ mounted 后补同步
 *
 * 立即执行 + deep watch schema 引用变化；schema 后续变化只应用 defaultValue，
 * 不重复 setInitialValues（避免污染 el-form 的初始值快照，见 applyDefaultsAndSync 注释）
 */
export function useApplyDefaults(
  props: XFormProps,
  setInitialValues: (initModel: Record<string, unknown>) => void
): void {
  let isFirstSync = true
  watch(
    () => props.schema,
    (val) => {
      applyDefaultsAndSync(props, val, setInitialValues, isFirstSync)
      isFirstSync = false
    },
    { immediate: true, deep: true }
  )
  onMounted(() => {
    // setup 期 immediate watch 触发时 elFormRef 尚未绑定，mounted 后补一次快照同步
    // （仅首次：若 watch 已同步过则跳过，避免重复覆盖；若 watch 因 schema 异常未触发也兜底）
    applyDefaultsAndSync(props, props.schema, setInitialValues, isFirstSync)
    isFirstSync = false
  })
}
