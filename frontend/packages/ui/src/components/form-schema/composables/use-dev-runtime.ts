/**
 * use-dev-runtime —— XForm dev 模式运行时
 *
 * 仅承载 dev-only 行为：schema 校验（validate + errorBus.error）、表达式危险标识符扫描
 * （scanForForbidden + errorBus.error）、model 缺失 warn、debug hook 安装（window.__xform_debug）。
 *
 * prod 下所有 watch + ref 初始化均执行但 console / errorBus 静默（依赖 showDebugBanner 门控）。
 *
 * @group 表单编排：开发态
 */
import { nextTick, ref, watch, type Ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { validate } from './use-validate'
import { scanForForbidden } from './use-scan-forbidden'
import { scanAsyncOptionsUnsupported } from './use-scan-async-options'
import { DEFAULT_COMPONENT_MAP } from '../adapters/element-plus-adapter'
import { resolveComponentFor } from './resolve-component'
import type { UseFormErrorBusReturn } from './use-form-error-bus'
import type { FieldErrorState } from './use-form-instance'
import type { SchemaNode, XFormProps } from '../types'

/**
 * 递归收集 schema 中出现的 string component 名（去重），过滤 builtin / ElXxx / 原生 HTML，
 * 对剩余名字逐个调用 resolveComponentFor —— 命中（unplugin-vue-components 自动注册的项目级组件
 * 如 RichTextEditor / BaseChart）返回真实组件对象，加入 dev validate 的 user 集合。
 *
 * 目的：dev validate 只查 builtin/user 两个集合，不感知运行时 resolveComponentFor 的全局组件
 * fallback，会把 RichTextEditor 误报为「未知组件名」。此处动态探测让 dev 校验与运行时解析对齐，
 * 但 Inpurt 这类拼写错误 resolveComponentFor 仍返回 null → 仍被 validate 识别为拼写错误。
 */
function collectResolvableComponents(
  schema: SchemaNode | SchemaNode[] | undefined,
  userComponents: Record<string, unknown> | undefined
): Set<string> {
  const names = new Set<string>()
  const visit = (node: unknown): void => {
    if (!node) return
    if (typeof node === 'string') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (typeof obj.component === 'string') names.add(obj.component)
    if (obj.children) visit(obj.children)
    if (obj.slots) {
      for (const v of Object.values(obj.slots as Record<string, unknown>)) visit(v)
    }
    if (obj.array && typeof obj.array === 'object') {
      const item = (obj.array as { itemSchema?: unknown }).itemSchema
      if (item) visit(item)
    }
    if (obj.formItem && typeof obj.formItem === 'object') {
      const slots = (obj.formItem as { slots?: unknown }).slots
      if (slots) visit(slots)
    }
  }
  visit(schema)

  const resolvable = new Set<string>()
  for (const name of names) {
    if (name in DEFAULT_COMPONENT_MAP) continue
    if (name.startsWith('El')) continue
    if (name === name.toLowerCase()) continue
    if (resolveComponentFor(name, userComponents) != null) resolvable.add(name)
  }
  return resolvable
}

/** useDevRuntime 入参 */
export interface UseDevRuntimeDeps {
  props: XFormProps
  /** dev 模式错误总线（来自 useFormErrorBus） */
  errorBus: UseFormErrorBusReturn
  /** debug hook 暴露给 dev console 的 setFieldError（来自 useFormInstance） */
  setFieldError: (name: string, message: string) => void
  /** debug hook 暴露给 dev console 的 fieldErrors ref（来自 useFormInstance） */
  fieldErrors: Ref<Record<string, FieldErrorState>>
}

/** useDevRuntime 返回值 */
export interface UseDevRuntimeReturn {
  /** schema 静态校验错误（仅 dev 显示在 XFormDebugBanner） */
  validateErrors: Ref<Array<{ keyPath: (string | number)[]; message: string }>>
  /** 表达式沙箱黑名单命中（仅 dev） */
  forbiddenErrors: Ref<string[]>
  /** asyncOptions 位于不支持位置（formItem.slots / array.itemSchema 内，请求不会发起，仅 dev） */
  asyncOptionsWarnings: Ref<string[]>
  /** 是否显示 debug banner（dev = true，prod = false） */
  showDebugBanner: Ref<boolean>
  /** XForm setup 末尾调一次挂 window.__xform_debug（dev only） */
  installDevDebugHook: () => void
}

/** dev 模式运行时：扫描 + 校验 + debug hook + model 缺失 warn */
export function useDevRuntime(deps: UseDevRuntimeDeps): UseDevRuntimeReturn {
  const { props, errorBus, setFieldError, fieldErrors } = deps

  const validateErrors = ref<Array<{ keyPath: (string | number)[]; message: string }>>([])
  const forbiddenErrors = ref<string[]>([])
  const asyncOptionsWarnings = ref<string[]>([])
  const showDebugBanner = ref(import.meta.env.DEV)

  // 阶段 1.2：model 缺时 dev mode 警告（提醒用户补传 reactive model）
  // 仅 DEV 触发，prod tree-shake 后零运行时开销
  if (import.meta.env.DEV && props.model === undefined) {
    console.warn(
      '[XForm] model prop 未传入。校验、默认值填充、reaction、dirty 追踪均不会生效。' +
        '请传入 reactive() 包装的对象：const form = reactive({...})'
    )
    errorBus.report({
      severity: 'warn',
      code: 'FORM_INSTANCE_NOT_READY',
      message: 'model prop 未传入，校验/默认值填充/reaction/dirty 追踪均不会生效',
      source: 'useDevRuntime',
    })
  }

  if (showDebugBanner.value) {
    /**
     * dev validate 函数 —— 抽出来便于 nextTick 调度
     *
     * 关键修复（2026-09-16）：原实现 watch immediate 在 setup 同步执行,内部
     * collectResolvableComponents → resolveComponentFor → vue.resolveComponent 触发
     * `[Vue warn]: resolveComponent can only be used in render() or setup()`。
     *
     * 修复方案：watch 自身不 immediate,首次执行延后到 nextTick（setup 同步代码结束后），
     * 此时 Vue 已经在 render effect 上下文,resolveComponent 合法。后续 schema 变化
     * 触发的 watch 也在非 setup 同步期,无警告。
     */
    function runDevValidate(val: typeof props.schema): void {
      const normalized: SchemaNode = Array.isArray(val) ? ({ children: val } as SchemaNode) : val
      // 阶段 1.3：组件名校验 —— 短名 + ElXxx 全名 + userComponents 三类必须命中其一
      // 运行时解析额外收集：schema.component 字符串走 resolveComponentFor 测试，能解析的（如
      // unplugin-vue-components 自动注册的 RichTextEditor）一并加入 user 集合，与运行时 fallback 对齐
      const runtimeResolved = collectResolvableComponents(normalized, props.components)
      const { isValid, errors } = validate(normalized, {
        knownComponents: {
          builtin: new Set(Object.keys(DEFAULT_COMPONENT_MAP)),
          user: new Set([...Object.keys(props.components ?? {}), ...runtimeResolved]),
        },
      })
      validateErrors.value = isValid ? [] : errors
      if (!isValid) {
        console.error('[XForm] schema validation failed:', errors)
        // OPT-7：升级为 user-facing 反馈（dev 弹 OSD）
        errorBus.report({
          severity: 'error',
          code: 'SCHEMA_VALIDATE_FAILED',
          message: `Schema 校验失败 ${errors.length} 项（详见 Debug Banner）`,
          source: 'useDevRuntime',
        })
      }
      const forbidden = scanForForbidden(normalized)
      forbiddenErrors.value = forbidden
      if (forbidden.length > 0) {
        // 降级为 warn：scanForForbidden 是 dev 诊断辅助，重复 0/低危标识符触发的 console.error 噪声大于收益
        // 真实危险（window/document/fetch 等）仍由 Debug Banner + errorBus 上报，不静默
        console.warn('[XForm][SECURITY] forbidden identifiers in expressions:', forbidden)
        errorBus.report({
          severity: 'error',
          code: 'FORBIDDEN_IDENTIFIER',
          message: `检测到危险标识符 ${forbidden.length} 个（详见 Debug Banner）`,
          source: 'useDevRuntime',
        })
      }
      // F2 短期：array.itemSchema / formItem.slots 内的 asyncOptions 永远不会发起请求，
      // dev 阶段扫描并让沉默失败可见（console + errorBus + DebugBanner 三处同现）
      const unsupportedAsync = scanAsyncOptionsUnsupported(normalized)
      asyncOptionsWarnings.value = unsupportedAsync
      if (unsupportedAsync.length > 0) {
        console.warn(
          '[XForm] asyncOptions 位于不支持的位置（formItem.slots / array.itemSchema 内），请求不会发起:',
          unsupportedAsync
        )
        errorBus.report({
          severity: 'warn',
          code: 'ASYNC_OPTIONS_UNSUPPORTED_POSITION',
          message: `${unsupportedAsync.length} 个 asyncOptions 位于不支持的位置，请求不会发起（详见 Debug Banner）`,
          source: 'useDevRuntime',
        })
      }
    }

    watch(
      () => props.schema,
      (val) => runDevValidate(val),
      { deep: true }
    )
    // 首次触发延后到 nextTick —— 避开 setup 同步期 vue.resolveComponent 警告
    nextTick(() => runDevValidate(props.schema))
  }

  function installDevDebugHook(): void {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __xform_debug?: unknown }).__xform_debug = {
      setFieldError,
      getFieldErrors: () => JSON.parse(JSON.stringify(fieldErrors.value)),
      getModel: () => JSON.parse(JSON.stringify(props.model)),
    }
  }

  return {
    validateErrors,
    forbiddenErrors,
    asyncOptionsWarnings,
    showDebugBanner,
    installDevDebugHook,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// dev 计数器 —— 收敛散落的 window 调试副作用（use-schema-renderer 的 triggerRender 计数）
// ────────────────────────────────────────────────────────────────────────────

/** 记录一次 triggerRender 调用（window.__triggerRenderCalled，dev only，prod 零开销） */
export function trackTriggerRender(): void {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __triggerRenderCalled?: number }
  w.__triggerRenderCalled = (w.__triggerRenderCalled ?? 0) + 1
}

// ────────────────────────────────────────────────────────────────────────────
// 类型重导出 —— 防止调用方 import 多路径
// ────────────────────────────────────────────────────────────────────────────
export type { ComponentPublicInstance }
