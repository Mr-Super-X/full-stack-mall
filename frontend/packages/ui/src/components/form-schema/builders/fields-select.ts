/**
 * builders/fields-select —— 选择类组件 builder
 *
 * 从 builders.ts 拆分（架构审查 #3）。含单选/多选/级联/树选/滑块/开关等
 * 枚举选择型组件（Select / Autocomplete / Cascader / Option / Radio / RadioGroup /
 * Checkbox / CheckboxGroup / Rate / Slider / Switch）。
 *
 * @group XForm 构建器
 */
import { makeBuilder, makeSimpleBuilder } from './core'

// ── Autocomplete ──
const AutocompleteBuilder = makeBuilder('Autocomplete')
class AutocompleteBuilderExt extends AutocompleteBuilder {
  fetchSuggestions(
    fn: (queryString: string, cb: (suggestions: Array<{ value: string }>) => void) => void
  ): this {
    return this.prop('fetchSuggestions', fn as never)
  }
  triggerOnFocus(): this {
    return this.prop('triggerOnFocus', true)
  }
  placement(p: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end'): this {
    return this.prop('placement', p)
  }
}
/**
 * xAutocomplete —— Autocomplete 组件链式构造器入口
 *
 * @see AutocompleteBuilderExt Ext 方法：fetchSuggestions / triggerOnFocus / placement
 * @see ./core.ts NodeBuilder 基类通用方法：label / prop / placeholder / required / rules 等
 */
export const xAutocomplete = (name: string) => new AutocompleteBuilderExt(name)

// ── Cascader ──
const CascaderBuilder = makeBuilder('Cascader')
class CascaderBuilderExt extends CascaderBuilder {
  options(opts: Array<unknown>): this {
    return this.prop('options', opts)
  }
  showAllLevels(): this {
    return this.prop('showAllLevels', true)
  }
  separator(s: string): this {
    return this.prop('separator', s)
  }
  // el-cascader 的 expandTrigger 在 props 嵌套字段中,需要 props.expandTrigger
  // 简化:用 prop() 直接覆盖整个 props(覆盖式更新),文档说明限制
}
/**
 * xCascader —— Cascader 组件链式构造器入口
 *
 * @see CascaderBuilderExt Ext 方法：options / showAllLevels / separator
 * @see ./core.ts NodeBuilder 基类通用方法
 */
export const xCascader = (name: string) => new CascaderBuilderExt(name)

// ── Checkbox ──
/** xCheckbox —— Checkbox 组件链式构造器入口（无 Ext，继承 NodeBuilder 通用方法） */
export const xCheckbox = makeSimpleBuilder('Checkbox')

// ── CheckboxGroup ──
/** xCheckboxGroup —— CheckboxGroup 组件链式构造器入口 */
export const xCheckboxGroup = makeSimpleBuilder('CheckboxGroup')

// ── Option ──
/** xOption —— Select Option 组件链式构造器入口 */
export const xOption = makeSimpleBuilder('Option')

// ── Radio ──
/** xRadio —— Radio 组件链式构造器入口 */
export const xRadio = makeSimpleBuilder('Radio')

// ── RadioGroup ──
const RadioGroupBuilder = makeBuilder('RadioGroup')
class RadioGroupBuilderExt extends RadioGroupBuilder {
  options(opts: Array<{ value: string; label: string }>): this {
    this.node.children = opts.map((o) => ({
      component: 'Radio',
      props: { value: o.value },
      children: o.label,
    }))
    return this
  }
}
/**
 * xRadioGroup —— RadioGroup 组件链式构造器入口
 *
 * @see RadioGroupBuilderExt Ext 方法：options (自动生成 Radio 子节点)
 */
export const xRadioGroup = (name: string) => new RadioGroupBuilderExt(name)

// ── Rate ──
/** xRate —— Rate 组件链式构造器入口 */
export const xRate = makeSimpleBuilder('Rate')

// ── Select ──
const SelectBuilder = makeBuilder('Select')
class SelectBuilderExt extends SelectBuilder {
  options(opts: Array<{ value: unknown; label: string }>): this {
    return this.prop('options', opts)
  }
}
/**
 * xSelect —— Select 组件链式构造器入口
 *
 * @see SelectBuilderExt Ext 方法：options
 */
export const xSelect = (name: string) => new SelectBuilderExt(name)

// ── Slider ──
/** xSlider —— Slider 组件链式构造器入口 */
export const xSlider = makeSimpleBuilder('Slider')

// ── Switch ──
/** xSwitch —— Switch 组件链式构造器入口 */
export const xSwitch = makeSimpleBuilder('Switch')
