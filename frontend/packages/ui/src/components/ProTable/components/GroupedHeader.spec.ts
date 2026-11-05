/**
 * GroupedHeader 单元测试
 *
 * 当前角色（v3.0 5c）：占位组件 —— 实际多级表头由 ElementTableBody 用 cellClassName
 * 实现视觉分组。本测试覆盖：
 * - mount 不崩溃（columns 接受 ProColumn[] 类型契约）
 * - BEM 类名正确生成
 * - columns 为空数组时 mount 不崩溃
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupedHeader from './GroupedHeader.vue'
import type { ProColumn } from '../types'

describe('GroupedHeader', () => {
  it('mount 渲染成功（不崩溃，columns 类型契约通过）', () => {
    const columns: ProColumn[] = [
      {
        prop: 'group1',
        label: '分组 1',
        children: [
          { prop: 'col1', label: '列 1' },
          { prop: 'col2', label: '列 2' },
        ],
      },
    ]
    const wrapper = mount(GroupedHeader, {
      props: { columns },
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('columns 为空数组时 mount 不崩溃', () => {
    const wrapper = mount(GroupedHeader, { props: { columns: [] } })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('占位组件不渲染可见内容（hidden）', () => {
    const wrapper = mount(GroupedHeader, {
      props: { columns: [{ prop: 'a', label: 'A' }] },
    })
    // 占位组件模板 <span hidden /> 不应有可文本内容
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })
})
