/**
 * use-current-breakpoint —— 监听 window.innerWidth 变化，返回 element-plus 风格断点
 *
 * 设计：SSR 安全（无 window 时返回 'md' 中位默认值）；onMounted 注册 + onUnmounted 清理；
 * resize 走 100ms 节流（断点 6 档逐帧更新是浪费）。
 *
 * @group 表单编排：响应式
 */
import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { throttle } from 'lodash-es'

/** resize 节流 100ms：断点只有 6 档，逐帧更新浪费 */
const RESIZE_THROTTLE_MS = 100

/** element-plus 标准 5 档断点 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** element-plus 默认断点阈值（与 docs 保持一致） */
const BREAKPOINTS: Array<[Breakpoint, number]> = [
  ['xl', 1920],
  ['lg', 1200],
  ['md', 992],
  ['sm', 768],
]

/** 返回当前断点 ref；SSR 场景返回 'md' 中位默认 */
export function useCurrentBreakpoint(): Ref<Breakpoint> {
  const current = ref<Breakpoint>('md')

  const update = () => {
    if (typeof window === 'undefined') return
    const width = window.innerWidth
    for (const [bp, min] of BREAKPOINTS) {
      if (width >= min) {
        current.value = bp
        return
      }
    }
    // 低于 sm(768px)即 xs
    current.value = 'xs'
  }

  // resize 走节流版；挂载时的首次 update() 保持同步（保证首帧断点正确）
  const throttledUpdate = throttle(update, RESIZE_THROTTLE_MS)

  onMounted(() => {
    update()
    window.addEventListener('resize', throttledUpdate)
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', throttledUpdate)
      throttledUpdate.cancel() // 清掉 trailing 待执行，避免卸载后还写 ref
    }
  })

  return current
}
