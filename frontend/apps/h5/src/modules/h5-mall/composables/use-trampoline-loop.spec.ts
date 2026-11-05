import { describe, expect, it, vi } from 'vitest'

import { useRafLoop } from './use-trampoline-loop'

/** 接管 rAF 与 performance.now：手动 flush 帧，虚拟时间受控（避免真实 16ms 等待） */
function mockRaf() {
  let virtualNow = 0
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('performance', { now: () => virtualNow })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames.length = 0
  })
  return {
    /** 推进一帧（16ms）并执行已排队回调 */
    flush() {
      virtualNow += 16
      const cbs = frames.splice(0)
      cbs.forEach((cb) => cb(virtualNow))
    },
  }
}

describe('useRafLoop', () => {
  it('start 后按帧驱动 tick（dt≈16ms）', () => {
    const { flush } = mockRaf()
    const dts: number[] = []
    const loop = useRafLoop(
      (dt) => dts.push(dt),
      () => false
    )
    loop.start()
    flush()
    flush()
    expect(dts).toHaveLength(2)
    expect(dts[0]).toBeCloseTo(0.016, 3)
  })

  it('settled 满足后自动停循环（不再排帧）', () => {
    const { flush } = mockRaf()
    let settled = false
    let ticks = 0
    const loop = useRafLoop(
      () => {
        ticks += 1
        settled = true
      },
      () => settled
    )
    loop.start()
    flush()
    expect(ticks).toBe(1)
    expect(loop.running()).toBe(false)
    flush()
    expect(ticks).toBe(1) // 已停，不再 tick
  })

  it('start 幂等（运行中重复调用不叠加帧）', () => {
    const { flush } = mockRaf()
    let ticks = 0
    const loop = useRafLoop(
      () => {
        ticks += 1
      },
      () => false
    )
    loop.start()
    loop.start()
    flush()
    expect(ticks).toBe(1)
    loop.stop()
  })
})
