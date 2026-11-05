/**
 * builders/fields-date —— 日期时间类组件 builder
 *
 * 从 builders.ts 拆分（架构审查 #3）。含 DatePicker / TimePicker / TimeSelect
 * —— 三个都有 format 系链式方法，时间语义内聚。
 *
 * @group XForm 构建器
 */
import { makeBuilder } from './core'

// ── DatePicker ──
const DatePickerBuilder = makeBuilder('DatePicker')
class DatePickerBuilderExt extends DatePickerBuilder {
  format(v: string): this {
    return this.prop('valueFormat', v)
  }
}
/**
 * xDatePicker —— DatePicker 组件链式构造器入口
 *
 * @see DatePickerBuilderExt Ext 方法：format (设置 valueFormat)
 */
export const xDatePicker = (name: string) => new DatePickerBuilderExt(name)

// ── TimePicker ──
const TimePickerBuilder = makeBuilder('TimePicker')
class TimePickerBuilderExt extends TimePickerBuilder {
  format(v: string): this {
    return this.prop('format', v)
  }
  valueFormat(v: string): this {
    return this.prop('valueFormat', v)
  }
  range(): this {
    return this.prop('isRange', true)
  }
}
/**
 * xTimePicker —— TimePicker 组件链式构造器入口
 *
 * @see TimePickerBuilderExt Ext 方法：format / valueFormat / range
 */
export const xTimePicker = (name: string) => new TimePickerBuilderExt(name)

// ── TimeSelect ──
const TimeSelectBuilder = makeBuilder('TimeSelect')
class TimeSelectBuilderExt extends TimeSelectBuilder {
  format(v: string): this {
    return this.prop('format', v)
  }
  start(v: string): this {
    return this.prop('start', v)
  }
  end(v: string): this {
    return this.prop('end', v)
  }
  step(v: string): this {
    return this.prop('step', v)
  }
}
/**
 * xTimeSelect —— TimeSelect 组件链式构造器入口
 *
 * @see TimeSelectBuilderExt Ext 方法：format / start / end / step
 */
export const xTimeSelect = (name: string) => new TimeSelectBuilderExt(name)
