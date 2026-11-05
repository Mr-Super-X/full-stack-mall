/**
 * SchemaNode 命名空间 —— 校验（2 字段）
 *
 * P2-1 拆分：原 SchemaNode 31 字段拆为 9 个命名空间接口，本文件定义「校验」子集：
 * rules / defaultValue —— 字段校验规则与初始默认值。
 *
 * 业务用法：
 * - 直接 import 此接口用于"只需校验相关字段 + 其他命名空间字段"的子类型场景
 * - 通过 SchemaNode（schema-node.ts）使用全部 9 个命名空间
 *
 * 不变量：
 * - SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价
 * - 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变
 */
import type { RuleItem } from './rule'

/**
 * SchemaNodeValidate —— 校验（rules / defaultValue）
 */
export interface SchemaNodeValidate {
  /**
   * 字段级校验规则（async-validator 兼容 + 跨字段扩展）
   * - string：命名规则名（在 XFormProps.rules 中查找）
   * - RuleItem：单个规则对象（required / pattern / validator / crossValidator 等）
   * - Array<string | RuleItem>：多个规则按顺序串行校验
   * @group 校验
   */
  rules?: string | RuleItem | Array<string | RuleItem>
  /**
   * 字段初始默认值（mount 时填充 model[name]，仅当 model 中字段未定义时生效）
   * 用户编辑后值会被替换；resetFields() 时回到此值
   * @group 校验
   */
  defaultValue?: unknown
}
