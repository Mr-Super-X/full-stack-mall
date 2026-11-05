/**
 * 校验规则类型 —— async-validator 兼容 + 跨字段扩展
 *
 * 设计决策：复用 element-plus 底层的 async-validator 协议，因此 `required / pattern / min /
 * max / message / validator / trigger / type` 七个字段与官方规范一字不差。
 * 跨字段扩展（`dependsOn / crossValidator / debounceMs`）是 form-schema 自有增强：
 * async-validator 原生不支持多字段联动（如"密码 == 确认密码"），需自行调度 depends 链。
 *
 * 跨字段执行链路（详见 ../composables/use-cross-field-rule-trigger.ts）：
 *   依赖字段变更 → crossValidator(value, ...depends) → true | string | Promise<...>
 *   返回 string 作为错误 message，由 validateForm 统一写入对应 form-item
 *
 * @see ../composables/use-cross-field-rule-trigger.ts 跨字段触发器实现
 * @see ../composables/use-form-validation.ts 校验编排入口
 * @see ./xform.ts ValidateOptions.validateFirst 入参说明
 *
 * @group 类型系统
 */

/** 单条字段校验规则（async-validator 兼容 + 跨字段扩展） */
export interface RuleItem {
  required?: boolean
  pattern?: RegExp | string
  min?: number | string
  max?: number | string
  message?: string
  validator?: (rule: unknown, value: unknown, cb: (err?: Error) => void) => void
  trigger?: 'blur' | 'change' | 'manual' | string | string[]
  /** async-validator 内置类型校验,如 'string' / 'email' / 'url' / 'number' 等 */
  type?: string
  /** 跨字段依赖：声明当前规则依赖的其他字段名（取自同 model，支持 lodash 路径解析如 'items[0].qty'）
   *  - 单字段依赖：dependsOn: 'password'
   *  - 多字段依赖：dependsOn: ['password', 'confirmPassword']
   *  仅与 crossValidator 配合使用；单独写无意义 */
  dependsOn?: string | string[]
  /** dependsOn 的别名，与 reaction / asyncOptions 的 deps 命名保持一致（PM 审查发现 4）
   *  - 优先读 dependsOn，未声明时回退读 deps（二者同时声明时 dependsOn 优先）
   *  - 新代码建议写 deps（命名更短，与另两套依赖机制一致）；dependsOn 保留向后兼容 */
  deps?: string | string[]
  /** 跨字段校验函数（替代 async-validator 的 callback validator，支持同步/异步）
   *  - 第 1 个参数：当前字段 value（lodash get 取自 model）
   *  - 后续参数：按 dependsOn 声明顺序传入依赖字段的 value
   *  - 返回 true 表示通过；返回 string 作为错误信息
   *  - 返回 Promise<true | string> 支持异步校验（远程接口等场景），validateForm 会 await
   * 失败时由 form-schema 统一把 message 写入对应 form-item，无需 callback */
  crossValidator?: (
    value: unknown,
    ...dependsOnValues: unknown[]
  ) => true | string | Promise<true | string>
  /**
   * 跨字段校验的 debounce 时延（毫秒，覆盖 schema 顶层 debounceValidation）
   * - 未设置：继承 schema.debounceValidation（默认 0 = 实时）
   * - >0：依赖字段停止变化 delay ms 后跑一次 crossValidator（适合密码/确认密码高频输入场景）
   * - 0：实时（每键触发）
   * 仅对有 crossValidator 的规则生效；纯字段规则（required / pattern）走 element-plus 自身 trigger
   */
  debounceMs?: number
}
