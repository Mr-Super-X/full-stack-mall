/**
 * useDevRuntime 单元测试
 *
 * 覆盖：
 * - showDebugBanner 默认 = import.meta.env.DEV
 * - validateErrors / forbiddenErrors 初始 = 空
 * - model 缺失时（DEV）→ console.warn + errorBus.report(FORM_INSTANCE_NOT_READY)
 * - model 缺失时（DEV）→ warn 文案含「model prop 未传入」
 * - schema 含未知组件 → validateErrors 被填充 + console.error + errorBus.report(SCHEMA_VALIDATE_FAILED)
 * - schema 含 forbidden 标识符 → forbiddenErrors 被填充 + console.warn + errorBus.report(FORBIDDEN_IDENTIFIER)
 * - schema 的 array.itemSchema 内含 asyncOptions → asyncOptionsWarnings + console.warn + errorBus.report(ASYNC_OPTIONS_UNSUPPORTED_POSITION)
 * - installDevDebugHook：挂载 window.__xform_debug
 * - installDevDebugHook：多次调用幂等
 * - installDevDebugHook：prod 环境不挂载
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { useDevRuntime } from './use-dev-runtime'
// 文件顶层 mock resolve-component 模块，让 collectResolvableComponents 内部的
// resolveComponentFor 调用可被 spy 控制；其余导出（EL_COMPONENT_MAP / isElUpload 等）保留实际实现
vi.mock('./resolve-component', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./resolve-component')>()
  return {
    ...actual,
    resolveComponentFor: vi.fn(actual.resolveComponentFor),
  }
})
import { resolveComponentFor } from './resolve-component'
import type { UseFormErrorBusReturn } from './use-form-error-bus'
import type { FieldErrorState } from './use-form-instance'
import type { XFormProps } from '../types'

// 构造 errorBus mock：report 方法 + dismiss 槽位（return type 与 UseFormErrorBusReturn 对齐）
function makeErrorBus(): UseFormErrorBusReturn {
  return {
    events: ref([]) as UseFormErrorBusReturn['events'],
    report: vi.fn() as UseFormErrorBusReturn['report'],
    dismiss: vi.fn() as UseFormErrorBusReturn['dismiss'],
    dismissAll: vi.fn() as UseFormErrorBusReturn['dismissAll'],
    unreadCount: ref(0) as UseFormErrorBusReturn['unreadCount'],
  }
}

function makeDeps(overrides?: {
  schema?: unknown
  model?: Record<string, unknown> | undefined
  components?: unknown
}) {
  const errorBus = makeErrorBus()
  const props = {
    schema: { children: [] },
    model: reactive({}),
    ...overrides,
  } as unknown as XFormProps
  const fieldErrors = ref<Record<string, FieldErrorState>>({})
  return { props, errorBus, fieldErrors, setFieldError: vi.fn() }
}

describe('useDevRuntime', () => {
  let originalDevHook: unknown

  beforeEach(() => {
    originalDevHook = (globalThis as { __xform_debug?: unknown }).__xform_debug
  })

  afterEach(() => {
    delete (globalThis as { __xform_debug?: unknown }).__xform_debug
    if (originalDevHook !== undefined) {
      ;(globalThis as { __xform_debug?: unknown }).__xform_debug = originalDevHook
    }
    vi.restoreAllMocks()
  })

  it('返回结构完整', () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps()
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    expect(ret).toBeDefined()
    expect(ret.validateErrors).toBeDefined()
    expect(ret.forbiddenErrors).toBeDefined()
    expect(ret.showDebugBanner).toBeDefined()
    expect(typeof ret.installDevDebugHook).toBe('function')
    scope.stop()
  })

  it('model 缺失时（DEV）→ console.warn + errorBus.report', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({ model: undefined })
    const scope = effectScope()
    scope.run(() => {
      useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[XForm] model prop 未传入'))
    expect(errorBus.report).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        code: 'FORM_INSTANCE_NOT_READY',
      })
    )
    scope.stop()
  })

  it('model 缺失时 warn 文案含完整原因说明', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({ model: undefined })
    const scope = effectScope()
    scope.run(() => {
      useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('校验、默认值填充、reaction、dirty 追踪均不会生效')
    )
    scope.stop()
  })

  it('schema 含未知组件 → validateErrors 被填充 + console.error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'NotExistComponent', name: 'a' }],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    // 立即 watch 触发需 nextTick
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.validateErrors.value.length).toBeGreaterThan(0)
    expect(ret.validateErrors.value[0]?.message).toContain('未知组件名')
    expect(errorSpy).toHaveBeenCalled()
    expect(errorBus.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SCHEMA_VALIDATE_FAILED',
      })
    )
    scope.stop()
  })

  it('schema 含已知内置组件 → validateErrors 保持空', async () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'Input', name: 'a' }],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.validateErrors.value).toEqual([])
    scope.stop()
  })

  it('schema 含 unplugin-vue-components 自动注册的全局组件 → validateErrors 为空', async () => {
    // mock resolveComponentFor 模拟 RichTextEditor 全局可解析（unplugin-vue-components 自动注册到 GlobalComponents）
    vi.mocked(resolveComponentFor).mockImplementation((name) => {
      if (name === 'RichTextEditor') return { name: 'RichTextEditor' }
      return null
    })
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'RichTextEditor', name: 'desc' }],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.validateErrors.value).toEqual([])
    vi.mocked(resolveComponentFor).mockReset()
  })

  it('schema 含拼写错误组件名 → validateErrors 仍报错（运行时 fallback 不误识别）', async () => {
    // mock resolveComponentFor 始终返回 null —— 模拟「unplugin 未注册 + 拼写错误」场景
    vi.mocked(resolveComponentFor).mockReturnValue(null)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'Inpurt', name: 'a' }], // Input 拼错
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.validateErrors.value.length).toBeGreaterThan(0)
    expect(ret.validateErrors.value[0]?.message).toContain('未知组件名')
    expect(errorSpy).toHaveBeenCalled()
    vi.mocked(resolveComponentFor).mockReset()
    errorSpy.mockRestore()
  })

  it('props.components 显式注册 → 不依赖运行时探测', async () => {
    // mock resolveComponentFor 始终返回 null —— 即使如此，props.components 显式提供的 MyInput
    // 也应被识别为合法组件，证明 user 集合优先于运行时探测
    vi.mocked(resolveComponentFor).mockReturnValue(null)
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'MyInput', name: 'a' }],
      components: { MyInput: { name: 'MyInput' } },
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.validateErrors.value).toEqual([])
    vi.mocked(resolveComponentFor).mockReset()
  })

  it('schema 含 forbidden 标识符（window）→ forbiddenErrors + console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [
        {
          component: 'Input',
          name: 'a',
          reaction: { hidden: '{{ (m) => window.location }' },
        },
      ],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.forbiddenErrors.value.length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[XForm][SECURITY] forbidden identifiers'),
      expect.anything()
    )
    expect(errorBus.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FORBIDDEN_IDENTIFIER',
      })
    )
    scope.stop()
  })

  it('schema 的 array.itemSchema 内含 asyncOptions → asyncOptionsWarnings + console.warn + errorBus.report', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [
        {
          kind: 'array',
          name: 'items',
          array: {
            itemSchema: {
              children: [{ component: 'Select', name: 'productId', asyncOptions: {} }],
            },
          },
        },
      ],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.asyncOptionsWarnings.value).toEqual(['字段 "productId"'])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('asyncOptions 位于不支持的位置'),
      expect.anything()
    )
    expect(errorBus.report).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        code: 'ASYNC_OPTIONS_UNSUPPORTED_POSITION',
      })
    )
    scope.stop()
  })

  it('schema 无 forbidden → forbiddenErrors 保持空数组', async () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({
      schema: [{ component: 'Input', name: 'a' }],
    })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(ret.forbiddenErrors.value).toEqual([])
    scope.stop()
  })

  it('installDevDebugHook 挂载 window.__xform_debug（dev 模式）', () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps()
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    ret.installDevDebugHook()
    expect((globalThis as { __xform_debug?: unknown }).__xform_debug).toBeDefined()
    expect(
      (globalThis as { __xform_debug?: { setFieldError?: unknown } }).__xform_debug?.setFieldError
    ).toBeTypeOf('function')
    scope.stop()
  })

  it('installDevDebugHook 多次调用幂等（不报错）', () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps()
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    expect(() => {
      ret.installDevDebugHook()
      ret.installDevDebugHook()
      ret.installDevDebugHook()
    }).not.toThrow()
    scope.stop()
  })

  it('window.__xform_debug.getFieldErrors 返回字段错误快照（JSON 深拷贝）', () => {
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps()
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    ret.installDevDebugHook()
    fieldErrors.value = { email: { error: '邮箱已被占用', validateStatus: 'error' } }
    const debug = (globalThis as { __xform_debug?: { getFieldErrors?: () => unknown } })
      .__xform_debug
    const snapshot = debug?.getFieldErrors?.()
    expect(snapshot).toEqual({ email: { error: '邮箱已被占用', validateStatus: 'error' } })
    scope.stop()
  })

  it('window.__xform_debug.getModel 返回 model 快照', () => {
    const model = reactive({ a: 1, b: { c: 2 } })
    const { props, errorBus, fieldErrors, setFieldError } = makeDeps({ model })
    const scope = effectScope()
    let ret!: ReturnType<typeof useDevRuntime>
    scope.run(() => {
      ret = useDevRuntime({ props, errorBus, setFieldError, fieldErrors })
    })
    ret.installDevDebugHook()
    const debug = (globalThis as { __xform_debug?: { getModel?: () => unknown } }).__xform_debug
    expect(debug?.getModel?.()).toEqual({ a: 1, b: { c: 2 } })
    scope.stop()
  })
})
