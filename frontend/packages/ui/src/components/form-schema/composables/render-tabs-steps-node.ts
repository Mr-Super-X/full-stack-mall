/**
 * Tabs / Steps 视觉容器渲染（PM 审查发现 9，Wave4-2）：
 * 识别 component: 'Tabs' / 'Steps'（或 ElTabs / ElSteps），children 每项映射为一个
 * ElTabPane / ElStep 面板；面板 label 取 child.label（缺省回退 `面板 ${i+1}`）。
 *
 * 定位：纯视觉容器（与 Card 同级）——XForm 不做激活态二次抽象，激活控制/校验门控
 * 通过透传 EP 原生 props/events 实现：
 * - Tabs：props.modelValue + props.beforeLeave（demo 演示校验门控写法）
 * - Steps：props.active + props.processStatus；切换走 demo 外层按钮 + active 绑定
 *
 * children 即面板：与 Card 容器 + children 模式心智一致，无需新 DSL 字段。
 *
 * 面板内布局：child.row/column 走 renderToComponentWithGrid 栅格（同 Card）；
 * 缺省直接 opts.render(child.children)。
 *
 * @see ./render-visual-container.ts Card 视觉容器（同模式）
 * @see ./render-with-grid.ts 面板内栅格渲染
 *
 * @group 表单编排：渲染
 */
import { h, type VNode } from 'vue'
import { ElStep, ElSteps, ElTabPane, ElTabs } from 'element-plus'
import type { SchemaNode } from '../types'
import { getComponentDefaultProps } from './barrel'
import { renderToComponentWithGrid } from './render-with-grid'
import type { RenderSchemaNodeOptions } from './render-schema-node'

/** 判定 component 是否为 Tabs 容器（短名 / 全名 / 组件对象三形态） */
export function isTabsNode(node: SchemaNode): boolean {
  const c = node.component
  return c === 'Tabs' || c === 'ElTabs' || c === ElTabs
}

/** 判定 component 是否为 Steps 容器（短名 / 全名 / 组件对象三形态） */
export function isStepsNode(node: SchemaNode): boolean {
  const c = node.component
  return c === 'Steps' || c === 'ElSteps' || c === ElSteps
}

/** 面板 label 归一化：child.label 缺省回退 `面板 ${i+1}` */
function paneLabel(child: SchemaNode, index: number): string {
  const raw = child.label
  // label 函数式（i18n 场景）此处不展开 —— 容器面板 label 用字符串，函数式 label 由消费方 t() 预求值后传入
  if (typeof raw === 'string' && raw.length > 0) return raw
  return `面板 ${index + 1}`
}

/** 单面板内容渲染：child.row/column → 栅格；缺省直接 render children */
function renderPaneContent(child: SchemaNode, opts: RenderSchemaNodeOptions): () => unknown {
  return () => {
    const useGrid = !!(child.row || child.column !== undefined)
    if (useGrid) return renderToComponentWithGrid(child, opts.render as never)
    return opts.render(child.children as never) as never
  }
}

/** 面板 child → ElTabPane / ElStep 节点（label/title + name + 内容插槽） */
function renderPanes(node: SchemaNode, opts: RenderSchemaNodeOptions, kind: 'tabs' | 'steps') {
  const arr = Array.isArray(node.children) ? node.children : []
  const Pane = kind === 'tabs' ? ElTabPane : ElStep
  return arr.map((child, i) => {
    const label = paneLabel(child, i)
    // Tabs 必须把 child.name 透传为 pane 的 name —— ElTabs 用 currentName（来自 modelValue）
    // 匹配 paneName 决定哪个 pane active（v-show），不传 name 会 fallback 到 index（'0'/'1'），
    // 与 modelValue（如 'basic'）永远不匹配，导致所有 pane 隐藏（首次打开看不到表单）
    const nameProp = kind === 'tabs' && child.name !== undefined ? { name: child.name } : null
    // EP 组件 API 不对称：ElTabPane 的 label 是 prop；ElStep 的标题是 title prop（label 不存在，
    // 传了会被当 attr 透传到根 div 不显示）。统一从 child.label 取值，按 kind 映射到正确 prop
    const labelProp = kind === 'tabs' ? { label } : { title: label }
    return h(
      Pane as never,
      {
        ...labelProp,
        ...(nameProp ?? {}),
        key: (child as Record<string, unknown>).key ?? i,
      } as never,
      // ElStep 的内容走 default slot；ElTabPane 同理
      { default: renderPaneContent(child, opts) } as never
    ) as VNode
  })
}

/**
 * renderTabsStepsNode —— Tabs/Steps 视觉容器渲染
 *
 * 仅处理「无 name + 有 children 数组」的容器节点；有 name / 无 children 返回 undefined
 * 让调度器落入后续分支（FormItem / row+column / 默认）。
 *
 * 透传合并优先级（与 renderVisualContainer 对齐）：
 * componentProps 默认 → node.props → asyncProps → disabled/key。
 */
export function renderTabsStepsNode(
  node: SchemaNode,
  Comp: object,
  opts: RenderSchemaNodeOptions,
  asyncProps: Record<string, unknown>
): VNode | undefined {
  const kind = isTabsNode(node) ? 'tabs' : isStepsNode(node) ? 'steps' : null
  if (!kind) return undefined
  if (node.name !== undefined || !Array.isArray(node.children)) return undefined
  const panes = renderPanes(node, opts, kind)
  if (panes.length === 0) return undefined
  return h(
    Comp as never,
    {
      ...getComponentDefaultProps(node, opts.componentProps),
      ...node.props,
      ...asyncProps,
      ...(node.disabled !== undefined ? { disabled: node.disabled } : {}),
      ...(node.key !== undefined && { key: node.key }),
    } as never,
    // ElTabs / ElSteps 的 default slot 即面板数组
    { default: () => panes } as never
  ) as VNode
}
