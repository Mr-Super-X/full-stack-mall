<script setup lang="ts">
/**
 * 大屏布局：数据面板基座（scale 等比缩放适配）。
 *
 * 消费方式（与 portal / default / h5 同构）：路由父记录 component 直挂本布局即获得能力——
 *   { path: '/big-demo', component: () => import('@/layouts/big/index.vue'), children: [...] }
 *
 * 能力模型：
 *   - 子页面样式按设计稿写死 px（默认 1920×1080；超宽页 meta.bigScreen 声明 9000×1080）
 *   - 运行时容器按 min(vw/dw, vh/dh) 等比缩放并居中（比例不符的空白为深色底）
 *   - 只缩放本布局自有容器 div，不碰 html/body——对 default / portal / h5 零残留
 *
 * 已知限制：
 *   - 容器内避免使用 teleport 到 body 的弹层组件（ElSelect 下拉等不随缩放），
 *     交互控件用内联形态（按钮/开关/滑块）
 *   - stage 带 transform 后成为后代 position: fixed 元素的 containing block
 *     （fixed 不再相对视口）——大屏页内如需悬浮元素请用 absolute 相对 stage 定位
 *
 * 注意：本布局不设计为被 keep-alive 缓存（项目 keep-alive 只作用于 default 内业务页）。
 *
 * @see [`./config/scale.ts`](./config/scale.ts) scale 纯计算 + meta 契约
 * @group 布局
 */
import {
  BIG_SCALE_RESIZE_DELAY,
  BIG_SCALE_STATE_KEY,
  computeBigScale,
  resolveBigScreenSize,
  type BigScaleState,
} from './config/scale'

// 运行时 BEM 命名空间：vv-big-layout
const bem = createNamespace('big-layout')

// vue-router（unplugin-auto-import 注入）
const route = useRoute()

// setup 顶层即按当前 meta + 视口初始化（scale.ts 纯计算零 Vue 依赖、无 SSR 顾虑）：
// 避免直开超宽页（9000 设计稿）时先按默认 1920×1080 渲染首帧再跳变的 FOUC
const initialDesign = resolveBigScreenSize(route.meta)
/** 当前生效的缩放状态（meta 切换 / 视口变化时整体替换） */
const state = ref<BigScaleState>({
  ...computeBigScale(initialDesign, window.innerWidth, window.innerHeight),
  designWidth: initialDesign.width,
  designHeight: initialDesign.height,
})

/** 立即按当前视口 + 路由 meta 重算 */
function recalc(): void {
  const design = resolveBigScreenSize(route.meta)
  const metrics = computeBigScale(design, window.innerWidth, window.innerHeight)
  state.value = { ...metrics, designWidth: design.width, designHeight: design.height }
}

let recalcTimer: ReturnType<typeof setTimeout> | undefined

/** resize / pageshow 走防抖（拖动窗口边缘时高频触发） */
function scheduleRecalc(): void {
  clearTimeout(recalcTimer)
  recalcTimer = setTimeout(recalc, BIG_SCALE_RESIZE_DELAY)
}

/** bfcache 恢复（pageshow persisted）时视口可能已变化，需重算 */
function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleRecalc()
}

// 同 layout 内跳转（1920 页 ↔ 9000 页）meta 变化 → 立即重算（不防抖，避免两页间闪烁中间态）
watch(() => route.meta.bigScreen, recalc)

onMounted(() => {
  recalc()
  window.addEventListener('resize', scheduleRecalc)
  window.addEventListener('pageshow', onPageShow)
})
onUnmounted(() => {
  clearTimeout(recalcTimer)
  window.removeEventListener('resize', scheduleRecalc)
  window.removeEventListener('pageshow', onPageShow)
})

// demo 组件（BigChart）消费：devicePixelRatio × scale 保持图表清晰
// provide / readonly 由 unplugin-auto-import 注入
provide(BIG_SCALE_STATE_KEY, readonly(state))

/**
 * 容器内联样式：尺寸写死设计稿 px，transform 平移（视口坐标）在前、缩放在后。
 * transform-origin: top left 是算法前提（offset 即缩放后左上角的目标位置）。
 */
const stageStyle = computed(() => ({
  width: `${state.value.designWidth}px`,
  height: `${state.value.designHeight}px`,
  transform: `translate(${state.value.offsetX}px, ${state.value.offsetY}px) scale(${state.value.scale})`,
}))
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('stage')" :style="stageStyle">
      <RouterView />
    </div>
  </div>
</template>

<style lang="scss">
// 非 scoped：big-tokens 提供的 CSS 变量需对 big-demo 子组件可见（同 portal-tokens 模式）
@use './styles/big-tokens.scss' as *;

// big layout 不走 postcss-pxtorem（仅 h5 前缀目录在转换范围），px 原样输出
.#{$BEM_PREFIX}-big-layout {
  position: fixed;
  inset: 0;
  overflow: hidden;
  // 深蓝黑底：比例不符时的留白填充色，与大屏深色科技风一致
  background: var(--big-bg-layout);

  &__stage {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
  }
}
</style>
