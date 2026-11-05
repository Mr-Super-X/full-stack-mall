/**
 * SidebarResizer 拖拽手柄测试。
 *
 * 覆盖主线：mousedown→mousemove 实时事件流、mouseup commit 与清理、
 * 边界钳制、键盘调节、a11y 属性。
 *
 * @see [`./SidebarResizer.vue`](./SidebarResizer.vue) 被测组件
 * @see [`../config/resize.ts`](../config/resize.ts) 钳制常量来源
 * @group 布局：Default
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SidebarResizer from './SidebarResizer.vue'
import { MENU_DEFAULT_WIDTH, MENU_MAX_WIDTH, MENU_MIN_WIDTH } from '../config/resize'

function mountResizer(base = MENU_DEFAULT_WIDTH) {
  return mount(SidebarResizer, { props: { base, modelValue: null } })
}

/** 在 document 上派发原生鼠标事件（组件监听挂在 document 级） */
function fireMouseDoc(type: string, clientX: number) {
  document.dispatchEvent(new MouseEvent(type, { clientX }))
}

describe('SidebarResizer', () => {
  it('拖拽序列：mousedown 锁定基准，mousemove 发实时宽度，mouseup 发 commit 并复位', async () => {
    const wrapper = mountResizer(200)
    const handle = wrapper.find('.vv-menu-resizer')

    await handle.trigger('mousedown', { clientX: 300 })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([200])

    fireMouseDoc('mousemove', 340)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([240])

    fireMouseDoc('mouseup', 340)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('commit')).toEqual([[240]])
    // 复位信号：拖拽结束归 null，父级据此移除 is-resizing
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('向左拖拽减小宽度，且越过下界时钳制到 MENU_MIN_WIDTH', async () => {
    const wrapper = mountResizer(200)
    await wrapper.find('.vv-menu-resizer').trigger('mousedown', { clientX: 300 })

    fireMouseDoc('mousemove', 0) // Δ=-300，理论值 -100
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([MENU_MIN_WIDTH])
  })

  it('越过上界时钳制到 MENU_MAX_WIDTH', async () => {
    const wrapper = mountResizer(200)
    await wrapper.find('.vv-menu-resizer').trigger('mousedown', { clientX: 0 })

    fireMouseDoc('mousemove', 9999)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([MENU_MAX_WIDTH])
  })

  it('mouseup 后 document 监听已移除，后续 mousemove 不再发事件', async () => {
    const wrapper = mountResizer(200)
    await wrapper.find('.vv-menu-resizer').trigger('mousedown', { clientX: 300 })
    const countAfterDrag = wrapper.emitted('update:modelValue')?.length ?? 0

    fireMouseDoc('mouseup', 330)
    await wrapper.vm.$nextTick()
    fireMouseDoc('mousemove', 400)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.length).toBe(countAfterDrag + 1) // 仅 +1（null 复位）
  })

  it('键盘方向键按 8px 步进调节并立即 commit', async () => {
    const wrapper = mountResizer(200)
    const handle = wrapper.find('.vv-menu-resizer')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('commit')).toEqual([[208]])

    await handle.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([192])

    // 非方向键不响应
    await handle.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('commit')?.length).toBe(2)
  })

  it('暴露 separator 语义与 aria 值域，辅助技术可感知', () => {
    const wrapper = mountResizer(200)
    const handle = wrapper.find('.vv-menu-resizer')
    expect(handle.attributes('role')).toBe('separator')
    expect(handle.attributes('aria-orientation')).toBe('vertical')
    expect(Number(handle.attributes('aria-valuemin'))).toBe(MENU_MIN_WIDTH)
    expect(Number(handle.attributes('aria-valuemax'))).toBe(MENU_MAX_WIDTH)
    expect(Number(handle.attributes('aria-valuenow'))).toBe(200)
  })

  it('卸载时兜底清理：拖拽中销毁组件，body 全局类不残留', async () => {
    const wrapper = mountResizer(200)
    await wrapper.find('.vv-menu-resizer').trigger('mousedown', { clientX: 300 })
    expect(document.body.classList.contains('vv-menu-resizing')).toBe(true)

    wrapper.unmount()
    expect(document.body.classList.contains('vv-menu-resizing')).toBe(false)
  })
})
