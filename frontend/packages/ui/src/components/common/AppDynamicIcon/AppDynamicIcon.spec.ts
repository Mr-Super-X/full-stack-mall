import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppDynamicIcon from './AppDynamicIcon.vue'

/**
 * vitest 无法解析 unplugin-icons 的 virtual:icons 虚拟模块（Icons 插件不在测试管线），
 * 这里 mock 注册表：用透传 attrs 的 stub 组件替代真实 SVG 组件，验证「查表渲染 + 属性透传」行为本身。
 * mock 路径必须与组件内 import 的 './registry.ts' 一致才能命中（registry 与组件同目录内聚）。
 */
const stubPlus = defineComponent({
  name: 'StubPlus',
  setup:
    (_props, { attrs }) =>
    () =>
      h('svg', attrs, 'plus'),
})
const stubHome = defineComponent({
  name: 'StubHome',
  setup:
    (_props, { attrs }) =>
    () =>
      h('svg', attrs, 'home'),
})

vi.mock('./registry.ts', () => ({
  resolveAppIcon: (name: string) =>
    (({ 'ep:plus': stubPlus, 'tabler:home': stubHome }) as Record<string, unknown>)[name],
}))

describe('AppDynamicIcon', () => {
  it('按 name 查表渲染对应图标组件', () => {
    const wrapper = mount(AppDynamicIcon, { props: { name: 'ep:plus' } })
    expect(wrapper.find('svg').text()).toBe('plus')
  })

  it('name 变化时切换图标组件', async () => {
    const wrapper = mount(AppDynamicIcon, { props: { name: 'ep:plus' } })
    expect(wrapper.find('svg').text()).toBe('plus')
    await wrapper.setProps({ name: 'tabler:home' })
    expect(wrapper.find('svg').text()).toBe('home')
  })

  it('size 透传为 SVG 的 width / height 属性', () => {
    const wrapper = mount(AppDynamicIcon, { props: { name: 'ep:plus', size: 24 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('24')
    expect(svg.attributes('height')).toBe('24')
  })

  it('不传 size 时不渲染 width / height（保留 SVG 编译产物默认 1.2em，防止 v-bind undefined 移除属性致塌陷）', () => {
    const wrapper = mount(AppDynamicIcon, { props: { name: 'ep:plus' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBeUndefined()
    expect(svg.attributes('height')).toBeUndefined()
  })

  it('装饰性图标默认带 aria-hidden（a11y）', () => {
    const wrapper = mount(AppDynamicIcon, { props: { name: 'ep:plus' } })
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })
})
