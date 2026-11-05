/**
 * SummaryRow 单元测试
 *
 * 当前角色（v3.0 5a）：占位组件 —— 实际汇总逻辑由 useSummary.computed 产出，
 * el-table 的 :summary-method 直接调用。本测试覆盖：
 * - mount 不崩溃
 * - BEM 类名 vv-pro-table-summary 正确生成
 * - 占位组件不渲染可见内容（hidden）
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SummaryRow from './SummaryRow.vue'

describe('SummaryRow', () => {
  it('mount 渲染成功（不崩溃）', () => {
    const wrapper = mount(SummaryRow)
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('占位组件不渲染可见内容（hidden）', () => {
    const wrapper = mount(SummaryRow)
    // 模板 <div hidden /> 不输出可见文本
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('BEM 根类名正确（vv-pro-table-summary）', () => {
    const wrapper = mount(SummaryRow)
    // 通过 html() 验证 class 字符串：jsdom + hidden 属性下 wrapper.classes() 可能为空数组
    expect(wrapper.html()).toContain('vv-pro-table-summary')
    wrapper.unmount()
  })
})
