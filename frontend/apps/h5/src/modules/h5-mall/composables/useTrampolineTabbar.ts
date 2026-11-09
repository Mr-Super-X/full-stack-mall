// Trampoline Tabbar Vue 编排层：引擎状态 ↔ 响应式渲染输出 ↔ 宿主 v-model。
//
// 结构裁决（读代码读不出的约定，变更前先看这里）：
//   - 引擎 state 为普通对象（非响应式）：每帧 step 高频变更不走 Vue 依赖追踪，
//     渲染输出由 render() 手动同步到 ref（字符串/数组整体替换）；
//   - reducedMotion 为 Ref（媒体查询可动态变化）：降级走 instantSelect 瞬时切换，
//     且此时不启动 rAF（零动画零空转）；
//   - rAF / 尺寸适配已拆子 Hook：use-trampoline-loop.ts / use-trampoline-fit.ts；
//   - modelValue watch 与 tapIndex 互防回环：changed 才更新 model，watch 命中已选 index 即忽略。

import type { Ref } from 'vue'

import {
  buildPanelPath,
  ballTransform as computeBallTransform,
  iconOffsetY,
} from './trampoline-geometry'
import {
  applyTap,
  createInitialState,
  instantSelect,
  isSettled,
  step,
  type TapResult,
} from './trampoline-engine'
import { useRafLoop } from './use-trampoline-loop'
import { useTrampolineFit } from './use-trampoline-fit'

export interface UseTrampolineTabbarOptions {
  /** 宿主受控选中 key（v-model）；外部变更（路由/编程式）经 watch 驱动引擎 */
  modelValue: Ref<string>
  /** prefers-reduced-motion：true 时全部动画降级为瞬时切换 */
  reducedMotion: Ref<boolean>
}

export function useTrampolineTabbar(
  tabs: ReadonlyArray<{ key: string }>,
  options: UseTrampolineTabbarOptions
) {
  const n = tabs.length
  const initialIdx = Math.max(
    0,
    tabs.findIndex((t) => t.key === options.modelValue.value)
  )
  const state = createInitialState(n, initialIdx)

  const panelD = ref('')
  const ballTransform = ref('')
  const iconYs = ref<number[]>(Array.from({ length: n }, () => 0))
  const activeIndex = ref(initialIdx)
  const wrapRef = ref<HTMLElement | null>(null)

  function render(): void {
    panelD.value = buildPanelPath({
      ballX: state.ball.x,
      ballCy: state.ball.cy,
      bulgeX: state.bulge.x,
      bulgeA: state.bulge.a,
    })
    ballTransform.value = computeBallTransform({
      phase: state.phase,
      ballX: state.ball.x,
      ballCy: state.ball.cy,
      vx: state.ball.vx,
      vyRender: state.ball.vyRender,
      squashS: state.squash.s,
    })
    iconYs.value = state.icons.map((ic) => iconOffsetY(state.ball.cy, ic.p))
    activeIndex.value = state.selected
  }

  const { innerStyle, fit } = useTrampolineFit(wrapRef)
  const loop = useRafLoop(
    (dt) => {
      step(state, dt, n)
      render()
    },
    () => isSettled(state)
  )

  function tapIndex(i: number): TapResult {
    if (options.reducedMotion.value) {
      const changed = i !== state.selected
      instantSelect(state, i, n)
      render()
      return changed ? 'changed' : 'same-hop'
    }
    const result = applyTap(state, i, n)
    if (result !== 'ignored') {
      render() // 点击零延迟反馈（ride 蓄力首帧），随后交给 rAF
      loop.start()
    }
    return result
  }

  // 外部 modelValue 变更（路由回写/编程式）→ 驱动引擎切换；
  // modelValue 来自宿主 props（toRef），props 下行是标准响应式通道
  watch(options.modelValue, (key) => {
    const i = tabs.findIndex((t) => t.key === key)
    if (i >= 0 && i !== state.selected) tapIndex(i)
  })

  onMounted(() => {
    fit()
    render() // 静态首帧（idle 不启动循环）
  })

  return { wrapRef, innerStyle, panelD, ballTransform, iconYs, activeIndex, tapIndex }
}
