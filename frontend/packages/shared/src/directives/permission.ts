/**
 * 权限控制指令 v-permission
 *
 * 用法：
 *   v-permission="'user:edit'"               单权限
 *   v-permission="['user:view','user:edit']" 多权限（AND 语义，全部满足）
 *   v-permission:any="['a','b']"             多权限（ANY 语义，任一满足）
 *
 * 与 v-auth 区别：
 *  - v-permission 是早期指令，专为按钮设计；行为更简单：仅做"移除"或"禁用"切换
 *  - v-auth 是 P0-4 阶段推出的统一权限指令，支持更多修饰符组合
 *  - 推荐新代码用 v-auth；v-permission 保留以兼容已有调用
 *
 * 实现：
 *  - install 模式（与 v-auth / inputDebounce / buttonDebounce 一致）
 *  - 调用 useAuth() 实时读取权限；权限变化时通过 updated 钩子重新判断
 *  - 默认行为：无权限时 display: none（与 v-auth remove 模式一致）
 *
 * @see [`./auth.ts`](./auth.ts) 统一权限指令
 * @see [`../../composables/useAuth`](../../composables/useAuth.ts) 权限判断底层
 * @group 指令：权限
 */

import { watchEffect } from 'vue'
import type { App } from 'vue'
import { useAuth } from '../composables/useAuth.ts'
import type { ElHTMLElement, PermissionBinding } from './permission.d'

/**
 * 内部：根据 binding 提取权限码数组并按修饰符判断。
 */
function checkPermission(
  binding: PermissionBinding,
  hasPerm: (codes: readonly string[]) => boolean,
  hasAnyPerm: (codes: readonly string[]) => boolean
): boolean {
  const codes = Array.isArray(binding.value) ? binding.value : [binding.value]
  return binding.arg === 'any' ? hasAnyPerm(codes) : hasPerm(codes)
}

/**
 * 应用无权限展示（display: none + aria-hidden）。
 */
function applyNoPermissionDisplay(el: ElHTMLElement): void {
  el.style.display = 'none'
  el.setAttribute('aria-hidden', 'true')
}

/**
 * 恢复元素展示（清空 display 与 aria-hidden）。
 */
function applyRestore(el: ElHTMLElement): void {
  el.style.display = ''
  el.removeAttribute('aria-hidden')
}

/**
 * 每次 binding 或权限变化时重新求值并应用。
 *
 * 为什么独立函数：mounted / updated / watchEffect 三处都要执行同一份逻辑；
 * 提取后任何修改仅一处生效，避免漏改造成行为漂移。
 */
function evaluate(el: ElHTMLElement, permissionBinding: PermissionBinding): void {
  const { hasPerm, hasAnyPerm } = useAuth()
  if (checkPermission(permissionBinding, hasPerm, hasAnyPerm)) {
    applyRestore(el)
  } else {
    applyNoPermissionDisplay(el)
  }
}

/**
 * 指令内部状态（每个绑定元素一份）。
 *
 * - stopWatcher：watchEffect 返回的停止函数；unmounted 时必须调用，否则
 *   即使元素被移除，effect 仍会持续订阅 store.permissions，造成内存泄漏。
 * - getBinding：闭包返回「当前最新」的 PermissionBinding；updated 时整体替换，
 *   保证 binding.value / arg 变化也能被响应（不需要 binding 自身引用）。
 */
interface PermissionContext {
  stopWatcher: () => void
  getBinding: () => PermissionBinding
}
const ctxMap = new WeakMap<ElHTMLElement, PermissionContext>()

export default {
  install(app: App) {
    app.directive<ElHTMLElement, PermissionBinding['value']>('permission', {
      mounted(el, binding) {
        const currentBinding: PermissionBinding = {
          value: binding.value as string | string[],
          arg: binding.arg,
        }
        const ctx: PermissionContext = {
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
          // 读取 binding.value 建立依赖；store.permissions 通过 useAuth().hasPerm 隐式收集
          void currentBinding.value
          evaluate(el, currentBinding)
        })
        ctx.stopWatcher = stop
      },
      updated(el, binding) {
        const ctx = ctxMap.get(el)
        if (!ctx) return
        // 整体替换 currentBinding；下次 watchEffect 触发即读到新 binding
        ctx.getBinding = () => ({
          value: binding.value as string | string[],
          arg: binding.arg,
        })
        // 立刻同步一次：watchEffect 依赖收集可能异步触发，不能等下次变化
        evaluate(el, {
          value: binding.value as string | string[],
          arg: binding.arg,
        })
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
