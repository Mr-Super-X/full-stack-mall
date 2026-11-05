/**
 * v-draggable 指令单测。
 *
 * 覆盖两层：
 * 1. clampPosition 纯函数：边界数学直接断言（不依赖 DOM 尺寸模拟）
 * 2. 指令行为：jsdom 中 mock getBoundingClientRect / offsetWidth / offsetHeight /
 *    window 视口尺寸，用真实 MouseEvent 走完整 mousedown → mousemove → mouseup 链路
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import Draggable, { clampPosition } from './draggable'

describe('clampPosition', () => {
  it('边界内位置原样返回', () => {
    expect(clampPosition({ left: 100, top: 80 }, { maxLeft: 400, maxTop: 550 })).toEqual({
      left: 100,
      top: 80,
    })
  })

  it('越过上/左边界时钳制为 0', () => {
    expect(clampPosition({ left: -50, top: -20 }, { maxLeft: 400, maxTop: 550 })).toEqual({
      left: 0,
      top: 0,
    })
  })

  it('越过右/下边界时钳制为 maxLeft/maxTop', () => {
    expect(clampPosition({ left: 9999, top: 9999 }, { maxLeft: 400, maxTop: 550 })).toEqual({
      left: 400,
      top: 550,
    })
  })

  it('弹窗比视口大（maxLeft 为负）时兜底为 0，不出现负坐标', () => {
    expect(clampPosition({ left: 100, top: 100 }, { maxLeft: -200, maxTop: -50 })).toEqual({
      left: 0,
      top: 0,
    })
  })
})

describe('v-draggable 指令', () => {
  /** 构造贴近 EP 真实结构的宿主：.el-dialog > .el-dialog__header > 手柄 */
  const Host = defineComponent({
    props: { enabled: { type: Boolean, default: true } },
    template: `
      <div class="el-dialog">
        <div class="el-dialog__header">
          <div v-draggable="enabled" class="handle">标题</div>
        </div>
        <div class="el-dialog__body">内容</div>
      </div>
    `,
  })

  /** jsdom 中布局尺寸全为 0，这里按 800×600 视口、400×300 弹窗 mock；
   *  rect 跟随内联 style 返回——指令每次 mousedown 会重读当前位置作为拖拽原点 */
  function mockLayout(dialog: HTMLElement) {
    const current = () => ({
      left: parseFloat(dialog.style.left) || 100,
      top: parseFloat(dialog.style.top) || 80,
    })
    vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          ...current(),
          width: 400,
          height: 300,
          right: current().left + 400,
          bottom: current().top + 300,
          x: current().left,
          y: current().top,
          toJSON: () => ({}),
        }) as DOMRect
    )
    Object.defineProperty(dialog, 'offsetWidth', { value: 400, configurable: true })
    Object.defineProperty(dialog, 'offsetHeight', { value: 300, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** 模拟一次完整拖拽（注意 MouseEventInit 的坐标字段是 clientX/clientY，x/y 无效） */
  function drag(
    handle: HTMLElement,
    from: { clientX: number; clientY: number },
    to: { clientX: number; clientY: number }
  ) {
    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: from.clientX,
        clientY: from.clientY,
      })
    )
    document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: to.clientX, clientY: to.clientY })
    )
    document.dispatchEvent(new MouseEvent('mouseup'))
  }

  it('按住手柄拖拽：把 margin 定位切换为 left/top 并按位移移动弹窗', () => {
    const wrapper = mount(Host, { global: { plugins: [Draggable] } })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })

    // 位移 +100/+100：left 100→200，top 80→180（均在边界内）
    expect(dialog.style.position).toBe('relative')
    // jsdom 的 CSSStyleDeclaration 会把 '0' 规范化为 '0px'
    expect(dialog.style.margin).toBe('0px')
    expect(dialog.style.left).toBe('200px')
    expect(dialog.style.top).toBe('180px')
  })

  it('拖拽不超出视口边界：右/下缘钳制，整个弹窗留在视口内（不产生 overlay 滚动条）', () => {
    const wrapper = mount(Host, { global: { plugins: [Draggable] } })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    // 起点 (120,100)，拖到极远 (7020,5100)：原始 left=7000/top=5080
    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 7020, clientY: 5100 })

    // maxLeft = 800-400 = 400；maxTop = 600-300 = 300（整个弹窗在视口内）
    expect(dialog.style.left).toBe('400px')
    expect(dialog.style.top).toBe('300px')
  })

  it('连续两次拖拽坐标累计：第二次以上次落点为原点，不跳回初始位置（回归）', () => {
    const wrapper = mount(Host, { global: { plugins: [Draggable] } })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    // 第一次拖拽：+100/+100 → 200/180
    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })
    expect(dialog.style.left).toBe('200px')
    expect(dialog.style.top).toBe('180px')

    // 第二次拖拽：+50/+50 → 250/230。
    // 若原点沿用首次缓存值（100/80），会算出 150/130——弹窗跳回偏移前位置（用户反馈 bug）
    drag(handle, { clientX: 300, clientY: 250 }, { clientX: 350, clientY: 300 })
    expect(dialog.style.left).toBe('250px')
    expect(dialog.style.top).toBe('230px')
  })

  it('内联定位被外部清除（如全屏切换）后拖拽仍正常：自动重新切换定位', () => {
    const wrapper = mount(Host, { global: { plugins: [Draggable] } })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })
    expect(dialog.style.left).toBe('200px')

    // 模拟 ProDialog.toggleFullScreen 清除内联定位（弹窗回到 margin 居中）
    dialog.style.left = ''
    dialog.style.top = ''
    dialog.style.margin = ''
    dialog.style.position = ''

    // 再次拖拽：应检测出定位被重置并重新切换，再按位移移动（rect mock 回 100/80，+100 → 200）
    drag(handle, { clientX: 150, clientY: 150 }, { clientX: 250, clientY: 250 })
    expect(dialog.style.position).toBe('relative')
    expect(dialog.style.left).toBe('200px')
    expect(dialog.style.top).toBe('180px')
  })

  it('绑定值为 false 时禁用拖拽，弹窗位置不动', () => {
    const wrapper = mount(Host, {
      props: { enabled: false },
      global: { plugins: [Draggable] },
    })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })

    expect(dialog.style.left).toBe('')
    expect(dialog.style.top).toBe('')
  })

  it('绑定值动态切换：false → true 后恢复拖拽能力', async () => {
    const wrapper = mount(Host, {
      props: { enabled: false },
      global: { plugins: [Draggable] },
    })
    const dialog = wrapper.find('.el-dialog').element as HTMLElement
    const handle = wrapper.find('.handle').element as HTMLElement
    mockLayout(dialog)

    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })
    expect(dialog.style.left).toBe('')

    // updated 钩子同步开关
    await wrapper.setProps({ enabled: true })
    drag(handle, { clientX: 120, clientY: 100 }, { clientX: 220, clientY: 200 })
    expect(dialog.style.left).toBe('200px')
  })
})
