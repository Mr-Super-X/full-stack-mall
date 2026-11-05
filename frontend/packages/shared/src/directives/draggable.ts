/**
 * 弹窗拖拽指令 v-draggable。
 *
 * 用法：
 *   <div v-draggable>标题</div>     允许拖拽
 *   <div v-draggable="false">标题</div>  禁用（如全屏态）
 *
 * 为什么不用 ElDialog 原生 draggable：
 * EP 原生拖拽无任何边界限制，弹窗可被拖出浏览器视口之外且无法找回，体验不可接受；
 * 本指令补齐边界钳制，并通过「手柄」语义限定只有头部可拖。
 *
 * 实现要点：
 * - 绑定元素即拖拽手柄：只有按住手柄才能拖，内容区选择/滚动/点击不受影响
 * - 实际移动的是手柄向上查找的最近 `.el-dialog` 祖先（el.closest 自动向上匹配，
 *   因此手柄放在 EP header 内任意层级均可）
 * - 首次拖拽时把 EP 默认的「margin 居中 + margin-top 偏移」定位切换为 left/top
 *   定位——margin 定位无法表达水平位移；el-overlay 是全屏 fixed，相对它的坐标即视口坐标
 * - 每次 mousedown 都重新读取当前位置作为拖拽原点：上次落点即本次起点
 *   （不能用首次值缓存——第二次拖拽会以初始位置为基准，弹窗瞬间跳回偏移前位置）
 * - 定位切换不用一次性 flag 而用内联 style 实际状态判断：ProDialog 全屏切换会清除
 *   内联定位，flag 模式下再次 mousedown 时弹窗已回 margin 居中，left 写在 static
 *   定位上不生效，拖拽会失灵
 * - 边界钳制到「视口 - 弹窗尺寸」：整个弹窗留在视口内——若只保留手柄高度，
 *   弹窗底部必然超出视口，触发 EP .el-overlay { overflow: auto } 的滚动条
 * - 仅支持鼠标事件（中后台桌面端场景）；如需平板触摸支持需改 Pointer Events
 *
 * 状态存 WeakMap（而非挂到 el 自定义属性）：避免污染 DOM 类型声明，元素回收自动释放。
 *
 * @see [`../components/common/ProDialog/ProDialog.vue`](../components/common/ProDialog/ProDialog.vue) 消费方
 * @group 指令：交互
 */
import type { App, DirectiveBinding, ObjectDirective } from 'vue'

/** 待钳制的目标位置（视口坐标） */
export interface DragPosition {
  left: number
  top: number
}

/** 钳制边界：最大可偏移量（通常为 视口尺寸 - 弹窗尺寸） */
export interface DragBounds {
  maxLeft: number
  maxTop: number
}

/**
 * 位置钳制纯函数：把弹窗位置限制在视口边界内。
 *
 * 单边为负（弹窗比视口大）时钳制为 0，避免 Math.max 出现负值把弹窗拖出左/上边界。
 * 导出供单测直接覆盖边界数学，无需模拟 DOM 事件。
 */
export function clampPosition(pos: DragPosition, bounds: DragBounds): DragPosition {
  const left = Math.min(Math.max(pos.left, 0), Math.max(bounds.maxLeft, 0))
  const top = Math.min(Math.max(pos.top, 0), Math.max(bounds.maxTop, 0))
  return { left, top }
}

/** 指令内部拖拽状态（每个绑定元素一份） */
interface DragState {
  handle: HTMLElement
  /** 绑定值：false 时禁用（binding.value 为 undefined 视为开启） */
  enabled: boolean
  startX: number
  startY: number
  originLeft: number
  originTop: number
  onMouseDown: (e: MouseEvent) => void
  onMouseMove: (e: MouseEvent) => void
  onMouseUp: () => void
}

const stateMap = new WeakMap<HTMLElement, DragState>()

/** 向上查找被拖拽的弹窗容器 */
function findDialog(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>('.el-dialog')
}

function createState(el: HTMLElement, binding: DirectiveBinding<boolean | undefined>): DragState {
  const state: DragState = {
    handle: el,
    enabled: binding.value !== false,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,

    onMouseDown(e: MouseEvent) {
      // 禁用态 / 非左键 / 找不到弹窗容器（如指令误绑到弹窗外元素）时不启动拖拽
      if (!state.enabled || e.button !== 0) return
      const dialog = findDialog(state.handle)
      if (!dialog) return
      // 阻止默认行为防止拖拽时选中文本；不阻断 click，关闭按钮等其他交互不受影响
      e.preventDefault()

      // EP 默认 margin 定位无法表达水平位移，需切换为 left/top 定位。
      // 用内联 style 实际状态判断（而非一次性 flag）：ProDialog 全屏切换会清除
      // 内联定位使弹窗回到 margin 居中，若 flag 仍记着「已切换」，left 会写在
      // static 定位上不生效，拖拽失灵
      const switched = dialog.style.position === 'relative' && dialog.style.left !== ''
      if (!switched) {
        const rect = dialog.getBoundingClientRect()
        dialog.style.margin = '0'
        dialog.style.position = 'relative'
        dialog.style.left = `${rect.left}px`
        dialog.style.top = `${rect.top}px`
      }

      // 关键：每次 mousedown 都重读当前实际位置作为原点（上次落点即本次起点）。
      // 若复用首次拖拽缓存的原点，第二次拖拽会以初始位置为基准计算位移，
      // 弹窗在按下瞬间跳回偏移前位置（demo 验证抓到的「二次拖拽偏移」bug）
      const rect = dialog.getBoundingClientRect()
      state.originLeft = rect.left
      state.originTop = rect.top
      state.startX = e.clientX
      state.startY = e.clientY
      document.addEventListener('mousemove', state.onMouseMove)
      document.addEventListener('mouseup', state.onMouseUp)
    },

    onMouseMove(e: MouseEvent) {
      const dialog = findDialog(state.handle)
      if (!dialog) return
      const next = clampPosition(
        {
          left: state.originLeft + e.clientX - state.startX,
          top: state.originTop + e.clientY - state.startY,
        },
        {
          // 整个弹窗钳制在视口内：右/下缘不超过视口，不触发 EP overlay 的滚动条
          maxLeft: window.innerWidth - dialog.offsetWidth,
          maxTop: window.innerHeight - dialog.offsetHeight,
        }
      )
      dialog.style.left = `${next.left}px`
      dialog.style.top = `${next.top}px`
    },

    onMouseUp() {
      document.removeEventListener('mousemove', state.onMouseMove)
      document.removeEventListener('mouseup', state.onMouseUp)
    },
  }

  // 拖拽从手柄的 mousedown 开始；mousemove/mouseup 挂在 document 上，
  // 保证指针快速移出手柄/弹窗外时拖拽不中断
  el.addEventListener('mousedown', state.onMouseDown)
  return state
}

/**
 * v-draggable 指令定义（具名导出供单测直接挂载）。
 */
export const draggableDirective: ObjectDirective<HTMLElement, boolean | undefined> = {
  mounted(el, binding) {
    stateMap.set(el, createState(el, binding))
  },
  updated(el, binding) {
    // binding.value 随组件状态变化（如全屏切换），updated 时同步开关
    const state = stateMap.get(el)
    if (state) state.enabled = binding.value !== false
  },
  unmounted(el) {
    const state = stateMap.get(el)
    if (state) {
      el.removeEventListener('mousedown', state.onMouseDown)
      // 兜底：指令卸载时若拖拽正在进行中（组件卸载的极端场景），清理 document 监听
      state.onMouseUp()
      stateMap.delete(el)
    }
  },
}

export default {
  install(app: App) {
    app.directive('draggable', draggableDirective)
  },
}
