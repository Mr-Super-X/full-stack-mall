// ref / onScopeDispose 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 轻量 Toast：show(msg) 弹出并自动消失，重复调用重置计时（后者覆盖前者）。
 *
 * 组件卸载时清理挂起的定时器，避免卸载后写已失效的响应式状态。
 *
 * @param duration 展示时长（ms，默认 1800）
 */
export function useToast(duration = 1800): {
  visible: Ref<boolean>
  message: Ref<string>
  show: (msg: string) => void
} {
  const visible = ref(false)
  const message = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(msg: string): void {
    message.value = msg
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, duration)
  }

  onScopeDispose(() => clearTimeout(timer))

  return { visible, message, show }
}
