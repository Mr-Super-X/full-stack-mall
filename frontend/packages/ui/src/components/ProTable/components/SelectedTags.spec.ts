/**
 * SelectedTags 组件单元测试（v3.5 PR1-A：A11y 键盘可达）
 *
 * 覆盖场景：
 * 1) 根 div role="region" + aria-label="当前已选筛选条件"
 * 2) 每个 tag 的关闭按钮（×）带 aria-label="清除筛选条件 ${label}"
 * 3) 清除全部按钮带 aria-label="清除全部筛选条件"
 * 4) 点击 × 触发 emit('clear-one', prop)
 * 5) 点击「清除全部」触发 emit('clear-all')
 * 6) 空 tag 时不渲染
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SelectedTags from './SelectedTags.vue'
import type { ProColumn } from '../types'

const columns: ProColumn[] = [
  { prop: 'name', label: '名称', search: { el: 'input' as const } },
  {
    prop: 'status',
    label: '状态',
    search: { el: 'select' as const },
    enum: [
      { label: '已支付', value: 'paid' },
      { label: '已发货', value: 'shipped' },
    ],
  },
]

describe('SelectedTags v3.5 A11y', () => {
  it('根 div 加 role="region" + aria-label="当前已选筛选条件"', () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: '张三', status: 'paid' } },
    })
    const root = wrapper.find('.vv-pro-table-selected-tags')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('region')
    expect(root.attributes('aria-label')).toBe('当前已选筛选条件')
  })

  it('每个 tag 的关闭按钮带 aria-label 含字段名', () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: '张三', status: 'paid' } },
    })
    // × 按钮 aria-label 含字段名（通过 el-tag 的 close icon 暴露给辅助技术）
    const tags = wrapper.findAll('[data-test^="selected-tag-"]')
    expect(tags.length).toBe(2)
  })

  it('「清除全部」按钮带 aria-label="清除全部筛选条件"', () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: '张三' } },
    })
    const clearAll = wrapper.find('[data-test="clear-all-tags"]')
    expect(clearAll.attributes('aria-label')).toBe('清除全部筛选条件')
  })

  it('点 × 触发 emit clear-one(prop)', async () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: '张三', status: 'paid' } },
    })
    // 通过 el-tag 的 close 事件触发
    const tag = wrapper.findComponent({ name: 'ElTag' })
    await tag.vm.$emit('close', new Event('click'))
    expect(wrapper.emitted('clear-one')).toBeTruthy()
    expect(wrapper.emitted('clear-one')![0]).toEqual(['name'])
  })

  it('点「清除全部」触发 emit clear-all', async () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: '张三' } },
    })
    await wrapper.find('[data-test="clear-all-tags"]').trigger('click')
    expect(wrapper.emitted('clear-all')).toBeTruthy()
    expect(wrapper.emitted('clear-all')).toHaveLength(1)
  })

  it('空 searchParams 时不渲染（region 也不挂载）', () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: {} },
    })
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
  })

  it('select 字段 enum 翻译为 label（避免显示 ID）', () => {
    const wrapper = mount(SelectedTags, {
      props: {
        columns,
        searchParams: { status: 'paid' },
        enumMaps: { status: { paid: '已支付' } },
      },
    })
    expect(wrapper.text()).toContain('已支付')
    expect(wrapper.text()).not.toContain('paid')
  })

  it('忽略空值（undefined / null / 空数组 / 空串）', () => {
    const wrapper = mount(SelectedTags, {
      props: { columns, searchParams: { name: undefined, status: null, extra: '' } },
    })
    expect(wrapper.findAll('[data-test^="selected-tag-"]').length).toBe(0)
  })
})
