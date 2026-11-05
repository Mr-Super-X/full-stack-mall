/**
 * SchemaNode 命名空间 —— v-model 适配（1 字段）
 *
 * P2-1 拆分：原 SchemaNode 31 字段拆为 9 个命名空间接口，本文件定义「v-model 适配」子集：
 * modelProp —— 特殊 v-model 绑定的属性名（默认 'modelValue'，Upload 节点用 'file-list'）。
 *
 * 业务用法：
 * - 直接 import 此接口用于"只需 modelProp + 其他命名空间字段"的子类型场景
 * - 通过 SchemaNode（schema-node.ts）使用全部 9 个命名空间
 *
 * 不变量：
 * - SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价
 * - 字段 JSDoc verbatim 拷贝自原 schema-node.ts，IDE hover 不变
 */

/**
 * SchemaNodeVModel —— v-model 适配（modelProp）
 */
export interface SchemaNodeVModel {
  /**
   * v-model 绑定的属性名（默认 'modelValue'，Upload 节点用 'file-list'）
   * @group v-model 适配
   */
  modelProp?: string
}
