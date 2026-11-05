/**
 * 文本复制指令 v-copy —— 全局通用。
 *
 * 用法：
 *   <button v-copy="'hello world'">点击复制</button>
 *   <span   v-copy="() => `订单号: ${order.id}`">点我复制</span>
 *
 * 实现要点：
 *  - 优先 navigator.clipboard.writeText（HTTPS / localhost / file: 等 secure context）
 *  - 降级 document.execCommand('copy')（HTTP 环境 / 旧浏览器 / 现代 API 抛错时）
 *  - ElMessage 全局提示：成功 / 失败 / 内容为空
 *  - 字符串值在 updated 时同步 binding 引用；函数值在点击时实时调用（避免闭包陈旧）
 *
 * 为什么用 WeakMap 存上下文：
 *  - 与 draggable / inputDebounce 范式一致；
 *  - 不污染 DOM 类型声明（不必扩展 HTMLElement 私有字段）；
 *  - 元素被 GC 时 ctx 自动释放，无内存泄漏。
 *
 * 关于全局注册：
 *  - src/directives/index.ts 通过 import.meta.glob 自动扫描本目录所有 .ts 文件
 *    （排除 *.d.ts / *.spec.ts / _*.ts / index.ts 自身），无需在本文件或 main.ts 手动注册；
 *  - main.ts 中的 `app.use(Directives)` 已覆盖全部指令。
 *
 * @see [`./copy.d.ts`](./copy.d.ts) 类型定义
 * @see [`./draggable.ts`](./draggable.ts) 同期 WeakMap 范式参考
 * @see [`./index.ts`](./index.ts) 自动注册入口
 * @group 指令：交互
 */

import type { App, DirectiveBinding } from 'vue'
import { ElMessage } from 'element-plus'
// 与 http.ts / useAppRouter.ts 同约定：显式 import 须自行携带消息样式
import 'element-plus/es/components/message/style/css'
// 指令 hook 无 setup 上下文——toast 文案经 i18n.global.t（2026-10-29，同 http-errors 方案）
import { i18n } from '../locales/index.ts'
import type { CopyValue, ElHTMLElement } from './copy.d'

/**
 * 解析 binding.value 为最终字符串。
 *
 * 函数形式每次点击都会重新调用——若函数返回依赖外部 ref/响应式状态，
 * Vue 的响应式系统会确保读到最新值；这是「避免闭包陈旧」的核心机制。
 */
function resolveCopyValue(value: CopyValue): string {
  return typeof value === 'function' ? value() : value
}

/**
 * 降级复制：textarea + execCommand('copy')。
 *
 * 为什么保留（兼容性降级，重要）：
 *  - HTTP（非 HTTPS / 非 localhost）环境下 `navigator.clipboard === undefined`，
 *    直接走现代 API 会抛 TypeError；
 *  - 部分浏览器（移动端老内核、旧版 Safari）不支持 clipboard API；
 *  - execCommand 虽已被 W3C 标记 deprecated，但仍是当前唯一可靠的降级路径。
 *
 * 关键样式细节（视口外、不可见、不可聚焦）：
 *  - position: fixed + top: 0 + left: 0 + 1×1：放视口外防止页面抖动；
 *  - opacity: 0 + 透明背景：用户视觉感知不到；
 *  - readonly + 阻止默认焦点样式：避免 iOS Safari 选中时弹出软键盘；
 *  - select() + setSelectionRange(0, len)：兼容 iOS（必须用后者才能复制）。
 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.padding = '0'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.boxShadow = 'none'
  textarea.style.background = 'transparent'
  textarea.style.opacity = '0'

  // 记录复制前的活动元素，复制完成后还原焦点——避免破坏页面 Tab 流
  const prevActive = document.activeElement as HTMLElement | null
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let success = false
  try {
    // execCommand 在某些浏览器（如新版 Safari）可能抛 SecurityError，统一捕获
    success = document.execCommand('copy')
  } catch {
    success = false
  }

  document.body.removeChild(textarea)
  // 可选还原：focus 可能再触发滚动，移动端会"跳一下"，故用 ?. 软处理
  prevActive?.focus?.()
  return success
}

/**
 * 现代复制：navigator.clipboard.writeText
 *
 * @returns true 写入成功；false 失败（用户拒绝授权 / 文档失焦 / API 抛错）。
 *          内部 try/catch 已转 false，调用方无需再 try/catch。
 */
async function clipboardCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * 统一复制入口：自动选择现代 API 或降级方案，结束统一 ElMessage 提示。
 *
 * 决策矩阵：
 *  - secure context + clipboard API 可用  → 走 navigator.clipboard.writeText
 *  - secure context + clipboard API 抛错   → 兜底 legacyCopy（罕见，用户拒授权等场景）
 *  - 非 secure context                    → 直接 legacyCopy（HTTP 部署站点的常见情形）
 */
async function handleCopy(text: string): Promise<void> {
  // isSecureContext：HTTPS / localhost / file: 协议返回 true，普通 HTTP 站点返回 false
  const useModernAPI =
    typeof navigator !== 'undefined' && !!navigator.clipboard && !!window.isSecureContext

  let success = false
  if (useModernAPI) {
    success = await clipboardCopy(text)
    if (!success) success = legacyCopy(text) // 兜底：API 存在但调用失败
  } else {
    success = legacyCopy(text)
  }

  if (success) {
    // 指令 hook 无 setup 上下文——toast 文案走 i18n.global.t（同 http-errors 方案——2026-10-29）
    ElMessage.success(i18n.global.t('common.copySuccess'))
  } else {
    ElMessage.error(i18n.global.t('common.copyFailed'))
  }
}

/**
 * 指令内部上下文（每个绑定元素一份）。
 *
 * 设计要点：
 *  - `binding` 字段直接持有 DirectiveBinding 引用：onClick 通过 ctx.binding.value
 *    访问最新值；updated 时整体替换 ctx.binding，无需解绑/重绑事件监听；
 *  - 函数式 value 每次点击实时执行——binding.value 是函数，resolveCopyValue 内调用
 *    函数本身就能拿到当前状态，避免「闭包陈旧」问题。
 */
interface CopyContext {
  /** 当前 binding 引用；updated 时整体替换，让后续点击读到最新 value */
  binding: DirectiveBinding<CopyValue>
  onClick: (event: MouseEvent) => void
}

const ctxMap = new WeakMap<ElHTMLElement, CopyContext>()

/**
 * 创建 click 监听 + ctx 上下文。
 *
 * onClick 通过闭包引用 ctx，TS 严格模式下需先声明 binding 字段再写 onClick；
 * 这里利用对象字面量自引用（JS 允许：onClick 内访问 ctx 时 binding 字段已就绪）。
 */
function createContext(binding: DirectiveBinding<CopyValue>): CopyContext {
  const ctx: CopyContext = {
    binding,
    onClick: () => {
      const text = resolveCopyValue(ctx.binding.value)
      if (!text) {
        // 空字符串 / 函数返回空串：给用户明确提示，避免「点了没反应」的困惑
        ElMessage.warning(i18n.global.t('common.copyEmpty'))
        return
      }
      void handleCopy(text)
    },
  }
  return ctx
}

/**
 * v-copy 指令定义（具名导出供单测直接挂载，无需走 install）。
 */
export const copyDirective = {
  mounted(el: ElHTMLElement, binding: DirectiveBinding<CopyValue>) {
    // 给宿主元素默认指针光标，提示可点击——提升可交互感知（用户原始需求）
    el.style.cursor = 'pointer'

    const ctx = createContext(binding)
    el.addEventListener('click', ctx.onClick)
    ctxMap.set(el, ctx)
  },
  updated(el: ElHTMLElement, binding: DirectiveBinding<CopyValue>) {
    // 字符串 binding 在 updated 时可能变了；函数 binding 无需特殊处理（点击时实时求值）
    // 只需替换 ctx.binding 引用，onClick 闭包下次执行时即读到新 value
    const ctx = ctxMap.get(el)
    if (ctx) ctx.binding = binding
  },
  unmounted(el: ElHTMLElement) {
    // 必须清理事件监听 + WeakMap 引用，否则组件频繁挂/卸载会留下游离监听器
    const ctx = ctxMap.get(el)
    if (ctx) {
      el.removeEventListener('click', ctx.onClick)
      ctxMap.delete(el)
    }
  },
}

export default {
  install(app: App) {
    app.directive<ElHTMLElement, CopyValue>('copy', copyDirective)
  },
}
