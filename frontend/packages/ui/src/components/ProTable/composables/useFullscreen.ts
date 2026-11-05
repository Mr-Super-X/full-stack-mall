/**
 * useFullscreen —— ProTable 全屏切换（v3.1 新增；v3.1.1 review 重构）。
 *
 * 角色：表格容器级全屏状态管理。采用 CSS fixed 遮罩方案（而非 Fullscreen API）：
 * - 优点：跨浏览器行为一致；z-index 层级可控；退出方式多样（按钮 / Esc / 编排层程序化）
 * - 配合 ProTable.vue 根容器 `is-fullscreen` class（position: fixed; inset: 0）
 *
 * v3.1.1 review 修复：
 * - 原实现用 `watch(isFullscreen, { flush: 'sync' })` 注册 Esc 监听器，是反模式
 *   （副作用与状态变更不在同一处 + flush: 'sync' 是修竞态症状而非根因）
 * - 改为在 toggle/exit 内显式 add/removeEventListener，命令式副作用与响应式状态分离
 *
 * Esc 退出：全屏激活时挂载 keydown 监听；激活期间按 Esc → 状态变 false + 立即摘除监听。
 *
 * @see [`../ProTable.vue`](../ProTable.vue) 编排层 —— 唯一调用方
 * @group ProTable composables
 */
import { ref, onScopeDispose, type Ref } from 'vue'

export interface UseFullscreenReturn {
  isFullscreen: Ref<boolean>
  toggleFullscreen: () => void
  exitFullscreen: () => void
}

export function useFullscreen(): UseFullscreenReturn {
  const isFullscreen = ref(false)

  /** Esc 退出 —— 仅在全屏激活期间挂载；按下 Esc 同步把状态置 false 并摘监听，避免下次切换再触发 */
  function handleEsc(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      isFullscreen.value = false
      window.removeEventListener('keydown', handleEsc)
    }
  }

  /** 挂载 / 摘除 Esc 监听 —— 显式副作用，与状态变更同一处 */
  function attachEscListener(): void {
    window.addEventListener('keydown', handleEsc)
  }
  function detachEscListener(): void {
    window.removeEventListener('keydown', handleEsc)
  }

  function toggleFullscreen(): void {
    isFullscreen.value = !isFullscreen.value
    // 副作用与状态变更在同一处：toggle 完成后立即挂载或摘除监听器，
    // 避免原 watch + flush: 'sync' 的"等渲染前再挂载"竞态
    if (isFullscreen.value) attachEscListener()
    else detachEscListener()
  }

  function exitFullscreen(): void {
    isFullscreen.value = false
    detachEscListener()
  }

  // 组件卸载兜底：激活态下卸载会泄漏 window 监听（路由跳走场景）
  onScopeDispose(() => {
    detachEscListener()
  })

  return { isFullscreen, toggleFullscreen, exitFullscreen }
}
