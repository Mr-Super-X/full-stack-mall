/**
 * builders/containers —— 容器类节点 builder
 *
 * 从 builders.ts 拆分（架构审查 #3）。含 Card（视觉容器）与 ArrayBuilder
 * （数组节点，独立于 makeBuilder，因为不绑 el 组件 props）。
 *
 * @group XForm 构建器
 */
import type { SchemaNode, XFormLabelFn } from '../types'
import { makeBuilder } from './core'

// ── Card ──
const CardBuilder = makeBuilder('Card')
class CardBuilderExt extends CardBuilder {
  /**
   * 设置 Card 标题 —— element-plus ElCard 无 title prop，标题走 slots.header 渲染
   * 写到 props.title 会触发 validate-component-props dev 模式 PROP_VALIDATION 警告
   */
  title(t: string): this {
    if (!this.node.slots) this.node.slots = {}
    this.node.slots.header = t
    return this
  }
  column(c: number): this {
    this.node.column = c
    return this
  }
  gutter(g: number): this {
    this.node.row = { gutter: g }
    return this
  }
}
/**
 * xCard —— Card 视觉容器链式构造器入口（无 name 字段，走视觉容器渲染分支）
 *
 * @see CardBuilderExt Ext 方法：title / column / gutter
 */
export const xCard = (name: string) => new CardBuilderExt(name)

// ── Tabs / Steps（PM 审查发现 9，Wave4-2 新增） ──
// 视觉容器：children 每项 → ElTabPane / ElStep 面板（label 取 child.label）
// 激活态 / 校验门控通过 EP 原生 props/events 透传（modelValue / beforeLeave / active）
const TabsBuilder = makeBuilder('Tabs')
class TabsBuilderExt extends TabsBuilder {
  /** 当前激活 tab 绑定（写 model 字段路径由消费方用 props.modelValue + @tabChange 自行桥接） */
  modelValue(v: string | number): this {
    return this.prop('modelValue', v)
  }
  /** 切走前校验门控 —— 传 (activeName, oldActiveName) => Promise<boolean> | boolean */
  beforeLeave(fn: (...args: unknown[]) => unknown): this {
    return this.prop('beforeLeave', fn)
  }
}
/**
 * xTabs —— Tabs 视觉容器链式构造器入口（children 每项 → ElTabPane）
 *
 * @see TabsBuilderExt Ext 方法：modelValue / beforeLeave
 */
export const xTabs = (name: string) => new TabsBuilderExt(name)

const StepsBuilder = makeBuilder('Steps')
class StepsBuilderExt extends StepsBuilder {
  /** 当前激活 step（number）——切换由消费方外层按钮 + active 绑定驱动 */
  active(n: number): this {
    return this.prop('active', n)
  }
  /** 完成态（'wait' | 'process' | 'finish' | 'error' | 'success'） */
  processStatus(s: string): this {
    return this.prop('processStatus', s)
  }
}
/**
 * xSteps —— Steps 视觉容器链式构造器入口（children 每项 → ElStep）
 *
 * @see StepsBuilderExt Ext 方法：active / processStatus
 */
export const xSteps = (name: string) => new StepsBuilderExt(name)

/**
 * ArrayBuilder —— 数组节点链式构造器（独立于 makeBuilder，因为不绑 el 组件 props）
 *
 * 链式 API：item / initialLength / minItems / maxItems / showActions / labels / title / draggable
 * build() 返回 SchemaNode —— props 类型不推导（数组节点本身不带 props）
 *
 * @see ../composables/render-array-node.ts 渲染逻辑
 * @see ../../types/array.ts ArrayNodeConfig 字段定义
 */
export class ArrayBuilder {
  node: SchemaNode = { kind: 'array', array: { itemSchema: {} as SchemaNode } }

  constructor(name: string) {
    this.node.name = name
  }

  item(itemSchema: SchemaNode | SchemaNode[]): this {
    if (!this.node.array) this.node.array = { itemSchema }
    else this.node.array.itemSchema = itemSchema
    return this
  }

  initialLength(n: number): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.initialLength = n
    return this
  }

  minItems(n: number): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.minItems = n
    return this
  }

  maxItems(n: number): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.maxItems = n
    return this
  }

  showActions(flag: boolean | { add?: boolean; remove?: boolean; move?: boolean }): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.showActions = flag
    return this
  }

  labels(opts: { add?: string; remove?: string; moveUp?: string; moveDown?: string }): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.labels = opts
    return this
  }

  title(t: string): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.title = t
    return this
  }

  /**
   * 行拖拽排序开关 —— 与 ArrayNodeConfig.draggable 对应
   * 默认 true；开启后行可 HTML5 拖拽换位，drop 走 moveItem 更新 model
   */
  draggable(flag = true): this {
    if (!this.node.array) this.node.array = { itemSchema: {} as SchemaNode }
    this.node.array.draggable = flag
    return this
  }

  label(l: string | XFormLabelFn): this {
    this.node.label = l
    return this
  }

  reaction(r: NonNullable<SchemaNode['reaction']>): this {
    this.node.reaction = r
    return this
  }

  build(): SchemaNode {
    return this.node
  }
}

/** xArray —— 数组节点（kind='array'）链式构造器入口 */
export const xArray = (name: string) => new ArrayBuilder(name)
