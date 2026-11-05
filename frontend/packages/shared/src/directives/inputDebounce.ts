import type { App } from 'vue'
import { debounce, isFunction, findInput, type EventHandler } from './_utils'
import type { ElHTMLElement, InputDebounceBinding } from './inputDebounce.d'

/**
 * v-inputDebounce="onInput"        默认 300ms 防抖
 * v-inputDebounce:500="onInput"    自定义 500ms
 *
 * 实现要点（参考社区最佳实践）：
 * - 中文输入法支持：compositionstart/end 标记 composing 状态，input 事件跳过
 * - 兼容封装组件：通过 findInput BFS 找到子 INPUT 元素（Element Plus 的 el-input 等）
 * - 完整清理：beforeUnmount 移除 input + compositionstart + compositionend 三个监听
 *
 * @see [`./_utils.ts`](./_utils.ts) debounce + findInput 工具
 * @see [`./buttonDebounce.ts`](./buttonDebounce.ts) click 防重指令
 * @group 指令：防抖
 */
interface InputDebounceContext {
  input: HTMLInputElement
  onInput: (e: Event) => void
  onCompositionStart: (e: Event) => void
  onCompositionEnd: (e: Event) => void
}

export default {
  install(app: App) {
    app.directive<ElHTMLElement, InputDebounceBinding['value']>('inputDebounce', {
      mounted(el, binding) {
        const delay = Number(binding.arg) || 300
        if (!isFunction(binding.value)) return

        const input = findInput(el)
        if (!input) return

        // 闭包状态：每个 inputDebounce 实例独立 composing 标志
        let composing = false
        const debounced = debounce(binding.value as EventHandler, delay)

        const onCompositionStart = (): void => {
          composing = true
        }
        const onCompositionEnd = (): void => {
          composing = false
          // 主动派发 input 事件触发防抖（中文输入完成时统一一次回调）
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const onInput = (event: Event): void => {
          if (composing) return
          debounced.call(input, event)
        }

        input.addEventListener('input', onInput)
        input.addEventListener('compositionstart', onCompositionStart)
        input.addEventListener('compositionend', onCompositionEnd)

        // 存引用供 beforeUnmount 清理
        const ctx: InputDebounceContext = {
          input,
          onInput,
          onCompositionStart,
          onCompositionEnd,
        }
        ;(el as ElHTMLElement & { __inputDebounce?: InputDebounceContext }).__inputDebounce = ctx
      },
      beforeUnmount(el) {
        const elExt = el as ElHTMLElement & { __inputDebounce?: InputDebounceContext }
        const ctx = elExt.__inputDebounce
        if (ctx) {
          ctx.input.removeEventListener('input', ctx.onInput)
          ctx.input.removeEventListener('compositionstart', ctx.onCompositionStart)
          ctx.input.removeEventListener('compositionend', ctx.onCompositionEnd)
          delete elExt.__inputDebounce
        }
      },
    })
  },
}
