/**
 * 反应式类型 —— 节点级派生字段的运行时求值
 *
 * 设计职责：把"某个字段值随其他字段变化而变化"这类联动需求抽象为可声明的 schema 片段，
 * 避免业务在 onChange 回调里手写副作用（难以维护 + 难以跨字段）。
 *
 * 字段族：
 * - ReactionValue<T>：单值反应式（字面量 / 函数 / 函数表达式字符串 三选一）
 * - ReactionConfig：reaction 字段（覆盖节点的任意字段），含 strategy / delay / deps 性能优化
 * - SchemaNodeReactive：7 字段响应式命名空间，被 SchemaNode extends 组合
 *
 * 执行链路：
 *   model 变化 → useReaction watchEffect → applyReactionFields 求值 → target[key] = value
 *
 * 命名空间索引：完整 9 命名空间字段对照表见 ../types.ts
 * @see ../composables/use-reaction.ts reaction 调度实现
 * @see ../composables/apply-reaction-fields.ts 求值 → 节点字段赋值实现
 */
import type { SchemaNode } from './schema-node'

/** 反应式字段值：字面量 / 函数 / 函数表达式字符串 —— 三种形态运行时由 use-reaction 统一求值 */
export type ReactionValue<T> = T | ((model: Record<string, unknown>) => T) | string

/** 反应式配置 —— reaction 字段类型，覆盖节点的任意字段 */
export interface ReactionConfig {
  rules?: ReactionValue<SchemaNode['rules']>
  // reaction.props 整体作为 ReactionValue：applyReactionFields 对函数/字符串求值后整体覆盖 node.props
  // （不是「逐字段反应式」——use-reaction 第 14-34 行 applyReactionFields 是直接赋值 target[key] = value）
  props?: ReactionValue<Record<string, unknown>>
  label?: ReactionValue<string>
  hidden?: ReactionValue<boolean>
  /** 反应式调度策略
   *  - 'sync'(默认):依赖变化立即同步执行 reaction 函数
   *  - 'debounce':依赖停止变化 delay ms 后执行一次(适合远程搜索等高频输入)
   *  - 'throttle':delay ms 内最多执行一次(适合实时保存等)
   *  strategy / delay 在 use-reaction 中解析,不会写入 node */
  strategy?: 'sync' | 'debounce' | 'throttle'
  /** debounce / throttle 延迟(ms);strategy !== 'sync' 时生效 */
  delay?: number
  /** 依赖字段路径列表（性能优化，如 ['a', 'b.c']）：
   *  声明后仅精确 watch 这些路径；不声明则保持旧行为 —— deep watch 整棵 model，
   *  任意字段变化都触发求值（大表单下 N 字段 × M 联动开销显著） */
  deps?: string[]
  // 其他可覆盖字段（开闭原则：未知字段透传）
  [key: string]: unknown
}

/**
 * SchemaNode 命名空间 —— 响应式（7 字段）
 *
 * 字段：reaction / disabled / permission / readonly / hidden / ignore / beforeChange
 * 职责：节点级派生 + 三态语义（view/edit/hidden）+ 业务内聚拦截层。
 *
 * 不变量：SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价。
 * 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变。
 * @group 响应式
 */
export interface SchemaNodeReactive {
  /**
   * 反应式配置 —— 覆盖节点任意字段（rules / props / label / hidden / disabled / ...）
   * - strategy: sync（默认）/ debounce / throttle + delay
   * - deps: 精确监听路径数组（避免 deep watch 整棵 model）
   * @group 响应式
   */
  reaction?: ReactionConfig
  /**
   * 字段禁用状态（支持反应式：boolean / 函数 / 函数表达式）
   *
   * - 数组节点：仅控制容器按钮（行内控件需通过 reaction 自行级联）
   * - props.disabled 优先级更高：用户显式写在 props 里的 disabled 会覆盖本字段
   * - el-form 自动跳过 disabled 字段的校验（async-validator 行为）
   *
   * 【双层语义】字段级 = 字段禁用；顶层 schema = 整体禁用整个表单（透传 el-form disabled，与 labelPosition 同模式）
   *
   * 与 `permission: 'hidden'` 的区别：disabled 仍渲染 DOM 但视觉灰显 + 跳过校验；
   * 'hidden' 直接不渲染。表单提交逻辑若要"附带字段但不让用户改"用 disabled，若要
   * "完全屏蔽"用 permission: 'hidden'。
   * @see permission 若需 view（纯文本展示）或 hidden（不渲染）
   * @see readonly 顶层整体只读模式
   * @group 响应式
   */
  disabled?: ReactionValue<boolean>
  /**
   * 字段权限（view / edit / hidden 三态）：
   * - 'edit'：正常渲染为可编辑控件（默认值，不配置等同 edit）
   * - 'view'：渲染为只读纯文本（model value 展示），跳过校验
   * - 'hidden'：不渲染该字段（DOM 中不出现）
   *
   * 动态权限：函数形式 (model) => 'view' | 'edit' | 'hidden'，根据当前 model 动态决定。
   * 权限码形式：字符串 'user.edit' 等，需配合 XForm 的 permissionResolver 配置；
   * 用户可注入 useAuth().hasPerm 实现权限码 → 状态映射。
   *
   * 与 `disabled` 的区别：disabled 仍渲染灰显 + 跳过校验；permission 是三态语义（view/edit/hidden），
   * 表达"展示形式"。表单状态切换场景（如 admin → read-only）用 permission。
   * 与 `readonly` 的区别：permission 是字段级；readonly 是顶层整体只读（一次性给所有字段套 view）。
   * @see disabled 字段级灰显
   * @see readonly 顶层整体只读
   * @group 响应式
   */
  permission?: ReactionValue<'view' | 'edit' | 'hidden'>
  /**
   * 字段级 beforeChange（第 3 层：业务内聚）
   * - 与 Props.beforeChange 同签名（多 allValues + ctx 两可选参在尾部）
   * - 数组元素字段（items[i].phone）直接写在 array.children[i].phone 上即可
   * - 可通过 ctx.setFieldValue 联动修改其他兄弟字段（ctx 完全开放）
   *
   * 三层 beforeChange 拦截顺序：Props.beforeChange（全局横切）→ beforeChangeRules（命名空间 pattern 匹配）
   * → SchemaNode.beforeChange（字段级业务内聚）。任意一层返回 undefined 放行给下一层；
   * reject / 抛异常 → 中断后续写入。
   * @see ../types/xform.ts XFormProps.beforeChange 全局横切层
   * @see ../types/xform.ts XFormProps.beforeChangeRules 命名空间层
   * @group 响应式
   */
  beforeChange?: import('./xform').BeforeChangeFn
  /**
   * 整体只读模式（仅顶层 schema 生效，与 labelPosition/disabled 同模式）：
   * - true 时所有字段按 view 态纯文本展示（复用 permission: 'view' 渲染链路，不包 formItem、不走校验）
   * - hidden 优先级更高（hidden 字段仍不渲染）
   * - 支持字面量 / 函数 / 函数表达式 / reaction 动态求值
   * - 字段级只读请用 permission: 'view'（本字段仅顶层生效）
   *
   * 与 `permission: 'view'` 的区别：readonly 一次性给所有字段套 view；permission 是单字段级控制。
   * 查看模式（用户角色切换为 viewer）用 readonly 顶层；个别字段差异化权限用 permission。
   * @see permission 字段级 view/edit/hidden
   * @see disabled 字段级灰显
   * @group 响应式
   */
  readonly?: ReactionValue<boolean>
  /**
   * 是否渲染（false 时不创建 DOM 节点，el-form-item 也不注册）；支持字面量 / 函数 / 函数表达式
   * 与 ignore 不同：ignore 仍渲染但不参与数据收集
   * @group 响应式
   */
  hidden?: boolean | ReactionValue<boolean>
  /**
   * 是否从 getNames() 排除（不参与校验 / dirty 追踪 / 反应式索引），但仍会渲染
   * 与 hidden 不同：hidden 不渲染；ignore 渲染但不参与表单数据收集
   * @group 响应式
   */
  ignore?: boolean
}
