/**
 * ProDialog 高级弹窗 —— 类型定义层。
 *
 * 角色：ProDialog 组件（`./ProDialog.vue`）与命令式 Hook（`@composables/useDialog`）
 * 共用的 Props / Emits / Hook 参数类型，保证声明式与命令式两种入口类型一致。
 *
 * 关键设计：ElDialog 原生 Props 通过 `InstanceType<typeof ElDialog>['$props']` 推导，
 * 而非 import element-plus 深层导出路径（如 `@element-plus/components/dialog`）——
 * 后者属于 EP 内部包结构，跨版本变动风险高；实例推导跟随主包导出，稳定。
 *
 * @see [`./ProDialog.vue`](./ProDialog.vue) 声明式组件
 * @see [`@composables/useDialog`](../../composables/useDialog.ts) 命令式 Hook
 * @group 通用组件：ProDialog
 */
import type { ElDialog } from 'element-plus'

/**
 * ElDialog 原生 Props 全量类型（从组件实例推导，全部置为可选）。
 *
 * title / width / top / modal / showClose / beforeClose 等原生属性均由此继承，
 * ProDialog 通过 `v-bind` 原样透传给内部 el-dialog。
 */
export type ElDialogNativeProps = Partial<InstanceType<typeof ElDialog>['$props']>

/**
 * ProDialog Props：ElDialog 原生 Props 全量继承 + 三个扩展属性。
 *
 * 注意：`draggable` 与 EP 原生同名属性语义不同——本组件的拖拽由 v-draggable
 * 指令实现（限制在视口边界内），透传时会从原生 props 中剔除，避免两套拖拽叠加。
 */
export interface ProDialogProps extends ElDialogNativeProps {
  /**
   * 是否允许按住头部拖拽（默认 true）——
   * 全屏态自动禁用（EP 全屏时弹窗贴满视口，拖拽无意义且会破坏布局）。
   * @defaultValue true
   */
  draggable?: boolean

  /**
   * 初始是否全屏（默认 false）——
   * 全屏走 EP 原生 `fullscreen` 机制（`.el-dialog.is-fullscreen` 贴满视口），
   * 头部提供切换按钮，运行时通过 fullScreenChange 事件感知状态变化。
   * @defaultValue false
   */
  fullScreen?: boolean

  /**
   * 是否显示头部全屏切换按钮（默认 true）——
   * 传 false 可隐藏按钮（如业务只允许固定尺寸的弹窗）。
   * @defaultValue true
   */
  showFullScreenButton?: boolean

  /**
   * 是否允许按住右下角拖拉调整弹窗宽高（默认 false）——
   * 启用后右下角出现 12×12 px 三角手柄；硬编码钳制最小 320×200、
   * 最大 viewport - 16px；全屏态自动禁用（与 draggable 同步策略）。
   * 仅在 resize 结束（mouseup）时抛 resizeChange 事件，
   * 不在 mousemove 高频抛以避免父组件重渲染抖动。
   * @defaultValue false
   */
  resizable?: boolean

  /**
   * resize 最小尺寸是否锁定为「本次打开时」的初始宽高（默认 false）——
   * 开启后只能放大、不能缩小到比初始打开时更小（防止内容排版被拖乱）；
   * 关闭时最小仍为硬编码 320×200。每次重新打开弹窗都会重新记录初始宽高。
   * @defaultValue false
   */
  resizeMinToInitial?: boolean
}

/**
 * ProDialog 事件。
 *
 * 语义约定（与 useDialog 的 Promise 语义对齐）：
 * - `confirm` 仅由内置「确定」按钮触发（自定义 footer 插槽时由调用方自行决定何时 emit），
 *   且 confirm 即视为「确认成功」——useDialog 的 Promise 此刻已 resolve。
 *   若需在确认前做异步校验并**阻止关闭**，请使用原生 `beforeClose` 拦截，
 *   不要依赖 confirm 时序（confirm 发出时关闭流程已启动）
 * - `close` 是兜底事件：确认 / 取消 / X 按钮 / ESC / 点击遮罩，任一途径关闭都会触发
 * - 因此「确认后做某事」请监听 `confirm`，「关闭后清理」请监听 `close`
 */
export type ProDialogEmits = {
  'update:modelValue': [value: boolean]
  /** 弹窗打开（进入动画开始） */
  open: []
  /** 弹窗关闭（所有关闭途径的兜底事件） */
  close: []
  /** 点击内置「确定」按钮 */
  confirm: []
  /** 全屏状态切换 */
  fullScreenChange: [value: boolean]
  /** 拖拉调整宽高结束时（mouseup）触发；参数为最终宽高（px） */
  resizeChange: [width: number, height: number]
}

/**
 * useDialog 的可选配置：组件 Props 去掉 `modelValue`（显隐由 open/close 托管，
 * 调用方不再直接控制）。
 */
export type UseDialogOptions = Partial<Omit<ProDialogProps, 'modelValue'>>
