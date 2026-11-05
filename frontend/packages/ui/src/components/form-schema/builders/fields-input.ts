/**
 * builders/fields-input —— 文本输入类组件 builder
 *
 * 从 builders.ts 拆分（架构审查 #3）。含 Input 系（Input / InputNumber / InputPassword /
 * InputTag / InputTextArea / Mention / Textarea）—— Textarea 复用 InputBuilder 的 props，
 * 与 Input 同文件避免跨文件导出中间变量。
 *
 * @group XForm 构建器
 */
import { makeBuilder, makeSimpleBuilder } from './core'

// ── Input ──
const InputBuilder = makeBuilder('Input')
class InputBuilderExt extends InputBuilder {
  clearable(): this {
    return this.prop('clearable', true)
  }
}
/**
 * xInput —— Input 组件链式构造器入口
 *
 * @see InputBuilderExt Ext 方法：clearable
 * @see ./core.ts NodeBuilder 基类通用方法
 */
export const xInput = (name: string) => new InputBuilderExt(name)

// ── InputNumber ──
/** xInputNumber —— InputNumber 组件链式构造器入口 */
export const xInputNumber = makeSimpleBuilder('InputNumber')

// ── InputPassword ──
/** xInputPassword —— InputPassword 快捷名（element-plus 内部映射到 ElInput.type=password） */
export const xInputPassword = makeSimpleBuilder('InputPassword')

// ── InputTag ──
/** xInputTag —— InputTag 组件链式构造器入口 */
export const xInputTag = makeSimpleBuilder('InputTag')

// ── InputTextArea ──
/** xInputTextArea —— InputTextArea 快捷名（element-plus 内部映射到 ElInput.type=textarea） */
export const xInputTextArea = makeSimpleBuilder('InputTextArea')

// ── Mention ──
/** xMention —— Mention 组件链式构造器入口 */
export const xMention = makeSimpleBuilder('Mention')

// ── Textarea ──（复用 InputBuilder 的 props，type=textarea 模拟多行）
class TextareaBuilderExt extends InputBuilder {
  rows(n: number): this {
    return this.prop('type', 'textarea').prop('rows', n)
  }
}
/**
 * xTextarea —— Textarea 快捷名（复用 InputBuilder，type=textarea + rows）
 *
 * @see TextareaBuilderExt Ext 方法：rows
 */
export const xTextarea = (name: string) => new TextareaBuilderExt(name)
