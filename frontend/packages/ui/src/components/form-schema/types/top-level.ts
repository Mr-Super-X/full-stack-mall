/**
 * SchemaNode 命名空间 —— 顶层配置（7 字段，双层语义）
 *
 * P2-1 拆分：原 SchemaNode 31 字段拆为 9 个命名空间接口，本文件定义「顶层配置」子集：
 * labelPosition / labelWidth / scrollToError / scrollIntoViewOptions / debounceValidation /
 * watchFallback / schemaVersion —— 通常在顶层 schema 配置，但字段级可 override。
 * schemaVersion 为低代码设计器演进接口预留（PM 审查发现 12，Wave4-3）。
 *
 * 业务用法：
 * - 直接 import 此接口用于"只需顶层配置 + 其他命名空间字段"的子类型场景
 * - 通过 SchemaNode（schema-node.ts）使用全部 9 个命名空间
 *
 * 不变量：
 * - SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价
 * - 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变
 */

/**
 * SchemaNodeTopLevel —— 顶层配置（双层语义：顶层为默认值，字段级 override）
 */
export interface SchemaNodeTopLevel {
  /**
   * el-form label 位置 —— 顶层为默认值，字段级可 override
   *
   * element-plus ElFormItem 与 ElForm 共享 label-position prop，所以字段级可独立设置；
   * 字段级未设置时 el-form-item 自动继承 el-form 顶层配置（element-plus 原生行为）。
   *
   * 【双层语义】顶层 schema 配置 = 表单整体默认值；字段级 override = 个别字段差异化布局
   * @group 布局
   */
  labelPosition?: 'left' | 'right' | 'top'
  /**
   * el-form label 宽度 —— 顶层为默认值，字段级可 override
   * - 顶层配置：表单整体 label 宽度（透传 el-form label-width）
   * - 字段级配置：该字段独立 label 宽度（透传 el-form-item label-width）
   * - 如 '120px' 或 120；数组形式 schema 无顶层节点，配置不生效
   *
   * 【双层语义】顶层默认 / 字段级 override
   * @group 布局
   */
  labelWidth?: string | number
  /**
   * 校验失败自动滚动到第一个错误字段（仅顶层 schema 生效，与 labelPosition 同模式）：
   * - 字段规则失败：ElForm 原生滚动到第一个 .el-form-item.is-error
   * - 跨字段 crossValidator 失败：XForm 内部滚动到第一个错误字段（keyPath 末段）
   * - 默认 false（与 element-plus 原生一致）
   * @group 顶层 schema
   */
  scrollToError?: boolean
  /**
   * 滚动行为选项（仅顶层 schema 生效，默认 true），如 { behavior: 'smooth', block: 'center' }
   * @group 顶层 schema
   */
  scrollIntoViewOptions?: ScrollIntoViewOptions | boolean
  /**
   * 跨字段校验的全局默认 debounce 时延（毫秒，仅顶层 schema 生效）
   * - 0（默认）：实时校验（每键触发 crossValidator）
   * - >0：依赖字段停止变化 delay ms 后跑一次 crossValidator（高频输入场景减负）
   *
   * 字段级 rules[i].debounceMs 可覆盖本配置。
   * @group 顶层 schema
   */
  debounceValidation?: number
  /**
   * 反向跨字段校验的 deep watch model 兜底开关（架构审查 #8，仅顶层 schema 生效，默认 true）
   *
   * true：常驻 deep watch 整个 model + 每键 lodash isEqual 快照 diff —— 覆盖「绕过 v-model
   * 直改 model」（如 setModel / 外部 patch）的兜底场景；代价是大表单每键 isEqual 成本。
   * false：关闭兜底 —— 纯 v-model 表单（所有写入都经 onValueChange）可省掉 deep watch，
   * 但绕过 v-model 的写入不再自动触发跨字段校验（需调用方手动 trigger）。
   *
   * @see ../composables/use-cross-field-trigger.ts（watchFallback 消费处）
   * @group 顶层 schema
   */
  watchFallback?: boolean
  /**
   * schema 版本号 —— 低代码设计器演进接口预留（PM 审查发现 12，Wave4-3，仅顶层 schema 生效）
   *
   * 语义：'major.minor.patch' 或业务自定义版本字符串；XForm 渲染管线不消费，
   * 仅供 useFormPersist.restoreFilter 等升级裁剪钩子 + 设计器 schema 升级策略锚定。
   * 业务无版本演进需求可不填。
   *
   * @see ../composables/use-form-persist.ts restoreFilter 消费侧
   * @group 顶层 schema
   */
  schemaVersion?: string
}
