import { onUnmounted, type Ref } from 'vue'

/**
 * sidebar 拖拽调宽：宽度状态由调用方持有（Ref 注入），本 composable 只负责拖拽事件逻辑。
 * 拖拽期间全局禁用文本选中；宽度钳制在 [minWidth, maxWidth]；卸载时自动清理监听。
 */
export function useSidebarDrag(
  width: Ref<number>,
  minWidth: number,
  maxWidth: number
): { onResizerMousedown: (e: MouseEvent) => void } {
  let dragging = false
  let startX = 0
  let startWidth = width.value

  function onMousemove(e: MouseEvent) {
    if (!dragging) return
    const next = startWidth + (e.clientX - startX)
    width.value = Math.min(maxWidth, Math.max(minWidth, next))
  }
  function onMouseup() {
    if (!dragging) return
    dragging = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
  }
  function onResizerMousedown(e: MouseEvent) {
    dragging = true
    startX = e.clientX
    startWidth = width.value
    e.preventDefault()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
  }

  onUnmounted(onMouseup)

  return { onResizerMousedown }
}
