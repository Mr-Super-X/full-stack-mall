/**
 * useFormInstance —— el-form 实例方法编排
 *
 * 职责：
 * - el-form 实例引用 + getRef / clearValidate / resetFields / validateField 等基础方法
 * - 数组操作 addItem / removeItem / moveItem（含 clearArraySubtree 行清理）
 * - 委托 useSetFieldError 处理 setFieldError / setFieldValidating + watch 守护
 * - zod 校验内部委托 ./use-zod-validator.ts
 *
 * 已抽离：setFieldError 双路径+watch 守护→./use-set-field-error、zod→./use-zod-validator。
 *
 * @group 表单编排：实例
 */
import { ref, toRaw, type ComponentPublicInstance, type Ref } from 'vue'
import { get, set } from 'lodash-es'
import { useSetFieldError, type FieldErrorState } from './use-set-field-error'
import { useZodValidator } from './use-zod-validator'
import type { UseFormErrorBusReturn } from './use-form-error-bus'
import { collectElFieldErrors } from '../utils/collect-el-field-errors'
import type { ZodType } from 'zod'

/**
 * ElFormInstance —— element-plus ElForm 实例运行时方法（宽松签名版）
 *
 * InstanceType<typeof ElForm> 会丢失 validate / validateField 等方法，这里补齐 element-plus 2.x
 * 实际支持但 TS 类型声明不全的方法。setInitialValues 是 element-plus 内部方法 —— 同步 ElForm 初始值快照，
 * 用于 defaultValue 填充后防止子组件 mount 副作用（如 ElRate emit 0）导致 resetFields 基准值错乱。
 *
 * @see ./use-set-field-error.ts Path B watch 守护依赖 fields 数组
 */
export type ElFormInstance = {
  validate?: (callback?: (valid: boolean) => void) => Promise<boolean>
  /**
   * element-plus 2.x TS 类型声明为 () => void，实际支持 props?: string[]（仅清除指定字段）
   * 这里用宽松签名补齐
   */
  clearValidate?: (props?: string | string[]) => void
  resetFields?: (props?: string | string[]) => void
  scrollToField?: (name: string) => void
  /**
   * element-plus 2.x 实际支持但 TS 类型声明不完整：validateField(prop?: string | string[]): Promise<void>（校验失败 reject）
   */
  validateField?: (prop?: string | string[]) => Promise<void>
  /**
   * element-plus 2.x 内部方法 —— 同步 ElForm 初始值快照，
   * 用于 defaultValue 填充后防止子组件 mount 副作用（如 ElRate emit 0）导致 resetFields 基准值错乱。
   */
  setInitialValues?: (initModel: Record<string, unknown>) => void
}

/** 重新导出 FieldErrorState 保持向后兼容（@see ./use-set-field-error.ts 定义） */
export type { FieldErrorState }

/** useFormInstance —— el-form 实例方法编排（getRef / validate / setFieldError / 数组操作） */
export function useFormInstance(
  model: () => Record<string, unknown> | undefined,
  zodSchema: () => ZodType | undefined,
  /** 显式 deps 传入（避免 provide/inject 在嵌套 composable 中失效） */
  errorBus?: UseFormErrorBusReturn
) {
  const elFormRef = ref<ElFormInstance | null>(null)
  // 阶段 3.1：externalErrors 由 useFormInstance 内部创建并拥有（避免 composer / instance / setFieldError
  // 三方所有权争议）。走 element-plus 官方 props.error + props.validateStatus 路径触发红字。
  const externalErrors = ref<Record<string, FieldErrorState>>({})

  const { setFieldError } = useSetFieldError({
    externalErrors,
    getFields: () =>
      (elFormRef.value as unknown as { fields?: unknown[] } | null)?.fields as
        | Array<{ prop?: string | { value?: string }; propString?: string | { value?: string } }>
        | undefined,
    // exactOptionalPropertyTypes: 条件展开避免传 undefined
    ...(errorBus ? { errorBus } : {}),
  })

  function getRef(key: string): ComponentPublicInstance | HTMLElement | null {
    const map = (elFormRef.value as unknown as { $?: Record<string, unknown> } | null)?.$ ?? {}
    return (map[key] as ComponentPublicInstance | HTMLElement) ?? null
  }

  /** 从 el-form field 上下文提取字段路径名（优先 propString，兼容 ref/字符串两种形态） */
  function extractFieldName(field: unknown): string | null {
    const raw = toRaw(field) as {
      prop?: string | Ref<string>
      propString?: string | Ref<string>
    }
    const propString =
      raw.propString && typeof raw.propString === 'object' && 'value' in raw.propString
        ? raw.propString.value
        : raw.propString
    const prop =
      raw.prop && typeof raw.prop === 'object' && 'value' in raw.prop ? raw.prop.value : raw.prop
    const name = typeof propString === 'string' ? propString : prop
    return typeof name === 'string' ? name : null
  }

  /** 从 ref-like 值解包字符串 —— 已迁移到 ../utils/read-ref-str（element-plus 内部字段状态常用 ref<string> 形态） */

  /**
   * 数组删/移后按行清理失效的校验态 —— 此前直接调无参 clearValidate() 会清空
   * 全表单错误（误伤其他字段的服务端/本地红字），且绕过 externalErrors 同步。
   * 只清 fromIndex 及之后的行：错误是位置性的，索引位移后旧错误指向错位的行；
   * fromIndex 之前的行索引未变，其错误仍然有效，必须保留。
   */
  function clearArraySubtree(name: string, fromIndex: number): void {
    const ef = elFormRef.value as unknown as { fields?: unknown[] } | null
    const escaped = name.replace(/[.*+?^${}()[\]\\]/g, '\\$&')
    const rowReg = new RegExp(`^${escaped}\\[(\\d+)\\]`)
    const names = (ef?.fields ?? []).map(extractFieldName).filter((n): n is string => {
      if (n === null) return false
      if (n === name || n.startsWith(`${name}.`)) return true
      const m = n.match(rowReg)
      return m !== null && Number(m[1]) >= fromIndex
    })
    // element-plus filterFields 对空数组的语义是"清全部字段"——
    // 一个匹配都提不到时必须什么都不做，否则等于退回无参 clearValidate 的误伤行为
    if (names.length === 0) return
    clearValidate(names)
  }

  function clearValidate(names?: string[]): void {
    // clearValidate 同时清理 externalErrors（保持与 setFieldError 同步）
    // P0-2:externalErrors 必存在（P0-2 内部创建）,去掉冗余守卫
    if (names) {
      for (const name of names) delete externalErrors.value[name]
    } else {
      externalErrors.value = {}
    }
    elFormRef.value?.clearValidate?.(names)
  }

  function resetFields(names?: string | string[]): void {
    // 部分重置：只清指定字段的 externalErrors；全量重置才清空整个 externalErrors
    // P0-2:externalErrors 必存在（P0-2 内部创建）,去掉冗余守卫
    if (names !== undefined) {
      const list = Array.isArray(names) ? names : [names]
      for (const n of list) delete externalErrors.value[n]
    } else {
      externalErrors.value = {}
    }
    elFormRef.value?.resetFields?.(names)
  }

  /**
   * 同步 ElForm 初始值快照。
   * 用于 schema defaultValue 填充后：防止子组件 mount 时副作用（如 ElRate 在 modelValue
   * 为 falsy 时 emit 0）导致 ElForm 捕获到错误的初始值，进而使 resetFields 无法回到 defaultValue。
   */
  function setInitialValues(initModel: Record<string, unknown>): void {
    elFormRef.value?.setInitialValues?.(initModel)
  }

  /**
   * 校验指定字段（透传 el-form validateField）—— 与 validate() 风格一致返回 boolean：
   * 成功 true；校验失败 / el-form 未绑定均 false
   * **失败时与 validateForm 对齐**：扫描 ef.fields 提取 validateState=error 的字段详情，
   * 触发 OSD toast（EL_FORM_VALIDATION_FAILED）与 console.error 输出。
   * 字段错误已由 el-form-item 红字展示，OSD/console 是给开发者的诊断反馈。
   */
  async function validateField(name: string | string[]): Promise<boolean> {
    const ef = elFormRef.value
    if (!ef?.validateField) {
      console.error(
        '[XForm] validateField 调用时 el-form 实例未绑定（elFormRef 为空），已按校验失败处理'
      )
      return false
    }
    try {
      await ef.validateField(name)
      return true
    } catch {
      // 校验失败：与 validateForm 对齐 —— 扫描 ef.fields 提取命中字段的错误详情
      const efAny = ef as unknown as { fields?: unknown[] }
      const targetNames = Array.isArray(name) ? name : [name]
      const details = collectElFieldErrors(efAny, {
        filterNames: new Set(targetNames),
        includeValue: true,
      })
      if (details.length > 0) {
        console.error('[XForm] validateField failed:', details)
        // force: true —— 用户主动 validateField() 调用场景，每次都应反馈（不被 5s 去重）
        errorBus?.report({
          severity: 'error',
          code: 'EL_FORM_VALIDATION_FAILED',
          message: `字段校验失败 ${details.length} 项（详见表单红字）`,
          fields: details.map((d) => d.field),
          details,
          source: 'useFormInstance/validateField',
          force: true,
        })
      }
      return false
    }
  }

  function scrollToField(name: string): void {
    elFormRef.value?.scrollToField?.(name)
  }

  // zod 顶层校验独立（内部委托，公开签名不变）
  const { validateFormWithZod } = useZodValidator(model, zodSchema)

  /** 数组操作：在 name 路径末尾追加一项（追加不产生索引位移，无需清理任何校验态）
   *
   * name 支持嵌套路径（如 'orders[0].items'），用 lodash get/set 解析。
   * P0-3 修复：嵌套 array 场景下内层 array 节点 name 已被前缀化（如 orders[0].items），
   * 直接 m[name] 失效。
   */
  function addItem(name: string, init?: Record<string, unknown>): void {
    const m = model()
    if (!m) return
    let arr = get(m, name) as unknown[] | undefined
    if (!Array.isArray(arr)) {
      arr = []
      set(m, name, arr)
    }
    arr.push(init ?? {})
  }

  /** 数组操作：删除 name[index]（支持嵌套路径） */
  function removeItem(name: string, index: number): void {
    const m = model()
    if (!m) return
    const arr = get(m, name) as unknown[] | undefined
    if (!Array.isArray(arr)) return
    if (index < 0 || index >= arr.length) return
    arr.splice(index, 1)
    // 被删行及之后的行索引位移（items[2].qty → items[1].qty），旧位置错误失效；
    // 之前的行不受影响，红字保留
    clearArraySubtree(name, index)
  }

  /** 数组操作：把 name[from] 移到 [to]（支持嵌套路径） */
  function moveItem(name: string, from: number, to: number): void {
    const m = model()
    if (!m) return
    const arr = get(m, name) as unknown[] | undefined
    if (!Array.isArray(arr)) return
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    // [min(from,to), max(from,to)] 区间内的行索引均变化，区间外不受影响
    clearArraySubtree(name, Math.min(from, to))
  }

  /** 手动标记某个字段为校验中(el-form-item 显示 loading 图标) */
  function setFieldValidating(name: string): void {
    setFieldError(name, '', 'validating')
  }

  return {
    elFormRef,
    getRef,
    clearValidate,
    resetFields,
    setInitialValues,
    validateField,
    scrollToField,
    validateFormWithZod,
    addItem,
    removeItem,
    moveItem,
    setFieldError,
    setFieldValidating,
    // 暴露 externalErrors ref 让调用方（如 XForm.vue）能直接读状态
    externalErrors,
  }
}
