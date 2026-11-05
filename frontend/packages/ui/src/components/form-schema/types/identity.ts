/**
 * SchemaNode 命名空间 —— 节点标识（6 字段）
 *
 * P2-1 拆分：原 SchemaNode 31 字段拆为 9 个命名空间接口，本文件定义「节点标识」子集：
 * component / name / label / key / id / meta —— 标记节点身份与 v-for key 的最小字段集。
 * id / meta 为低代码设计器演进接口预留（PM 审查发现 12，Wave4-3）：仅类型契约，不实现设计器。
 *
 * 业务用法：
 * - 直接 import 此接口用于"只需节点标识 + 其他命名空间字段"的子类型场景
 * - 通过 SchemaNode（schema-node.ts）使用全部 9 个命名空间
 *
 * 不变量：
 * - SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价
 * - 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变
 */

/**
 * 翻译函数 —— XForm 不绑定具体 i18n 库（分层铁律：components/ 不得 import locales/），
 * 由调用方注入 vue-i18n 的 t / 自研字典查表函数等任意 (key) => string 实现
 *
 * @group 节点标识
 */
export type XFormTranslateFn = (key: string) => string

/**
 * i18n 函数式 label —— 渲染期由 XForm 以 props.t 求值（架构审查 PM 发现 3，2026-09-18 落地）
 *
 * 与 reaction 的 label 函数区分：reaction.label 函数收 model、在 reaction 管线求值成
 * string 后写入 node.label；本函数收 t、由渲染层 resolveLabel 在 render effect 内求值
 * （vue-i18n 的 t 在 effect 内调用可建立 locale 依赖 → 语言切换自动重渲）
 *
 * 缺省 t（未注入 props.t）为 identity：fn((key) => key) —— 业务可完全闭包自译
 *
 * @group 节点标识
 */
export type XFormLabelFn = (t: XFormTranslateFn) => string

/**
 * 组件 —— 支持三种形式：
 * - EL 组件名：string（内置短名如 'Input' / 全名 'ElInput' / components prop 注册名）
 * - 原生 HTML 标签：string（全小写，如 'a' / 'span' / 'div'），直接渲染原生元素
 * - Component 对象：直接传入 Vue 组件实例/选项对象（无需在 XForm 的 components prop 注册）
 *
 * 推荐：EL 组件用 string 形式 + XForm 集中注册；slots 内的 trigger 元素也支持直接传 Component 对象
 * @group 节点标识
 */
export interface SchemaNodeIdentity {
  component?: string | object
  /**
   * 表单字段名 —— 绑定 model[name] 用于 el-form 数据收集与校验路径
   * 数组节点必填（items[*] 等）；纯 UI 节点（如 Card）可不填
   * @group 节点标识
   */
  name?: string
  /**
   * el-form-item label 文本（左侧/上方/右侧 由 labelPosition 决定）
   * - string：字面量直显
   * - XFormLabelFn：i18n 函数式，渲染期以 props.t 求值
   * @group 节点标识
   */
  label?: string | XFormLabelFn
  /**
   * v-for key（数组行用行对象身份前缀派生稳定 key；详见 array-row-key.ts）
   * key 优先级 > name（数组删/移行后 name 漂移会导致 form-item 重挂载）
   * @group 节点标识
   */
  key?: string | number
  /**
   * 节点稳定 id —— 低代码设计器演进接口预留（PM 审查发现 12，Wave4-3）
   *
   * 仅供设计器选中/锚定/回写使用；XForm 渲染与校验不消费（仍按 name/key 做标识）。
   * 业务手写 schema 可不填。约定：同层级内唯一，建议 'kebab-case' 或 UUID。
   * @group 节点标识
   */
  id?: string
  /**
   * 节点扩展元数据 —— 低代码设计器演进接口预留（PM 审查发现 12，Wave4-3）
   *
   * 透传不透明键值对（设计器私有状态 / 业务标注），XForm 渲染管线不消费、不校验、
   * 不序列化到 model。建议：仅放可 JSON 序列化的纯数据（与 schema 纯 JSON 约束一致）。
   * @group 节点标识
   */
  meta?: Record<string, unknown>
}
