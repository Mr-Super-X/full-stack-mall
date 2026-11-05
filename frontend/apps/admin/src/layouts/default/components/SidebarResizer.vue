<script setup lang="ts">
/**
 * 侧栏右缘拖拽调宽手柄（纯交互原语，不感知 store 字段语义）。
 *
 * 职责边界：只负责把鼠标/键盘操作翻译成宽度事件——
 * - 拖拽中：emit `update:modelValue`（实时宽度，非 null 即"拖拽中"信号，布局壳据此
 *   禁用 width 过渡动画，见 ../index.vue 的 is-resizing 绑定）
 * - 拖拽结束：emit `commit`（最终宽度，由父级决定落库目标字段）
 * 显隐控制（折叠/移动端隐藏）由父级 v-if 负责，本组件不判断布局状态。
 *
 * @see [`../config/resize.ts`](../config/resize.ts) clampMenuWidth 边界钳制
 * @see [`../index.vue`](../index.vue) 布局壳消费方（两处实例：主栏 + 二级侧栏）
 * @group 布局：Default
 */
import { clampMenuWidth, MENU_MAX_WIDTH, MENU_MIN_WIDTH } from '../config/resize'

const bem = createNamespace('menu-resizer')

const props = defineProps<{
  /** 拖拽基准宽度（当前生效宽度，px）——mousedown 时锁定为起始宽 */
  base: number
  /** 实时宽度（px）；null 表示未拖拽。拖拽中由本组件写入，父级只读判断 is-resizing */
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [width: number | null]
  /** 拖拽/键盘调节结束，最终宽度（已钳制），父级写入持久化字段 */
  commit: [width: number]
}>()

/** 拖拽起始鼠标 X 坐标与起始宽度（mousedown 锁定） */
let startX = 0
let startWidth = 0
/** 最近一次钳制后的宽度，mouseup 时作为 commit 载荷（props 回流有延迟，不可直接读） */
let lastWidth = 0

/** 拖拽中标志：驱动手柄高亮，同时阻止重复进入 onUp 清理 */
const dragging = ref(false)

function beginDrag(e: MouseEvent) {
  // 防 mousedown 默认行为（文本选中/图片拖拽幽灵），手柄本身无内容，preventDefault 无副作用
  e.preventDefault()
  startX = e.clientX
  startWidth = props.base
  lastWidth = props.base
  dragging.value = true
  emit('update:modelValue', lastWidth)
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', endDrag)
  // 拖出浏览器窗口后 mouseup 落在窗外不冒泡到 document，mouseleave 兜底收尾
  document.addEventListener('mouseleave', endDrag)
  // 全局禁文本选择 + 保持 col-resize 光标（移出手柄热区后光标/选择行为仍可控）
  document.body.classList.add('vv-menu-resizing')
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  lastWidth = clampMenuWidth(startWidth + e.clientX - startX)
  emit('update:modelValue', lastWidth)
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mouseleave', endDrag)
  document.body.classList.remove('vv-menu-resizing')
  emit('commit', lastWidth)
  emit('update:modelValue', null)
}

/** 键盘调节（a11y：separator 语义要求方向键可操作），步进 8px 与主流实现一致 */
const KEYBOARD_STEP = 8

function onKeyDown(e: KeyboardEvent) {
  const delta = e.key === 'ArrowRight' ? KEYBOARD_STEP : e.key === 'ArrowLeft' ? -KEYBOARD_STEP : 0
  if (delta === 0) return
  e.preventDefault()
  lastWidth = clampMenuWidth(props.base + delta)
  emit('update:modelValue', lastWidth)
  emit('commit', lastWidth)
  emit('update:modelValue', null)
}

// 组件卸载时若在拖拽中（极端：拖拽时路由切换把手柄 v-if 掉），须兜底清理全局监听与 body 状态，
// 否则 mousemove 空转 + 全局禁选残留
onUnmounted(endDrag)
</script>

<template>
  <div
    :class="[bem.b(), bem.is('active', dragging)]"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="modelValue ?? base"
    :aria-valuemin="MENU_MIN_WIDTH"
    :aria-valuemax="MENU_MAX_WIDTH"
    tabindex="0"
    :title="`${base}px`"
    @mousedown="beginDrag"
    @keydown="onKeyDown"
  ></div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-menu-resizer {
  position: absolute;
  top: 0;
  right: -3px; // 热区跨出侧栏 3px：贴边也易命中（侧栏有 1px 右边框）
  z-index: 5; // 压在菜单之上、低于侧栏整体（z-index 30）
  width: 6px;
  height: 100%;
  cursor: col-resize;
  outline: none;

  // 默认透明，hover/激活显示主题色指示条（1px 视觉宽度，符合"细把手"惯例）
  &::after {
    position: absolute;
    top: 0;
    right: 3px;
    width: 1px;
    height: 100%;
    content: '';
    background: var(--el-color-primary);
    opacity: 0;
    transition: opacity var(--transition-time-02);
  }

  &:hover::after,
  &:focus-visible::after,
  &.is-active::after {
    opacity: 0.7;
  }

  &.is-active::after {
    width: 2px; // 拖拽中反馈加粗
    opacity: 1;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 1px var(--el-color-primary);
  }
}
</style>
