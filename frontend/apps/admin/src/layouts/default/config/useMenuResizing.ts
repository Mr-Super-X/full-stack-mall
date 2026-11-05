/**
 * 侧栏拖拽调宽的响应式接线（布局壳 useMenuResizing）。
 *
 * 为什么抽离 index.vue：布局壳文件行数逼近硬上限，而"live 宽度 + 生效宽度 +
 * inline style"是完整内聚的调宽领域逻辑，与 resize.ts（纯函数钳制）同属一个
 * 领域，故归本目录而非全局 composables/（避免被 check-doc-currency 的
 * composable 计数统计，也保持布局内聚）。
 *
 * 数据流：拖拽手柄（SidebarResizer）v-model 实时宽度 → liveWidth（非 null 即
 * "拖拽中"信号，布局壳据此绑 is-resizing 禁用 width 过渡，防橡皮筋滞后）；
 * 拖拽结束 commit 写入 store 持久化（store 字段为 null = 跟随 token 默认 224px，
 * 见 @vv/shared store/modules/app）。手柄在折叠/移动端不渲染（v-if），故 inline 宽度
 * 同样只在展开态桌面端绑定，折叠宽度仍由 CSS is-collapsed 规则接管。
 *
 * @see [`../components/SidebarResizer.vue`](../components/SidebarResizer.vue) 交互发起方
 * @see [`./resize.ts`](./resize.ts) 钳制与常量
 * @see `@vv/shared` store/modules/app —— sidebarWidth / secondaryWidth 持久化字段
 * @group 布局：Default
 */
import { useAppStore } from '@vv/shared'
import { clampMenuWidth } from './resize'

/** 主栏（sidebar 模式）+ 二级侧栏（mixed/dual）的拖拽调宽状态与派生样式 */
export function useMenuResizing() {
  const appStore = useAppStore()
  /** 主栏实时拖拽宽度（px）；null = 未拖拽 */
  const sidebarLiveWidth = ref<number | null>(null)
  /** 二级侧栏实时拖拽宽度（px）；null = 未拖拽 */
  const secondaryLiveWidth = ref<number | null>(null)

  /** 主栏生效宽度：拖拽中优先取实时值，否则取持久化值并钳制（脏值兜底） */
  const sidebarWidthPx = computed(
    () => sidebarLiveWidth.value ?? clampMenuWidth(appStore.sidebarWidth)
  )
  /** 二级侧栏生效宽度，语义同 sidebarWidthPx */
  const secondaryWidthPx = computed(
    () => secondaryLiveWidth.value ?? clampMenuWidth(appStore.secondaryWidth)
  )

  /** 展开态桌面端才绑 inline 宽度；折叠/移动端宽度由 CSS 类（抽屉/min-width）接管 */
  const sidebarAsideStyle = computed(() =>
    appStore.mobile || appStore.sidebarCollapsed
      ? undefined
      : { width: `${sidebarWidthPx.value}px` }
  )
  /** 二级侧栏 inline 宽度，语义同 sidebarAsideStyle */
  const secondaryAsideStyle = computed(() =>
    appStore.mobile || appStore.sidebarCollapsed
      ? undefined
      : { width: `${secondaryWidthPx.value}px` }
  )

  return {
    sidebarLiveWidth,
    secondaryLiveWidth,
    sidebarWidthPx,
    secondaryWidthPx,
    sidebarAsideStyle,
    secondaryAsideStyle,
  }
}
