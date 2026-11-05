/**
 * builders/core —— 链式构建器共享底座
 *
 * 从 builders.ts 拆分（架构审查 #3：621 行超 400 硬上限）。本文件只含
 * 全部 builder 共用的三部分，各组件 builder 按域拆到 fields-*.ts / containers.ts：
 *
 * 1. NodeBuilder<C> —— 泛型基类，绑死 component 名 + props 类型
 *    通过 `class extends NodeBuilder` 直接继承所有链式方法（label/prop/required/...）
 *    无需在子类中重复声明
 * 2. makeBuilder(componentName) —— 工厂返回一个继承 NodeBuilder 的 class，
 *    子类只需实现 component-specific 方法（clearable/options/format/...）
 * 3. makeSimpleBuilder(componentName) —— 无 component-specific 方法的纯组件入口模板
 *
 * 类型推导：xInput() → Builder<'Input', ElInputProps> → build() 返回 SchemaNodeFor<'Input'>，
 * 这样 IDE 在链式调用时自动补全 props 字段名 + 校验 props 值类型。
 *
 * 类型断言（`as never`）归因：链式 builder 返回 SchemaNodeFor<C> 时，规则 / prop value 等字段
 * 类型与 element-plus 内部 props union 不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；
 * 运行时已验证 setRules / setProps 生效，TS 层用 as never 兜底。
 *
 * @group XForm 构建器
 */
import type {
  SchemaNode,
  SchemaNodeFor,
  ComponentName,
  ComponentPropsRegistry,
  RuleItem,
  ReactionValue,
  XFormLabelFn,
} from '../types'

/**
 * 链式构建器泛型基类
 *
 * - C：绑死的 component 名（决定 SchemaNodeFor<C> 类型）
 * - P：组件 props 类型（默认从 ComponentPropsRegistry 推导）
 *
 * 所有方法返回 `this` —— 链式调用通过原型链继承自动可用
 */
export class NodeBuilder<C extends ComponentName, P = ComponentPropsRegistry[C]> {
  // public 供 Ext 子类（如 CardBuilderExt.column / RadioGroupBuilderExt.options）直接访问
  node: Partial<SchemaNodeFor<C>> = {}

  constructor(componentName: C, name?: string) {
    if (name !== undefined) this.node.name = name
    this.node.component = componentName
  }

  label(label: string | XFormLabelFn): this {
    this.node.label = label
    return this
  }

  defaultValue(v: P extends { defaultValue?: infer D } ? D : unknown): this {
    this.node.defaultValue = v
    return this
  }

  placeholder(p: string): this {
    const n = this.node as { props?: Record<string, unknown> }
    n.props = { ...(n.props ?? {}), placeholder: p }
    return this
  }

  prop(key: string, value: unknown): this {
    const n = this.node as { props?: Record<string, unknown> }
    n.props = { ...(n.props ?? {}), [key]: value }
    return this
  }

  /** 字段禁用状态 —— 支持反应式（boolean / 函数 / 函数表达式） */
  disabled(v: ReactionValue<boolean>): this {
    this.node.disabled = v
    return this
  }

  /** callback 风格 validator(async-validator 兼容,同步或异步均可)
   *  - 多次调用会 push 多个 rule 到 rules 数组
   *  - 典型 async 用法:fn 内部调用 cb(new Error(...)) 或 cb() 表示失败/通过 */
  validator(
    fn: (rule: unknown, value: unknown, cb: (err?: Error) => void) => void,
    trigger: 'blur' | 'change' = 'blur'
  ): this {
    const n = this.node as { rules?: string | RuleItem | Array<string | RuleItem> }
    const arr = Array.isArray(n.rules) ? n.rules : n.rules !== undefined ? [n.rules] : []
    arr.push({ validator: fn as never, trigger })
    n.rules = arr as never
    return this
  }

  /** async 风格 validator 简写 —— 内部自动包成 callback 风格
   *  - fn 必须**内部**调 cb(成功 cb() / 失败 cb(Error))
   *  - 包装层不主动调 cb(避免覆盖 fn 内部调用)
   *  - 仅在 fn 抛错/返回 rejected Promise 时调 cb(Error),防止 fn 忘记调 cb 导致 el-form 永久等待 */
  asyncValidator(
    fn: (rule: unknown, value: unknown, cb: (err?: Error) => void) => Promise<unknown>,
    trigger: 'blur' | 'change' = 'blur'
  ): this {
    return this.validator((rule, value, cb) => {
      fn(rule, value, cb).catch((err: unknown) =>
        cb(err instanceof Error ? err : new Error(String(err)))
      )
    }, trigger)
  }

  required(message = '必填'): this {
    const n = this.node as { rules?: RuleItem[] | string }
    if (Array.isArray(n.rules)) n.rules.push({ required: true, message, trigger: 'blur' })
    // 字符串是命名规则引用 —— 保留引用并追加 required（此前整体覆盖导致命名规则丢失 H10）
    else if (typeof n.rules === 'string')
      n.rules = [n.rules, { required: true, message, trigger: 'blur' }] as never
    else n.rules = [{ required: true, message, trigger: 'blur' }]
    return this
  }

  rules(rules: RuleItem[] | string): this {
    this.node.rules = rules
    return this
  }

  hidden(flag = true): this {
    this.node.hidden = flag
    return this
  }

  ignore(flag = true): this {
    this.node.ignore = flag
    return this
  }

  col(span: number): this {
    this.node.col = { span }
    return this
  }

  reaction(r: NonNullable<SchemaNode['reaction']>): this {
    this.node.reaction = r
    return this
  }

  build(): SchemaNodeFor<C> {
    return this.node as SchemaNodeFor<C>
  }
}

/**
 * 通用 builder 工厂：返回绑死 component 名的类（extends NodeBuilder）
 * 原实现需在工厂内重复声明 13 个方法转发到 _b；重构后通过原型继承直接获得全部方法
 */
export function makeBuilder<C extends ComponentName>(
  componentName: C
): new (name: string) => NodeBuilder<C, ComponentPropsRegistry[C]> {
  class BasicBuilder extends NodeBuilder<C, ComponentPropsRegistry[C]> {
    constructor(name: string) {
      super(componentName, name)
    }
  }
  return BasicBuilder as new (name: string) => NodeBuilder<C, ComponentPropsRegistry[C]>
}

/**
 * 极简 builder 工厂：返回 (fieldName: string) => NodeBuilder 实例
 * 用于没有 component-specific 链式方法的纯组件（InputPassword/ColorPicker/Mention/Rate/...）
 * 取代原来「const XxxBuilder = makeBuilder + export const xXxx = (n) => new XxxBuilder(n)」2 行模板
 */
export const makeSimpleBuilder =
  <C extends ComponentName>(componentName: C) =>
  (fieldName: string): NodeBuilder<C> =>
    new (makeBuilder(componentName))(fieldName)
