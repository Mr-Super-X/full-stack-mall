/**
 * 数组节点渲染（kind === 'array'）：ElCard + 标题 + 添加按钮 + 每行 ElFormItem + 行尾按钮，
 * name 路径自动前缀化为 `items[i].subName`（el-form 按嵌套路径校验）。
 *
 * 类型断言（`as never`）归因见 types/TYPE-CAST-AUDIT.md。
 *
 * @group 表单编排：渲染
 */
import { h, type VNode } from 'vue'
import { ElCard, ElButton } from 'element-plus'
import { get } from 'lodash-es'
import type { SchemaNode } from '../types'
import { resolveLabel } from '../utils/resolve-label'
import { mergeColResponsive } from './barrel'
import { applyReactions, createBudget } from './use-reaction'
import type { RenderSchemaNodeOptions } from './render-schema-node'
import { rowKeyOf, rewriteNamePath } from './array-row-key'

/**
 * 拖拽排序的瞬时 UI 状态（设计师审查 F7：落点指示线 + 源行拖拽态）
 *
 * 模块级 ref：同一时刻用户只在一个数组上拖拽，无需实例隔离；
 * render effect 内 .value 读取建立响应式依赖，dragenter/dragleave/drop 时改值触发重渲
 */
import { ref } from 'vue'
const dragSourceIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)
const dropPosition = ref<'before' | 'after'>('after')

/**
 * 行级 reaction 注册条目（A5）—— stopper 桶 value 从纯函数升级为四元组：
 * - stop：停止本行全部 reaction watcher
 * - index：注册时的行序位 —— move 后 index 变化必须重注册（rewritten name 前缀随序位）
 * - itemSchema：注册时的 itemSchema 引用 —— schema 替换 / 深改后引用变化必须重注册
 * - rewritten：注册时 rewriteNamePath 产出的副本（reaction 结果写入这份副本；
 *   配置未变时跨渲染复用该副本 + watcher，跳过重注册 —— 原实现每次渲染全量
 *   stop + applyReactions 重注册，行数 × 渲染次数级别的无谓 churn）
 */
export interface RowReactionEntry {
  stop: () => void
  index: number
  itemSchema: SchemaNode | SchemaNode[] | string | undefined
  rewritten: SchemaNode
}

/**
 * 直调 renderArrayNode（不经 useRenderSchemaNode）时的退回桶 ——
 * 生产路径由 useRenderSchemaNode 注入实例级桶（组件卸载时 onScopeDispose 统一清理，
 * @see ./render-schema-node.ts）；本桶仅兼容单测 / bench 直调场景（与改前行为等价）
 */
const fallbackRowReactionStoppers = new Map<string, RowReactionEntry>()

/** stop 单个行级 reaction 条目并从桶中移除 */
function stopRowReaction(bucket: Map<string, RowReactionEntry>, key: string): void {
  const entry = bucket.get(key)
  if (entry) {
    entry.stop()
    bucket.delete(key)
  }
}

/** renderArrayNode —— 数组节点渲染（kind='array'，ElCard + 行 + 行内控件） */
export function renderArrayNode(
  node: SchemaNode,
  opts: RenderSchemaNodeOptions
): VNode | undefined {
  if (!node.array) return undefined
  const listName = node.name
  if (!listName) return undefined
  const cfg = node.array
  // el-form prop 路径必须用 items[0].qty 语法（方括号包裹数字索引），不能用 items.0.qty
  const sep = '.'
  const showActions = cfg.showActions ?? true
  const showAdd = typeof showActions === 'object' ? showActions.add !== false : showActions
  const showRemove = typeof showActions === 'object' ? showActions.remove !== false : showActions
  const showMove = typeof showActions === 'object' ? showActions.move !== false : showActions
  const labelAdd = cfg.labels?.add ?? '添加'
  const labelRemove = cfg.labels?.remove ?? '删除'
  const labelUp = cfg.labels?.moveUp ?? '上移'
  const labelDown = cfg.labels?.moveDown ?? '下移'

  // P0-3 修复：嵌套 array 场景下 listName 是嵌套路径（如 orders[0].items），
  // 直接 model[listName] 只能读顶层 key。改用 lodash get 解析嵌套路径。
  const listRaw = get(opts.model ?? {}, listName)
  const list: unknown[] = Array.isArray(listRaw) ? listRaw : []
  const min = cfg.minItems ?? 0
  const max = cfg.maxItems ?? Infinity

  // A5：行级 reaction 桶 —— 优先用 useRenderSchemaNode 注入的实例级桶（卸载有清理路径），
  // 直调场景（单测 / bench）退回模块级桶
  const rowBucket = opts.rowReactionStoppers ?? fallbackRowReactionStoppers

  // 行级 reaction stale 清理 —— list 重渲（push/splice/move 后）停掉已不在当前 list
  // 的旧行 watcher。prefix 限定 listName 避免误清其他 array 容器的 watcher
  // （多个 array 并存时按 listName 隔离）
  const currentRowKeys = new Set(list.map((row, i) => `${listName}#${rowKeyOf(row, i)}`))
  const listPrefix = `${listName}#`
  for (const key of rowBucket.keys()) {
    if (key.startsWith(listPrefix) && !currentRowKeys.has(key)) {
      stopRowReaction(rowBucket, key)
    }
  }

  /**
   * A5：取本行的 rewritten 副本（含行级 reaction 注册）——
   * - 桶内同 rowKey 条目且 index + itemSchema 引用均未变 → 复用缓存副本（watcher 仍
   *   存活、reaction 结果已写入副本），跳过重注册（原实现每次渲染全量 stop +
   *   applyReactions 重注册，行数 × 渲染次数级别的无谓 churn）
   * - 否则（新行 / 移动后序位变化 / schema 替换）→ 停旧 watcher，重建副本 + 重注册
   */
  const resolveRowRewritten = (row: unknown, rowKey: string, index: number) => {
    const rowStopKey = `${listName}#${rowKey}`
    const cached = rowBucket.get(rowStopKey)
    if (cached && cached.index === index && cached.itemSchema === cfg.itemSchema) {
      return cached.rewritten
    }
    if (cached) stopRowReaction(rowBucket, rowStopKey)
    const rewritten = rewriteNamePath(cfg.itemSchema, `${listName}[${index}]`, sep, rowStopKey)
    if (rewritten && typeof rewritten === 'object') {
      // 行级 reaction 独立注册（与顶层 use-schema-renderer reaction 并行）：
      // 把 row 子树对象作为 model 传入 —— 行内相对 deps（'qty' / 'price' 等）在
      // 根 model 不可达，用行 model 解析后 use-reaction.ts lodash.get 才有值。
      // 行内 reaction 数量通常远小于顶层 schema，独立预算避免抢顶层 budget 配额；
      // 无限循环场景由 runner 内 budget.enter() 兜底 + console.error 告警
      const rowStoppers: (() => void)[] = []
      applyReactions(
        rewritten as SchemaNode,
        row as Record<string, unknown>,
        rowStoppers,
        createBudget(),
        opts.resolveFunctionExpression
      )
      rowBucket.set(rowStopKey, {
        stop: () => rowStoppers.forEach((s) => s()),
        index,
        itemSchema: cfg.itemSchema,
        rewritten: rewritten as SchemaNode,
      })
    }
    return rewritten
  }

  const renderRow = (row: unknown, index: number): VNode => {
    const rowKey = rowKeyOf(row, index)
    // name 前缀 = 位置路径（el-form 校验用，随 index 走）；
    // keyPrefix = 行对象身份（vnode key 用，随行数据走）——两者必须分离，
    // 否则删/移行后内部 form-item 的 key（fi-items[0].qty）漂移，整行重挂载
    const rewritten = resolveRowRewritten(row, rowKey, index)
    const inner = rewritten
      ? opts.render({
          ...(rewritten as object),
          col: mergeColResponsive((rewritten as SchemaNode).col, opts.currentBreakpoint?.value),
        } as SchemaNode)
      : undefined
    // P2-3 拖拽排序：draggable 开启时整行可拖
    // F7 增强（设计师审查）：dragover 计算鼠标在行内上半/下半 → 渲染 2px 落点指示线；
    // dragstart 给源行加 .is-dragging 半透明；drop/dragend 清状态
    const dndProps =
      cfg.draggable === true
        ? {
            draggable: true,
            onDragstart: (e: DragEvent) => {
              e.dataTransfer?.setData('text/xform-array-row', String(index))
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              dragSourceIndex.value = index
            },
            onDragover: (e: DragEvent) => {
              e.preventDefault() // 必须 preventDefault 才允许 drop
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
              // 计算鼠标在行内的垂直位置：上半 → before（插到当前行之前），下半 → after
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const ratio = (e.clientY - rect.top) / rect.height
              dropTargetIndex.value = index
              dropPosition.value = ratio < 0.5 ? 'before' : 'after'
            },
            onDragleave: () => {
              // 鼠标离开本行时清落点指示（进入下一行时 dragover 会重设）
              if (dropTargetIndex.value === index) {
                dropTargetIndex.value = null
              }
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault()
              const from = Number(e.dataTransfer?.getData('text/xform-array-row'))
              if (Number.isInteger(from) && from !== index) {
                // 落点换算：before = 插到 index 之前（即 from → index-1）；after = 插到 index 之后
                const target = dropPosition.value === 'before' ? index - 1 : index
                opts.arrayActions?.moveItem(listName, from, target)
              }
              dragSourceIndex.value = null
              dropTargetIndex.value = null
            },
            onDragend: () => {
              dragSourceIndex.value = null
              dropTargetIndex.value = null
            },
          }
        : {}
    // F7：源行拖拽态 + 落点指示 class
    const dndClass =
      cfg.draggable === true
        ? [
            dragSourceIndex.value === index ? 'is-dragging' : '',
            dropTargetIndex.value === index
              ? dropPosition.value === 'before'
                ? 'is-drop-before'
                : 'is-drop-after'
              : '',
          ]
            .filter(Boolean)
            .join(' ')
        : ''
    return h(
      'div',
      {
        key: `array-${listName}-${rowKey}`,
        class: [
          `${typeof node.component === 'string' ? node.component.toLowerCase() : 'array-node'}__row`,
          dndClass,
        ]
          .filter(Boolean)
          .join(' '),
        ...dndProps,
      } as Record<string, unknown>,
      {
        default: () => [
          h('div', { class: 'array-node__row-body' } as Record<string, unknown>, {
            default: () => (inner && !Array.isArray(inner) ? [inner] : (inner as never)),
          }) as VNode,
          h('div', { class: 'array-node__row-actions' } as Record<string, unknown>, {
            // 类型归因：ElButton 与 h() 第一参 union 不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；
            // 运行时已验证 render 正常，TS 层用 as never 兜底。
            default: () =>
              [
                showMove &&
                  h(
                    ElButton as never,
                    {
                      size: 'small',
                      disabled: index === 0,
                      onClick: () => opts.arrayActions?.moveItem(listName, index, index - 1),
                    } as Record<string, unknown>,
                    { default: () => labelUp }
                  ),
                showMove &&
                  h(
                    ElButton as never,
                    {
                      size: 'small',
                      disabled: index >= list.length - 1,
                      onClick: () => opts.arrayActions?.moveItem(listName, index, index + 1),
                    } as Record<string, unknown>,
                    { default: () => labelDown }
                  ),
                showRemove &&
                  h(
                    ElButton as never,
                    {
                      size: 'small',
                      type: 'danger',
                      disabled: list.length <= min,
                      onClick: () => opts.arrayActions?.removeItem(listName, index),
                    } as Record<string, unknown>,
                    { default: () => labelRemove }
                  ),
              ].filter(Boolean) as never,
          }) as VNode,
        ],
      }
    ) as VNode
  }

  return h(
    ElCard as never,
    {
      shadow: 'never',
      class: 'array-node',
      ...(node.props ?? {}),
    } as Record<string, unknown>,
    {
      default: () => [
        h('div', { class: 'array-node__header' } as Record<string, unknown>, {
          default: () =>
            [
              h('span', { class: 'array-node__title' } as Record<string, unknown>, {
                default: () => cfg.title ?? resolveLabel(node.label, opts.t) ?? listName,
              }) as VNode,
              showAdd &&
                h(
                  ElButton as never,
                  {
                    type: 'primary',
                    size: 'small',
                    disabled: list.length >= max,
                    onClick: () => opts.arrayActions?.addItem(listName),
                  } as Record<string, unknown>,
                  { default: () => labelAdd }
                ),
            ].filter(Boolean) as never,
        }) as VNode,
        h('div', { class: 'array-node__body' } as Record<string, unknown>, {
          default: () =>
            list.length === 0
              ? [
                  h('div', { class: 'array-node__empty' } as Record<string, unknown>, {
                    // 引用实际 labelAdd（默认「添加」，可配 labels.add），避免文案与按钮实际文案不一致
                    default: () => `暂无数据，点击上方「${labelAdd}」按钮添加一行`,
                  }) as VNode,
                ]
              : (list.map((row, i) => renderRow(row, i)) as never),
        }) as VNode,
      ],
    }
  ) as VNode
}
