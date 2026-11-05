/**
 * ProDialogForm 高级弹窗表单 —— barrel 导出层
 *
 * 角色：对外统一出口。组件（`ProDialogForm.vue`）+ 全部类型定义从这里导出，
 * 消费方只需 `import { ProDialogForm } from '@components/common/ProDialogForm'`。
 *
 * 为什么不走 unplugin-vue-components 全局注册？
 * - ProDialogForm 内部组合了 ProDialog + XForm + 业务配置 props，调用方通常需要
 *   显式 import + 标注 props 类型，全局自动注册会让 IDE hover 丢失 Props 类型签名
 *   （详见 CLAUDE.md §1.7 "组件全局注册与 IDE 智能提示"）
 * - 与 ProDialog 保持一致：ProDialog 也走子目录 + barrel 显式 import 模式
 *
 * @see [`./ProDialogForm.vue`](./ProDialogForm.vue) 组件本体
 * @see [`./types.ts`](./types.ts) Props / Emits / Expose 类型
 * @group 通用组件：ProDialogForm
 */
export { default as ProDialogForm } from './ProDialogForm.vue'

/** ProDialogForm Props @see ./types.ts */
export type { ProDialogFormProps } from './types'
/** ProDialogForm Emits @see ./types.ts */
export type { ProDialogFormEmits } from './types'
// Re-export 依赖类型供调用方使用（避免调用方单独 import form-schema/types）
export type { XFormExpose } from '../../form-schema/types.ts'
/** ProDialogForm Expose —— 透传 XFormExpose 全部 19 个方法 @see ./types.ts */
export type { ProDialogFormExpose, ValidateServerResponse } from './types'
