/**
 * Schema 节点渲染调度器：5 类分支按权限 / view / array / 视觉容器 / formItem /
 * row+column / 默认顺序委托给子模块，本文件只负责调度与共享 ctx 准备。
 *
 * 公共工具函数（如 resolveComponentFor / compileRules / wrapWithElCol / buildSlotFn 等）
 * 统一从 `./barrel` 消费，本文件不再 re-export —— 渲染调度器与 barrel 职责分离。
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 * @see ./render-form-item / render-array-node / render-visual-container 接收 RenderSchemaNodeOptions
 *
 * @group 表单编排：渲染
 */
import {
  getCurrentScope,
  h,
  onScopeDispose,
  type VNode,
  type ComponentPublicInstance,
  type Ref,
} from 'vue'
import { createNamespace } from '@vv/shared'

// 与 XForm.vue / build-slots.ts 同一 block 命名空间
const bem = createNamespace('x-form')

import type {
  BeforeChangeCtx,
  BeforeChangeRule,
  SchemaNode,
  XFormExpose,
  XFormProps,
} from '../types'

import { resolveComponentFor } from './resolve-component'
import { wrapWithElCol } from './wrap-with-elcol'
import { buildAsyncProps, buildUploadDefaultSlot, getComponentDefaultProps } from './build-slots'
import { resolveLabel } from '../utils/resolve-label'

import { buildVModelBindings } from './build-vmodel-bindings'
import { buildOnBindings } from './build-on-bindings'
import { renderArrayNode, type RowReactionEntry } from './render-array-node'
import { renderVisualContainer } from './render-visual-container'
import { renderTabsStepsNode } from './render-tabs-steps-node'
import { renderWithFormItem, renderWithRowColumn } from './render-form-item'
import { resolvePermission, renderViewPlaceholder } from './use-field-permission'
import { validateSchemaProps } from './validate-component-props'
import type { ExpressionScope } from './use-expression'

type RenderFn = (
  node: SchemaNode | SchemaNode[] | string | undefined | null
) => VNode | string | VNode[] | undefined

// ────────────────────────────────────────────────────────────────────────────
// RenderSchemaNodeOptions —— 主调度入参类型
// ────────────────────────────────────────────────────────────────────────────

/**
 * RenderSchemaNodeOptions —— render-schema-node 主调度入参
 *
 * 5 类分支（数组 / 视觉容器 / FormItem / row+column / 默认）共享的 ctx，
 * 由 XForm 注入，下游 ./render-form-item / render-array-node / render-visual-container 共用。
 */
export interface RenderSchemaNodeOptions {
  model: XFormProps['model']
  components: XFormProps['components']
  beforeChange: XFormProps['beforeChange']
  /** i18n 翻译函数（XFormProps.t 透传）——label 函数式在 render effect 内以它求值 */
  t?: XFormProps['t']
  beforeChangeRules?: BeforeChangeRule[] | undefined
  /** ctx 工厂（每字段独立 ctx 实例） */
  makeBeforeChangeCtx?: ((node: SchemaNode) => BeforeChangeCtx) | undefined
  /** XFormExpose：ctx.setFieldError 调用 */
  formRef?: XFormExpose | undefined
  rules: XFormProps['rules']
  componentProps?: XFormProps['componentProps']
  render: RenderFn
  /** ArrayNode 命令式操作（来自 XFormExpose） */
  arrayActions?: {
    addItem: (name: string, init?: Record<string, unknown>) => void
    removeItem: (name: string, index: number) => void
    moveItem: (name: string, from: number, to: number) => void
  }
  /** 字段事件触发跨字段校验 */
  triggerCrossFieldValidator?: (
    node: SchemaNode,
    eventType: 'blur' | 'change'
  ) => Promise<void> | void
  /**
   * 覆盖 el-form-item 内部 emit 的 onBlur 后,el-form 不会自动跑字段内规则；
   * XForm 必须在 onBlur/onChange handler 中显式调用此函数以保证 min/max/required 等规则生效
   */
  validateField?: (name: string) => Promise<void>
  /** v-model 值写入后主动触发 */
  onValueChange?: (node: SchemaNode, newValue: unknown) => void
  /** 当前响应式断点 */
  currentBreakpoint?: Ref<'xs' | 'sm' | 'md' | 'lg' | 'xl'>
  /**
   * 权限码 → 状态 映射：业务注入 `useAuth().hasPerm` 实现，
   * 默认 identity（字符串字面量直接返回）
   */
  permissionResolver?: (perm: string) => 'view' | 'edit' | 'hidden'
  /**
   * H2：实例级表达式解析器（composer 注入 createExpressionScope() 产物）。
   * on 事件绑定与 permission 表达式经它解析，缺省回退模块级（向后兼容）。
   * @see ./use-expression.ts createExpressionScope
   */
  resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']
  /**
   * 整体只读（顶层 schema readonly 字段解析结果，由 XForm 注入）：
   * 返回 true 时未 hidden 的字段一律按 view 态纯文本展示（hidden 优先级仍最高）
   */
  globalReadonly?: () => boolean
  /**
   * 外部字段错误状态（XForm.vue 注入），走 el-form-item 官方
   * props.error + props.validateStatus 路径触发红字，避免直接改 elForm.fields[i]
   */
  externalErrors?: () => Record<
    string,
    { error: string; validateStatus: '' | 'validating' | 'success' | 'error' }
  >
  /**
   * 字段级 dirty 视觉指示（XFormProps.showDirtyMark 透传，设计师审查 F13）
   * - showDirtyMark: 是否开启 dirty 标记（默认 false）
   * - dirtyFields: 响应式 dirty 字段集合（composer 注入 useFormDirty.dirtyFieldsRef）
   * 二者同时存在时，render-form-item 给对应 el-form-item 追加 `is-dirty` class
   * exactOptionalPropertyTypes: 可选 + undefined 联合以兼容条件展开
   */
  showDirtyMark?: boolean | undefined
  dirtyFields?: Readonly<Ref<ReadonlySet<string>>> | undefined
  /**
   * A5：行级 reaction stopper 桶。缺省时 useRenderSchemaNode 每实例自动创建一份并在
   * 卸载时经 onScopeDispose 统一 stop + clear；显式注入（测试 / 高级场景）时直接用
   * 注入桶。renderArrayNode 消费该桶做行级 reaction 注册 / stale 清理 /
   * 配置未变跳过重注册（@see ./render-array-node.ts RowReactionEntry）
   */
  rowReactionStoppers?: Map<string, RowReactionEntry>
}

/** 主调度入口 —— 5 类渲染分支按顺序委托给子函数 */
export function useRenderSchemaNode(opts: RenderSchemaNodeOptions) {
  /**
   * A5：行级 reaction stopper 桶 —— 默认每渲染器实例一份（原 render-array-node 模块级
   * Map 跨实例共享：①组件卸载后桶条目无清理路径——stale 清理只在渲染时执行，卸载后
   * 不再渲染，重复挂载会让模块级 Map 无限增长（条目持有 rewritten 副本 = schema 克隆）；
   * ②原始值行 i${index} key 跨实例碰撞互相误停 watcher）。桶随 opts 注入
   * renderArrayNode；渲染器所在 setup 卸载时统一 stop + clear。
   * getCurrentScope 守卫：无活跃 scope 的直调场景（单测 / bench）退化为不注册清理，
   * 与 useSchemaRenderer 的 onScopeDispose 边界一致
   */
  const rowReactionStoppers = opts.rowReactionStoppers ?? new Map<string, RowReactionEntry>()
  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const entry of rowReactionStoppers.values()) entry.stop()
      rowReactionStoppers.clear()
    })
  }

  /** view 态占位（permission: 'view' 或顶层 readonly）—— 纯文本不包 formItem 不走校验 */
  function renderViewField(node: SchemaNode): VNode {
    return h(
      'div',
      {
        key: `view-${node.name}`,
        class: bem.e('view-field'),
        'data-permission': 'view',
      } as Record<string, unknown>,
      {
        default: () =>
          [
            node.label
              ? h('label', { class: bem.e('view-field__label') } as Record<string, unknown>, {
                  default: () => `${resolveLabel(node.label, opts.t)}：`,
                })
              : null,
            h('span', { class: bem.e('view-field__value') } as Record<string, unknown>, {
              default: () => renderViewPlaceholder(node, opts.model),
            }),
          ].filter(Boolean) as never,
      }
    ) as VNode
  }

  /** 共享上下文准备（dev mode 白名单校验 + 组件解析 + 事件绑定 + async props） */
  function resolveNodeContext(node: SchemaNode): {
    Comp: ReturnType<typeof resolveComponentFor>
    eventBindings: Record<string, unknown>
    asyncProps: Record<string, unknown>
  } {
    // dev mode 白名单校验（用户传错字段名时 console.warn + OSD 提示）
    // 仅遍历 string component + EL_COMPONENT_MAP 命中的字段；用户自定义组件自动跳过
    validateSchemaProps(node)
    const Comp =
      typeof node.component === 'string'
        ? resolveComponentFor(node.component, opts.components)
        : node.component
    const eventBindings = {
      ...buildVModelBindings(node, opts.model, {
        layer1: opts.beforeChange,
        namespaceRules: opts.beforeChangeRules,
        makeCtx: opts.makeBeforeChangeCtx,
        formRef: opts.formRef,
        onValueChange: opts.onValueChange,
      }),
      ...buildOnBindings(node, opts.model, opts.resolveFunctionExpression),
    }
    const asyncProps = buildAsyncProps(node)
    return { Comp, eventBindings, asyncProps }
  }

  /** 分支 2：视觉容器（Card 等带 row/column，无 name） */
  function renderVisualBranch(
    node: SchemaNode,
    Comp: ReturnType<typeof resolveComponentFor>,
    asyncProps: Record<string, unknown>
  ): VNode | string | VNode[] | undefined {
    if (!Comp || (!node.slots && node.children === undefined) || node.name) return undefined
    return renderVisualContainer(node, Comp as object, opts, asyncProps)
  }

  /** 分支 2b：Tabs / Steps 视觉容器（children 每项 → ElTabPane / ElStep 面板） */
  function renderTabsStepsBranch(
    node: SchemaNode,
    Comp: ReturnType<typeof resolveComponentFor>,
    asyncProps: Record<string, unknown>
  ): VNode | string | VNode[] | undefined {
    if (!Comp) return undefined
    return renderTabsStepsNode(node, Comp as object, opts, asyncProps) ?? undefined
  }

  /** 分支 3：FormItem 包装（含 name 或 formItem: true）—— 有 fall-through（result 为空时继续） */
  function renderFormItemBranch(
    node: SchemaNode,
    Comp: ReturnType<typeof resolveComponentFor>
  ): VNode | string | VNode[] | undefined {
    const shouldWrap =
      (node.name !== undefined && node.formItem !== false) || node.formItem === true
    if (!shouldWrap) return undefined
    return renderWithFormItem(node, Comp as object, opts) ?? undefined
  }

  /** 分支 4：纯 row+column 布局（无 formItem） */
  function renderRowColumnBranch(node: SchemaNode): VNode | string | VNode[] | undefined {
    if (node.row === undefined && node.column === undefined) return undefined
    return renderWithRowColumn(node, opts)
  }

  /** 分支 5：默认——直接渲染 Comp + wrapWithElCol */
  function renderDefaultBranch(
    node: SchemaNode,
    Comp: ReturnType<typeof resolveComponentFor>,
    eventBindings: Record<string, unknown>,
    asyncProps: Record<string, unknown>
  ): VNode | string | VNode[] | undefined {
    if (!Comp) return undefined
    // 类型归因：动态 Comp（resolveComponentFor 返回 object | string）与 h() 第一参 union 不等价
    // （C1 根因，详见 types/TYPE-CAST-AUDIT.md）；运行时已验证 render 正常，TS 层用 as never 兜底。
    return wrapWithElCol(
      node,
      h(
        Comp as never,
        {
          ...eventBindings,
          ...getComponentDefaultProps(node, opts.componentProps),
          ...node.props,
          ...asyncProps,
          ...(node.disabled !== undefined ? { disabled: node.disabled } : {}),
          ...(node.key !== undefined && { key: node.key }),
        } as Record<string, unknown>,
        { default: buildUploadDefaultSlot(node, Comp, opts.render) as never }
      ) as VNode,
      opts.currentBreakpoint?.value
    )
  }

  // ──────────────────────────────────────────────────────────────────────
  // 主调度：权限 gate + view 态提前 return；下方 5 分支按顺序尝试
  // ──────────────────────────────────────────────────────────────────────

  function renderToComponentInner(node: SchemaNode): VNode | string | VNode[] | undefined {
    // 权限 gate（位于最前面，所有渲染分支前）
    // - hidden: 不渲染，DOM 中不出现
    // - view: 纯文本占位，跳过 formItem 包装与校验
    // - edit: 正常走原有分支
    const permission = resolvePermission(node, {
      model: () => opts.model ?? {},
      ...(opts.permissionResolver ? { permissionResolver: opts.permissionResolver } : {}),
      ...(opts.resolveFunctionExpression
        ? { resolveFunctionExpression: opts.resolveFunctionExpression }
        : {}),
    })
    if (permission === 'hidden') return undefined
    // 顶层 schema readonly：未 hidden 的字段一律按 view 态展示
    const readonly = opts.globalReadonly?.() === true
    if ((permission === 'view' || readonly) && node.name) {
      return renderViewField(node)
    }

    // 数组节点独立分支：进入即截断，即使 renderArrayNode 返回 undefined
    if (node.kind === 'array') return renderArrayNode(node, { ...opts, rowReactionStoppers })

    // 共享上下文准备（dev mode 白名单校验 + Comp + eventBindings + asyncProps）
    const { Comp, eventBindings, asyncProps } = resolveNodeContext(node)

    // 2) Tabs / Steps 视觉容器（children 即面板）——先于 Card 视觉容器判定
    const tabsStepsResult = renderTabsStepsBranch(node, Comp, asyncProps)
    if (tabsStepsResult !== undefined) return tabsStepsResult

    // 2b) 视觉容器（Card 等带 row/column，无 name）
    const visualResult = renderVisualBranch(node, Comp, asyncProps)
    if (visualResult !== undefined) return visualResult

    // 3) FormItem 包装（含 name 或 formItem: true）—— 有 fall-through
    const formItemResult = renderFormItemBranch(node, Comp)
    if (formItemResult !== undefined) return formItemResult

    // 4) 纯 row+column 布局（无 formItem）
    const rowColumnResult = renderRowColumnBranch(node)
    if (rowColumnResult !== undefined) return rowColumnResult

    // 5) 默认分支：直接渲染 Comp
    return renderDefaultBranch(node, Comp, eventBindings, asyncProps)
  }
  return renderToComponentInner
}

export type { ComponentPublicInstance }
