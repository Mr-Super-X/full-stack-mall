/**
 * useResetOnClose —— 弹窗关闭后延时重置表单 + 生命周期清理
 *
 * 关键点:
 * 1. 重置时序:ProDialog 未暴露 closed 事件(动画结束后),用 setTimeout(reset, 300) 模拟。
 *    此时 el-dialog 已 display:none,重置只更新响应式数据,下次打开是空白表单无闪烁。
 * 2. 生命周期清理:组件卸载时若 timer 仍在等待,必须 clearTimeout,避免访问已卸载的 ref。
 * 3. 重入保护:短时间内多次触发 close 时清理已有 timer,不堆积多次 reset。
 *
 * @see [`../ProDialogForm.vue`](../ProDialogForm.vue) 消费方
 * @group 通用组件:ProDialogForm
 */
import { onUnmounted } from 'vue'
import type { XFormExpose } from '../../../form-schema/types.ts'

/** EP 默认 dialog 关闭动画时长(ms)—— 此值需与 EP 版本同步 */
const CLOSE_ANIMATION_DURATION_MS = 300

export interface UseResetOnCloseOptions {
  /** 取 XForm 实例的 getter */
  formRef: () => XFormExpose | null | undefined
  /** 取 resetOnClose 开关的 getter */
  resetOnClose: () => boolean
  /** 执行重置的回调(直接调用 ref.resetFields) */
  onReset: (ref: XFormExpose) => void
}

export interface UseResetOnCloseReturn {
  /** 绑定到 ProDialog 的 @close 事件 */
  handleClose: () => void
}

export function useResetOnClose(options: UseResetOnCloseOptions): UseResetOnCloseReturn {
  const { formRef, resetOnClose, onReset } = options

  // timer 句柄:保存以便 onUnmounted 清理,避免卸载后访问已置空的 ref
  let closeResetTimer: ReturnType<typeof setTimeout> | null = null

  function handleClose(): void {
    if (!resetOnClose()) return
    if (!formRef()) return

    // 重入保护:短时间内多次触发 close 时清理已有 timer
    if (closeResetTimer !== null) {
      clearTimeout(closeResetTimer)
    }
    closeResetTimer = setTimeout(() => {
      closeResetTimer = null
      const r = formRef()
      if (r) onReset(r)
    }, CLOSE_ANIMATION_DURATION_MS)
  }

  // 生命周期清理 —— 组件卸载时若 timer 仍在等待,必须清理
  onUnmounted(() => {
    if (closeResetTimer !== null) {
      clearTimeout(closeResetTimer)
      closeResetTimer = null
    }
  })

  return { handleClose }
}
