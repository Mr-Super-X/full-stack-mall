/**
 * 组件名解析：用户注册 / 短名 / 全名 / ElXxx / 全局注册 / 原生 HTML 标签，
 * 内置 EL 短名 → 实际组件映射见 EL_COMPONENT_MAP，ElUpload 类型判断工具避免覆盖默认图标注入。
 *
 * @group 表单编排：渲染
 */
import { getCurrentInstance, resolveComponent } from 'vue'
import {
  ElAutocomplete,
  ElButton,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElColorPicker,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElInputTag,
  ElMention,
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
} from 'element-plus'
import type { SchemaNode } from '../types'

/**
 * EL_COMPONENT_MAP —— 内置 EL 组件短名 → 实际组件对象的映射表
 *
 * ⚠️ 唯一 runtime 真源（架构审查 #2，2026-09-18 收敛）：组件名 → 字符串的
 * DEFAULT_COMPONENT_MAP（adapters/element-plus-adapter.ts）从此表派生，
 * 禁止再手写第二份映射表 —— 新增组件只在此处登记一次。
 */
export const EL_COMPONENT_MAP: Record<string, unknown> = {
  Input: ElInput,
  Select: ElSelect,
  Option: ElOption,
  Switch: ElSwitch,
  DatePicker: ElDatePicker,
  TimePicker: ElTimePicker,
  TimeSelect: ElTimeSelect,
  Upload: ElUpload,
  Transfer: ElTransfer,
  TreeSelect: ElTreeSelect,
  Autocomplete: ElAutocomplete,
  Button: ElButton,
  Icon: ElIcon,
  RadioGroup: ElRadioGroup,
  Radio: ElRadio,
  CheckboxGroup: ElCheckboxGroup,
  Checkbox: ElCheckbox,
  Cascader: ElCascader,
  InputNumber: ElInputNumber,
  InputPassword: ElInput,
  ElInputPassword: ElInput,
  InputTextArea: ElInput,
  ElInputTextArea: ElInput,
  InputTag: ElInputTag,
  ColorPicker: ElColorPicker,
  Mention: ElMention,
  Rate: ElRate,
  Slider: ElSlider,
  Card: ElCard,
  Tabs: ElTabs,
  TabPane: ElTabPane,
  Steps: ElSteps,
  Step: ElStep,
  FormItem: ElFormItem,
  Form: ElForm,
}

/**
 * 缓存 appContext.components —— 跨 getCurrentInstance() 调用稳定可用
 *
 * 关键修复（2026-09-16）：vue 3.5 在 setup/render effect 内调 `vue.resolveComponent(name)`
 * 时,若当前实例未显式声明 components 选项(SchemaField / XForm / LayoutBranch 都没声明),
 * Vue 内部遍历父链找不到匹配项时,会**返回组件名字符串原样**(而非组件对象),
 * 导致后续 `h(Comp, ...)` 把 'RichTextEditor' 当作未知组件名渲染空 vnode。
 *
 * 兜底策略：直接读 `getCurrentInstance().appContext.components`（unplugin-vue-components
 * 把 src/components/common/** 自动注入到此 Map）。该 Map 与 vue 内部分析无关,直接查表
 * 一定能拿到正确组件对象。
 *
 * 关键挑战：getCurrentInstance() 在 nextTick 回调、watch immediate 等非 render/setup
 * 上下文返回 null。但 unplugin-vue-components 注册的组件在 app 启动时就写入
 * app._context.components,只要能拿到一次 appContext,后续任意时刻都能查表。
 *
 * 实现：第一次拿到 instance 时缓存 appContext,后续所有调用复用缓存。这样无论调用上下文
 * 是否在 render/setup,都能正确解析 RichTextEditor / BaseChart 等项目级组件。
 */
let cachedAppContext: { components?: Record<string, unknown> } | null = null

function resolveFromAppContext(name: string): unknown | null {
  // 优先用缓存（任意上下文可读）
  if (cachedAppContext?.components && name in cachedAppContext.components) {
    const comp = cachedAppContext.components[name]
    if (typeof comp !== 'string') return comp
  }
  // 缓存未命中或 comp 是字符串,尝试从 currentInstance 拿（render/setup 上下文）
  const inst = getCurrentInstance()
  if (inst?.appContext?.components) {
    // 首次成功拿到,缓存供后续任意上下文复用
    cachedAppContext = inst.appContext as { components?: Record<string, unknown> }
    if (name in cachedAppContext.components!) {
      const comp = cachedAppContext.components![name]
      if (typeof comp !== 'string') return comp
    }
  }
  return null
}

/** resolveComponentFor —— 组件名解析（用户注册 / 短名 / 全名 / ElXxx / 全局注册 / 原生 HTML） */
export function resolveComponentFor(
  name: string | undefined,
  userComponents?: Record<string, unknown>
): unknown {
  if (!name) return null
  if (userComponents && name in userComponents) return userComponents[name]
  if (name in EL_COMPONENT_MAP) return EL_COMPONENT_MAP[name] ?? null
  if (name.startsWith('El') && name.length > 2) {
    const short = name[2]!.toUpperCase() + name.slice(3)
    if (short in EL_COMPONENT_MAP) return EL_COMPONENT_MAP[short] ?? null
  }
  if (name.startsWith('El')) {
    try {
      const r = resolveComponent(name)
      if (typeof r !== 'string') return r
    } catch {
      /* fallthrough */
    }
  }
  // 原生 HTML 标签（全小写，如 'a' / 'span' / 'div'）→ 返回字符串标签名，
  // h() 对字符串直接渲染原生元素（与 EL 组件名的 PascalCase/ElXxx 约定不冲突）
  if (name === name.toLowerCase()) return name
  // 项目级全局组件 fallback：unplugin-vue-components 把 src/components/common/** 自动注入到
  // GlobalComponents，schema.component 直接写 'RichTextEditor' 等项目组件名可被 resolveComponent
  // 解析，业务方无需在 XFormProps.components 重复注册。
  // 优先查 appContext.components（绕开 vue.resolveComponent 父链查找不确定性），
  // 失败再走 vue.resolveComponent 兜底（兼容 SSR 等场景）。
  const fromAppContext = resolveFromAppContext(name)
  if (fromAppContext !== null) return fromAppContext
  try {
    const r = resolveComponent(name)
    if (typeof r !== 'string') return r
  } catch {
    /* not registered globally — fallthrough to null */
  }
  return null
}

/** schema 名与解析结果双向确认，避免业务用 components 覆盖 Upload 后误注入默认图标 */
export function isElUpload(node: SchemaNode, Comp: unknown): boolean {
  const name = typeof node.component === 'string' ? node.component : ''
  if (name !== 'Upload' && name !== 'ElUpload') return false
  return Comp === ElUpload
}

/** 判断当前节点是否为 listType='picture-card' 的 ElUpload */
export function isPictureCardUpload(node: SchemaNode, Comp: unknown): boolean {
  return isElUpload(node, Comp) && node.props?.listType === 'picture-card'
}

/** 判断当前节点是否为开启 drag 拖拽的 ElUpload */
export function isDragUpload(node: SchemaNode, Comp: unknown): boolean {
  return isElUpload(node, Comp) && Boolean(node.props?.drag)
}
