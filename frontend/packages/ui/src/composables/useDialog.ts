/**
 * 命令式弹窗 Hook —— useDialog。
 *
 * 与声明式 `<ProDialog v-model>` 互补：适合在纯 JS/TS 逻辑（如按钮回调、请求回调）中
 * 动态唤起弹窗，无需在模板里预埋组件节点。
 *
 * 用法：
 * ```ts
 * const editDialog = useDialog(EditForm, { title: '编辑用户', width: '600px' })
 * try {
 *   await editDialog.open({ userId: 1 })   // 点「确定」resolve
 * } catch (e) {
 *   if (e instanceof DialogCancelledError) return  // 取消/关闭/ESC/遮罩
 * }
 * ```
 *
 * 核心机制（三个关键点）：
 * 1. 动态挂载：open() 时创建容器 div 挂到 body，用 render() 渲染一个包装组件；
 *    关闭动画结束（EP closed 事件）后 render(null) + remove() 销毁，无 DOM 残留
 * 2. 上下文继承：手动 render 的组件树**没有**宿主应用上下文——不处理的话全局注册的
 *    组件（el-*）、Pinia、Router、i18n 全部失效。双保险：
 *    - setup 内调用 useDialog：捕获 `getCurrentInstance().appContext`
 *    - 纯 JS 调用：回退到 main.ts 通过 setDialogAppContext(app) 注册的全局 app
 * 3. Promise 语义：open() 返回 Promise——点「确定」resolve；取消/关闭/X/ESC/遮罩
 *    reject 一个 DialogCancelledError（与 ElMessageBox.confirm 的语义一致）
 *
 * @see [`../components/common/ProDialog`](../components/common/ProDialog/index.ts) 声明式组件（弹窗容器）
 * @see 消费方 app 入口（如 apps/admin/src/main.ts）setDialogAppContext 的调用点
 * @group Composables
 */
import type { App, AppContext, Component } from 'vue'
import {
  defineComponent,
  getCurrentInstance,
  h,
  onScopeDispose,
  reactive,
  ref,
  render,
  shallowRef,
} from 'vue'
import { ProDialog } from '../components/common/ProDialog/index.ts'
import type { UseDialogOptions } from '../components/common/ProDialog/index.ts'

/**
 * 纯 JS 调用场景的全局 app 上下文（main.ts 中 setDialogAppContext(app) 注册）。
 * setup 内调用时优先使用调用方实例的上下文（见 useDialog 内部），此值仅作回退。
 */
let globalAppContext: AppContext | null = null

/**
 * 向 useDialog 注册主应用上下文。
 *
 * 必须在 main.ts 的 app.use(...) 全部完成之后调用——_context 中的 provides
 * （Pinia / Router / i18n）是各插件 install 时写入的，提前注册会拿到残缺上下文。
 */
export function setDialogAppContext(app: App): void {
  globalAppContext = app._context
}

/**
 * 读取已注册的主应用上下文（未注册时为 null）。
 *
 * 供同样需要「脱离组件树渲染」的兄弟 composable 复用 —— 上下文注册点只保留
 * main.ts 那一处，避免每个动态挂载场景各建一套 setXxxAppContext。
 *
 * @see [`./useConfirm`](./useConfirm) 当前唯一的外部消费方（VNode 形态 content 需要）
 */
export function getDialogAppContext(): AppContext | null {
  return globalAppContext
}

/**
 * 用户取消/关闭弹窗时 open() Promise 的 reject 原因。
 * 通过 instanceof 或 code === 'DIALOG_CANCELLED' 识别。
 */
export class DialogCancelledError extends Error {
  readonly code = 'DIALOG_CANCELLED' as const
  constructor() {
    super('ProDialog: 弹窗被用户取消或关闭')
    this.name = 'DialogCancelledError'
  }
}

/** useDialog 返回的句柄 */
export interface UseDialogReturn {
  /**
   * 打开弹窗。
   * @param contentProps 透传给内容组件的 props
   * @returns 点「确定」时 resolve（值恒为 true，对齐 ElMessageBox.confirm 语义，
   *          业务载荷请通过内容组件自身状态传递）；取消/关闭/ESC/遮罩时
   *          reject DialogCancelledError。
   *          调用方必须 catch（同 ElMessageBox.confirm），否则产生 unhandled rejection
   */
  open: (contentProps?: Record<string, unknown>) => Promise<unknown>
  /** 以「取消」语义关闭弹窗（挂起的 Promise 会 reject） */
  close: () => void
  /** 运行时更新弹窗 props（title / width / fullScreen 等），实时生效 */
  setProps: (props: Partial<UseDialogOptions>) => void
  /** 弹窗当前是否处于打开状态 */
  readonly isOpen: boolean
}

/**
 * 创建命令式弹窗句柄。
 *
 * @param content 弹窗内容组件（渲染在 ProDialog 默认插槽中）
 * @param options 弹窗配置（ProDialog Props 去掉 modelValue，同组件调用）
 */
export function useDialog(content: Component, options: UseDialogOptions = {}): UseDialogReturn {
  // 双保险第 1 层：setup 内调用时捕获调用方实例上下文；
  // 纯 JS 调用时 getCurrentInstance() 为 null，走模块级全局回退
  const callerContext = getCurrentInstance()?.appContext ?? null

  // 组件卸载自动清理：callerContext 非空 ⟺ 组件 setup 同步阶段调用（此刻必有 active
  // effect scope；纯 JS 调用为 null，跳过）——调用方组件销毁时按「取消」语义关闭
  // 弹窗，否则容器挂在 body 上不受调用方生命周期管理：DOM 残留 + Promise 挂起泄漏
  if (callerContext) {
    onScopeDispose(() => close())
  }

  // 响应式配置：包装组件的 render 函数展开 state —— 这是 setProps 实时生效的关键
  const state = reactive<UseDialogOptions>({ ...options })
  // shallowRef 而非 ref：contentProps 是「打开瞬间的快照」——只有 open() 整体替换
  // 这一个写入口，无属性级响应需求；深响应会让调用方原地修改嵌套对象时内容组件
  // 被动更新（破坏快照语义），且对嵌套对象徒增递归代理开销
  const contentPropsRef = shallowRef<Record<string, unknown>>({})
  const visible = ref(false)

  let container: HTMLElement | null = null
  let settled = false
  let resolvePromise: ((value: unknown) => void) | null = null
  let rejectPromise: ((err: unknown) => void) | null = null

  /** 销毁挂载容器（render(null) 卸载组件树 + 移除 DOM 节点） */
  function unmount(): void {
    if (!container) return
    render(null, container)
    container.remove()
    container = null
  }

  /** 首次 open 时创建容器并渲染包装组件 */
  function ensureMounted(): void {
    if (container) return
    const holder = document.createElement('div')
    // data 属性仅供定位/排查（测试也用它断言容器生命周期）
    holder.setAttribute('data-pro-dialog-container', '')
    document.body.appendChild(holder)
    container = holder

    const Wrapper = defineComponent({
      name: 'ProDialogWrapper',
      setup() {
        return () => {
          // 声明为 Record 而非内联对象：state 来自 UseDialogOptions（exactOptionalPropertyTypes
          // 下可选属性不含 undefined），直接内联传入 h() 会与组件 props 类型冲突
          const dialogProps: Record<string, unknown> = {
            ...state,
            modelValue: visible.value,
            'onUpdate:modelValue': (v: boolean) => {
              visible.value = v
            },
            onConfirm: () => settle('confirm'),
            // close 是所有关闭途径的兜底事件：confirm 先行 settle 后这里因
            // settled 标志短路，不会二次结算把 resolve 覆盖成 reject
            onClose: () => settle('cancel'),
            // EP 关闭动画结束后再销毁 DOM，避免关闭瞬间弹窗消失（无退场动画）
            onClosed: () => unmount(),
          }
          return h(ProDialog, dialogProps, {
            default: () => h(content, contentPropsRef.value),
          })
        }
      },
    })

    const vnode = h(Wrapper)
    // 双保险第 2 层：把主应用上下文挂到 vnode 上——动态挂载的组件树由此
    // 获得全局注册的组件、Pinia、Router、i18n 等全部应用级能力
    const context = callerContext ?? globalAppContext
    if (!context) {
      // 防御：两种来源都缺失（纯 JS 调用且未在 main.ts 注册）时上下文字段为 null，
      // el-dialog 会静默退化成未解析标签——显式警告避免排查困难
      console.warn('[useDialog] 未捕获到 appContext：请在 main.ts 调用 setDialogAppContext(app)')
    }
    vnode.appContext = context
    render(vnode, container)
  }

  /** 结算挂起的 Promise 并触发关闭（关闭动画走完由 onClosed 真正销毁） */
  function settle(result: 'confirm' | 'cancel'): void {
    if (settled) return
    settled = true
    if (result === 'confirm') {
      resolvePromise?.(true)
    } else {
      rejectPromise?.(new DialogCancelledError())
    }
    resolvePromise = null
    rejectPromise = null
    visible.value = false
  }

  function open(contentProps: Record<string, unknown> = {}): Promise<unknown> {
    contentPropsRef.value = contentProps
    ensureMounted()
    // 重复 open：按「取消」语义结算旧 Promise（防止挂起泄漏），复用当前已打开的弹窗。
    // 不动 visible（已为 true，避免触发关闭动画把容器销毁）
    if (visible.value) {
      rejectPromise?.(new DialogCancelledError())
      resolvePromise = null
      rejectPromise = null
    }
    visible.value = true
    // 关键：settle() 结算上一次 Promise 时把 settled 写死为 true，
    // 随新 Promise 创建必须复位——否则第二次 open 后 settle() 被短路，
    // 新 Promise 永不结算、弹窗卡在打开态（"确认后再打开"场景必现）
    settled = false
    return new Promise((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })
  }

  function close(): void {
    settle('cancel')
  }

  function setProps(props: Partial<UseDialogOptions>): void {
    Object.assign(state, props)
  }

  return {
    open,
    close,
    setProps,
    get isOpen() {
      return visible.value
    },
  }
}
