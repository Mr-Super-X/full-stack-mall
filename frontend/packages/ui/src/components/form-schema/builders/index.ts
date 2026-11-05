/**
 * builders/index —— 链式构建器 barrel
 *
 * 从 builders.ts 拆分（架构审查 #3：621 行超 400 硬上限）：
 * - core.ts：NodeBuilder 泛型基类 + makeBuilder / makeSimpleBuilder 工厂
 * - fields-input.ts：Input 系文本输入（Input / Textarea / InputNumber / ...）
 * - fields-select.ts：选择类（Select / Autocomplete / Cascader / RadioGroup / ...）
 * - fields-date.ts：日期时间类（DatePicker / TimePicker / TimeSelect）
 * - fields-data.ts：数据操作类（Transfer / TreeSelect / Upload / ColorPicker）
 * - containers.ts：容器类（Card 视觉容器 + ArrayBuilder 数组节点）
 *
 * 消费方仍从 `@/components/form-schema/builders` 导入（builders.ts barrel 转发），
 * 27 个 xXxx 入口 + NodeBuilder + ArrayBuilder 导出面保持不变。
 *
 * NodeBuilder 已通过 `export class` 声明，自动成为命名导出 ——
 * 高级用户可直接继承自定义组件：
 *
 * @example
 * ```ts
 * class MyDatePickerBuilder extends NodeBuilder<'Input'> {
 *   dateOnly(): this { return this.prop('type', 'date') }
 * }
 * ```
 *
 * @group XForm 构建器
 */
export { NodeBuilder, makeBuilder, makeSimpleBuilder } from './core'
export {
  xInput,
  xInputNumber,
  xInputPassword,
  xInputTag,
  xInputTextArea,
  xMention,
  xTextarea,
} from './fields-input'
export {
  xAutocomplete,
  xCascader,
  xCheckbox,
  xCheckboxGroup,
  xOption,
  xRadio,
  xRadioGroup,
  xRate,
  xSelect,
  xSlider,
  xSwitch,
} from './fields-select'
export { xDatePicker, xTimePicker, xTimeSelect } from './fields-date'
export { xColorPicker, xTransfer, xTreeSelect, xUpload } from './fields-data'
export { xCard, ArrayBuilder, xArray, xTabs, xSteps } from './containers'
