// Trampoline Tabbar 画布尺寸适配子 Hook：容器宽 → 362 设计稿坐标系整体 scale。
//
// 结构裁决：
//   - 几何尺寸一律 JS 内联（pxtorem 不碰内联样式）：若写进 SFC <style> 会被转 rem，
//     与 JS scale 形成双重缩放；
//   - scale 不限上限：面板铺满容器宽（spec §2.1「等分面板宽度」，面板即容器）；
//   - transform scale 不撑布局：wrap 占位高度由 fit() 手动补偿（视觉高 = TB_H × s）。

import type { Ref } from 'vue'

import { PANEL, TB_H, clamp } from './trampoline-geometry'

export function useTrampolineFit(wrapRef: Ref<HTMLElement | null>) {
  /** 内层 362 坐标系画布尺寸 + 缩放 */
  const innerStyle = ref({ width: '0px', height: '0px', transform: 'scale(1)' })

  function fit(): void {
    const el = wrapRef.value
    if (!el) return
    const s = clamp(el.clientWidth / PANEL.w, 0, Number.MAX_VALUE)
    innerStyle.value = {
      width: `${PANEL.w}px`,
      height: `${TB_H}px`,
      transform: `scale(${s})`,
    }
    el.style.height = `${Math.round(TB_H * s)}px`
  }

  onMounted(() => {
    fit()
    window.addEventListener('resize', fit)
  })
  onUnmounted(() => window.removeEventListener('resize', fit))

  return { innerStyle, fit }
}
