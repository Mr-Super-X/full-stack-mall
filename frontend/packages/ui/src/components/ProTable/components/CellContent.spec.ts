/**
 * CellContent 组件单元测试
 *
 * 覆盖场景：
 * 1) 原始值（字符串/数字）走文本插值
 * 2) VNode（render 函数 / enum ElTag 产物）走 component 挂载
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import CellContent from './CellContent.vue'

describe('CellContent', () => {
  it('原始值走文本插值', () => {
    const wrapper = mount(CellContent, { props: { content: 'hello' } })
    expect(wrapper.text()).toBe('hello')
  })

  it('数字/null 等非 VNode 值同样走文本插值', () => {
    const wrapper = mount(CellContent, { props: { content: 42 } })
    expect(wrapper.text()).toBe('42')
  })

  it('VNode 走 component 挂载（resolveCell 的 render/enum 产物）', () => {
    const wrapper = mount(CellContent, {
      props: { content: h('span', { class: 'tag-mock' }, 'vnode-text') },
    })
    expect(wrapper.find('span.tag-mock').exists()).toBe(true)
    expect(wrapper.text()).toBe('vnode-text')
  })
})
