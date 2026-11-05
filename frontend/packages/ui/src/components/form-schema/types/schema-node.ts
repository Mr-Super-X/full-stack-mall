/**
 * Schema 节点定义 —— XForm schema DSL 的核心接口
 *
 * 业务入口推荐 `SchemaNodeFor<C>` 泛型版本（按 component 字段推导 props 类型）：
 *   const node: SchemaNodeFor<'Input'> = { component: 'Input', props: { placeholder: 'x' } }
 *
 * @group 类型系统
 */
import type {
  ElAutocomplete,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElColorPicker,
  ElDatePicker,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElInputTag,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElSelect,
  ElSlider,
  ElStep,
  ElSteps,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTimePicker,
  ElTimeSelect,
  ElTransfer,
  ElTreeSelect,
  ElUpload,
  MentionProps,
} from 'element-plus'

import type { SchemaNodeIdentity } from './identity'
import type { SchemaNodeRender } from './render'
import type { SchemaNodeLayout } from './layout'
import type { SchemaNodeValidate } from './validate'
import type { SchemaNodeReactive } from './reaction'
import type { SchemaNodeArray } from './array'
import type { SchemaNodeData } from './async-options'
import type { SchemaNodeVModel } from './v-model'
import type { SchemaNodeTopLevel } from './top-level'

/**
 * 从 element-plus 组件构造器中提取 props 类型
 * 利用 vue 3 ComponentCustomOptions['props'] 的派生
 */
type ComponentProps<T> = T extends new (...args: never[]) => infer R
  ? NonNullable<R extends { $props: infer P } ? P : never>
  : NonNullable<T extends { props: infer P } ? P : never>

/**
 * SchemaNode —— XForm schema DSL 的核心节点定义（35 字段接口）
 *
 * 字段分组（按 P2-1 拆分后命名空间）：
 * | 命名空间 | 字段数 | 子接口 |
 * | --- | --- | --- |
 * | 节点标识 | 6 | SchemaNodeIdentity（component/name/label/key + id/meta 设计器预留） |
 * | 渲染属性 | 5 | SchemaNodeRender（props/on/children/slots/directives） |
 * | 布局 | 4 | SchemaNodeLayout（row/column/col/formItem） |
 * | 校验 | 2 | SchemaNodeValidate（rules/defaultValue） |
 * | 响应式 | 7 | SchemaNodeReactive（reaction/disabled/permission/readonly/hidden/ignore/beforeChange） |
 * | 数组节点 | 2 | SchemaNodeArray（kind/array） |
 * | 数据加载 | 1 | SchemaNodeData（asyncOptions） |
 * | v-model 适配 | 1 | SchemaNodeVModel（modelProp） |
 * | 顶层配置 | 7 | SchemaNodeTopLevel（labelPosition/labelWidth/scrollToError/scrollIntoViewOptions/debounceValidation/watchFallback + schemaVersion 设计器预留） |
 *
 * TS interface extends 组合：9 命名空间无字段重叠，SchemaNode 类型形状与 P2-1 重构前完全等价。
 * IDE hover 仍显示扁平字段列表；命名空间接口可单独 import 用于"只关心某类字段"的子类型场景。
 *
 * 业务入口推荐 `SchemaNodeFor<C>` 泛型版本（按 component 字段推导 props 类型）：
 *   const node: SchemaNodeFor<'Input'> = { component: 'Input', props: { placeholder: 'x' } }
 *
 * @see ./identity.ts SchemaNodeIdentity（6 字段）
 * @see ./render.ts SchemaNodeRender（5 字段）
 * @see ./layout.ts SchemaNodeLayout（4 字段）
 * @see ./validate.ts SchemaNodeValidate（2 字段）
 * @see ./reaction.ts SchemaNodeReactive（7 字段）
 * @see ./array.ts SchemaNodeArray（2 字段）
 * @see ./async-options.ts SchemaNodeData（1 字段）
 * @see ./v-model.ts SchemaNodeVModel（1 字段）
 * @see ./top-level.ts SchemaNodeTopLevel（5 字段）
 */
export interface SchemaNode
  extends
    SchemaNodeIdentity,
    SchemaNodeRender,
    SchemaNodeLayout,
    SchemaNodeValidate,
    SchemaNodeReactive,
    SchemaNodeArray,
    SchemaNodeData,
    SchemaNodeVModel,
    SchemaNodeTopLevel {}

/**
 * element-plus 业务组件 props 类型提取（vue 3.5+ ComponentProps）
 * 用于 SchemaNodeFor 泛型按 component 字段推导 props 类型
 */
type ElInputProps = ComponentProps<typeof ElInput>
type ElSelectProps = ComponentProps<typeof ElSelect>
type ElOptionProps = ComponentProps<typeof ElOption>
type ElSwitchProps = ComponentProps<typeof ElSwitch>
type ElDatePickerProps = ComponentProps<typeof ElDatePicker>
type ElTimePickerProps = ComponentProps<typeof ElTimePicker>
type ElTimeSelectProps = ComponentProps<typeof ElTimeSelect>
type ElTreeSelectProps = ComponentProps<typeof ElTreeSelect>
type ElUploadProps = ComponentProps<typeof ElUpload>
type ElAutocompleteProps = ComponentProps<typeof ElAutocomplete>
type ElInputTagProps = ComponentProps<typeof ElInputTag>
type ElMentionProps = MentionProps
type ElColorPickerProps = ComponentProps<typeof ElColorPicker>
type ElRateProps = ComponentProps<typeof ElRate>
type ElTransferProps = ComponentProps<typeof ElTransfer>
type ElRadioGroupProps = ComponentProps<typeof ElRadioGroup>
type ElRadioProps = ComponentProps<typeof ElRadio>
type ElCheckboxGroupProps = ComponentProps<typeof ElCheckboxGroup>
type ElCheckboxProps = ComponentProps<typeof ElCheckbox>
type ElCascaderProps = ComponentProps<typeof ElCascader>
type ElInputNumberProps = ComponentProps<typeof ElInputNumber>
type ElSliderProps = ComponentProps<typeof ElSlider>
type ElCardProps = ComponentProps<typeof ElCard>
type ElTabsProps = ComponentProps<typeof ElTabs>
type ElTabPaneProps = ComponentProps<typeof ElTabPane>
type ElStepsProps = ComponentProps<typeof ElSteps>
type ElStepProps = ComponentProps<typeof ElStep>
type ElFormItemProps = ComponentProps<typeof ElFormItem>

/**
 * 快捷名 → 对应组件 props 类型的映射（可声明合并）
 *
 * 消费方可通过 TypeScript module augmentation 扩展自定义组件：
 * ```ts
 * declare module '@components/form-schema/types' {
 *   interface ComponentPropsRegistry {
 *     MyInput: MyInputProps
 *   }
 * }
 * ```
 */
export interface ComponentPropsRegistry {
  Input: ElInputProps
  Select: ElSelectProps
  Option: ElOptionProps
  Switch: ElSwitchProps
  DatePicker: ElDatePickerProps
  TimePicker: ElTimePickerProps
  TimeSelect: ElTimeSelectProps
  TreeSelect: ElTreeSelectProps
  Upload: ElUploadProps
  Autocomplete: ElAutocompleteProps
  InputPassword: ElInputProps
  InputTextArea: ElInputProps
  InputTag: ElInputTagProps
  ColorPicker: ElColorPickerProps
  Mention: ElMentionProps
  Rate: ElRateProps
  Transfer: ElTransferProps
  RadioGroup: ElRadioGroupProps
  Radio: ElRadioProps
  CheckboxGroup: ElCheckboxGroupProps
  Checkbox: ElCheckboxProps
  Cascader: ElCascaderProps
  InputNumber: ElInputNumberProps
  Slider: ElSliderProps
  Card: ElCardProps
  Tabs: ElTabsProps
  TabPane: ElTabPaneProps
  Steps: ElStepsProps
  Step: ElStepProps
  FormItem: ElFormItemProps
  // 数组节点不绑 el 组件,内部独立渲染 —— props 类型留空占位
  ArrayNode: Record<string, unknown>
}

/** 向后兼容别名，等效于 ComponentPropsRegistry */
export type PropsByComponent = ComponentPropsRegistry

/** 支持类型推导的 component 名 */
export type ComponentName = keyof ComponentPropsRegistry

/**
 * 按 component 字段推导 props 类型的 SchemaNode 泛型
 *
 * 用法：
 * ```ts
 * const email: SchemaNodeFor<'Input'> = {
 *   component: 'Input',
 *   name: 'email',
 *   props: { placeholder: 'a@b.com', clearable: true },
 * }
 * // props: { placeholder: 123 }  // ❌ TS 类型错误
 * ```
 */
export type SchemaNodeFor<C extends ComponentName = ComponentName> = Omit<
  SchemaNode,
  'component' | 'props'
> & {
  component: C
  props?: ComponentPropsRegistry[C]
}
