/**
 * useXFormComposer 单元测试 —— XForm 顶层编排
 *
 * 验证点：
 * 1. 返回结构完整（XFormExpose + 模板绑定）
 * 2. dev mode 下 model 缺失时打印警告
 * 3. schema validate 失败时 validateErrors 被填充（dev mode）
 * 4. exposed.getNames() 反映 schema 字段（含/不含 ignore）
 * 5. installDevDebugHook 挂载/不挂载 window.__xform_debug（按 import.meta.env.DEV 分支）
 * 6. 顶层 column/row/disabled/labelPosition 透传到 topLevelXxx computed
 * 7. H2：expressionFunctions 写入实例级 ExpressionScope（同页多 composer 实例互不污染）
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { MockInstance } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { useXFormComposer, type UseXFormComposerReturn } from './use-xform-composer'
import type { XFormExpose, XFormProps } from '../types'

// ────────────────────────────────────────────────────────────────────────────
// 工具：在 effect scope 中跑 composer，scope 由测试自身 stop 释放 watcher。
// H2 修复后表达式沙箱是实例私有（createExpressionScope），无模块级清表副作用。
// ────────────────────────────────────────────────────────────────────────────

interface MountHandle {
  composer: UseXFormComposerReturn
  /** scope 销毁钩子 —— 调用方在断言结束后必须调用 */
  dispose: () => void
}

function mountInScope(props: XFormProps | object): MountHandle {
  const scope = effectScope()
  let composer!: UseXFormComposerReturn
  scope.run(() => {
    composer = useXFormComposer({ props: props as XFormProps })
  })
  return {
    composer,
    dispose: () => scope.stop(),
  }
}

const noop = (): void => {}

const SIMPLE_SCHEMA: XFormProps = {
  schema: [{ component: 'Input', name: 'email' }],
  model: reactive({ email: '' }),
}

// ────────────────────────────────────────────────────────────────────────────
// 测试
// ────────────────────────────────────────────────────────────────────────────

describe('useXFormComposer', () => {
  const originalDevHook = (globalThis as { __xform_debug?: unknown }).__xform_debug
  let warnSpy: MockInstance | undefined
  let errorSpy: MockInstance | undefined
  const handles: MountHandle[] = []

  afterEach(() => {
    // 释放所有未释放的 scope
    while (handles.length) {
      const h = handles.pop()
      h?.dispose()
    }
    // 清理 module-level 状态（避免测试间污染）
    delete (globalThis as { __xform_debug?: unknown }).__xform_debug
    if (originalDevHook !== undefined) {
      ;(globalThis as { __xform_debug?: unknown }).__xform_debug = originalDevHook
    }
    warnSpy?.mockRestore()
    errorSpy?.mockRestore()
    warnSpy = undefined
    errorSpy = undefined
  })

  function mount(props: XFormProps | object): MountHandle {
    const h = mountInScope(props)
    handles.push(h)
    return h
  }

  it('返回 XFormExpose 全量 API（19 个方法）', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    noop()
    const apiKeys = [
      'getRef',
      'getNames',
      'validate',
      'validateDetail',
      'clearValidate',
      'resetFields',
      'validateField',
      'scrollToField',
      'validateWithZod',
      'setFieldError',
      'setFieldValidating',
      'addItem',
      'removeItem',
      'moveItem',
      'isDirty',
      'getDirtyFields',
      'isTouched',
      'resetDirty',
      'validateFromServer',
    ]
    for (const k of apiKeys) {
      expect(composer.exposed).toHaveProperty(k)
      expect(typeof (composer.exposed as unknown as Record<string, unknown>)[k]).toBe('function')
    }
  })

  it('顶层 column / row / labelPosition / disabled 透传到 topLevelXxx', () => {
    const { composer } = mount({
      schema: {
        column: 2,
        labelPosition: 'top',
        disabled: true,
        children: [
          { component: 'Input', name: 'a' },
          { component: 'Input', name: 'b' },
        ],
      },
      model: reactive({ a: '', b: '' }),
    } as unknown as XFormProps)
    expect(composer.topLevelColumn.value).toBe(2)
    expect(composer.topLevelColSpan.value).toBe(12)
    expect(composer.topLevelLabelPosition.value).toBe('top')
    expect(composer.topLevelDisabled.value).toBe(true)
    expect(composer.topLevelNodes.value).toHaveLength(2)
  })

  it('顶层 column 缺省时 topLevelColumn 为 undefined 且 colSpan = 24', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    expect(composer.topLevelColumn.value).toBeUndefined()
    expect(composer.topLevelColSpan.value).toBe(24)
  })

  it('exposed.getNames 返回 schema 中所有 name 字段', () => {
    const { composer } = mount({
      schema: [
        { component: 'Input', name: 'a' },
        { component: 'Input', name: 'b' },
        { component: 'Input', name: 'c', ignore: true },
      ],
      model: reactive({ a: '', b: '', c: '' }),
    } as unknown as XFormProps)
    expect(composer.exposed.getNames()).toEqual(['a', 'b'])
    expect(composer.exposed.getNames(true).sort()).toEqual(['a', 'b', 'c'])
  })

  it('dev mode 下 model 缺失时 console.warn 触发', () => {
    // vitest 下 import.meta.env.DEV = true（已知 vitest 默认开启 DEV）
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { composer: _c } = mount({ schema: [{ component: 'Input', name: 'a' }] })
    void _c
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[XForm] model prop 未传入'))
  })

  it('dev mode 下 schema 含未知组件时 validateErrors 被填充', async () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { composer } = mount({
      schema: [{ component: 'NotExistComponent', name: 'a' }],
      model: reactive({ a: '' }),
    })
    await nextTick()
    expect(composer.validateErrors.value.length).toBeGreaterThan(0)
    expect(composer.validateErrors.value[0]?.message).toContain('未知组件名')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('installDevDebugHook 在 dev 模式挂载 window.__xform_debug', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    composer.installDevDebugHook()
    expect((globalThis as { __xform_debug?: unknown }).__xform_debug).toBeDefined()
    expect(
      (globalThis as { __xform_debug?: { setFieldError?: unknown } }).__xform_debug?.setFieldError
    ).toBeTypeOf('function')
  })

  it('installDevDebugHook 幂等（多次调用安全）', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    composer.installDevDebugHook()
    composer.installDevDebugHook()
    expect((globalThis as { __xform_debug?: unknown }).__xform_debug).toBeDefined()
  })

  it('fieldErrors ref 初始为空对象', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    expect(composer.fieldErrors.value).toEqual({})
  })

  describe('错误传播链路验证（架构审查 #4）', () => {
    const triggerRenderCount = () =>
      (globalThis as { __triggerRenderCalled?: number }).__triggerRenderCalled ?? 0

    it('setFieldError 键级写入不触发 composer watch（ref 源监听不到 reactive 键 mutation）', async () => {
      const { composer } = mount(SIMPLE_SCHEMA)
      const baseline = triggerRenderCount()
      // 真实路径：externalErrors.value[name] = {...}（reactive 对象键写入，非 ref 重赋值）
      composer.exposed.setFieldError('email', '服务端返回的错误')
      await nextTick()
      // watch(fieldErrors) 的源是 ref —— 键级 mutation 不触发 ref 的 dep，计数不变
      // 这是「疑似失效 watch」的实证：该 watch 对 setFieldError 路径从未生效过
      expect(triggerRenderCount()).toBe(baseline)
    })

    it('渲染兜底路径有效：Object.keys 派生（模拟 XForm.vue :data-field-errors 绑定）随键级写入更新', async () => {
      const { composer, dispose } = mount(SIMPLE_SCHEMA)
      // 模拟 XForm.vue fieldErrorKeys computed —— 渲染期读取 reactive 键建立追踪
      const scope = effectScope()
      const keysSig = scope.run(() =>
        computed(() => Object.keys(composer.fieldErrors.value).join(','))
      )
      expect(keysSig?.value).toBe('')
      composer.exposed.setFieldError('email', '服务端返回的错误')
      await nextTick()
      expect(keysSig?.value).toBe('email')
      scope.stop()
      dispose()
    })
  })

  it('顶层 readonly 反应式装配不崩溃（值通过 internal renderOpts.globalReadonly 消费）', () => {
    // readonly 是顶层字段，composer 内部消费于 renderOpts.globalReadonly，
    // 不直接对外暴露 —— 此处验证 composer 装配过程未崩溃
    const { composer } = mount({
      schema: {
        readonly: true,
        children: [{ component: 'Input', name: 'a' }],
      },
      model: reactive({ a: '' }),
    } as unknown as XFormProps)
    expect(composer.exposed).toBeDefined()
    expect(typeof composer.exposed.validate).toBe('function')
  })

  it('schema 数组形态也能正常工作（顶层无 row/col）', () => {
    const { composer } = mount({
      schema: [
        { component: 'Input', name: 'a' },
        { component: 'Input', name: 'b' },
      ],
      model: reactive({ a: '', b: '' }),
    })
    expect(composer.topLevelNodes.value).toHaveLength(2)
    expect(composer.topLevelRow.value).toBeUndefined()
    expect(composer.topLevelColumn.value).toBeUndefined()
  })

  it('H2 回归：同页两个 composer 实例的 expressionFunctions 互不污染', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // 两个实例注册同名函数 tag，各自返回 from-A / from-B
    const schema = [{ component: 'Input', name: 'a', reaction: { label: '{{ () => tag() }}' } }]
    const modelA = reactive({ a: '' })
    const modelB = reactive({ a: '' })
    const mountA = mount({
      schema,
      model: modelA,
      expressionFunctions: { tag: () => 'from-A' },
    } as unknown as XFormProps)
    const mountB = mount({
      schema,
      model: modelB,
      expressionFunctions: { tag: () => 'from-B' },
    } as unknown as XFormProps)

    await nextTick()
    // 污染形态 1：改 A 的 model 触发其 reaction 重算 —— 必须仍用 A 的函数表
    //（修复前 B 的 immediate 注册覆盖模块表，A 重算后变 from-B）
    modelA.a = 'trigger'
    await nextTick()
    expect(mountA.composer.topLevelNodes.value[0].label).toBe('from-A')
    expect(mountB.composer.topLevelNodes.value[0].label).toBe('from-B')

    // 污染形态 2：A 卸载后 B 的 reaction 重算不得 ReferenceError
    //（修复前 A 的 onScopeDispose 清模块表会毁掉 B 的注册）
    mountA.dispose()
    modelB.a = 'trigger'
    await nextTick()
    expect(mountB.composer.topLevelNodes.value[0].label).toBe('from-B')
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('ComponentPublicInstance 类型兼容 —— ref 暴露后支持 ref.value.validate()', () => {
    const { composer } = mount(SIMPLE_SCHEMA)
    const inst: ComponentPublicInstance & XFormExpose = {
      $: {},
      $data: {},
      $emit: () => {},
      $nextTick: async () => {},
      $options: {},
      $parent: null,
      $props: {},
      $refs: {},
      $root: null,
      $forceUpdate: () => {},
      // exposed
      ...composer.exposed,
    } as unknown as ComponentPublicInstance & XFormExpose
    expect(typeof inst.validate).toBe('function')
    expect(typeof inst.getNames).toBe('function')
  })

  it('顶层 debounceValidation 字段透传', () => {
    const { composer } = mount({
      schema: {
        debounceValidation: 300,
        children: [{ component: 'Input', name: 'a' }],
      },
      model: reactive({ a: '' }),
    } as unknown as XFormProps)
    // debounceValidation 在 composer 内部透传给 useCrossFieldTrigger
    // 不直接对外暴露 —— 此处仅验证 composer 装配过程未崩溃
    expect(composer.exposed).toBeDefined()
  })

  it('顶层 scrollToError / scrollIntoViewOptions 字段透传', () => {
    const { composer } = mount({
      schema: {
        scrollToError: true,
        scrollIntoViewOptions: { behavior: 'smooth', block: 'center' },
        children: [{ component: 'Input', name: 'a' }],
      },
      model: reactive({ a: '' }),
    } as unknown as XFormProps)
    expect(composer.topLevelScrollToError.value).toBe(true)
    expect(composer.topLevelScrollIntoViewOptions.value).toEqual({
      behavior: 'smooth',
      block: 'center',
    })
  })

  it('顶层 labelWidth / labelPosition 透传', () => {
    const { composer } = mount({
      schema: {
        labelWidth: 120,
        labelPosition: 'right',
        children: [{ component: 'Input', name: 'a' }],
      },
      model: reactive({ a: '' }),
    } as unknown as XFormProps)
    expect(composer.topLevelLabelWidth.value).toBe(120)
    expect(composer.topLevelLabelPosition.value).toBe('right')
  })
})

/**
 * P0-1 silent catch 修复守护（静态源码检查）
 *
 * P0-1 修复点：validateField 是内嵌闭包（位于 use-render-root.ts 的 renderOpts.validateField），
 * 仅在字段 onBlur 时由 render-form-item 触发，无法在 unit test 层级直接 mount 触发。
 * 采用静态源码检查守护——确保修复代码不被误删：
 * 1. 包含错误码常量 EL_FORM_VALIDATE_FIELD_FAILED
 * 2. 包含 errorBus.report 调用
 * 3. 不包含 silent catch 注释
 *
 * 若需要更严格的行为测试，可改为 @vue/test-utils mount XForm.vue 触发字段 blur，
 * 但需要 XForm.vue 暴露 errorBus（目前未 expose）。
 *
 * P0-3 重构后 validateField 闭包从 use-xform-composer.ts 搬到 use-render-root.ts，
 * 静态检查路径同步更新。
 */
describe('P0-1 silent catch 修复守护', () => {
  // Windows 下 `new URL('./xxx', import.meta.url).pathname` 解析为根盘符路径,
  // 必须用 path.resolve(__dirname, ...) 才能拿到同目录相对路径
  const renderRootPath = resolve(dirname(fileURLToPath(import.meta.url)), './use-render-root.ts')

  it('use-render-root.ts 含 errorBus 上报与错误码常量', () => {
    const content = readFileSync(renderRootPath, 'utf-8')
    // 关键字符串必须存在
    expect(content).toContain('EL_FORM_VALIDATE_FIELD_FAILED')
    expect(content).toContain('errorBus.report')
    // 不应是 silent catch
    expect(content).not.toContain('catch {\n        /* silent')
  })

  it('use-render-root.ts 含 force: true 标志（主动调用场景跳过去重）', () => {
    const content = readFileSync(renderRootPath, 'utf-8')
    expect(content).toMatch(/force:\s*true/)
  })
})
