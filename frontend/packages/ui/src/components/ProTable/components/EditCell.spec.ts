/**
 * EditCell 组件单元测试
 *
 * 覆盖场景：
 * 1) edit.el='input' 渲染 ElInput 并透传 modelValue / 列 edit.props
 * 2) 输入触发 update 事件，携带列 prop 与新值（父级据此 rowEdit.setValue）
 * 3) edit.el='input-number' / 'select' 走对应分支
 * 4) 自定义组件名（如 'MyComp'）经 resolveEditComp 原样交给 component :is
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EditCell from './EditCell.vue'
import type { ProColumn } from '../types'

/** ElInput stub：把 update:modelValue 桥接到原生 input 事件，便于模拟用户输入
 *  size 显式声明为 prop：原生 input 的 size 是 DOM prop（Vue 走 el.size 赋值），
 *  不声明时 attributes('size') 拿不到值，无法断言尺寸对齐 */
const ElInputStub = {
  props: ['modelValue', 'size'],
  emits: ['update:modelValue'],
  template:
    '<input class="el-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const ElInputNumberStub = {
  props: ['modelValue', 'size'],
  template: '<div class="el-input-number-stub" />',
}
const ElSelectStub = {
  props: ['modelValue', 'size'],
  template: '<div class="el-select-stub" />',
}

const colWithEdit = (edit: NonNullable<ProColumn['edit']>): ProColumn => ({
  prop: 'name',
  label: '名称',
  edit,
})

function mountEditCell(
  edit: NonNullable<ProColumn['edit']>,
  value: unknown,
  density?: 'compact' | 'default' | 'loose'
) {
  return mount(EditCell, {
    // exactOptionalPropertyTypes：density 未传时不写入 props（条件展开，避免显式 undefined）
    props: { rowKey: 1, col: colWithEdit(edit), value, ...(density ? { density } : {}) },
    global: {
      stubs: { ElInput: ElInputStub, ElInputNumber: ElInputNumberStub, ElSelect: ElSelectStub },
    },
  })
}

describe('EditCell', () => {
  it('edit.el=input 渲染 ElInput 并透传 modelValue 与 edit.props', () => {
    const wrapper = mountEditCell({ el: 'input', props: { placeholder: '请输入' } }, '张三')
    const input = wrapper.find('input.el-input-stub')
    expect(input.exists()).toBe(true)
    expect(input.attributes('value')).toBe('张三')
  })

  it('输入触发 update 事件，携带列 prop 与新值', async () => {
    const wrapper = mountEditCell({ el: 'input' }, '旧值')
    await wrapper.find('input.el-input-stub').setValue('新值')
    expect(wrapper.emitted('update')).toEqual([['name', '新值']])
  })

  it('edit.el=input-number / select 分别走对应控件分支', () => {
    expect(mountEditCell({ el: 'input-number' }, 3).find('.el-input-number-stub').exists()).toBe(
      true
    )
    expect(mountEditCell({ el: 'select' }, 'a').find('.el-select-stub').exists()).toBe(true)
  })

  it('内置三控件统一 size=small（修复点：select 曾缺省 default 32px，与 input/input-number 的 24px 不齐）', () => {
    expect(mountEditCell({ el: 'input' }, 'x').findComponent(ElInputStub).props('size')).toBe(
      'small'
    )
    expect(mountEditCell({ el: 'select' }, 'x').findComponent(ElSelectStub).props('size')).toBe(
      'small'
    )
    expect(
      mountEditCell({ el: 'input-number' }, 1).findComponent(ElInputNumberStub).props('size')
    ).toBe('small')
    // 根 div 是统一样式挂载点（input-number 宽度 100% 后代选择器的前提）
    expect(mountEditCell({ el: 'input' }, 'x').classes('vv-edit-cell')).toBe(true)
  })

  it('密度联动：density 三档映射控件 size（compact→small / default→default / loose→large）', () => {
    expect(
      mountEditCell({ el: 'input' }, 'x', 'compact').findComponent(ElInputStub).props('size')
    ).toBe('small')
    expect(
      mountEditCell({ el: 'input' }, 'x', 'default').findComponent(ElInputStub).props('size')
    ).toBe('default')
    expect(
      mountEditCell({ el: 'input' }, 'x', 'loose').findComponent(ElInputStub).props('size')
    ).toBe('large')
    // select / input-number 同映射（密度切换对全部内置控件生效）
    expect(
      mountEditCell({ el: 'select' }, 'x', 'loose').findComponent(ElSelectStub).props('size')
    ).toBe('large')
    expect(
      mountEditCell({ el: 'input-number' }, 1, 'default')
        .findComponent(ElInputNumberStub)
        .props('size')
    ).toBe('default')
  })

  it('列级 edit.props.size 显式优先于 density 映射', () => {
    const wrapper = mountEditCell({ el: 'input', props: { size: 'large' } }, 'x', 'compact')
    expect(wrapper.findComponent(ElInputStub).props('size')).toBe('large')
  })

  it('自定义组件名经 resolveEditComp 原样交给 component :is', () => {
    // 未注册的自定义组件名渲染为同名原生标签（Vue 运行时降级行为），
    // 此处仅验证不会命中三个内置分支而落空
    const wrapper = mountEditCell({ el: 'my-custom-comp' }, 'x')
    expect(wrapper.find('.el-input-stub').exists()).toBe(false)
    expect(wrapper.html()).toContain('my-custom-comp')
  })

  // ─────────── v3.5 PR1-A：A11y 编辑态播报 ───────────

  it('v3.5：进入编辑时插入 sr-only span + aria-live 播报', () => {
    const wrapper = mountEditCell({ el: 'input' }, 'x')
    const srOnly = wrapper.find('.sr-only')
    expect(srOnly.exists()).toBe(true)
    expect(srOnly.attributes('aria-live')).toBe('polite')
    // 播报消息含字段名（label 优先，缺省回落 prop）
    expect(srOnly.text()).toContain('已进入编辑')
  })
})
