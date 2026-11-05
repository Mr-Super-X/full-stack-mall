import type { AppContext } from 'vue'
import { getCurrentInstance } from 'vue'
import { ElMessageBox, type ElMessageBoxOptions } from 'element-plus'
import { getDialogAppContext } from './useDialog'

/**
 * EP 在用户取消 / 关闭时 reject 的哨兵值。
 *
 * 取自 element-plus 2.14.3 `message-box/src/messageBox.mjs:54-55`：点取消 reject 字符串
 * `'cancel'`，开启 `distinguishCancelAndClose` 后点 X 额外 reject `'close'`。
 *
 * 这是把「用户取消」与「真实异常」区分开的**唯一依据**。无条件 `catch → false` 会把
 * `beforeClose` 回调里抛出的业务异常一并吞掉，现场表现为「点了确定却什么都没发生」
 * 且无任何日志 —— 排查成本极高，故此处必须精确匹配后再降级。
 */
const CANCEL_ACTIONS: ReadonlySet<unknown> = new Set(['cancel', 'close'])

const DEFAULT_TITLE = '系统提示'
const DEFAULT_CONFIRM_TEXT = '确定'
const DEFAULT_CANCEL_TEXT = '取消'

/**
 * 危险操作预设：确认按钮转红 + 警告图标。
 *
 * `confirmButtonType` 会被 EP 透传给内部 el-button 的 type
 * （`message-box/src/index.mjs:143`），故无须再写 `confirmButtonClass` 覆盖样式。
 */
const DANGER_PRESET = {
  type: 'warning',
  confirmButtonType: 'danger',
} as const satisfies Pick<ElMessageBoxOptions, 'type' | 'confirmButtonType'>

/**
 * useConfirm 的对象形态参数 —— EP 原生 `ElMessageBoxOptions` 的裁剪超集。
 *
 * 被 Omit 掉的 4 个字段及原因：
 * - `message` / `title` —— 由本接口的 `content` / `title` 取代（EP 原生
 *   `title?: string | ElMessageBoxOptions` 是为兼容位置参数重载留的 hack，类型含糊）
 * - `callback`  —— **传了会让 Promise 永不结算**：EP 内部是
 *   `if (options.callback) callback(...) else resolve/reject`（messageBox.mjs:53），
 *   走 callback 分支后 resolve/reject 均不触发，await 永久挂起
 * - `boxType`   —— 由 `.confirm` 快捷方法内部决定，外部覆盖会破坏按钮布局
 */
export interface UseConfirmOptions extends Omit<
  ElMessageBoxOptions,
  'message' | 'title' | 'callback' | 'boxType'
> {
  /**
   * 正文内容，**仅支持字符串**。
   *
   * 如需渲染富文本（粗体 / 换行 / 链接 / 全局注册的组件标签如 `<el-tag>`），
   * 同时打开 `dangerouslyUseHTMLString: true`，EP 会走 `innerHTML` 分支
   * （`message-box/src/index.vue:93`）；否则走 `textContent` 分支。
   *
   * **类型刻意只允许 string**：EP 模板里 message 只被字符串消费（`textContent` /
   * `innerHTML`），VNode/Component 形态**类型上写允许但运行时会渲染成
   * `[object Object]`**。需要业务组件作为内容（表单 / 多选 / 状态回传等）的
   * 场景，请改用 `useDialog` —— 它支持任意 Component 内容，但 Promise 语义是
   * 取消 reject `DialogCancelledError`，与 useConfirm 不同。
   */
  content: string
  /** 标题，缺省 `'系统提示'` */
  title?: string
  /**
   * 危险操作（删除 / 重置 / 批量清空等）快捷开关：确认按钮转红 + 警告图标。
   * 等价于手写 `{ type: 'warning', confirmButtonType: 'danger' }`，
   * 且显式传入的同名字段优先级更高（见实现中的展开顺序）。
   */
  danger?: boolean
  /**
   * 当 `dangerouslyUseHTMLString: true` 时，HTML 字符串里若包含全局注册的组件
   * 或依赖 Pinia / Router / i18n 的内容，需要手动传上下文。
   * 缺省自动解析（见 `resolveAppContext`），仅在自动解析失败时才需显式传。
   */
  appContext?: AppContext | null
}

/**
 * 解析弹窗内容的渲染上下文。
 *
 * 本项目用 unplugin-vue-components 按需引入 EP，main.ts **没有** `app.use(ElementPlus)`，
 * 因此 EP 自带的 `ElMessageBox._context` 恒为 null。VNode 形态的 content 若不补上下文，
 * 其中的全局组件 / Pinia / Router / i18n 会全部失效（渲染成未解析标签）。
 *
 * 三层回退：显式传入 > setup 同步期捕获 > main.ts 注册的全局上下文。
 * 中间层通常拿不到 —— useConfirm 多在 click 回调里调用，此时 Vue 已把 currentInstance
 * 置空，兜底全靠第三层，这也是复用 useDialog 注册机制的原因。
 */
function resolveAppContext(explicit: AppContext | null | undefined): AppContext | null {
  // 用 undefined 而非 falsy 判定：调用方显式传 null 表示「就是不要上下文」，须被尊重
  if (explicit !== undefined) return explicit
  return getCurrentInstance()?.appContext ?? getDialogAppContext()
}

/**
 * 把位置参数 / 对象参数两种重载形态归一成对象形态。
 *
 * 分支写法而非 `{ content, title }` 直传：tsconfig 开启了 exactOptionalPropertyTypes，
 * 可选属性不接受显式 undefined，title 缺省时必须整个字段不出现。
 */
function normalizeArgs(
  contentOrOptions: string | UseConfirmOptions,
  title: string | undefined
): UseConfirmOptions {
  if (typeof contentOrOptions !== 'string') return contentOrOptions
  return title === undefined ? { content: contentOrOptions } : { content: contentOrOptions, title }
}

/**
 * 二次确认 Hook —— useConfirm。
 *
 * 封装 `ElMessageBox.confirm`，把「取消即 reject」重塑为「取消即 resolve(false)」。
 * 业务侧因此可以一行 `if (await useConfirm('...'))` 表达确认流程，无须 try/catch，
 * 也不会再出现漏 catch 导致的 `Uncaught (in promise) cancel` 控制台噪音。
 *
 * 与 `useDialog` 的分工（两者互补，勿混用）：
 * - useConfirm —— 纯文本 / HTML 字符串的**是否继续**询问，返回 boolean，无业务载荷
 * - useDialog  —— 渲染**自定义内容组件**（表单等）的弹窗，取消时 reject DialogCancelledError
 *
 * @example
 * ```ts
 * // 危险操作删除（取消即 resolve false，无须 try/catch）
 * if (!(await useConfirm({
 *   content: `确定删除订单 ${orderId} 吗？此操作不可恢复。`,
 *   title: '删除确认',
 *   danger: true,
 *   confirmButtonText: '删除',
 * }))) return
 * await api.removeOrder(orderId)
 *
 * // HTML 富文本（dangerouslyUseHTMLString 走 EP innerHTML 分支，可渲染全局组件标签）
 * await useConfirm({
 *   content: `<p>订单 <b>${orderId}</b> 将被永久删除 <el-tag type="danger">不可恢复</el-tag></p>`,
 *   dangerouslyUseHTMLString: true,
 *   confirmButtonText: '我已知晓风险',
 * })
 * ```
 *
 * @see [`./useDialog`](./useDialog) 组件级命令式弹窗（本文件复用其 appContext 注册）
 * @see [`./useLogout`](./useLogout) 典型调用方
 * @group Composables
 * @returns 点「确定」resolve `true`；点「取消」/ 关闭图标 / ESC / 遮罩 resolve `false`。
 *          **不 reject** —— 故调用方无须 try/catch（对比 `ElMessageBox.confirm` 原生行为）。
 *          唯一的例外：`beforeClose` 回调内抛出的业务异常会原样上抛，不被降级为 false。
 */
export function useConfirm(content: string, title?: string): Promise<boolean>
export function useConfirm(options: UseConfirmOptions): Promise<boolean>
export async function useConfirm(
  contentOrOptions: string | UseConfirmOptions,
  title?: string
): Promise<boolean> {
  const {
    content,
    title: boxTitle = DEFAULT_TITLE,
    danger = false,
    appContext,
    ...rest
  } = normalizeArgs(contentOrOptions, title)

  try {
    await ElMessageBox.confirm(
      content,
      boxTitle,
      {
        confirmButtonText: DEFAULT_CONFIRM_TEXT,
        cancelButtonText: DEFAULT_CANCEL_TEXT,
        // danger 仅提供默认值：...rest 后置展开，故调用方显式传的
        // confirmButtonType / type 会覆盖预设（如危险操作想用 error 图标）
        ...(danger ? DANGER_PRESET : null),
        ...rest,
      },
      resolveAppContext(appContext)
    )
    return true
  } catch (err) {
    // 取消哨兵值 → 降级为 false，这正是「消除 Uncaught (in promise)」的落点
    if (CANCEL_ACTIONS.has(err)) return false
    // 其余一律原样上抛：吞掉真实异常会让调用方永远看不到错误（见 CANCEL_ACTIONS 注释）
    throw err
  }
}
