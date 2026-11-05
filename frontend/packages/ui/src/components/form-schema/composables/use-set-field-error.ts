/**
 * useSetFieldError —— setFieldError 双路径机制（外部错误 → el-form-item 红字）
 *
 * 为什么需要双路径：
 * - 路径 A：externalErrors ref → el-form-item props 透传；
 *   el-form.validateField 内部 setValidationState('success') 会覆盖 path A 写入的 error 状态
 * - 路径 B：watch 守护强制把 el-form-item 的 validateState/validateMessage ref 同步成
 *   当前错误值，覆盖 el-form 自身的 validate-success 回调，确保红字不被复位
 *   （按需守护：仅「当前有外部错误条目」的字段挂 watcher，条目清除即 stop——
 *   无条目的字段无 drift 风险，常态 watcher 数为 0，见文件内 guardField 注释）
 *
 * OSD 上报：realtime 路径（crossValidator 反向 / 服务端 422）默认上报 toast；
 * silent=true 跳过（applyCrossErrors 批量汇总场景，避免 N 条独立 toast）
 *
 * @see ./use-form-instance.ts 调用方
 * @see ./use-form-error-bus.ts OSD 总线
 *
 * @group 表单编排：错误总线
 */

import { getCurrentScope, onScopeDispose, toRaw, watch, type Ref } from 'vue'

import type { UseFormErrorBusReturn } from './use-form-error-bus'
import { readRefStr } from '../utils/read-ref-str'

/** 字段错误状态（与 use-form-instance 同步导出，保持向后兼容） */
export type FieldErrorState = {
  error: string
  validateStatus: '' | 'validating' | 'success' | 'error'
}

/**
 * el-form fields 数组元素的运行时结构（element-plus 2.x 通过 defineExpose 暴露）
 * prop / propString / validateState / validateMessage 都是 ref-like（ref 或 computed）
 */
interface ElFormFieldRaw {
  prop?: string | { value?: string }
  propString?: string | { value?: string }
  validateState?: { value?: string }
  validateMessage?: { value?: string }
}

/** 解包 ref-like 字符串字段 —— 已迁移到 ../utils/read-ref-str */

/** 取 el-form 内部 fields 数组（懒读取，避免 setup 期间 ref 为空时崩溃） */
type FieldsGetter = () => ElFormFieldRaw[] | undefined

/**
 * useSetFieldError 入参 —— setFieldError 双路径机制依赖
 *
 * - externalErrors: 阶段 3.1 外部字段错误 ref（XForm.vue 创建并传入）
 * - getFields: 懒读取 el-form fields 数组（elFormRef.value?.fields）
 * - errorBus: 显式 deps 传入（避免 provide/inject 在嵌套 composable 中失效）
 */
export interface UseSetFieldErrorOptions {
  /** 阶段 3.1：外部字段错误状态 ref（XForm.vue 创建并传入） */
  externalErrors: Ref<Record<string, FieldErrorState>>
  /** 懒读取 el-form fields 数组（elFormRef.value?.fields） */
  getFields: FieldsGetter
  /** OPT-7：错误事件总线 —— 显式 deps 传入 */
  errorBus?: UseFormErrorBusReturn
}

/**
 * useSetFieldError 返回值 —— 双路径 setFieldError 函数
 */
export interface UseSetFieldErrorReturn {
  /**
   * 设置字段错误状态
   * @param name 字段名
   * @param message 错误信息（空字符串表示清除）
   * @param state 校验状态
   * @param silent true 跳过 OSD 上报（用于 applyCrossErrors 批量汇总场景）
   */
  setFieldError(
    name: string,
    message: string,
    state?: '' | 'validating' | 'success' | 'error',
    silent?: boolean
  ): void
}

/**
 * 初始化 setFieldError 双路径 + watch 守护
 * 在 setup 期间调用一次，返回的 setFieldError 直接传给上层
 */
export function useSetFieldError(opts: UseSetFieldErrorOptions): UseSetFieldErrorReturn {
  const { externalErrors, getFields, errorBus } = opts

  function setFieldError(
    name: string,
    message: string,
    state: '' | 'validating' | 'success' | 'error' = 'error',
    /** 静默标志：true 时不触发 OSD 上报（applyCrossErrors 批量汇总场景） */
    silent?: boolean
  ): void {
    // 路径 A：element-plus 官方 props 路径
    // A4（docs/audit/2026-10-15）：message 非空即写入条目（error / validating 均支持，
    // validating 用于异步校验中的 loading 图标）；仅 error 态触发 OSD 上报。
    // 修复前「state==='error' && message」把非空 message 的 validating 挤进 else 分支
    // 删除条目——异步校验中误清已有红字，且 validating 态永不生效。
    if (message) {
      externalErrors.value[name] = { error: message, validateStatus: state }
      // OPT-7：realtime 路径触发 OSD；validateForm 批量场景传 silent=true 跳过
      // OPT-C：setFieldError 是单字段错误的通用入口（realtime cross / 服务端 422 都可能调用），
      // 用通用 FIELD_ERROR code；区分来源由调用方的 source 字段标识
      if (state === 'error' && !silent) {
        errorBus?.report({
          severity: 'error',
          code: 'FIELD_ERROR',
          message,
          fields: [name],
          source: 'useFormInstance',
        })
      }
    } else {
      delete externalErrors.value[name]
    }
  }

  // 路径 B：watch 守护
  // 1) 订阅 externalErrors 变化（crossValidator 重算 / setFieldError 调用）
  // 2) 订阅 fields 数组变化（新字段注册），给每个新字段的 validateState/validateMessage 装 watch：
  //    当外部错误仍存在但 el-form-item 内部 validateField(success) 把状态改回 success 时，
  //    立即纠正为 error —— 这是 element-plus validateStateDebounced(100ms) 之外的同步纠正。
  //    debounced 最终会跟随 validateState 显示 error，所以红字保留。
  //
  // 清理语义（diff 精准清理）：只清「上一轮有外部错误条目、这一轮没有」的字段。
  // 无外部错误条目的字段一律不动 —— el-form 内部错误（如 required 红字）归
  // el-form validateField 自己管，绝不能被误清（Bug：填确认密码触发外部错误时，
  // 日期字段的 required 红字被 watch else 分支无差别清空）
  // ── 按需守护（批次 3-3）───────────────────────────────────────────────
  // 仅当字段「当前有外部错误条目」时挂 validateState watcher，条目清除即 stop。
  // 无条目的字段不存在 drift 风险（el-form 内部状态归 el-form 管），其守护回调本就恒空跑
  // （err?.error 为 undefined 不纠正），白挂 watcher —— 大表单常态下从 O(字段数) 降为 0。
  // 为什么不做「合并进 externalErrors watch 的单次遍历」：守护的职责是实时纠正 ——
  // el-form blur/change 校验通过时把 validateState 改回 success（此刻 externalErrors 未变），
  // 必须在该 ref 变化瞬间纠正回来；合并后纠正只在 externalErrors 变化时发生，
  // 两次变化之间的 drift（红字消失）将可见，属行为回归。
  const guardStops = new Map<string, { field: object; stop: () => void }>()
  // guardField 在 watch 回调内创建 watcher —— 脱离 setup effect scope，组件卸载后仍存活（泄漏）。
  // Map 收集 stop 句柄，scope 销毁时统一清理；getCurrentScope 守卫单测中无 scope 的裸调用
  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const g of guardStops.values()) g.stop()
      guardStops.clear()
    })
  }

  const guardField = (field: object): void => {
    const rawField = toRaw(field) as ElFormFieldRaw
    // 从 field 推字段名（优先 propString，没有用 prop）
    const fieldName = readRefStr(rawField.propString) || readRefStr(rawField.prop)
    if (typeof fieldName !== 'string') return
    const existing = guardStops.get(fieldName)
    if (existing) {
      // 同名已守护：field 对象未变 → 幂等跳过；对象已重建（el-form-item 重挂载）→ stop 旧的装新的
      if (existing.field === field) return
      existing.stop()
      guardStops.delete(fieldName)
    }
    // 按需语义核心：无外部错误条目不挂 watcher
    const err = externalErrors.value?.[fieldName]
    if (!err?.error) return
    const vs = rawField.validateState
    const vm = rawField.validateMessage
    if (!(vs && typeof vs === 'object' && 'value' in vs)) return
    const stop = watch(
      () => (vs as { value: string }).value,
      (newState) => {
        const current = externalErrors.value?.[fieldName]
        if (!current?.error) return
        // A4：按条目的 validateStatus 纠正（validating 不被守护覆盖成 error，loading 图标可见）
        const want = current.validateStatus ?? 'error'
        if (newState !== want) {
          ;(vs as { value: string }).value = want
          if (vm && typeof vm === 'object' && 'value' in vm) {
            ;(vm as { value: string }).value = want === 'error' ? current.error : ''
          }
        }
      }
    )
    guardStops.set(fieldName, { field, stop })
  }

  // 上一轮 watch 时「持有外部错误条目」的字段名集合 —— diff 清理的基准
  let prevErrorFields = new Set<string>()

  watch(
    () => externalErrors.value,
    (errors) => {
      const fields = getFields()
      if (!fields) return
      const currentErrorFields = new Set<string>()
      for (const field of fields) {
        if (!field || typeof field !== 'object') continue
        const rawField = toRaw(field) as ElFormFieldRaw
        const fieldName = readRefStr(rawField.propString) || readRefStr(rawField.prop)
        if (typeof fieldName !== 'string') continue
        const target = errors[fieldName]
        const vs = rawField.validateState
        const vm = rawField.validateMessage
        if (target?.error) {
          currentErrorFields.add(fieldName)
          // A4：按条目的 validateStatus 同步——validating 显示 loading 图标（非红字），
          // 文案只在 error 态写入（validating 态 EP 无文案位，loading 图标即反馈）
          const want = target.validateStatus ?? 'error'
          if (vs && typeof vs === 'object' && 'value' in vs && vs.value !== want) {
            ;(vs as { value: string }).value = want
          }
          const wantMsg = want === 'error' ? target.error : ''
          if (vm && typeof vm === 'object' && 'value' in vm && vm.value !== wantMsg) {
            ;(vm as { value: string }).value = wantMsg
          }
        } else if (prevErrorFields.has(fieldName)) {
          // 仅当「上一轮有外部错误条目、这一轮没有」才清除显示状态；
          // 新旧皆无条目的字段保持不动（其 error 状态属于 el-form 内部错误）
          if (vs && typeof vs === 'object' && 'value' in vs && vs.value === 'error') {
            ;(vs as { value: string }).value = ''
          }
          if (vm && typeof vm === 'object' && 'value' in vm && vm.value) {
            ;(vm as { value: string }).value = ''
          }
          // 条目清除 → 守护一并停止（按需语义：无 drift 风险不再需要 watcher）
          const g = guardStops.get(fieldName)
          if (g) {
            g.stop()
            guardStops.delete(fieldName)
          }
        }
        guardField(field)
      }
      prevErrorFields = currentErrorFields
    },
    { deep: true, immediate: true }
  )

  // fields 数组本身可能变化（el-form-item 注册新字段）
  watch(
    () => getFields(),
    (fields) => {
      if (!fields) return
      for (const field of fields) {
        if (field && typeof field === 'object') guardField(field)
      }
    },
    { immediate: true }
  )

  return { setFieldError }
}
