/**
 * Schema 字符串快捷名 → Element Plus 全局注册名 的内置映射
 *
 * ⚠️ 单一真源派生（架构审查 #2，2026-09-18 收敛）：本表不再手写，
 * 从 composables/resolve-component.ts 的 EL_COMPONENT_MAP（组件对象表）
 * 派生 —— 新增组件只须在 EL_COMPONENT_MAP 登记一次，两处自动对齐。
 *
 * 依赖 element-plus 组件对象的稳定 `.name` 属性（如 ElInput.name === 'ElInput'）；
 * 别名键（InputPassword / ElInputPassword 等共享 ElInput 对象）自动派生正确目标名。
 * 若未来 EP 某组件缺 `.name`，fall back 到短名键本身。
 *
 * 为什么不在此处直接 import element-plus 组件对象作值：
 * - 本表消费方只要字符串名（resolveComponent 从全局注册表查找）
 * - 直接持有组件对象引用会增加 adapter 层与 EP 的耦合面
 * （组件对象仅在 resolve-component.ts 一处持有，adapter 单向依赖之）
 *
 * @group XForm 适配层
 */
import { EL_COMPONENT_MAP } from '../composables/resolve-component'

function deriveComponentNameMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [shortName, component] of Object.entries(EL_COMPONENT_MAP)) {
    const withName = component as { name?: string }
    map[shortName] = withName.name ?? shortName
  }
  return map
}

export const DEFAULT_COMPONENT_MAP: Record<string, string> = deriveComponentNameMap()

/** 把快捷名形式的默认 props 同时展开为 ElXxx 形式，兼容 schema 中两种写法 */
function expandComponentProps(
  base: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, props] of Object.entries(base)) {
    result[key] = { ...props }
    const elName = DEFAULT_COMPONENT_MAP[key]
    if (elName) {
      if (!(elName in result)) result[elName] = { ...props }
      const fullName = `El${key}`
      if (fullName in DEFAULT_COMPONENT_MAP) result[fullName] = { ...props }
    }
  }
  return result
}

/** 内置默认组件 props：按组件名注入，节点级 props 可覆盖 */
const BASE_DEFAULT_COMPONENT_PROPS: Record<string, Record<string, unknown>> = {
  Input: { clearable: true },
  InputNumber: { controlsPosition: 'right' },
  InputPassword: { type: 'password', showPassword: true },
  InputTextArea: { type: 'textarea', showWordLimit: true },
  InputTag: { clearable: true },
  Select: { clearable: true },
  Cascader: { clearable: true },
  DatePicker: { clearable: true },
  TimePicker: { clearable: true },
  TimeSelect: { clearable: true },
  TreeSelect: { clearable: true },
  Autocomplete: { clearable: true },
}

/**
 * 默认组件 props：按组件名注入，节点级 props 可覆盖。
 *
 * 包含轻量输入 UX 默认值和 Input 语义 alias 默认值；不强制 ColorPicker、Mention、Rate 的业务偏好。
 *
 * 键同时支持快捷名（如 'Input'）和 Element Plus 全名（如 'ElInput'），
 * 因此 schema 中写 component: 'Input' 或 component: 'ElInput' 都能命中。
 */
export const DEFAULT_COMPONENT_PROPS: Record<
  string,
  Record<string, unknown>
> = expandComponentProps(BASE_DEFAULT_COMPONENT_PROPS)

/**
 * 解析 schema.component 字符串到最终组件名（供 resolveComponent 查找）
 *
 * 解析顺序：
 * 1. userComponentKeys 命中 → 返回原 name（调用方走用户 components map）
 * 2. DEFAULT_COMPONENT_MAP 内置命中（如 Input → 'ElInput'）
 * 3. ElXxx 原生名直通
 *
 * 返回 null 时调用方应降级为 <div> 占位
 */
export function resolveElComponentName(name: string, userComponentKeys?: string[]): string | null {
  if (userComponentKeys && userComponentKeys.includes(name)) {
    return name
  }
  if (name in DEFAULT_COMPONENT_MAP) {
    return DEFAULT_COMPONENT_MAP[name] ?? null
  }
  if (name.startsWith('El')) {
    return name
  }
  return null
}

/**
 * ELComponentProps<T> —— 解开 element-plus buildProp 元组,提取运行时 props 类型
 *
 * element-plus 2.x 组件 props 类型形如 `[type, required, validator, __epPropKey]` 元组(用 readonly tuple 实现)，
 * 在 vue 模板/h() 中直接使用会触发 TS 类型不兼容。传统做法是 `as never`(归因见 types/TYPE-CAST-AUDIT.md C1)。
 *
 * 本辅助类型用 Conditional Types 提取元组最后一个对象元素,得到运行时可消费的 props 形态。
 * 这是未来消除 render-* 文件中 `as never` 的入口(P1-2 阶段一:仅声明,不替换)。
 *
 * @see types/TYPE-CAST-AUDIT.md C1
 * @example
 * ```ts
 * import type { InputProps } from 'element-plus'
 * type ElInputRuntimeProps = ELComponentProps<InputProps>
 * ```
 */
export type ELComponentProps<T> = T extends readonly [...unknown[], infer Last]
  ? Last extends object
    ? Last
    : never
  : T extends object
    ? T
    : Record<string, unknown>
