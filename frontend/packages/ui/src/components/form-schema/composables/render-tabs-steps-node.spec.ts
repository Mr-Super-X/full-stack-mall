/**
 * render-tabs-steps-node 单元测试（PM 审查发现 9，Wave4-2）
 *
 * 覆盖：
 * - Tabs 容器：children 每项 → ElTabPane（label 取 child.label）
 * - Steps 容器：children 每项 → ElStep
 * - label 缺省回退 `面板 ${i+1}`
 * - 非 Tabs/Steps 节点 → 返回 undefined（让调度器落入后续分支）
 * - 有 name / 无 children 数组 → 返回 undefined
 * - props 合并（componentProps → node.props → asyncProps）
 * - child.row/column → 走 grid 渲染
 */
import { describe, expect, it, vi } from 'vitest'
import { h, type VNode } from 'vue'
import { ElCard, ElRow, ElStep, ElSteps, ElTabPane, ElTabs } from 'element-plus'
import { isTabsNode, isStepsNode, renderTabsStepsNode } from './render-tabs-steps-node'
import type { RenderSchemaNodeOptions } from './render-schema-node'
import type { SchemaNode } from '../types'

function makeOpts(overrides?: Partial<RenderSchemaNodeOptions>): RenderSchemaNodeOptions {
  return {
    model: {} as never,
    components: {},
    beforeChange: undefined,
    beforeChangeRules: undefined,
    rules: {},
    componentProps: undefined,
    render: vi.fn((node: SchemaNode) => {
      if (!node) return undefined
      return h('div', { 'data-test': node.name ?? 'pane-child' })
    }) as never,
    ...overrides,
  }
}

describe('isTabsNode / isStepsNode', () => {
  it("'Tabs' 短名 → true", () => {
    expect(isTabsNode({ component: 'Tabs' } as SchemaNode)).toBe(true)
  })
  it("'ElTabs' 全名 → true", () => {
    expect(isTabsNode({ component: 'ElTabs' } as SchemaNode)).toBe(true)
  })
  it('ElTabs 组件对象 → true', () => {
    expect(isTabsNode({ component: ElTabs as never } as SchemaNode)).toBe(true)
  })
  it("'Steps' 短名 → isStepsNode true", () => {
    expect(isStepsNode({ component: 'Steps' } as SchemaNode)).toBe(true)
  })
  it("'Card' → 两者均 false", () => {
    const node = { component: 'Card' } as SchemaNode
    expect(isTabsNode(node)).toBe(false)
    expect(isStepsNode(node)).toBe(false)
  })
})

describe('renderTabsStepsNode / Tabs', () => {
  it('children 每项 → ElTabPane（label 取 child.label）', () => {
    const node: SchemaNode = {
      component: 'Tabs',
      children: [
        { name: 'a', label: '基础' },
        { name: 'b', label: '高级' },
      ],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    expect(vnode).toBeDefined()
    expect(vnode?.type).toBe(ElTabs)
    // default slot 返回 ElTabPane 数组
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const panes = slotFn()
    expect(panes).toHaveLength(2)
    expect(panes[0]?.type).toBe(ElTabPane)
    expect((panes[0]?.props as { label: string }).label).toBe('基础')
    expect((panes[1]?.props as { label: string }).label).toBe('高级')
  })

  it('label 缺省 → 回退 `面板 ${i+1}`', () => {
    const node: SchemaNode = {
      component: 'Tabs',
      children: [{ name: 'a' }, { name: 'b', label: '显式' }],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const panes = slotFn()
    expect((panes[0]?.props as { label: string }).label).toBe('面板 1')
    expect((panes[1]?.props as { label: string }).label).toBe('显式')
  })

  it('node.props.modelValue 透传（激活态绑定入口）', () => {
    const node: SchemaNode = {
      component: 'Tabs',
      props: { modelValue: 'second' },
      children: [
        { name: 'a', label: '一' },
        { name: 'b', label: '二' },
      ],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    expect((vnode?.props as { modelValue: string }).modelValue).toBe('second')
  })

  it('child.name 透传为 pane name（ElTabs 用 currentName 匹配 paneName 决定 active）', () => {
    // 回归：不传 name 时 EP fallback 到 index（'0'/'1'），与 modelValue（如 'basic'）永远不匹配，
    // 导致所有 pane v-show=none —— 首次打开看不到表单（2026-09-18 用户反馈）
    const node: SchemaNode = {
      component: 'Tabs',
      props: { modelValue: 'basic' },
      children: [
        { name: 'basic', label: '基础' },
        { name: 'advanced', label: '高级' },
      ],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const panes = slotFn()
    expect((panes[0]?.props as { name: string }).name).toBe('basic')
    expect((panes[1]?.props as { name: string }).name).toBe('advanced')
  })

  it('child.name 缺省 → 不传 name prop（EP fallback 到 index）', () => {
    const node: SchemaNode = {
      component: 'Tabs',
      children: [{ label: '无 name' }, { name: 'b', label: '有 name' }],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const panes = slotFn()
    expect(panes[0]?.props?.name).toBeUndefined()
    expect((panes[1]?.props as { name: string }).name).toBe('b')
  })

  it('child.row/column → 面板内容走 grid 渲染（ElRow）', () => {
    const node: SchemaNode = {
      component: 'Tabs',
      children: [{ name: 'a', label: '栅格', column: 2, children: [{ name: 'x' }] }],
    }
    const vnode = renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const panes = slotFn()
    const paneDefault = (panes[0]?.children as { default: () => VNode }).default
    const gridVNode = paneDefault()
    // grid 渲染产出 ElRow
    expect((gridVNode as VNode).type).toBe(ElRow)
  })
})

describe('renderTabsStepsNode / Steps', () => {
  it('children 每项 → ElStep（child.label 映射为 title prop）', () => {
    const node: SchemaNode = {
      component: 'Steps',
      props: { active: 1 },
      children: [{ label: '填写' }, { label: '确认' }, { label: '完成' }],
    }
    const vnode = renderTabsStepsNode(node, ElSteps as never, makeOpts(), {})
    expect(vnode?.type).toBe(ElSteps)
    expect((vnode?.props as { active: number }).active).toBe(1)
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const steps = slotFn()
    expect(steps).toHaveLength(3)
    expect(steps[0]?.type).toBe(ElStep)
    // EP ElStep 的标题是 title prop（非 label）；child.label 缺省回退 `面板 N`
    expect((steps[1]?.props as { title: string }).title).toBe('确认')
    expect(steps[0]?.props?.label).toBeUndefined()
  })

  it('Steps child.label 缺省 → title 回退 `面板 N`', () => {
    const node: SchemaNode = {
      component: 'Steps',
      children: [{}, { label: '显式' }],
    }
    const vnode = renderTabsStepsNode(node, ElSteps as never, makeOpts(), {})
    const slotFn = (vnode?.children as Record<string, () => VNode[]>).default
    const steps = slotFn()
    expect((steps[0]?.props as { title: string }).title).toBe('面板 1')
    expect((steps[1]?.props as { title: string }).title).toBe('显式')
  })
})

describe('renderTabsStepsNode / 边界', () => {
  it('非 Tabs/Steps（如 Card）→ 返回 undefined', () => {
    const node: SchemaNode = { component: 'Card', children: [{ name: 'a' }] }
    expect(renderTabsStepsNode(node, ElCard as never, makeOpts(), {})).toBeUndefined()
  })

  it('有 name → 返回 undefined（让调度器走 FormItem 分支）', () => {
    const node: SchemaNode = { component: 'Tabs', name: 'tabField', children: [] }
    expect(renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})).toBeUndefined()
  })

  it('children 非数组（单对象）→ 返回 undefined', () => {
    const node: SchemaNode = { component: 'Tabs', children: { name: 'single' } as never }
    expect(renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})).toBeUndefined()
  })

  it('children 空数组 → 返回 undefined', () => {
    const node: SchemaNode = { component: 'Tabs', children: [] }
    expect(renderTabsStepsNode(node, ElTabs as never, makeOpts(), {})).toBeUndefined()
  })
})
