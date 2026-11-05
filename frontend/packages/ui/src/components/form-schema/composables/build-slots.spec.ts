/**
 * build-slots 单元测试
 *
 * 覆盖：
 * - renderChildren: undefined/string/array/SchemaNode 各分支
 * - buildSlotFn: 函数 slot / 字符串 / SchemaNode
 * - buildUploadDefaultSlot: picture-card / drag / text / picture / 用户自定义优先
 * - buildUploadTipSlot: 字符串自动包 el-upload__tip / 函数原样
 * - getComponentDefaultProps: 按 component 名注入
 * - buildAsyncProps: 仅 Autocomplete 注入 fetchSuggestions
 */
import { describe, expect, it, vi } from 'vitest'
import { h, type VNode } from 'vue'
import { ElUpload } from 'element-plus'
import {
  buildAsyncProps,
  buildSlotFn,
  buildUploadDefaultSlot,
  buildUploadTipSlot,
  getComponentDefaultProps,
  renderChildren,
} from './build-slots'
import type { SchemaNode } from '../types'

type RenderFn = (
  node: SchemaNode | SchemaNode[] | string | undefined | null
) => VNode | string | VNode[] | undefined

const render: RenderFn = vi.fn((node) => {
  if (!node || typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(render) as VNode[]
  return h('div', { 'data-test': node.name ?? 'node' })
}) as never

describe('renderChildren', () => {
  it('undefined → 返回 undefined', () => {
    expect(renderChildren(undefined, render)).toBeUndefined()
  })

  it('string → 原样返回', () => {
    expect(renderChildren('hello', render)).toBe('hello')
  })

  it('数组 → 递归渲染', () => {
    const out = renderChildren([{ name: 'a' }, { name: 'b' }], render) as VNode[]
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(2)
  })

  it('SchemaNode 单节点 → 调 render', () => {
    const node: SchemaNode = { name: 'x' }
    const out = renderChildren(node, render)
    expect(out).toBeDefined()
  })
})

describe('buildSlotFn', () => {
  it('函数 slot → 透传 scope 调用', () => {
    const slotFn = vi.fn((scope: Record<string, unknown>) => `value=${scope.x}`)
    const wrapped = buildSlotFn(slotFn as never, render)
    expect(wrapped({ x: 5 })).toBe('value=5')
  })

  it('字符串 slot → 通过 renderChildren 返回', () => {
    const wrapped = buildSlotFn('text slot', render)
    expect(wrapped()).toBe('text slot')
  })

  it('SchemaNode slot → 通过 renderChildren 渲染', () => {
    const node: SchemaNode = { name: 'slotNode' }
    const wrapped = buildSlotFn(node, render)
    const result = wrapped()
    expect(result).toBeDefined()
  })

  it('SchemaNode[] slot → 数组渲染', () => {
    const nodes: SchemaNode[] = [{ name: 'a' }, { name: 'b' }]
    const wrapped = buildSlotFn(nodes, render)
    const result = wrapped() as VNode[]
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })
})

describe('buildUploadDefaultSlot', () => {
  it('listType="picture-card" → 渲染 Plus 图标', () => {
    const node: SchemaNode = { component: 'Upload', props: { listType: 'picture-card' } }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode
    expect(vnode).toBeDefined()
  })

  it('drag=true → 渲染 UploadFilled + 拖拽文案', () => {
    const node: SchemaNode = { component: 'Upload', props: { drag: true } }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode[]
    expect(Array.isArray(vnode)).toBe(true)
    expect(vnode).toHaveLength(2)
  })

  it('默认（text/picture）→ 渲染「点击上传」按钮', () => {
    const node: SchemaNode = { component: 'Upload' }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode
    expect(vnode).toBeDefined()
  })

  it('用户自定义 slots.default → 优先使用用户内容', () => {
    const node: SchemaNode = {
      component: 'Upload',
      slots: {
        default: { component: 'span', children: '自定义触发' } as never,
      },
    }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode
    expect(vnode).toBeDefined()
    // 应该是用户的 span，不是 Plus 图标
  })

  it('用户自定义 children → 优先使用 children', () => {
    const node: SchemaNode = {
      component: 'Upload',
      children: { component: 'span', children: 'children 触发' },
    }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode
    expect(vnode).toBeDefined()
  })

  it('slots.trigger 存在 → 不注入默认内容（避免孤立按钮）', () => {
    const node: SchemaNode = {
      component: 'Upload',
      slots: { trigger: { component: 'button', children: '选择文件' } as never },
    }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot()
    // 没有 children 也没 default slot 时返回 children（undefined）
    expect(vnode).toBeFalsy()
  })

  it('非 Upload 组件 → 返回 children 或 undefined', () => {
    const node: SchemaNode = { component: 'Input' }
    const slot = buildUploadDefaultSlot(node, 'Input' as never, render)
    const vnode = slot()
    expect(vnode).toBeFalsy()
  })

  it('picture-card + drag 同时开启 → picture-card 优先（Plus 图标不溢出）', () => {
    const node: SchemaNode = {
      component: 'Upload',
      props: { listType: 'picture-card', drag: true },
    }
    const slot = buildUploadDefaultSlot(node, ElUpload, render)
    const vnode = slot() as VNode
    // picture-card 优先级最高（drag 排序在后）
    expect(vnode).toBeDefined()
  })
})

describe('buildUploadTipSlot', () => {
  it('字符串 tip → 自动包 el-upload__tip div', () => {
    const slot = buildUploadTipSlot('仅支持 jpg/png', render)
    const vnode = slot() as VNode
    expect(vnode).toBeDefined()
    // props.class 应包含 'el-upload__tip'
    const props = (vnode as unknown as { props: { class?: string } }).props
    expect(props.class).toBe('el-upload__tip')
  })

  it('函数 tip → 透传', () => {
    const fn = vi.fn(() => 'dynamic tip')
    const slot = buildUploadTipSlot(fn as never, render)
    expect(slot()).toBe('dynamic tip')
    expect(fn).toHaveBeenCalled()
  })

  it('SchemaNode tip → 通过 renderChildren 渲染', () => {
    const node: SchemaNode = { name: 'tip' }
    const slot = buildUploadTipSlot(node, render)
    expect(slot()).toBeDefined()
  })
})

describe('getComponentDefaultProps', () => {
  it('node.component 是字符串 → 从 componentProps 查找', () => {
    const node: SchemaNode = { component: 'Input' }
    const result = getComponentDefaultProps(node, {
      Input: { clearable: true, placeholder: '默认占位' },
    })
    expect(result).toEqual({ clearable: true, placeholder: '默认占位' })
  })

  it('node.component 是对象 → 返回空对象', () => {
    const node: SchemaNode = { component: { name: 'CustomComp' } as never }
    const result = getComponentDefaultProps(node, {
      Input: { clearable: true },
    })
    expect(result).toEqual({})
  })

  it('componentProps 未提供 → 返回空对象', () => {
    const node: SchemaNode = { component: 'Input' }
    expect(getComponentDefaultProps(node)).toEqual({})
  })

  it('componentProps 中无对应组件 → 返回空对象', () => {
    const node: SchemaNode = { component: 'Input' }
    const result = getComponentDefaultProps(node, { Select: { clearable: true } })
    expect(result).toEqual({})
  })
})

describe('buildAsyncProps', () => {
  it('无 asyncOptions → 返回空对象', () => {
    const node: SchemaNode = { component: 'Autocomplete' }
    expect(buildAsyncProps(node)).toEqual({})
  })

  it('component 非 Autocomplete → 返回空对象（即使有 asyncOptions）', () => {
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: { source: () => Promise.resolve([]) } as never,
    }
    expect(buildAsyncProps(node)).toEqual({})
  })

  it('Autocomplete + asyncOptions → 注入 fetchSuggestions', () => {
    const node: SchemaNode = {
      component: 'Autocomplete',
      asyncOptions: { source: () => Promise.resolve([]) } as never,
    }
    const result = buildAsyncProps(node)
    expect(result.fetchSuggestions).toBeTypeOf('function')
  })

  it('ElAutocomplete 全名 + asyncOptions → 也注入 fetchSuggestions', () => {
    const node: SchemaNode = {
      component: 'ElAutocomplete',
      asyncOptions: { source: () => Promise.resolve([]) } as never,
    }
    const result = buildAsyncProps(node)
    expect(result.fetchSuggestions).toBeTypeOf('function')
  })

  // B2 实证修正（2026-10-19 浏览器实测）：渲染层每次重渲染都调 buildAsyncProps——
  // 若每次新建 fetcher 实例，seq 闭包归零，每次输入都用到 seq=1 的"新"实例，
  // 竞态令牌形同虚设（旧响应全部落地）。fetcher 必须按 asyncOptions 引用复用。
  it('重复调用（重渲染）返回同一 fetcher 引用 —— seq 在同一节点生命周期内累计', () => {
    const node: SchemaNode = {
      component: 'Autocomplete',
      asyncOptions: { source: () => Promise.resolve([]) } as never,
    }
    const first = buildAsyncProps(node).fetchSuggestions
    const second = buildAsyncProps(node).fetchSuggestions
    expect(second).toBe(first)
  })

  it('复用的 fetcher 实例竞态防护生效：旧响应后到被丢弃', async () => {
    let resolveSecond: ((v: unknown[]) => void) | null = null
    const node: SchemaNode = {
      component: 'Autocomplete',
      asyncOptions: {
        source: (query?: string) =>
          query === '慢'
            ? new Promise((r) => setTimeout(() => r(['慢-结果']), 30))
            : new Promise((r) => {
                resolveSecond = r as (v: unknown[]) => void
              }),
      } as never,
    }
    // 连续两次渲染拿到的同一实例（模拟两次输入都用它）
    const fetcher = buildAsyncProps(node).fetchSuggestions as (
      q: string,
      cb: (s: Array<{ value: unknown }>) => void
    ) => void

    const landed: unknown[] = []
    fetcher('慢', (suggestions) => landed.push(suggestions))
    fetcher('快', (suggestions) => landed.push(suggestions))
    resolveSecond!([['快-结果']])
    await new Promise((r) => setTimeout(r, 60))

    // 「慢」响应（mySeq=1）后返回，seq 已为 2 → 丢弃；只有「快」落地
    expect(landed).toEqual([[['快-结果']]])
  })
})
