/**
 * 类型推导编译时测试（type-only，不在运行时执行）
 *
 * 验证 SchemaNodeFor<C> 泛型按 component 字段推导 props 类型
 * 如果类型不匹配，tsc 会报 TS2322/TS2345 错误（CI 自动捕获）
 *
 * 文件以 .test-d.ts 结尾：vitest 不会运行（纯类型），但 tsc --build 会编译
 *
 * @group XForm 类型测试
 */
import type { SchemaNodeFor, PropsByComponent } from '../types'

// === Input 节点类型推导 ===
const _inputValid: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  props: { placeholder: 'a@b.com', clearable: true, modelValue: '' },
}
void _inputValid

// 错误示例（注释掉避免阻塞测试，仅文档化）
// const _inputBad: SchemaNodeFor<'Input'> = {
//   component: 'Input',
//   props: { placeholder: 123, clearable: 'yes' as string },  // ❌ 类型错
// }

// === Select 节点 ===
const _selectValid: SchemaNodeFor<'Select'> = {
  component: 'Select',
  name: 'role',
  props: { multiple: true, clearable: true, filterable: true },
}
void _selectValid

// === Switch 节点 ===
const _switchValid: SchemaNodeFor<'Switch'> = {
  component: 'Switch',
  name: 'enabled',
  props: { modelValue: false, activeText: 'ON', inactiveText: 'OFF' },
}
void _switchValid

// === DatePicker 节点 ===
const _dateValid: SchemaNodeFor<'DatePicker'> = {
  component: 'DatePicker',
  name: 'birthday',
  props: { type: 'date', valueFormat: 'YYYY-MM-DD', clearable: true },
}
void _dateValid

// === RadioGroup / Radio 节点 ===
const _radioGroupValid: SchemaNodeFor<'RadioGroup'> = {
  component: 'RadioGroup',
  name: 'gender',
  props: { modelValue: '', size: 'default' },
}
void _radioGroupValid

// === ComponentName 类型应包含所有 12 个组件 ===
const _inputPassword: SchemaNodeFor<'InputPassword'> = {
  component: 'InputPassword',
  props: { type: 'password', showPassword: true },
}
const _inputTextArea: SchemaNodeFor<'InputTextArea'> = {
  component: 'InputTextArea',
  props: { type: 'textarea', rows: 4 },
}
const _inputTag: SchemaNodeFor<'InputTag'> = {
  component: 'InputTag',
  props: { modelValue: ['Vue', 'Element Plus'], max: 5, clearable: true },
}
const _colorPicker: SchemaNodeFor<'ColorPicker'> = {
  component: 'ColorPicker',
  props: { modelValue: '#1890ff', colorFormat: 'hex', showAlpha: true },
}
const _mention: SchemaNodeFor<'Mention'> = {
  component: 'Mention',
  props: { modelValue: '@alice', options: [{ value: 'alice', label: 'Alice' }] },
}
const _rate: SchemaNodeFor<'Rate'> = {
  component: 'Rate',
  props: { modelValue: 4, allowHalf: true },
}
void _inputPassword
void _inputTextArea
void _inputTag
void _colorPicker
void _mention
void _rate

const _components: ComponentName = 'Input' // type-only test
void _components

// === PropsByComponent 类型应可访问 ===
const _inputProps: PropsByComponent['Input'] = { placeholder: 'x' }
void _inputProps

type ComponentName = keyof PropsByComponent
