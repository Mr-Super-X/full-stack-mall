/**
 * 权限指令 v-auth
 *
 * 用法：
 *   v-auth="'user:edit'"               单权限
 *   v-auth="['user:view','user:edit']" 多权限（AND 语义，全部满足）
 *   v-auth:any="['a','b']"             多权限（ANY 语义，任一满足）
 *   v-auth:disabled 修饰符             无权限时仅禁用，保留元素
 *
 * 实现：
 *  - install 模式（与 inputDebounce / buttonDebounce / permission 一致）
 *  - 调用 useAuth() 取最新权限，自动响应权限变化（store 更新时元素也更新）
 *  - 移除元素不是 el.remove()（彻底删除），而是 el.style.display = 'none'
 *    这样 Vue 响应式系统保留组件实例，切回权限时不需要重新挂载
 *
 * @see [`./permission.ts`](./permission.ts) 旧版权限指令
 * @see [`../../composables/useAuth`](../../composables/useAuth.ts) 权限判断底层
 * @group 指令：权限
 */

import { watchEffect } from 'vue'
import type { App } from 'vue'
import { useAuth } from '../composables/useAuth.ts'
import type { ElHTMLElement, AuthBinding } from './auth.d'

/**
 * 内部校验函数：从 AuthBinding 提取语义判断权限
 *
 * @param binding 指令绑定值
 * @param hasPerm AND 语义校验函数
 * @param hasAnyPerm ANY 语义校验函数
 * @returns true 表示有权限
 */
function checkPermission(
  binding: AuthBinding,
  hasPerm: (codes: readonly string[]) => boolean,
  hasAnyPerm: (codes: readonly string[]) => boolean
): boolean {
  const codes = Array.isArray(binding.value) ? binding.value : [binding.value]
  return binding.modifiers?.any ? hasAnyPerm(codes) : hasPerm(codes)
}

/**
 * 把 AuthBinding 从原生 DirectiveBinding 还原成内部结构。
 *
 * 抽象原因：mounted / updated / watcher 三处都要构造同一份结构（避免漏改）。
 */
function toAuthBinding(binding: {
  value: unknown
  arg?: string
  modifiers?: Partial<Record<string, boolean>>
}): AuthBinding {
  // disabled 既可作为冒号参数（v-auth:disabled，常见写法）也可作为修饰符（v-auth.disabled），
  // 两种写法都视为「无权限时仅禁用」模式。remove 同理兼容：v-auth:remove / v-auth.remove
  const arg = binding.arg ?? ''
  const argLower = arg.toLowerCase()
  const isDisabled = !!binding.modifiers?.disabled || argLower === 'disabled'
  const isRemove = !!binding.modifiers?.remove || argLower === 'remove'
  return {
    value: binding.value as string | string[],
    modifiers: {
      any: argLower === 'any',
      disabled: isDisabled,
      remove: isRemove,
    },
  }
}

/**
 * 无权限展示：根据 modifiers 决定是移除元素（默认）还是仅禁用。
 *
 * - remove / 无修饰符：display:none + aria-hidden=true（彻底从可访问树移除）
 * - disabled：保留 display，仅添加 is-disabled 类 + pointer-events:none + aria-disabled
 *   适用场景：管理员可见但被撤销权限的按钮，「存在但不可操作」
 */
function applyNoAuthDisplay(el: ElHTMLElement, disabled: boolean): void {
  if (disabled) {
    // 保留元素可见，仅禁用交互
    el.classList.add('is-disabled')
    el.setAttribute('aria-disabled', 'true')
    // pointer-events: none 让鼠标穿透；el-button 内部还要禁 native disabled 属性
    el.style.pointerEvents = 'none'
  } else {
    el.style.display = 'none'
    el.setAttribute('aria-hidden', 'true')
  }
}

/**
 * 恢复元素展示：清除所有「无权限」副作用。
 *
 * 反向对应 applyNoAuthDisplay 的两种模式——恢复时无法判断先前是哪种，
 * 所以把 display / pointer-events / class / aria-* 全部清空。
 */
function applyRestore(el: ElHTMLElement): void {
  el.style.display = ''
  el.style.pointerEvents = ''
  el.classList.remove('is-disabled')
  el.removeAttribute('aria-hidden')
  el.removeAttribute('aria-disabled')
}

/**
 * 每次 binding 或权限变化时重新求值并应用。
 *
 * 为什么独立函数：mounted / updated / watchEffect 三处都要执行同一份逻辑；
 * 提取后任何修改仅一处生效，避免漏改造成行为漂移。
 */
function evaluate(el: ElHTMLElement, authBinding: AuthBinding): void {
  const { hasPerm, hasAnyPerm } = useAuth()
  const hasAccess = checkPermission(authBinding, hasPerm, hasAnyPerm)
  if (hasAccess) {
    applyRestore(el)
  } else {
    applyNoAuthDisplay(el, !!authBinding.modifiers?.disabled)
  }
}

/**
 * 指令内部状态（每个绑定元素一份）。
 *
 * - stopWatcher：watchEffect 返回的停止函数；unmounted 时必须调用，否则
 *   即使元素被移除，effect 仍会持续订阅 store.permissions，造成内存泄漏。
 * - getBinding：闭包返回「当前最新」的 AuthBinding；updated 时整体替换，
 *   保证 binding.value / modifiers 变化也能被响应（不需要 binding 自身引用）。
 */
interface AuthContext {
  stopWatcher: () => void
  getBinding: () => AuthBinding
}
const ctxMap = new WeakMap<ElHTMLElement, AuthContext>()

export default {
  install(app: App): void {
    app.directive<ElHTMLElement, AuthBinding['value']>('auth', {
      mounted(el, binding) {
        const currentBinding = toAuthBinding(binding)
        const ctx: AuthContext = {
          getBinding: () => currentBinding,
          stopWatcher: () => {
            /* 占位，mount 末尾覆盖 */
          },
        }
        ctxMap.set(el, ctx)

        // watchEffect 同时订阅 binding.value 与 store.permissions：
        //  - binding 自身变化（updated 钩子会重写 currentBinding）
        //  - store 权限变化（用户切换角色 / token 刷新）
        // 任一变化触发 effect → evaluate(el, currentBinding) 重新求值
        const stop = watchEffect(() => {
          // 读取 binding.value 建立依赖；store.permissions 已在 useAuth 内被 storeToRefs 暴露，
          // 调用 hasPerm 时会隐式收集。这里再显式 touch 一次以防后续 useAuth 实现变更
          void currentBinding.value
          evaluate(el, currentBinding)
        })
        ctx.stopWatcher = stop
      },
      updated(el, binding) {
        const ctx = ctxMap.get(el)
        if (!ctx) return
        // 整体替换 currentBinding；下次 watchEffect 触发即读到新 binding
        ctx.getBinding = () => toAuthBinding(binding)
        // 立刻同步一次：watchEffect 依赖收集可能异步触发，不能等下次变化
        evaluate(el, toAuthBinding(binding))
      },
      unmounted(el) {
        const ctx = ctxMap.get(el)
        if (ctx) {
          ctx.stopWatcher()
          ctxMap.delete(el)
        }
      },
    })
  },
}
