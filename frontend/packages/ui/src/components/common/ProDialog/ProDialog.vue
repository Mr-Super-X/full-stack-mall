<script setup lang="ts">
/**
 * ProDialog 高级弹窗（声明式入口）。
 *
 * 在 ElDialog 基础上扩展三项能力：
 * - 头部拖拽：`v-draggable` 指令实现，可限制在视口边界内（EP 原生 draggable 无边界限制，
 *   拖出屏幕后无法找回，故不用原生）
 * - 全屏切换：走 EP 原生 `fullscreen` 机制，头部自带切换按钮，全屏态自动禁用拖拽
 * - 头部操作组靠右对齐：全屏 + 关闭按钮一组（EP 原生 X 绝对定位与 flex 流对不齐，
 *   收编为自绘按钮，`show-close` / `before-close` 语义保持对齐原生 X）
 * - 内置确认/取消 footer：默认提供两按钮，向外抛出语义化的 `confirm` / `close` 事件
 *
 * ElDialog 原生 Props 透传方式（重要）：
 * 显式声明的只有 modelValue / title / draggable / fullScreen / showFullScreenButton，
 * 其余原生 Props（width / top / modal / showClose / beforeClose 等）经
 * `inheritAttrs: false` + `v-bind="$attrs"` 原样落到内部 el-dialog——
 * 不用 `defineProps<ProDialogProps>()` 全量继承，因为 Vue 3.6 SFC 编译器
 * 无法对 `Partial<InstanceType<typeof ElDialog>['$props']>` 做编译期类型展开。
 *
 * 组件被 `@vv/ui` global-components 的自动扫描全局注册为 `<ProDialog>`（无需 import），
 * 命令式入口见 `@composables/useDialog`。
 *
 * @see [`./types.ts`](./types.ts) 对外类型（UseDialogOptions 等，供命令式入口复用）
 * @see `@vv/shared` directives/draggable.ts 拖拽指令实现
 * @see [`@composables/useDialog`](../../../composables/useDialog.ts) 命令式调用
 * @group 通用组件：ProDialog
 */
import { Aim, Close, FullScreen } from '@element-plus/icons-vue'

// BEM 命名空间：vv-pro-dialog（createNamespace 由 unplugin-auto-import 注入）
const bem = createNamespace('pro-dialog')

// 原生 Props 走 $attrs 透传，关闭自动继承避免与 v-bind="$attrs" 双重绑定
// （监听器双绑会导致事件回调执行两次）
defineOptions({ inheritAttrs: false })

const attrs = useAttrs() // vue

// 头部关闭按钮收编为自绘（与全屏按钮组成一组靠右对齐，见文件头「头部布局」说明），
// 需把用户传入的 show-close 从透传集合中剥离，避免 EP 再渲染一个绝对定位的原生 X
// （kebab / camel 两种写法都剥离）
const dialogAttrs = computed(() => {
  const { 'show-close': _kebab, showClose: _camel, ...rest } = attrs
  return rest
})

// show-close 语义保留：默认显示自绘关闭按钮，用户传 :show-close="false" 时隐藏
const showClose = computed(() => {
  const v = (attrs['show-close'] ?? attrs['showClose']) as boolean | undefined
  return v ?? true
})

// 显式声明的自有 Props；其余 ElDialog 原生 Props 经 $attrs 透传（见文件头注释）
interface Props {
  /** 显隐控制（v-model），默认 false */
  modelValue?: boolean
  /** 弹窗标题（透传 EP title；传入 header 插槽时插槽优先） */
  title?: string
  /**
   * 是否允许按住头部拖拽（默认 true）——
   * 全屏态自动禁用（EP 全屏时弹窗贴满视口，拖拽无意义且会破坏布局）
   */
  draggable?: boolean
  /** 初始是否全屏（默认 false）——头部提供切换按钮 */
  fullScreen?: boolean
  /** 是否显示头部全屏切换按钮（默认 true） */
  showFullScreenButton?: boolean
  /**
   * 是否允许按住右下角拖拉调整弹窗宽高（默认 false）——
   * 启用后右下角出现 12×12 px 三角手柄；
   * 钳制：最小 320×200、最大 viewport - 16px；全屏态自动禁用。
   * 仅在 resize 结束（mouseup）时抛 resizeChange，
   * 不在 mousemove 高频抛以避免父组件重渲染抖动。
   */
  resizable?: boolean
  /**
   * resize 最小尺寸是否锁定为「本次打开时」的初始宽高（默认 false）——
   * 开启后只能放大、不能缩小到比初始打开时更小（防止内容排版被拖乱）；
   * 关闭时最小仍为硬编码 320×200。每次重新打开弹窗都会重新记录初始宽高。
   */
  resizeMinToInitial?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '',
  draggable: true,
  fullScreen: false,
  showFullScreenButton: true,
  resizable: false,
  resizeMinToInitial: false,
})

const emit = defineEmits<{
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
}>()

const isFullScreen = ref(props.fullScreen)
// fullScreen prop 作为初始值，外部后续改 prop 时同步（支持调用方控制全屏态）
watch(
  () => props.fullScreen,
  (v) => {
    isFullScreen.value = v
  }
)

// 头部拖拽手柄 ref：切换全屏时需要通过它向上找到 .el-dialog 清除拖拽残留的内联定位
const headerRef = ref<HTMLElement | null>(null)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

/**
 * 拖拽生效条件：允许拖拽 且 非全屏 且 弹窗已打开。
 * 关闭动画期间 visible 已为 false，自然禁拖，无需额外处理动画边界。
 */
const dragEnabled = computed(() => props.draggable && !isFullScreen.value && visible.value)

function toggleFullScreen(): void {
  isFullScreen.value = !isFullScreen.value
  // 清除拖拽 + resize 留下的内联定位/尺寸：
  // - 拖拽：EP .is-fullscreen 只重置 margin，不重置 left/top
  // - resize：width/height 不清除 → 退出全屏后弹窗仍是上次拖拽的尺寸（EP 默认 width 不生效）
  // 进出全屏都清除：退出全屏后弹窗回到默认居中 + EP 默认尺寸
  const dialog = headerRef.value?.closest<HTMLElement>('.el-dialog')
  if (dialog) {
    dialog.style.left = ''
    dialog.style.top = ''
    dialog.style.margin = ''
    dialog.style.position = ''
    dialog.style.width = ''
    dialog.style.height = ''
  }
  emit('fullScreenChange', isFullScreen.value)
}

// —— 可拖拉调整宽高 ——
/** resize 启用条件：props.resizable && 非全屏 && 弹窗可见（与 draggable 同步策略） */
const resizableEnabled = computed(() => props.resizable && !isFullScreen.value && visible.value)

/**
 * 本次打开弹窗的初始宽高（resizeMinToInitial 开启时作为最小可缩尺寸）。
 * 每次打开重新记录（open 事件 → nextTick 测量），保证「当前初始打开」语义——
 * 上一次 resize 留下的内联尺寸不影响本次记录（EP 重渲染后 offsetWidth 即初始布局值）。
 */
const initialDialogSize = ref<{ width: number; height: number } | null>(null)

/** 打开时记录初始尺寸：测量需等 dialog DOM 就位，故走 nextTick */
function recordInitialSize(): void {
  nextTick(() => {
    const dialog = headerRef.value?.closest<HTMLElement>('.el-dialog')
    if (dialog) {
      initialDialogSize.value = { width: dialog.offsetWidth, height: dialog.offsetHeight }
    }
  })
}

/**
 * resize 钳制最小值数据源（组件注入，composable 保持纯交互）。
 *
 * get：当前最小宽高——resizeMinToInitial 开启且有记录时用「本次打开的初始宽高」，
 * 否则回退硬编码 320×200（保持 resizable 原有行为）；
 * ensure：open 事件的记录若因渲染时序未就绪（如弹窗内容异步挂载），
 * 首次拖拽时用当前尺寸补记——打开后未经 resize 的当前尺寸即初始尺寸。
 */
interface ResizeMinSource {
  get: () => { width: number; height: number }
  ensure: (width: number, height: number) => void
}

const resizeMinSource: ResizeMinSource = {
  get() {
    return props.resizeMinToInitial && initialDialogSize.value
      ? initialDialogSize.value
      : { width: 320, height: 200 }
  },
  ensure(width, height) {
    if (props.resizeMinToInitial && !initialDialogSize.value) {
      initialDialogSize.value = { width, height }
    }
  },
}

/**
 * 右下角 resize 交互子系统（composable 抽离）。
 *
 * 抽离理由：组件本体负责「弹窗是什么」（透传 / 布局 / 语义化事件），resize 是一套
 * 自包含的交互闭环——document 级监听注册清理、钳制数学、全局副作用恢复——与模板
 * 零耦合；收拢后组件只剩一行声明，钳制逻辑可脱离 DOM 做纯函数单测。
 * 参数用结构类型（{ value: T }）而非 Ref<T>：本文件零 vue import（AutoImport 约定），
 * 结构类型与 Ref<T> 赋值兼容。
 * @param enabled resize 生效条件（响应式数据源由组件注入，保持单向数据流）
 * @param headerRef 头部手柄 ref：经它 closest('.el-dialog') 找到被改尺寸的容器
 * @param minSource 钳制最小宽高（px）数据源——resizeMinToInitial 开启时为
 * 本次打开弹窗的初始宽高，否则 320×200；由组件注入聚合（prop / 记录状态），
 * ensure 供 open 记录未就绪时首次拖拽补记
 * @param onResizeEnd mouseup 结算回调（组件转发为 resizeChange 事件）
 * @see [`./ProDialog.spec.ts`](./ProDialog.spec.ts) 钳制 / 清理 / 全屏联动用例
 */
function useProDialogResize(
  enabled: { readonly value: boolean },
  headerRef: { readonly value: HTMLElement | null },
  minSource: ResizeMinSource,
  onResizeEnd: (width: number, height: number) => void
): { startResize: (e: MouseEvent) => void } {
  /** resize 中间状态：mousedown 锁定，mouseup 清空（普通变量而非 ref——避免高频 mousemove 触发响应式依赖追踪） */
  interface ResizeState {
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    dialog: HTMLElement
  }

  let resizeState: ResizeState | null = null

  // body 全局样式的旧值备份：mouseup / 卸载时「恢复」而非「清空」——
  // 宿主页面若本身设了 userSelect（如全局拖拽排序场景），清空会把宿主样式一并抹掉
  let prevUserSelect = ''
  let prevCursor = ''

  function startResize(e: MouseEvent): void {
    if (!enabled.value) return
    const dialog = headerRef.value?.closest<HTMLElement>('.el-dialog')
    if (!dialog) return
    resizeState = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dialog.offsetWidth,
      startHeight: dialog.offsetHeight,
      dialog,
    }
    // open 事件的初始尺寸记录未就绪时（渲染时序差异），用当前尺寸补记
    minSource.ensure(dialog.offsetWidth, dialog.offsetHeight)
    prevUserSelect = document.body.style.userSelect
    prevCursor = document.body.style.cursor
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeUp)
    // preventDefault 防止文本选中 + 改鼠标手势
    e.preventDefault()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'se-resize'
  }

  function handleResizeMove(e: MouseEvent): void {
    if (!resizeState) return
    const dx = e.clientX - resizeState.startX
    const dy = e.clientY - resizeState.startY
    // 钳制：最小值取 minSource（resizeMinToInitial 开启时为初始打开宽高）；
    // 最大 viewport - 16px（左右上下各留 8px 余量）
    const { width: minW, height: minH } = minSource.get()
    const maxW = window.innerWidth - 16
    const maxH = window.innerHeight - 16
    const newWidth = Math.max(minW, Math.min(maxW, resizeState.startWidth + dx))
    const newHeight = Math.max(minH, Math.min(maxH, resizeState.startHeight + dy))
    resizeState.dialog.style.width = `${newWidth}px`
    resizeState.dialog.style.height = `${newHeight}px`
  }

  /** 摘除 document 监听 + 按备份恢复 body 样式（mouseup 与组件卸载清理共用） */
  function stopResize(): void {
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeUp)
    document.body.style.userSelect = prevUserSelect
    document.body.style.cursor = prevCursor
  }

  function handleResizeUp(): void {
    if (!resizeState) return
    stopResize()
    onResizeEnd(resizeState.dialog.offsetWidth, resizeState.dialog.offsetHeight)
    resizeState = null
  }

  // onUnmounted 清监听：组件卸载时如果正在 resize，document 监听器必须清理（防泄漏）；
  // body 样式同样按备份值恢复
  onUnmounted(() => {
    stopResize()
    resizeState = null
  })

  return { startResize }
}

// resize 交互收拢为一行声明：监听生命周期 / 钳制 / 副作用恢复全部在 composable 内
const { startResize } = useProDialogResize(
  resizableEnabled,
  headerRef,
  resizeMinSource,
  (width, height) => emit('resizeChange', width, height)
)

/** el-dialog 的 open 事件（进入动画开始）：记录本次打开的初始宽高，供 resizeMinToInitial 钳制 */
function handleOpen(): void {
  recordInitialSize()
  emit('open')
}

/** el-dialog 的 close 事件：所有关闭途径的兜底（确认/取消/X/ESC/遮罩都会触发） */
function handleClose(): void {
  emit('close')
}

/** 内置「取消」按钮：仅关闭，不触发 confirm */
function handleCancel(): void {
  visible.value = false
}

/** 内置「确定」按钮：先抛 confirm 再关闭（自定义 footer 插槽时由调用方自行决定该语义） */
function handleConfirm(): void {
  emit('confirm')
  visible.value = false
}

/**
 * 自绘关闭按钮：语义对齐 EP 原生 X——beforeClose 存在时交给它决定是否关闭
 * （EP 仅在通过其内部途径关闭时调用 beforeClose，这里复刻同一语义；
 * ESC / 遮罩点击仍走 EP 内部途径，beforeClose 由 EP 自己调用）
 */
function handleCloseClick(): void {
  // 模板写法是 before-close（kebab），render 函数/对象传参可能是 beforeClose（camel），两者都认
  const beforeClose = (attrs['before-close'] ?? attrs['beforeClose']) as
    ((done: () => void) => void) | undefined
  if (beforeClose) {
    beforeClose(() => {
      visible.value = false
    })
    return
  }
  visible.value = false
}
</script>

<template>
  <!-- v-bind="dialogAttrs" 必须在最前：原生 props（width/top/modal/beforeClose 等）先落位，
       后面的显式绑定（fullscreen/class/show-close 等）才能按需覆盖；
       show-close 恒为 false——原生 X 已收编进下方头部 actions 组（对齐问题见样式注释） -->
  <el-dialog
    v-bind="dialogAttrs"
    v-model="visible"
    :fullscreen="isFullScreen"
    :show-close="false"
    :class="[bem.b(), bem.is('drag-disabled', !dragEnabled)]"
    @open="handleOpen"
    @close="handleClose"
  >
    <!-- 头部 = 拖拽手柄：铺满 EP header 内容区，只有按住这里才能拖，内容区不受影响 -->
    <template #header>
      <div ref="headerRef" v-draggable="dragEnabled" :class="bem.e('header')">
        <span :class="bem.e('title')">
          <slot name="header">{{ title }}</slot>
        </span>
        <!-- 操作组：全屏 + 关闭一组靠右。两按钮都需 mousedown.stop / click.stop，
             否则点按钮会同时触发拖拽或冒泡到 EP header -->
        <div :class="bem.e('actions')">
          <el-button
            v-if="showFullScreenButton"
            :class="[bem.e('action-btn'), bem.e('fullscreen-btn')]"
            :icon="isFullScreen ? Aim : FullScreen"
            :title="isFullScreen ? '退出全屏' : '全屏'"
            text
            @mousedown.stop
            @click.stop="toggleFullScreen"
          />
          <el-button
            v-if="showClose"
            :class="[bem.e('action-btn'), bem.e('close-btn')]"
            :icon="Close"
            title="关闭"
            text
            @mousedown.stop
            @click.stop="handleCloseClick"
          />
        </div>
      </div>
    </template>

    <!-- resize 手柄：作为 default slot 第一个元素，绝对定位贴 dialog 右下角。
         EP .el-dialog__body 默认 position: relative，所以 handle 的 absolute 相对 body。
         触发条件：resizable 启用 + 非全屏 + 弹窗可见（resizableEnabled computed 已聚合）。 -->
    <div v-if="resizableEnabled" :class="bem.e('resize-handle')" @mousedown="startResize" />

    <slot />

    <template #footer>
      <slot name="footer">
        <el-button @click="handleCancel">取 消</el-button>
        <el-button type="primary" @click="handleConfirm">确 定</el-button>
      </slot>
    </template>
  </el-dialog>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-dialog {
  // 拖拽手柄：标题与操作组（全屏+关闭）分居两侧，操作组整组靠右对齐。
  // 关闭按钮收编自绘（EP 原生 X 绝对定位在 header 右侧，与 flex 流内的全屏按钮
  // 对不齐且间距不可控，demo 验证反馈「头部样式很丑」，故弃用原生 X）
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: move;
    user-select: none;
  }

  &__title {
    flex: 1;
    overflow: hidden;
    font-size: var(--el-dialog-title-font-size, 16px);
    color: var(--el-dialog-title-text-color, var(--el-text-color-primary));
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 操作组：全屏 + 关闭按钮固定 24×24，靠右排列
  &__actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    .el-button + .el-button {
      margin-left: 0px;
    }
  }

  &__action-btn {
    width: 24px;
    height: 24px;
    padding: 0;
  }

  // 禁用拖拽时手柄恢复默认光标（全屏态 / draggable=false）
  &.is-drag-disabled &__header {
    cursor: default;
  }

  // 右下角 resize 手柄：12×12 px 三角，绝对定位贴 dialog 右下角
  // hover 时三角变蓝（提示可调整）
  &__resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 12px;
    height: 12px;
    cursor: se-resize;
    user-select: none;
    z-index: 1;

    &::after {
      content: '';
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 0 6px 6px;
      border-color: transparent transparent var(--el-color-info) transparent;
      transition: border-bottom-color 0.2s ease;
    }

    &:hover::after {
      border-bottom-color: var(--el-color-primary);
    }
  }
}
</style>
