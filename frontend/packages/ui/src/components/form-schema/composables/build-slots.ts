/**
 * 插槽构造与组件 props 默认值：children 多态归一化、slot → 渲染函数、
 * Upload 触发区默认内容（picture-card / drag / text-picture）、Upload tip 字符串自动包
 * el-upload__tip、按组件名注入默认 props、构造 Autocomplete 异步选项 props。
 *
 * @group 表单编排：渲染
 */
import { h, type VNode } from 'vue'
import { ElButton, ElIcon, ElUpload } from 'element-plus'
import { Plus, UploadFilled } from '@element-plus/icons-vue'
import { createNamespace } from '@vv/shared'
import type { SchemaNode, SchemaSlot } from '../types'
import { isElUpload, isPictureCardUpload, isDragUpload } from './resolve-component'
import { buildAutocompleteFetcher } from './use-async-options'

type RenderFn = (
  node: SchemaNode | SchemaNode[] | string | undefined | null
) => VNode | string | VNode[] | undefined

const bem = createNamespace('x-form') // 与 XForm.vue 同一 block，保证注入的类名落在 XForm 命名空间下
const UPLOAD_ICON_CLASS = {
  pictureCard: [bem.e('upload-icon'), bem.em('upload-icon', 'picture-card')].join(' '),
  drag: ['el-icon--upload', bem.e('upload-icon'), bem.em('upload-icon', 'drag')].join(' '),
}
const UPLOAD_DRAG_TEXT_CLASS = ['el-upload__text', bem.e('upload-text')].join(' ')
const UPLOAD_BUTTON_CLASS = bem.e('upload-button')

/** renderChildren —— children 多多态归一化（string / SchemaNode / SchemaNode[]） */
export function renderChildren(
  children: SchemaNode['children'],
  render: RenderFn
): VNode | string | VNode[] | undefined {
  if (children === undefined) return undefined
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(render) as VNode[]
  return render(children)
}

/** buildSlotFn —— slot 值 → 渲染函数（统一 function / 字符串 / SchemaNode） */
export function buildSlotFn(value: SchemaSlot, render: RenderFn): (scope?: unknown) => unknown {
  if (typeof value === 'function') {
    return (scope?: unknown) => value(scope as Record<string, unknown>)
  }
  // 字符串 / SchemaNode / SchemaNode[] 统一走 renderChildren，
  // 避免直接调用 renderToComponentInner 处理字符串时返回 undefined
  return () => renderChildren(value as SchemaNode['children'], render)
}

/**
 * 构建 Upload 默认插槽内容。
 * 用户未提供 default slot / children 时按类型注入默认触发区内容：
 * - `listType: 'picture-card'` → `<el-icon><Plus /></el-icon>`
 * - `drag: true` → `<el-icon class="el-icon--upload"><UploadFilled /></el-icon>` + 拖拽提示文案
 * - 其余（text / picture）→ `<el-button>点击上传</el-button>`
 *
 * 为什么 text / picture 也必须兜底：ElUpload 的触发区**就是** default slot 本身
 * （element-plus/upload-content.vue 非 drag 分支直接 `renderSlot($slots, 'default')`，不含任何内置 UI），
 * 插槽为空时 `.el-upload--text` 是零高度空元素 —— 字段看起来没渲染、完全无法交互。
 *
 * 注意 DOM 结构：`el-form-item__content` 下会多出一层无类名的 `<div>`，它是 ElUpload 组件自身的
 * 模板根节点（element-plus/upload.vue 用它收拢 upload-list 与 upload-content 两个兄弟节点），
 * 不是 XForm 的包裹层，也无法从 XForm 侧移除；需要调整该层样式时用 `.el-form-item__content > div` 定位。
 */
export function buildUploadDefaultSlot(
  node: SchemaNode,
  Comp: unknown,
  render: RenderFn
): () => VNode | string | VNode[] | undefined {
  return () => {
    // 用户已自定义默认插槽时优先使用，不覆盖
    if (node.slots?.default !== undefined) {
      // 统一用 buildSlotFn 处理函数 / 字符串 / SchemaNode / SchemaNode[]
      // 类型归因：渲染函数返回 VNode | string | VNode[] | undefined 联合与 Upload slot 期望类型不等价
      // （C1 根因，详见 types/TYPE-CAST-AUDIT.md）；运行时已验证，TS 层用 as never 兜底。
      return buildSlotFn(node.slots.default, render)() as never
    }
    const children = renderChildren(node.children, render) as never
    if (children) return children
    // 用了 slots.trigger 时 ElUpload 把 default 渲染在触发区之外（element-plus/upload.vue:85），
    // 此时再注入默认内容会在触发区旁多出一个孤立按钮/图标
    if (node.slots?.trigger !== undefined) return children
    if (isPictureCardUpload(node, Comp)) {
      return h(
        ElIcon,
        { class: UPLOAD_ICON_CLASS.pictureCard },
        { default: () => h(Plus) }
      ) as VNode
    }
    // drag 排在 picture-card 之后：两者同时开启时卡片触发区仅 148px，
    // UploadFilled 的官方 67px 大图标会溢出，此时保留 Plus 更合适
    if (isDragUpload(node, Comp)) {
      return [
        h(ElIcon, { class: UPLOAD_ICON_CLASS.drag }, { default: () => h(UploadFilled) }),
        h('div', { class: UPLOAD_DRAG_TEXT_CLASS }, '拖拽文件到这里或点击上传'),
      ] as VNode[]
    }
    // text / picture 兜底：触发区为空时字段不可见、不可点（详见函数 JSDoc）
    if (isElUpload(node, Comp)) {
      return h(
        ElButton,
        { class: UPLOAD_BUTTON_CLASS, type: 'primary' },
        { default: () => '点击上传' }
      ) as VNode
    }
    return children
  }
}

/**
 * 构建 Upload 的 tip 插槽内容。
 * 当用户传入字符串时，自动包裹在 <div class="el-upload__tip"> 中，
 * 使字符串 tip 默认获得 Element Plus 的提示文案样式；
 * SchemaNode / 函数形式保持原样，由用户自行控制 wrapper。
 */
export function buildUploadTipSlot(
  value: SchemaSlot,
  render: RenderFn
): (scope?: unknown) => unknown {
  if (typeof value === 'function') {
    return (scope?: unknown) => value(scope as Record<string, unknown>)
  }
  if (typeof value === 'string') {
    return () => h('div', { class: 'el-upload__tip' }, value)
  }
  return () => renderChildren(value as SchemaNode['children'], render)
}

/** 取节点对应组件的默认 props；仅对 string component 生效 */
export function getComponentDefaultProps(
  node: SchemaNode,
  componentProps?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  if (typeof node.component !== 'string') return {}
  return componentProps?.[node.component] ?? {}
}

/**
 * Autocomplete fetcher 缓存：key = asyncOptions 配置引用。
 * B2 实证修正（2026-10-19 浏览器实测）：渲染层每次重渲染都调 buildAsyncProps——原实现
 * 每次新建 fetcher 实例（seq 闭包归零），每次输入都用到 seq=1 的"新"实例，慢响应
 * 全部落地，竞态令牌形同虚设。按配置引用复用后 seq 在同节点生命周期内累计；
 * asyncOptions 整体替换（新引用）自动获得新 fetcher，旧实例随 GC 回收。
 */
const autocompleteFetcherCache = new WeakMap<
  NonNullable<SchemaNode['asyncOptions']>,
  ReturnType<typeof buildAutocompleteFetcher>
>()

/** 构造 Autocomplete 异步选项所需的 props */
export function buildAsyncProps(node: SchemaNode): Record<string, unknown> {
  if (!node.asyncOptions) return {}
  const name = typeof node.component === 'string' ? node.component : null
  if (name !== 'Autocomplete' && name !== 'ElAutocomplete') return {}
  let fetcher = autocompleteFetcherCache.get(node.asyncOptions)
  if (!fetcher) {
    fetcher = buildAutocompleteFetcher(node.asyncOptions)
    autocompleteFetcherCache.set(node.asyncOptions, fetcher)
  }
  return {
    fetchSuggestions: fetcher,
  }
}

/** 抑制未使用导入告警：ElUpload 在 isElUpload 类型守卫中被引用 */
void ElUpload
