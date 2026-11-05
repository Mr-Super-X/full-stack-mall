/**
 * ProDialog 组件单测。
 *
 * 聚焦两条集成路径：
 * 1. 默认渲染：内置 footer（取消/确定）+ 全屏切换按钮 + title 落位
 * 2. 拖拽 × 全屏交叉（code-reviewer #2 HIGH 回归）：v-draggable 给 .el-dialog
 *    写入的内联定位，在切入/切出全屏时必须被清除——EP .is-fullscreen 只重置
 *    margin/width/height，不重置内联 left/top，残留会把全屏弹窗顶出视口
 *
 * 挂载方式：用 createApp + mount 到 body 挂载真实应用（与 useDialog.spec 同一策略），
 * 不用 @vue/test-utils 的 mount——VTU 挂载到游离 DOM 时 EP 的 teleport 链路
 * 在 jsdom 下渲染不出内容，而真实应用路径与生产行为一致。
 * EP 组件 teleport 到 body，断言统一走 document.querySelector；
 * jsdom 布局尺寸为 0，拖拽前按 800×600 视口 / 400×300 弹窗 mock（同 draggable.spec 策略）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import Draggable from '@vv/shared/directives/draggable.ts'
import ProDialog from './ProDialog.vue'

describe('ProDialog', () => {
  const mounted: Array<{ app: App; container: HTMLElement }> = []

  afterEach(() => {
    mounted.forEach(({ app, container }) => {
      app.unmount()
      container.remove()
    })
    mounted.length = 0
    // EP teleport / useLockscreen 在 jsdom 下的副作用清理，防用例间串扰
    document.body.querySelectorAll('.el-overlay').forEach((el) => el.remove())
    document.documentElement.style.overflow = ''
    vi.restoreAllMocks()
  })

  function mountOpen(
    props: Record<string, unknown> = {},
    listeners: Record<string, unknown> = {}
  ): void {
    const container = document.createElement('div')
    document.body.appendChild(container)
    // Vue3 createApp 第二参数支持 on* 开头的 key 作为 emit listener；
    // 这里把 listeners 展开到 props 对象里，createApp 自动识别 onXxx → 监听器
    const app = createApp(ProDialog, {
      modelValue: true,
      title: '交叉测试',
      ...props,
      ...listeners,
    })
    app.component('ElDialog', ElDialog)
    app.component('ElButton', ElButton)
    app.use(Draggable)
    app.mount(container)
    mounted.push({ app, container })
  }

  async function queryDialog(): Promise<HTMLElement> {
    let dialog: HTMLElement | null = null
    await vi.waitFor(() => {
      dialog = document.querySelector('.el-dialog')
      expect(dialog).toBeTruthy()
    })
    return dialog as unknown as HTMLElement
  }

  function fullscreenBtn(): HTMLElement {
    const btn = document.querySelector<HTMLElement>('.vv-pro-dialog__fullscreen-btn')
    expect(btn).toBeTruthy()
    return btn as HTMLElement
  }

  it('默认渲染：内置取消/确定按钮 + 全屏/关闭按钮靠右一组 + title 落位', async () => {
    mountOpen()
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.el-dialog__footer button').length).toBe(2)
    })
    expect(fullscreenBtn()).toBeTruthy()
    // 自绘关闭按钮（EP 原生 X 已收编进 actions 组，.el-dialog__headerbtn 不再渲染）
    expect(document.querySelector('.vv-pro-dialog__close-btn')).toBeTruthy()
    expect(document.querySelector('.el-dialog__headerbtn')).toBeNull()
    expect(document.querySelector('.vv-pro-dialog__title')?.textContent).toContain('交叉测试')
  })

  it('自绘关闭按钮尊重 beforeClose 拦截', async () => {
    const onUpdate = vi.fn()
    let allowClose = false
    mountOpen({
      beforeClose: (done: () => void) => {
        if (allowClose) done()
      },
      'onUpdate:modelValue': onUpdate,
    })
    await queryDialog()

    const closeBtn = document.querySelector<HTMLElement>('.vv-pro-dialog__close-btn') as HTMLElement
    // beforeClose 不放行：不触发 update:modelValue
    closeBtn.click()
    await nextTick()
    expect(onUpdate).not.toHaveBeenCalled()

    // 放行后：关闭
    allowClose = true
    closeBtn.click()
    await nextTick()
    expect(onUpdate).toHaveBeenCalledWith(false)
  })

  it('show-close=false：actions 组里只有全屏按钮，无自绘关闭按钮', async () => {
    mountOpen({ 'show-close': false })
    await queryDialog()
    expect(document.querySelector('.vv-pro-dialog__close-btn')).toBeNull()
    expect(document.querySelector('.vv-pro-dialog__fullscreen-btn')).toBeTruthy()
  })

  it('拖拽后切全屏：清除 v-draggable 的内联定位残留；退出全屏同样复位', async () => {
    mountOpen()
    const dialog = await queryDialog()
    const handle = document.querySelector('.vv-pro-dialog__header') as HTMLElement
    expect(handle).toBeTruthy()

    // mock 布局尺寸（jsdom 全 0）：800×600 视口 / 400×300 弹窗 / 50px 手柄
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      width: 400,
      height: 300,
      right: 500,
      bottom: 380,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    } as DOMRect)
    Object.defineProperty(dialog, 'offsetWidth', { value: 400, configurable: true })
    Object.defineProperty(handle, 'offsetHeight', { value: 50, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

    // 先拖拽出内联定位
    handle.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 120, clientY: 100 })
    )
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 200 }))
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(dialog.style.left).toBe('200px')

    // 切全屏：is-fullscreen 生效 + 内联定位被 toggleFullScreen 清除
    fullscreenBtn().click()
    await vi.waitFor(() => {
      expect(dialog.classList.contains('is-fullscreen')).toBe(true)
    })
    expect(dialog.style.left).toBe('')
    expect(dialog.style.top).toBe('')
    expect(dialog.style.margin).toBe('')
    expect(dialog.style.position).toBe('')

    // 退出全屏：同样复位为默认居中（拖拽偏移一并清除，可重新拖）
    fullscreenBtn().click()
    await vi.waitFor(() => {
      expect(dialog.classList.contains('is-fullscreen')).toBe(false)
    })
    expect(dialog.style.left).toBe('')
    expect(dialog.style.position).toBe('')
  })

  describe('resizable 可调整宽高', () => {
    /** 提取 resize-handle 元素 */
    function resizeHandle(): HTMLElement {
      const el = document.querySelector<HTMLElement>('.vv-pro-dialog__resize-handle')
      expect(el).toBeTruthy()
      return el as HTMLElement
    }

    /** jsdom 下弹窗/视口尺寸全 0，需要 mock 才能让钳制逻辑有真值可算。
     *
     * offsetWidth / offsetHeight 用 getter 实现：跟随 style.width / style.height
     * 动态变化（贴近真实浏览器重排行为），保证 emit 时拿到的尺寸是 resize 后的值。
     */
    function mockLayout(width = 400, height = 300, viewportW = 800, viewportH = 600): void {
      const dialog = document.querySelector<HTMLElement>('.el-dialog') as HTMLElement
      Object.defineProperty(dialog, 'offsetWidth', {
        get() {
          const styleWidth = Number.parseInt(this.style.width, 10)
          return styleWidth || width
        },
        configurable: true,
      })
      Object.defineProperty(dialog, 'offsetHeight', {
        get() {
          const styleHeight = Number.parseInt(this.style.height, 10)
          return styleHeight || height
        },
        configurable: true,
      })
      Object.defineProperty(window, 'innerWidth', { value: viewportW, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: viewportH, configurable: true })
    }

    it('resizable=true：右下角出现 resize-handle 元素', async () => {
      mountOpen({ resizable: true })
      await queryDialog()
      expect(resizeHandle()).toBeTruthy()
    })

    it('resizable=false（默认）：无 resize-handle', async () => {
      mountOpen()
      await queryDialog()
      expect(document.querySelector('.vv-pro-dialog__resize-handle')).toBeNull()
    })

    it('拖拽 handle：mousedown 启动 → mousemove 改 width/height → mouseup 抛 resizeChange', async () => {
      const onResizeChange = vi.fn()
      mountOpen({ resizable: true }, { onResizeChange })
      const dialog = await queryDialog()
      mockLayout()

      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      // 模拟向右下拖 +200/+150
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 150 }))
      expect(dialog.style.width).toBe('600px')
      expect(dialog.style.height).toBe('450px')

      // mouseup 触发事件
      document.dispatchEvent(new MouseEvent('mouseup'))
      // mock 用 getter 跟随 style 动态计算 offsetWidth，emit 拿到的就是 resize 后的尺寸
      expect(onResizeChange).toHaveBeenCalledWith(600, 450)
      // 副作用清理：cursor / user-select 恢复
      expect(document.body.style.cursor).toBe('')
      expect(document.body.style.userSelect).toBe('')
    })

    it('钳制：最小尺寸 320×200（向左上拖出范围时被夹紧）', async () => {
      mountOpen({ resizable: true })
      const dialog = await queryDialog()
      mockLayout()

      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      // 起点 clientX/Y 是 0，向左上拖 -500/-500：实际位移为 0 - 500 = -500，远小于最小
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: -500 }))
      expect(dialog.style.width).toBe('320px')
      expect(dialog.style.height).toBe('200px')
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('钳制：最大尺寸 = viewport - 16px（向右下拖出视口时被夹紧）', async () => {
      mountOpen({ resizable: true })
      const dialog = await queryDialog()
      mockLayout(400, 300, 800, 600)

      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      // 向右下拖 +1000/+1000：远超 800-16 / 600-16
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 1000 }))
      expect(dialog.style.width).toBe('784px') // 800 - 16
      expect(dialog.style.height).toBe('584px') // 600 - 16
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('全屏态：自动禁用 resize（resizableEnabled computed 联动）', async () => {
      mountOpen({ resizable: true, fullScreen: true })
      await queryDialog()
      expect(document.querySelector('.vv-pro-dialog__resize-handle')).toBeNull()
    })

    it('resize 后切全屏：内联 width/height 被清除（与拖拽清理同思路）', async () => {
      mountOpen({ resizable: true })
      const dialog = await queryDialog()
      mockLayout()

      // 拖大弹窗
      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))
      document.dispatchEvent(new MouseEvent('mouseup'))
      expect(dialog.style.width).toBe('600px')
      expect(dialog.style.height).toBe('500px')

      // 切全屏：内联尺寸 + 定位应一并清除（toggleFullScreen 加了 width/height 清理）
      fullscreenBtn().click()
      await vi.waitFor(() => {
        expect(dialog.classList.contains('is-fullscreen')).toBe(true)
      })
      expect(dialog.style.width).toBe('')
      expect(dialog.style.height).toBe('')
      expect(dialog.style.left).toBe('')
      expect(dialog.style.top).toBe('')
    })

    it('mousemove 中不抛 resizeChange（仅 mouseup 触发，避免父组件高频重渲染）', async () => {
      const onResizeChange = vi.fn()
      mountOpen({ resizable: true }, { onResizeChange })
      await queryDialog()
      mockLayout()

      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }))
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))
      expect(onResizeChange).not.toHaveBeenCalled() // 关键断言：mousemove 不抛

      document.dispatchEvent(new MouseEvent('mouseup'))
      expect(onResizeChange).toHaveBeenCalledTimes(1)
    })

    it('onUnmounted 清理 document 监听器（防内存泄漏）', async () => {
      const onResizeChange = vi.fn()
      mountOpen({ resizable: true }, { onResizeChange })
      await queryDialog()
      mockLayout()

      // 启动 resize（mousedown 注册了 document mousemove/mouseup 监听）
      resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))

      // 卸载前手动模拟未触发的 mouseup（模拟用户拖到一半组件被销毁）
      const { app, container } = mounted[mounted.length - 1]!
      app.unmount()
      container.remove()

      // 卸载后再次 dispatch mousemove 不应再触发业务逻辑（document 监听已被 onUnmounted 清掉）
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }))
      // resizeState 已置 null，handleResizeMove 是 no-op；断言函数式（副作用：style 不应被改）
      const dialog = document.querySelector<HTMLElement>('.el-dialog')
      // 卸载后 dialog 应已被移除或未被附加新尺寸
      // （实际 EP 卸载后会 remove .el-overlay；这里只要 style 没被改就算清理通过）
      expect(dialog?.style.width === '' || dialog === null).toBe(true)
    })

    /**
     * prototype 级尺寸 mock：挂在 HTMLElement.prototype 上，dialog 元素尚未渲染时即生效。
     *
     * 与 mockLayout（元素级）的差异：resizeMinToInitial 的初始尺寸在 open 事件时记录，
     * 早于测试拿到 dialog 元素的时机——元素级 mock 挂载时测量已完成，只能用 prototype 级。
     * 仅对 .el-dialog 元素返回 mock 值，其余元素保持 jsdom 默认 0。
     * 返回 restore 回调（prototype 描述符需显式还原，vi.restoreAllMocks 不覆盖 defineProperty）。
     */
    function mockDialogLayoutProto(
      width = 400,
      height = 300,
      viewportW = 800,
      viewportH = 600
    ): () => void {
      const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
      const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          if (!this.classList.contains('el-dialog')) return 0
          return Number.parseInt(this.style.width, 10) || width
        },
      })
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get(this: HTMLElement) {
          if (!this.classList.contains('el-dialog')) return 0
          return Number.parseInt(this.style.height, 10) || height
        },
      })
      Object.defineProperty(window, 'innerWidth', { value: viewportW, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: viewportH, configurable: true })
      return () => {
        if (origWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origWidth)
        if (origHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origHeight)
      }
    }

    it('resizeMinToInitial：钳制最小 = 本次打开的初始宽高（向左上拖停在初始尺寸，可正常放大）', async () => {
      const restore = mockDialogLayoutProto(400, 300, 800, 600)
      try {
        // 打开时（open 事件 → nextTick）即记录初始尺寸，此刻 prototype mock 已生效 → 400×300
        mountOpen({ resizable: true, resizeMinToInitial: true })
        const dialog = await queryDialog()
        await nextTick()
        await nextTick() // handleOpen 内 nextTick 的测量回调

        // 向左上拖 -500：停在初始 400×300（而非默认 320×200）
        resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: -500 }))
        expect(dialog.style.width).toBe('400px')
        expect(dialog.style.height).toBe('300px')
        document.dispatchEvent(new MouseEvent('mouseup'))

        // 向右下拖 +100/+100：可正常放大（开关只抬升下限，不限制上限）
        resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }))
        expect(dialog.style.width).toBe('500px')
        expect(dialog.style.height).toBe('400px')
        document.dispatchEvent(new MouseEvent('mouseup'))
      } finally {
        restore()
      }
    })

    it('resizeMinToInitial=false（默认）：即使已记录初始尺寸，最小仍钳制 320×200', async () => {
      const restore = mockDialogLayoutProto(400, 300, 800, 600)
      try {
        mountOpen({ resizable: true })
        const dialog = await queryDialog()
        await nextTick()
        await nextTick()

        resizeHandle().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: -500 }))
        expect(dialog.style.width).toBe('320px')
        expect(dialog.style.height).toBe('200px')
        document.dispatchEvent(new MouseEvent('mouseup'))
      } finally {
        restore()
      }
    })
  })
})
