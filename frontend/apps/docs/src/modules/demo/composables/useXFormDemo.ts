/**
 * useXFormDemo —— XForm demo 站点样板 composable
 *
 * 抽离 30 个 XForm* demo 中重复的样板代码：
 * - formRef（统一类型为 XFormExpose | null）
 * - bem 命名空间（统一前缀 'demo-x-form-{name}'）
 * - onReset（resetFields 透传）
 * - copySchema（schema JSON 写入剪贴板 + toast 反馈）
 * - copyModel（model JSON 写入剪贴板 + toast 反馈）
 * - onSave 通用版（validate + 失败/成功 toast）
 *
 * 设计原则：
 * - 抽离的是「完全等价」的样板，不抽「有差异」的逻辑（如 XFormArray 的 grandTotal 拼接、
 *   XFormDetailFill 的 400ms 模拟提交）——这些 demo 保留自己的 onSave
 * - 所有函数返回纯函数，行为 100% 等价于原内联实现（toast 文案、剪贴板格式、按钮顺序不变）
 * - 不依赖任何 demo 私有数据，仅依赖 schema/model 的引用
 *
 * 使用：
 * ```ts
 * const { formRef, bem, onSave, onReset, copySchema, copyModel } = useXFormDemo({
 *   name: 'base',
 *   schema,
 *   model,
 * })
 * ```
 */
// ref 由 unplugin-auto-import 注入（§1.6）；类型 Ref 须显式 type import
import type { Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { XFormExpose, SchemaNode } from '@vv/ui/components/form-schema/types.ts'

export interface UseXFormDemoOptions {
  /** 必填：demo 简称（用于 bem 命名空间 demo-x-form-{name} 与 formRef 标识） */
  name: string
  /**
   * 必填：schema 引用。传值（reactive 对象）或 getter 函数均可
   * 复制时 JSON.stringify 整个 schema —— 与原 demo 内联实现完全一致
   */
  schema: SchemaNode | SchemaNode[] | (() => SchemaNode | SchemaNode[])
  /**
   * 可选：model 引用，供 copyModel 使用。传值或 getter 均可
   */
  model?: Record<string, unknown> | (() => Record<string, unknown> | undefined)
  /**
   * 可选：onSave 成功 toast 文案（默认 '保存成功'）
   * - 传 string：用该文案（与 ElMessage.success 等价）
   * - 传 false：关闭成功 toast（适用于需要自定义渲染的场景）
   * - 不传：使用默认 '保存成功'
   */
  successMessage?: string | false
  /**
   * 可选：onSave 失败 toast 文案（默认 '校验失败，请检查字段'）
   */
  failMessage?: string
}

export interface UseXFormDemoReturn {
  /** formRef —— 统一类型为 XFormExpose | null */
  formRef: Ref<XFormExpose | null>
  /** BEM 命名空间 —— 统一前缀 demo-x-form-{name} */
  bem: ReturnType<typeof createNamespace>
  /** 重置（直接调 el-form 的 resetFields，不弹 toast —— 与原 demo 行为一致） */
  onReset: () => void
  /** 复制 schema JSON 到剪贴板，成功/失败均有 toast —— 与原 demo 行为一致 */
  copySchema: () => Promise<void>
  /** 复制 model JSON 到剪贴板（model 未传时此函数不可用） */
  copyModel: () => Promise<void>
  /**
   * 通用 onSave：validate → 失败弹 failMessage → 成功弹 successMessage
   * 适用于只需要"校验+toast"的简单 demo；需要展示 JSON dump 或追加业务逻辑的 demo
   * （XFormBase/Builder/CrossField/Array/Upload/Disabled/DetailFill）请保留自己的 onSave 实现
   */
  onSave: () => Promise<boolean>
}

/**
 * 异步复制字符串到剪贴板。统一错误处理：非安全上下文或拒绝时弹错误 toast
 * 与 18 个 demo 的 copySchema / copyModel 内联实现完全等价
 */
async function copyToClipboard(
  text: string,
  successMsg: string,
  entity: 'schema' | 'model'
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`${entity === 'schema' ? 'schema' : 'model'} 已复制到剪贴板`)
  } catch {
    ElMessage.error('复制失败，请手动选择')
  }
  // 占位 successMsg 以便将来扩展（保留参数避免破坏调用方）
  void successMsg
}

export function useXFormDemo(options: UseXFormDemoOptions): UseXFormDemoReturn {
  const {
    name,
    schema,
    model,
    successMessage = '保存成功',
    failMessage = '校验失败，请检查字段',
  } = options

  const formRef = ref<XFormExpose | null>(null)
  const bem = createNamespace(`demo-x-form-${name}`)

  function resolveSchema(): SchemaNode | SchemaNode[] {
    return typeof schema === 'function' ? schema() : schema
  }
  function resolveModel(): Record<string, unknown> | undefined {
    if (model === undefined) return undefined
    return typeof model === 'function' ? model() : model
  }

  function onReset(): void {
    formRef.value?.resetFields()
  }

  async function copySchema(): Promise<void> {
    const text = JSON.stringify(resolveSchema(), null, 2)
    await copyToClipboard(text, 'schema 已复制到剪贴板', 'schema')
  }

  async function copyModel(): Promise<void> {
    const m = resolveModel()
    if (m === undefined) {
      ElMessage.warning('model 未传入，无法复制')
      return
    }
    const text = JSON.stringify(m, null, 2)
    await copyToClipboard(text, 'model 已复制到剪贴板', 'model')
  }

  async function onSave(): Promise<boolean> {
    if (!formRef.value) return false
    const valid = await formRef.value.validate()
    if (!valid) {
      ElMessage.error(failMessage)
      return false
    }
    if (successMessage !== false) {
      ElMessage.success(successMessage)
    }
    return true
  }

  return { formRef, bem, onReset, copySchema, copyModel, onSave }
}
