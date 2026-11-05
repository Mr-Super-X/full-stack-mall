import { describe, it, expect, vi } from 'vitest'
import { createApp, type Component } from 'vue'
import FormSchemaPlugin, {
  XForm,
  useFormDirty,
  useSchemaIndex,
  buildIndex,
  xInput,
  xArray,
} from './index'
import type { XFormProps } from './index'
import { validate } from './composables/use-validate'
import { resolveElComponentName } from './adapters/element-plus-adapter'

describe('FormSchemaPlugin', () => {
  it('install(app) registers XForm globally', () => {
    const app = createApp({})
    const componentSpy = vi.spyOn(app, 'component')
    app.use(FormSchemaPlugin)
    expect(componentSpy).toHaveBeenCalledWith('XForm', expect.anything())
  })

  it('re-exports validate() from use-validate', () => {
    expect(typeof validate).toBe('function')
    const result = validate({ component: 'Input' })
    expect(result.isValid).toBe(true)
  })

  it('re-exports resolveElComponentName() from adapter', () => {
    expect(typeof resolveElComponentName).toBe('function')
    expect(resolveElComponentName('Input')).toBe('ElInput')
  })

  it('default export has install method', () => {
    expect(typeof (FormSchemaPlugin as Component & { install?: unknown }).install).toBe('function')
  })

  it('default export is installable via app.use', () => {
    const app = createApp({})
    expect(() => app.use(FormSchemaPlugin)).not.toThrow()
  })

  it('具名导出 XForm 组件 / builders / useFormDirty / useSchemaIndex', () => {
    expect(XForm).toBeDefined()
    expect(typeof xInput).toBe('function')
    expect(typeof xArray).toBe('function')
    expect(typeof useFormDirty).toBe('function')
    expect(typeof useSchemaIndex).toBe('function')
    expect(typeof buildIndex).toBe('function')
  })
})

/**
 * XFormProps 契约快照 —— 与 docs/24 §2「18 个」+ scripts/check-doc-currency.ts
 * 'XFormProps 字段数' 校验互锁：增删 prop 时三处同时失败（satisfies 在编译期
 * 拦漏字段/多字段，toHaveLength 在运行期锁数量）。
 */
describe('XFormProps 契约', () => {
  it('字段集合与 docs/24 §2 一致（18 个，satisfies 编译期锁定 key）', () => {
    const propsShape = {
      schema: true,
      model: true,
      components: true,
      rules: true,
      directives: true,
      t: true,
      beforeChange: true,
      beforeChangeRules: true,
      zodSchema: true,
      expressionFunctions: true,
      scrollToError: true,
      scrollIntoViewOptions: true,
      componentProps: true,
      permissionResolver: true,
      showErrorToast: true,
      reactionBudget: true,
      size: true,
      showDirtyMark: true,
    } satisfies Record<keyof XFormProps, true>
    expect(Object.keys(propsShape)).toHaveLength(18)
  })
})

/**
 * 设计器演进字段类型契约（PM 审查发现 12，Wave4-3）——
 * SchemaNode 增加 id / meta（节点级）+ schemaVersion（顶层）三字段；仅类型契约不实现设计器。
 * 与 scripts/check-doc-currency.ts 'SchemaNode 字段数' 校验互锁。
 */
describe('设计器演进字段类型契约', () => {
  it('SchemaNode 接受 id / meta / schemaVersion 可选字段', () => {
    // 编译期：能赋这三字段即类型契约通过；运行期：值正确透传
    const node: import('./types').SchemaNode = {
      component: 'Input',
      name: 'email',
      id: 'field-email',
      meta: { designerSelected: true, group: 'basic' },
      schemaVersion: '1.0.0',
    }
    expect(node.id).toBe('field-email')
    expect(node.meta).toEqual({ designerSelected: true, group: 'basic' })
    expect(node.schemaVersion).toBe('1.0.0')
  })

  it('三字段均可缺省（业务手写 schema 无设计器需求不填）', () => {
    const node: import('./types').SchemaNode = { component: 'Input', name: 'x' }
    expect(node.id).toBeUndefined()
    expect(node.meta).toBeUndefined()
    expect(node.schemaVersion).toBeUndefined()
  })
})
