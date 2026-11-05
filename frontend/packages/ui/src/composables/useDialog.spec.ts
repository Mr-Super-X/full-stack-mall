/**
 * useDialog 命令式弹窗单测。
 *
 * 测试策略：通过 setDialogAppContext 注册一个包含 ElDialog / ElButton / v-draggable
 * 的最小应用上下文，模拟「纯 JS 调用」场景（不走 setup），同时天然验证
 * appContext 继承机制——`.el-dialog` 能被渲染出来即证明动态挂载的组件树
 * 拿到了注册的全局上下文（否则 el-dialog 会退化成无法解析的原生标签，
 * header/footer 具名插槽不会渲染，确认按钮根本不存在）。
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import Draggable from '@vv/shared/directives/draggable.ts'
import { DialogCancelledError, setDialogAppContext, useDialog } from './useDialog'

/** 最小内容组件：仅渲染一个可定位的 div */
const Content = defineComponent({
  name: 'TestDialogContent',
  setup: () => () => h('div', { class: 'test-dialog-content' }, '内容体'),
})

beforeAll(() => {
  const app = createApp(defineComponent({ render: () => null }))
  app.component('ElDialog', ElDialog)
  app.component('ElButton', ElButton)
  app.use(Draggable)
  setDialogAppContext(app)
})

afterEach(() => {
  // 兜底：测试中途断言失败时清理残留挂载点，避免污染后续用例
  document.querySelectorAll('[data-pro-dialog-container]').forEach((el) => el.remove())
})

async function waitContent(selector = '.test-dialog-content'): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelector(selector)).toBeTruthy()
  })
}

async function waitContainerGone(): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelector('[data-pro-dialog-container]')).toBeNull()
  })
}

/** 内置 footer 的取消/确定按钮（EP el-button 渲染为 <button>） */
function footerButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.el-dialog__footer button'))
}

describe('useDialog', () => {
  it('open 动态挂载弹窗（含全局上下文），点「确定」resolve 且关闭后容器销毁', async () => {
    const dialog = useDialog(Content, { title: '测试弹窗' })
    const promise = dialog.open()
    await waitContent()

    // .el-dialog / .el-overlay 出现 = ElDialog 通过继承的 appContext 成功解析；
    // 标题在自定义 header（vv-pro-dialog__title）中，EP 默认的 .el-dialog__title 不存在
    expect(document.querySelector('.el-dialog')).toBeTruthy()
    expect(document.querySelector('.el-overlay')).toBeTruthy()
    expect(document.querySelector('.vv-pro-dialog__title')?.textContent).toContain('测试弹窗')
    expect(dialog.isOpen).toBe(true)

    const [, confirmBtn] = footerButtons()
    confirmBtn.click()

    await expect(promise).resolves.toBe(true)
    expect(dialog.isOpen).toBe(false)
    // closed 事件（关闭动画结束）后容器才真正销毁
    await waitContainerGone()
    expect(document.querySelector('.test-dialog-content')).toBeNull()
  })

  it('点「取消」reject DialogCancelledError 并销毁容器', async () => {
    const dialog = useDialog(Content)
    const promise = dialog.open()
    await waitContent()

    const [cancelBtn] = footerButtons()
    cancelBtn.click()

    await expect(promise).rejects.toBeInstanceOf(DialogCancelledError)
    await waitContainerGone()
  })

  it('点头部自绘关闭按钮同样以 DialogCancelledError reject（所有关闭途径语义一致）', async () => {
    const dialog = useDialog(Content)
    const promise = dialog.open()
    await waitContent()

    // EP 原生 X 已收编为 ProDialog 自绘关闭按钮（.el-dialog__headerbtn 不再渲染）
    document.querySelector<HTMLElement>('.vv-pro-dialog__close-btn')?.click()

    await expect(promise).rejects.toBeInstanceOf(DialogCancelledError)
    await waitContainerGone()
  })

  it('setProps 实时更新已打开弹窗的 props', async () => {
    const dialog = useDialog(Content, { title: '旧标题' })
    const promise = dialog.open()
    await waitContent()

    dialog.setProps({ title: '新标题' })
    await vi.waitFor(() => {
      expect(document.querySelector('.vv-pro-dialog__title')?.textContent).toContain('新标题')
    })

    dialog.close()
    promise.catch(() => {}) // 预期中的取消 rejection，避免 unhandled rejection 噪音
    await waitContainerGone()
  })

  it('open 的 contentProps 透传给内容组件', async () => {
    const PropsContent = defineComponent({
      props: { label: { type: String, default: '' } },
      setup: (p) => () => h('div', { class: 'test-props-content' }, p.label),
    })
    const dialog = useDialog(PropsContent)
    const promise = dialog.open({ label: '来自 open' })

    await vi.waitFor(() => {
      expect(document.querySelector('.test-props-content')?.textContent).toBe('来自 open')
    })

    dialog.close()
    promise.catch(() => {})
    await waitContainerGone()
  })

  it('close() 以「取消」语义关闭并 reject 挂起的 Promise', async () => {
    const dialog = useDialog(Content)
    const promise = dialog.open()
    await waitContent()

    dialog.close()

    await expect(promise).rejects.toBeInstanceOf(DialogCancelledError)
    await waitContainerGone()
  })

  /**
   * 回归（code-reviewer #1 CRITICAL）：settled 标志未复位时，
   * "确认 → 再 open" 的复用场景下第二个 Promise 永不结算、弹窗卡死
   */
  it('复用同一句柄：confirm 关闭后再 open，第二个 Promise 正常 resolve', async () => {
    const dialog = useDialog(Content, { title: '复用' })

    const first = dialog.open()
    await waitContent()
    footerButtons()[1].click()
    await expect(first).resolves.toBe(true)
    await waitContainerGone()

    // 第二次打开：容器重建 + settled 已复位
    const second = dialog.open()
    await waitContent()
    footerButtons()[1].click()
    await expect(second).resolves.toBe(true)
    await waitContainerGone()
  })

  it('复用同一句柄：cancel 后再 open，第二次可正常确认', async () => {
    const dialog = useDialog(Content)

    const first = dialog.open()
    await waitContent()
    footerButtons()[0].click()
    await expect(first).rejects.toBeInstanceOf(DialogCancelledError)
    await waitContainerGone()

    const second = dialog.open()
    await waitContent()
    footerButtons()[1].click()
    await expect(second).resolves.toBe(true)
    await waitContainerGone()
  })

  it('已打开状态下重复 open：旧 Promise 按取消 reject，新 Promise 接管并可确认', async () => {
    const dialog = useDialog(Content)

    const first = dialog.open()
    await waitContent()

    const second = dialog.open()
    // 旧 Promise 被「取消」语义结算
    await expect(first).rejects.toBeInstanceOf(DialogCancelledError)
    // 弹窗未走关闭动画，容器复用
    expect(document.querySelector('[data-pro-dialog-container]')).toBeTruthy()

    footerButtons()[1].click()
    await expect(second).resolves.toBe(true)
    await waitContainerGone()
  })

  /**
   * 防回归：options → ProDialog 是 `{ ...state }` 全量展开（useDialog.ts），
   * 非白名单逐属性拷贝——若未来退化为白名单，ProDialog 新增扩展 prop
   * （如 resizeMinToInitial）会「类型合法、运行时不生效」地静默丢失。
   * 以 resizable 的 resize-handle 渲染为透传生效的 DOM 表征；
   * resizeMinToInitial 与其同属 UseDialogOptions，走同一链路。
   */
  it('options 与 setProps 全量透传 ProDialog 扩展 prop（resize-handle 出现/消失为表征）', async () => {
    const dialog = useDialog(Content, { resizable: true, resizeMinToInitial: true })
    const promise = dialog.open()
    await vi.waitFor(() => {
      expect(document.querySelector('.vv-pro-dialog__resize-handle')).toBeTruthy()
    })

    // setProps 入口同源（Object.assign → state → 展开），关闭 resizable 手柄应立即消失
    dialog.setProps({ resizable: false })
    await vi.waitFor(() => {
      expect(document.querySelector('.vv-pro-dialog__resize-handle')).toBeNull()
    })

    dialog.close()
    promise.catch(() => {}) // 预期中的取消 rejection，避免 unhandled rejection 噪音
    await waitContainerGone()
  })
})
