import type { App } from 'vue'
import { debounce, isFunction } from './_utils'
import type { ElHTMLElement, ButtonDebounceBinding } from './buttonDebounce.d'

/**
 * v-buttonDebounce="onClick"        默认 500ms 防抖
 * v-buttonDebounce:1000="onClick"    自定义 1000ms
 *
 * 实现：trailing edge 防抖（点击后延迟 500ms 才真正调用 handler，期间重复点击会重置计时）。
 * 与 inputDebounce 共用 _utils.debounce 工具，保证项目内行为一致。
 *
 * 与 inputDebounce 区别：
 * - click 事件不涉及中文输入法（无 composition 事件）
 * - 仍然使用 findInput 兼容封装按钮组件（如 el-button 内部真实 click 在子元素）
 * - 完整 beforeUnmount 清理防止内存泄漏
 *
 * @see [`./_utils.ts`](./_utils.ts) debounce 工具
 * @see [`./inputDebounce.ts`](./inputDebounce.ts) input 防抖指令
 * @group 指令：防抖
 */
export default {
  install(app: App) {
    app.directive<ElHTMLElement, ButtonDebounceBinding['value']>('buttonDebounce', {
      mounted(el, binding) {
        const delay = Number(binding.arg) || 500
        if (!isFunction(binding.value)) return

        const handler = debounce(binding.value, delay)
        el.addEventListener('click', handler)

        // 存引用供 beforeUnmount 清理
        ;(
          el as ElHTMLElement & { __buttonDebounceHandler?: (e: Event) => void }
        ).__buttonDebounceHandler = handler
      },
      beforeUnmount(el) {
        const handler = (el as ElHTMLElement & { __buttonDebounceHandler?: (e: Event) => void })
          .__buttonDebounceHandler
        if (handler) {
          el.removeEventListener('click', handler)
          ;(el as ElHTMLElement & { __buttonDebounceHandler?: unknown }).__buttonDebounceHandler =
            undefined
        }
      },
    })
  },
}
