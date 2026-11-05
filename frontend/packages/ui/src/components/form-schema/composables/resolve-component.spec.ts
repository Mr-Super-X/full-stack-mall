/**
 * resolve-component 单元测试
 *
 * 覆盖：
 * - resolveComponentFor: 用户组件 / 内置短名 / ElXxx 全名 / 原生 HTML 标签 / 全局组件 fallback
 * - EL_COMPONENT_MAP: 26 个内置映射完整性
 * - isElUpload: component name + Comp 引用双重判断
 * - isPictureCardUpload / isDragUpload: 基于 isElUpload + props 判断
 */
import { describe, expect, it, vi } from 'vitest'
import { ElUpload } from 'element-plus'

// 文件顶层 mock vue 模块：resolveComponentFor 的全局组件 fallback 走 vue.resolveComponent，
// jsdom 无 Vue 实例时该调用会抛错——用 mock 提供可控返回值，让 fallback 路径可断言。
// 默认实现 mock 出 vue 未命中行为：返回组件名字符串 → resolveComponentFor fallthrough → null
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    resolveComponent: vi.fn((name: string) => name),
  }
})

import { resolveComponent } from 'vue'
import {
  EL_COMPONENT_MAP,
  isDragUpload,
  isElUpload,
  isPictureCardUpload,
  resolveComponentFor,
} from './resolve-component'
import type { SchemaNode } from '../types'

const mockedResolveComponent = vi.mocked(resolveComponent)

describe('resolveComponentFor', () => {
  it('undefined → null', () => {
    expect(resolveComponentFor(undefined)).toBeNull()
  })

  it('用户自定义 components → 用户版本优先', () => {
    const MyInput = { name: 'MyInput' }
    const result = resolveComponentFor('MyInput', { MyInput })
    expect(result).toBe(MyInput)
  })

  it('内置短名 → EL_COMPONENT_MAP 查找', () => {
    const result = resolveComponentFor('Input')
    expect(result).toBe(EL_COMPONENT_MAP.Input)
  })

  it('ElXxx 全名 → 短名 fallback', () => {
    const result = resolveComponentFor('ElInput')
    expect(result).toBe(EL_COMPONENT_MAP.Input)
  })

  it('原生 HTML 标签（全小写）→ 返回字符串', () => {
    expect(resolveComponentFor('div')).toBe('div')
    expect(resolveComponentFor('span')).toBe('span')
  })

  it('未注册的组件名（混合大小写）→ null', () => {
    expect(resolveComponentFor('MyUnknownComponent')).toBeNull()
  })

  it('空 userComponents → 仍走内置查找', () => {
    const result = resolveComponentFor('Input', {})
    expect(result).toBe(EL_COMPONENT_MAP.Input)
  })

  it('全局组件 fallback：vue.resolveComponent 命中 → 返回组件对象', () => {
    // unplugin-vue-components 把 src/components/common/** 自动注册到 GlobalComponents，
    // 这里 mock vue.resolveComponent 模拟 RichTextEditor 全局可解析
    const RichTextEditorStub = { name: 'RichTextEditor' }
    mockedResolveComponent.mockReturnValueOnce(RichTextEditorStub as never)
    const result = resolveComponentFor('RichTextEditor')
    expect(result).toBe(RichTextEditorStub)
  })

  it('全局组件 fallback：vue.resolveComponent 返回字符串（未注册）→ null', () => {
    // vue 未命中时 resolveComponent 返回组件名字符串原样；显式视为 fallthrough，
    // 与 ElXxx 路径同语义。防止拼写错误（如 Inpurt）被误识别为合法组件
    mockedResolveComponent.mockReturnValueOnce('NotRegistered' as never)
    expect(resolveComponentFor('NotRegistered')).toBeNull()
  })

  it('userComponents 优先于全局 fallback', () => {
    const UserVersion = { name: 'UserRichTextEditor' }
    const GlobalVersion = { name: 'GlobalRichTextEditor' }
    mockedResolveComponent.mockReturnValueOnce(GlobalVersion as never)
    const result = resolveComponentFor('RichTextEditor', { RichTextEditor: UserVersion })
    expect(result).toBe(UserVersion)
  })
})

describe('EL_COMPONENT_MAP', () => {
  it('包含 26+ 个内置组件', () => {
    expect(Object.keys(EL_COMPONENT_MAP).length).toBeGreaterThanOrEqual(26)
  })

  it('Input / InputPassword / InputTextArea 都映射到 ElInput', () => {
    expect(EL_COMPONENT_MAP.Input).toBe(EL_COMPONENT_MAP.InputPassword)
    expect(EL_COMPONENT_MAP.Input).toBe(EL_COMPONENT_MAP.InputTextArea)
  })

  it('InputTag 映射到 ElInputTag（独立组件）', () => {
    expect(EL_COMPONENT_MAP.InputTag).toBeDefined()
  })

  it('Upload 映射到 ElUpload', () => {
    expect(EL_COMPONENT_MAP.Upload).toBe(ElUpload)
  })
})

describe('isElUpload', () => {
  it('name=Upload + Comp=ElUpload → true', () => {
    const node: SchemaNode = { component: 'Upload' }
    expect(isElUpload(node, ElUpload)).toBe(true)
  })

  it('name=ElUpload + Comp=ElUpload → true', () => {
    const node: SchemaNode = { component: 'ElUpload' }
    expect(isElUpload(node, ElUpload)).toBe(true)
  })

  it('name=Upload + Comp=其他 → false（避免用户 components 覆盖后误判）', () => {
    const node: SchemaNode = { component: 'Upload' }
    expect(isElUpload(node, { name: 'CustomUpload' })).toBe(false)
  })

  it('name=其他 → false', () => {
    const node: SchemaNode = { component: 'Input' }
    expect(isElUpload(node, ElUpload)).toBe(false)
  })

  it('component 是对象（非字符串） → false', () => {
    const node: SchemaNode = { component: { name: 'X' } as never }
    expect(isElUpload(node, ElUpload)).toBe(false)
  })
})

describe('isPictureCardUpload', () => {
  it('Upload + listType=picture-card → true', () => {
    const node: SchemaNode = { component: 'Upload', props: { listType: 'picture-card' } }
    expect(isPictureCardUpload(node, ElUpload)).toBe(true)
  })

  it('Upload + listType=text → false', () => {
    const node: SchemaNode = { component: 'Upload', props: { listType: 'text' } }
    expect(isPictureCardUpload(node, ElUpload)).toBe(false)
  })

  it('非 ElUpload → false（即使 props.listType 对）', () => {
    const node: SchemaNode = { component: 'Upload', props: { listType: 'picture-card' } }
    expect(isPictureCardUpload(node, { name: 'CustomUpload' })).toBe(false)
  })

  it('listType 缺失 → false', () => {
    const node: SchemaNode = { component: 'Upload' }
    expect(isPictureCardUpload(node, ElUpload)).toBe(false)
  })
})

describe('isDragUpload', () => {
  it('Upload + drag=true → true', () => {
    const node: SchemaNode = { component: 'Upload', props: { drag: true } }
    expect(isDragUpload(node, ElUpload)).toBe(true)
  })

  it('Upload + drag=false → false', () => {
    const node: SchemaNode = { component: 'Upload', props: { drag: false } }
    expect(isDragUpload(node, ElUpload)).toBe(false)
  })

  it('Upload + drag 缺失 → false', () => {
    const node: SchemaNode = { component: 'Upload' }
    expect(isDragUpload(node, ElUpload)).toBe(false)
  })

  it('非 ElUpload → false', () => {
    const node: SchemaNode = { component: 'Upload', props: { drag: true } }
    expect(isDragUpload(node, { name: 'CustomUpload' })).toBe(false)
  })
})
