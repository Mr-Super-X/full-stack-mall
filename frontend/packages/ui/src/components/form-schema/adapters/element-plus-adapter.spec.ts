import { describe, it, expect } from 'vitest'
import {
  resolveElComponentName,
  DEFAULT_COMPONENT_MAP,
  DEFAULT_COMPONENT_PROPS,
} from './element-plus-adapter'
import { EL_COMPONENT_MAP } from '../composables/resolve-component'

describe('resolveElComponentName(name, userComponentKeys?)', () => {
  it('resolves "Input" to "ElInput" from default map', () => {
    expect(resolveElComponentName('Input')).toBe('ElInput')
  })

  it('returns original name when userComponents list contains it', () => {
    expect(resolveElComponentName('MyInput', ['MyInput'])).toBe('MyInput')
  })

  it('returns null for unknown component (not in default map and not ElXxx)', () => {
    expect(resolveElComponentName('UnknownXYZ')).toBeNull()
  })

  it('passes through ElXxx native names directly', () => {
    expect(resolveElComponentName('ElInput')).toBe('ElInput')
    expect(resolveElComponentName('ElSelect')).toBe('ElSelect')
  })

  it('resolves various built-in shortcuts', () => {
    expect(resolveElComponentName('Select')).toBe('ElSelect')
    expect(resolveElComponentName('Switch')).toBe('ElSwitch')
    expect(resolveElComponentName('DatePicker')).toBe('ElDatePicker')
    expect(resolveElComponentName('InputNumber')).toBe('ElInputNumber')
    expect(resolveElComponentName('Cascader')).toBe('ElCascader')
  })

  it('resolves extended built-in shortcuts', () => {
    expect(resolveElComponentName('Input')).toBe('ElInput')
    expect(resolveElComponentName('InputPassword')).toBe('ElInput')
    expect(resolveElComponentName('InputTextArea')).toBe('ElInput')
    expect(resolveElComponentName('InputTag')).toBe('ElInputTag')
    expect(resolveElComponentName('ColorPicker')).toBe('ElColorPicker')
    expect(resolveElComponentName('Mention')).toBe('ElMention')
    expect(resolveElComponentName('Rate')).toBe('ElRate')
  })

  it('resolves alias full names to the same Element Plus components', () => {
    expect(resolveElComponentName('ElInputPassword')).toBe('ElInput')
    expect(resolveElComponentName('ElInputTextArea')).toBe('ElInput')
    expect(resolveElComponentName('ElInputTag')).toBe('ElInputTag')
    expect(resolveElComponentName('ElColorPicker')).toBe('ElColorPicker')
    expect(resolveElComponentName('ElMention')).toBe('ElMention')
    expect(resolveElComponentName('ElRate')).toBe('ElRate')
  })

  it('DEFAULT_COMPONENT_PROPS exposes only safe defaults', () => {
    expect(DEFAULT_COMPONENT_PROPS.Input).toEqual({ clearable: true })
    expect(DEFAULT_COMPONENT_PROPS.InputNumber).toEqual({ controlsPosition: 'right' })
    expect(DEFAULT_COMPONENT_PROPS.InputPassword).toEqual({
      type: 'password',
      showPassword: true,
    })
    expect(DEFAULT_COMPONENT_PROPS.ElInputPassword).toEqual({
      type: 'password',
      showPassword: true,
    })
    expect(DEFAULT_COMPONENT_PROPS.InputTextArea).toEqual({ type: 'textarea', showWordLimit: true })
    expect(DEFAULT_COMPONENT_PROPS.ElInputTextArea).toEqual({
      type: 'textarea',
      showWordLimit: true,
    })
    expect(DEFAULT_COMPONENT_PROPS.InputTag).toEqual({ clearable: true })
    expect(DEFAULT_COMPONENT_PROPS.ColorPicker).toBeUndefined()
    expect(DEFAULT_COMPONENT_PROPS.Mention).toBeUndefined()
    expect(DEFAULT_COMPONENT_PROPS.Rate).toBeUndefined()
  })

  it('DEFAULT_COMPONENT_MAP is exported and contains expected keys', () => {
    expect(DEFAULT_COMPONENT_MAP.Input).toBe('ElInput')
    expect(DEFAULT_COMPONENT_MAP.Select).toBe('ElSelect')
    expect(DEFAULT_COMPONENT_MAP.Switch).toBe('ElSwitch')
    expect(DEFAULT_COMPONENT_MAP.Option).toBe('ElOption')
    expect(DEFAULT_COMPONENT_MAP.RadioGroup).toBe('ElRadioGroup')
    expect(DEFAULT_COMPONENT_MAP.CheckboxGroup).toBe('ElCheckboxGroup')
    expect(DEFAULT_COMPONENT_MAP.Radio).toBe('ElRadio')
    expect(DEFAULT_COMPONENT_MAP.Checkbox).toBe('ElCheckbox')
    expect(DEFAULT_COMPONENT_MAP.Slider).toBe('ElSlider')
  })

  it('DEFAULT_COMPONENT_MAP 键集合与 EL_COMPONENT_MAP 单一真源一致（防双表漂移，架构审查 #2）', () => {
    expect(Object.keys(DEFAULT_COMPONENT_MAP).sort()).toEqual(Object.keys(EL_COMPONENT_MAP).sort())
  })

  it('DEFAULT_COMPONENT_MAP 从组件对象 .name 派生 ElXxx 目标名（含 Icon 与别名键）', () => {
    expect(DEFAULT_COMPONENT_MAP.Icon).toBe('ElIcon')
    expect(DEFAULT_COMPONENT_MAP.InputPassword).toBe('ElInput')
    expect(DEFAULT_COMPONENT_MAP.ElInputTextArea).toBe('ElInput')
    expect(DEFAULT_COMPONENT_MAP.Form).toBe('ElForm')
  })
})
