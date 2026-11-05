/**
 * validate-component-props 单元测试 —— OPT-B dev mode props 校验
 *
 * 验证点：
 * 1. 反射从 EL_COMPONENT_MAP 自动构建 KNOWN_PROP_KEYS 映射
 * 2. EL 组件的合法 props 不警告
 * 3. 未知 props（拼写错误）触发 console.warn + OSD 上报
 * 4. 用户自定义组件（components prop 注册）不校验
 * 5. Component 对象（非非对象）跳过校验
 * 6. 递归遍历 children / slots / array.itemSchema
 * 7. dev only：prod 模式下不输出警告
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ElInput, ElSelect } from 'element-plus'

import { validateSchemaProps, getKnownPropKeys } from './validate-component-props'
import type { SchemaNode } from '../types'
import { useFormErrorBus, type UseFormErrorBusReturn } from './use-form-error-bus'

const HANDLES: Array<{ dispose: () => void }> = []

function mountBus(): UseFormErrorBusReturn {
  const scope = effectScope()
  let bus!: UseFormErrorBusReturn
  scope.run(() => {
    bus = useFormErrorBus()
  })
  HANDLES.push({ dispose: () => scope.stop() })
  return bus
}

describe('validate-component-props', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | undefined

  beforeEach(() => {
    // vitest 推荐用 vi.stubEnv 而非 Object.defineProperty（后者对 import.meta.env 不可靠）
    vi.stubEnv('DEV', true)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy?.mockRestore()
    while (HANDLES.length) HANDLES.pop()?.dispose()
  })

  describe('反射白名单', () => {
    it('KNOWN_PROP_KEYS 从 EL_COMPONENT_MAP 自动构建', () => {
      const inputKeys = getKnownPropKeys('Input')
      expect(inputKeys).toBeDefined()
      expect(inputKeys!.has('modelValue')).toBe(true)
      expect(inputKeys!.has('placeholder')).toBe(true)
      expect(inputKeys!.has('clearable')).toBe(true)
      // ElInput 全名应也能命中
      const elInputKeys = getKnownPropKeys('ElInput')
      expect(elInputKeys).toBeDefined()
      expect(elInputKeys!.size).toBeGreaterThan(0)
    })

    it('KNOWN_PROP_KEYS 应覆盖所有 EL_COMPONENT_MAP 组件', () => {
      const selectKeys = getKnownPropKeys('Select')
      expect(selectKeys).toBeDefined()
      expect(selectKeys!.has('multiple')).toBe(true)
      expect(selectKeys!.has('clearable')).toBe(true)
      expect(selectKeys!.has('placeholder')).toBe(true)
    })

    it('UNKNOWN 组件返回 undefined（不校验）', () => {
      const unknown = getKnownPropKeys('NonExistentComponent')
      expect(unknown).toBeUndefined()
    })
  })

  describe('合法 props 不触发警告', () => {
    it('Input 节点全部合法 props → 不警告', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'Input',
        name: 'email',
        props: { placeholder: 'a@b.com', clearable: true, disabled: false },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
      expect(bus.events.value).toHaveLength(0)
    })

    it('ElInput 全名同样命中', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'ElInput',
        name: 'email',
        props: { placeholder: 'x', clearable: true },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('onXxx 事件回调（onTabChange / onUpdate:modelValue 等）→ 合法透传不警告', () => {
      const bus = mountBus()
      // Vue 事件监听在 props 对象里以 on + 驼峰事件名形式透传（等价模板 @tab-change），
      // 不在 Component.props 反射的 prop 声明白名单内 —— 校验器须豁免，否则误报
      const node: SchemaNode = {
        component: 'Tabs',
        props: {
          modelValue: 'basic',
          onTabChange: () => undefined,
          'onUpdate:modelValue': () => undefined,
        },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
      expect(bus.events.value).toHaveLength(0)
    })
  })

  describe('未知 props 触发警告 + OSD', () => {
    it('Input 节点含未声明 props → 警告 + 上报', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'Input',
        name: 'email',
        props: {
          placeholder: 'x',
          unknownProp: 'foo', // ← 拼写错误
          anotherUnknown: 123, // ← 多余 prop
        },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      // console.warn 签名: (prefix, message, source) — message 含未声明 props 名
      const firstCall = warnSpy.mock.calls[0]
      expect(firstCall[0] as string).toContain('[XForm][UNKNOWN_COMPONENT_PROP]')
      expect(firstCall[1] as string).toContain('unknownProp, anotherUnknown')
      expect(firstCall[2] as string).toBe('validateSchemaProps')
      expect(bus.events.value).toHaveLength(1)
      const report = (bus.events.value[0] as { code?: string; severity?: string }).code
      expect(report).toBe('UNKNOWN_COMPONENT_PROP')
    })

    it('DatePicker 专属 props（valueFormat）用在 Input 上 → 警告', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'Input',
        name: 'date',
        props: {
          valueFormat: 'YYYY-MM-DD', // ← DatePicker 的 prop
        },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      const firstCall = warnSpy.mock.calls[0]
      expect(firstCall[0] as string).toContain('[XForm][UNKNOWN_COMPONENT_PROP]')
      expect(firstCall[1] as string).toContain('valueFormat')
    })

    it('el-form 推荐字段（label / prop / rules）不警告（业务透传）', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'Input',
        name: 'email',
        props: {
          // el-form 透传到 el-form-item 的字段（不在 ElInput.props 白名单）
          label: '邮箱',
          prop: 'email',
          rules: [{ required: true }],
          required: true,
          showMessage: true,
        },
      }
      validateSchemaProps(node, bus)
      // 这些是 el-form 透传字段，应被白名单接受，不警告
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })

  describe('边界场景', () => {
    it('Component 对象（不是 string）跳过校验', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: {/* 任意 component */} as never,
        name: 'custom',
        props: { anyProp: 'value' },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('未知组件名跳过校验（用户可能通过 components prop 注册）', () => {
      const bus = mountBus()
      const node: SchemaNode = {
        component: 'MyCustomInput', // EL_COMPONENT_MAP 不命中
        name: 'x',
        props: { anyProp: 'value' },
      }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('空 props 对象不警告', () => {
      const bus = mountBus()
      const node: SchemaNode = { component: 'Input', name: 'x' }
      validateSchemaProps(node, bus)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('undefined 根节点不警告', () => {
      const bus = mountBus()
      validateSchemaProps(undefined, bus)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('数组根节点递归校验每个子节点', () => {
      const bus = mountBus()
      const root: SchemaNode[] = [
        { component: 'Input', name: 'a', props: { typoProp: 'x' } }, // 警告
        { component: 'Select', name: 'b', props: { anotherTypo: 'y' } }, // 警告
      ]
      validateSchemaProps(root, bus)
      expect(warnSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('递归遍历', () => {
    it('children 数组递归校验', () => {
      const bus = mountBus()
      const root: SchemaNode = {
        component: 'Card',
        children: [{ component: 'Input', name: 'a', props: { typoProp: 'x' } }],
      }
      validateSchemaProps(root, bus)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })

    it('slots 递归校验', () => {
      const bus = mountBus()
      const root: SchemaNode = {
        component: 'Card',
        slots: {
          default: { component: 'Input', name: 'a', props: { typoProp: 'x' } },
        },
      }
      validateSchemaProps(root, bus)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })

    it('array.itemSchema 递归校验', () => {
      const bus = mountBus()
      const root: SchemaNode = {
        component: 'Form',
        kind: 'array',
        array: {
          itemSchema: { component: 'Input', name: 'qty', props: { typoProp: 'x' } },
        },
      } as SchemaNode
      validateSchemaProps(root, bus)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('实际 Element Plus 组件反射校验', () => {
    it('ElInput.props 应包含 modelValue / placeholder / clearable', () => {
      const keys = new Set(Object.keys(ElInput.props ?? {}))
      expect(keys.has('modelValue')).toBe(true)
      expect(keys.has('placeholder')).toBe(true)
      expect(keys.has('clearable')).toBe(true)
    })

    it('ElSelect.props 应包含 multiple / clearable', () => {
      const keys = new Set(Object.keys(ElSelect.props ?? {}))
      expect(keys.has('modelValue')).toBe(true)
      expect(keys.has('multiple')).toBe(true)
      expect(keys.has('clearable')).toBe(true)
    })
  })
})
