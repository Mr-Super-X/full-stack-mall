import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useTrampolineTabbar } from './useTrampolineTabbar'

const TABS = [
  { key: 'home', label: '首页' },
  { key: 'grid', label: '分类' },
  { key: 'bag', label: '购物袋' },
  { key: 'user', label: '我的' },
] as const

/** 以 stub 组件承载 composable（onMounted/onUnmounted 需要组件上下文）；函数 ref 接 wrapRef */
function mountTabbar(reduced = false) {
  const modelValue = ref<string>('home')
  const reducedMotion = ref(reduced)
  let api!: ReturnType<typeof useTrampolineTabbar>
  const Harness = defineComponent({
    setup() {
      api = useTrampolineTabbar([...TABS], { modelValue, reducedMotion })
      return () =>
        h('div', {
          ref: (el: Element | null) => {
            api.wrapRef.value = el as HTMLElement | null
          },
        })
    },
  })
  const w = mount(Harness)
  return { w, api, modelValue, reducedMotion }
}

describe('useTrampolineTabbar', () => {
  it('挂载后渲染静态首帧：panelD 含 M/Z、ballStyle 含 translate、画布 362 坐标系', async () => {
    const { api } = mountTabbar()
    await nextTick()
    expect(api.panelD.value.startsWith('M0 ')).toBe(true)
    expect(api.panelD.value.endsWith('Z')).toBe(true)
    expect(api.ballTransform.value).toContain('translate(')
    // jsdom clientWidth=0 → scale 钳到 0；画布尺寸仍按设计稿 362 坐标系输出
    expect(api.innerStyle.value.width).toBe('362px')
    expect(api.innerStyle.value.transform).toBe('scale(0)')
  })

  it('tapIndex 切换选中：activeIndex 立即更新（零延迟反馈）', async () => {
    const { api } = mountTabbar()
    await nextTick()
    expect(api.activeIndex.value).toBe(0)
    expect(api.tapIndex(2)).toBe('changed')
    expect(api.activeIndex.value).toBe(2)
  })

  it('modelValue 外部变更驱动引擎跟随（防回环：已选 index 忽略）', async () => {
    const { api, modelValue } = mountTabbar()
    await nextTick()
    modelValue.value = 'bag' // index 2
    await nextTick()
    expect(api.activeIndex.value).toBe(2)
    modelValue.value = 'bag' // 重复赋值同 key → 无变化
    await nextTick()
    expect(api.activeIndex.value).toBe(2)
  })

  it('reducedMotion：tapIndex 走瞬时切换，activeIndex 立即到位', async () => {
    const { api, reducedMotion } = mountTabbar(true)
    await nextTick()
    expect(reducedMotion.value).toBe(true)
    expect(api.tapIndex(3)).toBe('changed')
    expect(api.activeIndex.value).toBe(3)
  })
})
