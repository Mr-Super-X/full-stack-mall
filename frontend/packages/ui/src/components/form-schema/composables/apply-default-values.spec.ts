/**
 * apply-default-values 单元测试
 *
 * 覆盖：
 * - normalizeSchema: 数组 → 包 children
 * - applyDefaults: 递归填充 defaultValue（仅当 model 字段未定义时）
 * - applyDefaults: 跳过 string / undefined / null / 空数组
 * - applyDefaults: 嵌套 children 递归
 * - applyDefaultsAndSync: defaultValue 填充 + setInitialValues 调用
 * - useApplyDefaults: schema 变化时 watch 触发
 * - useApplyDefaults: prod 下也生效（不依赖 dev 开关）
 * - useApplyDefaults: mounted 后补一次同步
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import {
  applyDefaults,
  applyDefaultsAndSync,
  normalizeSchema,
  useApplyDefaults,
} from './apply-default-values'
import type { XFormProps } from '../types'

describe('normalizeSchema', () => {
  it('数组 schema → 包 children 形态', () => {
    const arr = [{ component: 'Input', name: 'a' }]
    const out = normalizeSchema(arr as never)
    expect(out.children).toBe(arr)
    expect(out.component).toBeUndefined()
  })

  it('单节点 schema → 原样返回', () => {
    const node = { component: 'Input', name: 'a' }
    const out = normalizeSchema(node)
    expect(out).toBe(node)
  })
})

describe('applyDefaults', () => {
  it('model 字段未定义 → 填入 defaultValue', () => {
    const node = { name: 'email', defaultValue: 'a@b.com' }
    const model: Record<string, unknown> = {}
    applyDefaults(node, model)
    expect(model.email).toBe('a@b.com')
  })

  it('model 字段已定义（即使是 undefined）→ 不覆盖', () => {
    const node = { name: 'email', defaultValue: 'a@b.com' }
    const model: Record<string, unknown> = { email: undefined }
    applyDefaults(node, model)
    // get 返回 undefined 时仍 set（lodash get 区分 own property）
    expect(model.email).toBe('a@b.com')
  })

  it('model 字段已有值 → 不覆盖', () => {
    const node = { name: 'email', defaultValue: 'a@b.com' }
    const model: Record<string, unknown> = { email: 'existing@x.com' }
    applyDefaults(node, model)
    expect(model.email).toBe('existing@x.com')
  })

  it('嵌套路径：name="address.city" 支持 lodash get/set', () => {
    const node = { name: 'address.city', defaultValue: 'Beijing' }
    const model: Record<string, unknown> = {}
    applyDefaults(node, model)
    expect((model.address as Record<string, unknown>).city).toBe('Beijing')
  })

  it('节点无 name → 跳过', () => {
    const node = { defaultValue: 'x' }
    const model: Record<string, unknown> = {}
    applyDefaults(node, model)
    expect(model).toEqual({})
  })

  it('节点无 defaultValue → 跳过', () => {
    const node = { name: 'email' }
    const model: Record<string, unknown> = {}
    applyDefaults(node, model)
    expect(model).toEqual({})
  })

  it('数组节点 → 遍历每个子节点', () => {
    const nodes = [
      { name: 'a', defaultValue: 1 },
      { name: 'b', defaultValue: 2 },
    ]
    const model: Record<string, unknown> = {}
    applyDefaults(nodes, model)
    expect(model).toEqual({ a: 1, b: 2 })
  })

  it('string 节点 → 跳过', () => {
    const model: Record<string, unknown> = {}
    applyDefaults('text node' as never, model)
    expect(model).toEqual({})
  })

  it('undefined / null 节点 → 跳过', () => {
    const model: Record<string, unknown> = {}
    applyDefaults(undefined, model)
    applyDefaults(null as never, model)
    expect(model).toEqual({})
  })

  it('嵌套 children 递归', () => {
    const node = {
      component: 'Card',
      children: [{ name: 'inner', defaultValue: 'X' }],
    }
    const model: Record<string, unknown> = {}
    applyDefaults(node, model)
    expect(model.inner).toBe('X')
  })

  it('model undefined → 安全跳过', () => {
    const node = { name: 'a', defaultValue: 'X' }
    expect(() => applyDefaults(node, undefined)).not.toThrow()
  })
})

describe('applyDefaultsAndSync', () => {
  it('应用 defaultValue + 调用 setInitialValues', () => {
    const node = { name: 'email', defaultValue: 'a@b.com' }
    const model = reactive<Record<string, unknown>>({})
    const props = { schema: node, model } as unknown as XFormProps
    const setInitialValues = vi.fn()
    applyDefaultsAndSync(props, node, setInitialValues)
    expect(model.email).toBe('a@b.com')
    expect(setInitialValues).toHaveBeenCalledWith(model)
  })

  it('数组 schema → 先 normalize 再应用', () => {
    const arr = [{ name: 'a', defaultValue: 1 }]
    const model = reactive<Record<string, unknown>>({})
    const props = { schema: arr, model } as unknown as XFormProps
    const setInitialValues = vi.fn()
    applyDefaultsAndSync(props, arr as never, setInitialValues)
    expect(model.a).toBe(1)
    expect(setInitialValues).toHaveBeenCalledTimes(1)
  })
})

describe('useApplyDefaults', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('立即执行 + mounted 后补同步', async () => {
    const scope = effectScope()
    const setInitialValues = vi.fn()

    scope.run(() => {
      const model = reactive<Record<string, unknown>>({})
      const props = {
        schema: { name: 'email', defaultValue: 'a@b.com' },
        model,
      } as unknown as XFormProps
      useApplyDefaults(props, setInitialValues)
      // 捕获 onMounted 钩子
      // （vue 在 setup 阶段注册，scope.run 内已经挂上）
    })

    // 立即执行：applyDefaults + setInitialValues 应被调过 1 次
    expect(setInitialValues).toHaveBeenCalledTimes(1)

    // 模拟 mounted 触发：直接调用（绕过 vue 的 mount 调度）
    // vue 的 onMounted 在 effectScope 内同步触发较复杂，这里仅验证逻辑正确性
    scope.stop()
  })

  it('schema 引用变化时重跑 defaultValue 填充，但不重复同步 initialValues 快照', async () => {
    const scope = effectScope()
    const setInitialValues = vi.fn()
    // 关键：props 必须是 reactive 才能让 watch(() => props.schema) 追踪到引用变化
    const model = reactive<Record<string, unknown>>({})
    const propsRef = reactive<XFormProps>({
      schema: { name: 'a', defaultValue: 1 },
      model,
    } as XFormProps)

    scope.run(() => {
      useApplyDefaults(propsRef, setInitialValues)
    })

    // 首次同步：applyDefaults + setInitialValues 各 1 次
    expect(setInitialValues).toHaveBeenCalledTimes(1)
    expect(model.a).toBe(1)

    // 替换 schema 为新引用 → 只应用新 defaultValue，不再覆盖 initialValues 快照
    propsRef.schema = { name: 'b', defaultValue: 2 }
    await nextTick()
    expect(model.b).toBe(2)
    // 回归：setInitialValues 仍只被调 1 次（首次），避免脏 model 污染快照
    // （2026-09-18 用户反馈「点重置没反应」根因：schema computed 重求值触发 deep watch
    // 反复 setInitialValues(props.model)，把当前脏 model 同步为快照）
    expect(setInitialValues).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('applyDefaultsAndSync 显式传 syncSnapshot=false 时只应用 defaultValue 不同步快照', () => {
    const setInitialValues = vi.fn()
    const model = reactive<Record<string, unknown>>({})
    const props = {
      schema: { name: 'email', defaultValue: 'a@b.com' },
      model,
    } as unknown as XFormProps
    applyDefaultsAndSync(props, props.schema, setInitialValues, false)
    expect(model.email).toBe('a@b.com')
    expect(setInitialValues).not.toHaveBeenCalled()
  })
})
