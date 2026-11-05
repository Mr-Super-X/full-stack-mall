/**
 * SelectionBar 组件单元测试（spec 2026-09-18 §3.5 测试矩阵）
 *
 * 覆盖场景：
 * 1) 渲染「已选 N 项」（N = ctx.selectedCount）
 * 2) 点击「清除」emit clear
 * 3) slot 接管优先：提供 default slot 时 actions 配置不渲染（ToolbarRenderer 不挂载）
 * 4) 无 slot 时 actions 配置经 ToolbarRenderer 渲染
 * 5) 可访问性：role="status" + aria-live="polite"（选中变化可被辅助技术感知）
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import SelectionBar from './SelectionBar.vue'
import ToolbarRenderer from './ToolbarRenderer.vue'
import type { ToolbarAction, ToolbarCtx } from '../types'

function makeCtx(overrides: Partial<ToolbarCtx> = {}): ToolbarCtx {
  return {
    selectedRows: [{ id: 1 }, { id: 2 }],
    selectedCount: 2,
    loading: false,
    refresh: vi.fn(),
    ...overrides,
  }
}

describe('SelectionBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('渲染「已选 N 项」（N = ctx.selectedCount）', () => {
    const wrapper = mount(SelectionBar, { props: { ctx: makeCtx({ selectedCount: 5 }) } })
    expect(wrapper.text()).toContain('已选')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('项')
  })

  it('点击「清除」emit clear', async () => {
    const wrapper = mount(SelectionBar, { props: { ctx: makeCtx() } })
    await wrapper.find('[data-test="selection-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('slot 接管优先：提供 default slot 时 ToolbarRenderer 不挂载', () => {
    const actions: ToolbarAction[] = [{ label: '配置按钮', onClick: vi.fn() }]
    const wrapper = mount(SelectionBar, {
      props: { ctx: makeCtx(), actions },
      slots: { default: '<div class="custom-batch">自定义批量区</div>' },
    })
    expect(wrapper.find('.custom-batch').exists()).toBe(true)
    expect(wrapper.findComponent(ToolbarRenderer).exists()).toBe(false)
  })

  it('slot 作用域下发 ctx + clearSelection（点击调用 emit clear）', async () => {
    const wrapper = mount(SelectionBar, {
      props: { ctx: makeCtx({ selectedCount: 3 }) },
      slots: {
        default: `<template #default="{ selectedCount, clearSelection }">
          <button class="slot-clear" @click="clearSelection">slot清除({{ selectedCount }})</button>
        </template>`,
      },
    })
    const btn = wrapper.find('.slot-clear')
    expect(btn.text()).toContain('3')
    await btn.trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('无 slot 时 actions 配置经 ToolbarRenderer 渲染', () => {
    const wrapper = mount(SelectionBar, {
      props: {
        ctx: makeCtx(),
        actions: [{ label: '批量删除', onClick: vi.fn() }],
      },
    })
    expect(wrapper.findComponent(ToolbarRenderer).exists()).toBe(true)
    expect(wrapper.text()).toContain('批量删除')
  })

  it('可访问性：role="status" + aria-live="polite"', () => {
    const wrapper = mount(SelectionBar, { props: { ctx: makeCtx() } })
    const root = wrapper.find('[role="status"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-live')).toBe('polite')
  })

  // ─────────── v3.5 PR1-A：A11y aria-label 补齐 ───────────

  it('v3.5：清除按钮 aria-label="清除选择"', () => {
    const wrapper = mount(SelectionBar, { props: { ctx: makeCtx() } })
    expect(wrapper.find('[data-test="selection-clear"]').attributes('aria-label')).toBe('清除选择')
  })
})
