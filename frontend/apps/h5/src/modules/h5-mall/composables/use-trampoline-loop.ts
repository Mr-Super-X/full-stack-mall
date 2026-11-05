// 通用 rAF 步进循环（Trampoline Tabbar 渲染驱动子 Hook）。
//
// 结构裁决：
//   - 帧间隔 dt 秒、clamp ≤0.034s（spec §6：防后台切回大步长爆炸）；
//   -  settled 谓词满足即自动停循环（idle 静态不空转，60fps 仅存在于动画期间）；
//   - 卸载自动 cancelAnimationFrame（Vue 规范：副作用必须清理）。

/** dt 上限（秒）：后台切回时单帧步长钳制（spec §6） */
export const RAF_DT_MAX = 0.034

export interface RafLoop {
  /** 启动循环（已在运行时为幂等空操作） */
  start: () => void
  /** 立即停循环（卸载兜底；正常路径由 settled 谓词自动停） */
  stop: () => void
  /** 是否在运行（测试断言用） */
  readonly running: () => boolean
}

/**
 * @param tick 每帧物理/渲染推进（dt 秒；dt=0 的帧不调用）
 * @param isSettled 静止判据：tick + 渲染后满足即停循环
 */
export function useRafLoop(tick: (dt: number) => void, isSettled: () => boolean): RafLoop {
  let raf = 0
  let running = false
  let last = 0

  function frame(now: number): void {
    const dt = Math.min(Math.max((now - last) / 1000, 0), RAF_DT_MAX)
    last = now
    if (dt > 0) tick(dt)
    if (isSettled()) {
      running = false
      return
    }
    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  onUnmounted(stop)

  return { start, stop, running: () => running }
}
