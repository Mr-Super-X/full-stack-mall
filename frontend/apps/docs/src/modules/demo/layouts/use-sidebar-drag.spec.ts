/**
 * useSidebarDrag 单元测试
 * 覆盖：拖拽增量调宽 / min-max 钳制 / mouseup 停止响应 / 外部 Ref 状态注入
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { useSidebarDrag } from './use-sidebar-drag'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

function run(initial = 200, min = 150, max = 400) {
  const width = ref(initial)
  const drag = scope.run(() => useSidebarDrag(width, min, max))!
  return { width, ...drag }
}

function fireMouse(type: 'mousemove' | 'mouseup', clientX: number) {
  document.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
}

function mousedown(handler: (e: MouseEvent) => void, clientX: number) {
  handler(new MouseEvent('mousedown', { clientX }))
}

describe('useSidebarDrag', () => {
  it('mousedown 后 mousemove 按增量调整宽度', () => {
    const { width, onResizerMousedown } = run()
    mousedown(onResizerMousedown, 100)
    fireMouse('mousemove', 150)
    expect(width.value).toBe(250)
  })

  it('宽度钳制在 min~max', () => {
    const { width, onResizerMousedown } = run()
    mousedown(onResizerMousedown, 200)
    fireMouse('mousemove', -1000)
    expect(width.value).toBe(150)
    fireMouse('mousemove', 10000)
    expect(width.value).toBe(400)
  })

  it('mouseup 后不再响应 mousemove', () => {
    const { width, onResizerMousedown } = run()
    mousedown(onResizerMousedown, 100)
    fireMouse('mousemove', 150)
    fireMouse('mouseup', 150)
    fireMouse('mousemove', 300)
    expect(width.value).toBe(250)
  })

  it('外部 Ref 注入：拖拽修改调用方持有的宽度状态', () => {
    const { width, onResizerMousedown } = run(180, 100, 500)
    mousedown(onResizerMousedown, 180)
    fireMouse('mousemove', 220)
    expect(width.value).toBe(220)
  })
})
