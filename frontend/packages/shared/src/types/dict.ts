/**
 * 字典类型契约（前端主导定义，后端 / Mock 必须遵守）。
 *
 * 为什么放 src/types/ 而不是 api/modules/dict.ts：
 * DictItem 是跨层契约 —— API 层（解析响应）、store 层（缓存）、composable 层（useDict）、
 * 组件层（DictSelect / DictTag）都要引用它。若定义在 api 层，store / components
 * 就反向依赖了「请求实现细节」；放 types/ 后各层平级引用，
 * 依赖方向干净（types 不依赖任何业务代码，符合 §2.1 目录职责）。
 *
 * 关于契约中的 `[key: string]: any`：
 * 项目规范严禁 any（全局规则 §二.3），这里用 unknown 索引签名严格化 ——
 * 「允许任意扩展字段」的语义完全等价，但读取扩展字段时强制类型收窄，更安全。
 *
 * @see [`src/api/modules/dict.ts`](../api/modules/dict.ts) 按 code 拉取字典的请求出口
 * @group 字典类型契约
 */

/**
 * el-tag 主题色 —— 与 element-plus `TagProps['type']` 对齐。
 * 空串表示「不传 type，用 el-tag 默认主题」。
 *
 * @group 字典类型契约
 */
export type DictTagType = '' | 'primary' | 'success' | 'info' | 'warning' | 'danger'

/**
 * 字典项 —— 前端定义的契约结构，后端按字典 code 返回 `DictItem[]`。
 *
 * 字段语义（后端契约）：
 * - `value` / `label`：必填，选项值与显示文本
 * - `type`：可选，el-tag 主题（DictTag 消费；DictSelect 不使用）
 * - `disabled`：可选，下拉中该项禁选（DictSelect 消费；DictTag 不受影响）
 * - `cssClass`：可选，自定义类名透传到 DictTag 根节点（业务特殊样式钩子）
 * - 其余字段原样保留（`sort` / `color` / `remark` 等业务扩展），由索引签名兜底
 *
 * @group 字典类型契约
 */
export interface DictItem {
  /** 字典项值（el-option 的 :value，也是表单提交值） */
  value: string | number
  /** 显示文本 */
  label: string
  /** el-tag 主题（DictTag 消费；不传则用 el-tag 默认主题） */
  type?: DictTagType
  /** 是否禁用（DictSelect 中该项不可选；DictTag 渲染不受影响） */
  disabled?: boolean
  /** 自定义 CSS 类名（透传到 DictTag 根节点，供业务定制特定字典项样式） */
  cssClass?: string
  /**
   * 扩展字段：后端可附加任意业务字段（如 `sort` / `color` / `remark`），前端原样保留。
   * 用 unknown 而非契约中的 any —— 语义等价（允许扩展），但读取时必须类型收窄。
   */
  [key: string]: unknown
}
