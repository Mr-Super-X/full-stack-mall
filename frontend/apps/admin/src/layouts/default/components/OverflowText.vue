<script setup lang="ts">
/**
 * 溢出省略文本：文字被 ellipsis 截断时 hover 显示完整 tooltip，未溢出则不弹。
 *
 * 为什么按溢出动态启停：栏宽可被拖拽手柄改变（@see ../config/resize.ts），长标题
 * 在窄栏里截断后需要 tooltip 补全信息；但文字完整时弹 tooltip 是视觉干扰，
 * 故按 scrollWidth > clientWidth 判断，仅溢出时启用 el-tooltip。
 *
 * 检测用 ResizeObserver 而非监听单一来源：栏宽拖拽 / 折叠切换 / 窗口缩放都会
 * 改变本元素宽度，观察元素本身可覆盖全部。jsdom 无 ResizeObserver，组件内已守卫
 * （测试用 stubGlobal 注入 mock）。
 *
 * 折叠态不依赖本组件：EP collapse 用 CSS 隐藏菜单项直接子 span（本组件根元素），
 * 折叠 tooltip 由 AppMenu 的 showCollapsedTooltip 分支另行处理。
 *
 * 样式结构（2026-10-29 样式审计改造）：text-overflow 三件套走全局 utility
 * `.vv-ellipsis`（@vv/ui custom.scss 单源，模板 class 挂载）——本组件 style 块
 * 因此移除。块级化语义保留：ellipsis 需要块级盒，依赖 flex 父级（EP 菜单项 /
 * 子菜单标题均为 flex 容器），脱离 flex 父级使用时由消费方自行块级化
 *
 * @see [`./AppMenu.vue`](./AppMenu.vue) 主要消费方（菜单标题 4 处）
 * @group 布局：Default
 */
const bem = createNamespace('overflow-text')

defineProps<{
  /** 完整文本：同时作为显示内容与 tooltip 内容，保证同源 */
  text: string
}>()

/** 溢出标志，直接驱动 el-tooltip 的 disabled */
const overflow = ref(false)
const textEl = useTemplateRef<HTMLSpanElement>('textEl')

function detectOverflow() {
  const el = textEl.value
  if (!el) return
  overflow.value = el.scrollWidth > el.clientWidth
}

let observer: ResizeObserver | undefined

onMounted(() => {
  detectOverflow() // 挂载先同步检测一次：首帧不依赖 RO 回调（含 jsdom 测试环境）
  if (typeof ResizeObserver !== 'undefined' && textEl.value) {
    observer = new ResizeObserver(detectOverflow)
    observer.observe(textEl.value)
  }
})

// RO 观察随组件卸载释放：手柄拖拽导致的栏宽变化在菜单项销毁后无意义，
// 不 disconnect 会持续持有元素引用
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <el-tooltip :content="text" placement="right" :disabled="!overflow">
    <!-- 三件套改挂全局 utility class .vv-ellipsis（custom.scss 单源）——2026-10-29 样式审计示范改造 -->
    <span ref="textEl" :class="[bem.b(), 'vv-ellipsis']">{{ text }}</span>
  </el-tooltip>
</template>
