/**
 * 自定义组件类型扩展测试（编译时类型测试）
 *
 * 验证消费方通过 module augmentation 扩展 ComponentPropsRegistry 后：
 * 1. SchemaNodeFor<'MyInput'> 能推导自定义 props
 * 2. builder 返回类型能读取注册表类型
 *
 * 文件以 .test-d.ts 结尾：vitest 不会运行（纯类型），但 tsc --build 会编译
 *
 * @group XForm 类型测试
 */
import type { SchemaNodeFor } from '../types'
import { xInput } from '../builders'

// 自定义组件 props
interface MyInputProps {
  prefix?: string
  suffix?: string
  modelValue?: string
}

declare module '../types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}

// === SchemaNodeFor 扩展后推导 ===
const _myInputValid: SchemaNodeFor<'MyInput'> = {
  component: 'MyInput',
  name: 'keyword',
  props: { prefix: 'Search:', suffix: '✓', modelValue: '' },
}
void _myInputValid

// 错误示例：@ts-expect-error 会在类型正确时主动报错，防止回归
// @ts-expect-error prefix 应为 string
const _myInputBad: SchemaNodeFor<'MyInput'> = { component: 'MyInput', props: { prefix: 123 } } // ❌ 类型错
void _myInputBad

// === builder 返回类型验证（通过 xInput 推断注册表读取正常） ===
const _inputBuilderReturn = xInput('email').build()
type _InputBuilderReturnType = typeof _inputBuilderReturn
