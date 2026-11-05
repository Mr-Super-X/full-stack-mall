/**
 * RichTextEditor 高级富文本编辑器 —— barrel 导出层
 *
 * 角色：对外统一出口。组件（`RichTextEditor.vue`）+ 全部类型定义从这里导出。
 *
 * 与 ProDialogForm 的差异（不走「强制显式 import」）：
 * - 消费方通常直接模板使用 `<RichTextEditor v-model="html" />`，无需操作 ref / 类型标注，
 *   依赖 unplugin-vue-components 自动注册即可获得完整 Props 类型提示（deep 扫描 common/ 子目录，
 *   注册名按文件名不变）
 * - 本 barrel 主要价值：类型出口（RichTextEditorProps / Emits / UploadResult）+
 *   需要显式 import 的场景（如 demo 里 `?raw` 提取源码做 API 文档）
 * - 与 ProDialog / ProDialogForm 保持一致：目录 + barrel 模式，避免组件文件散落 common/ 一级
 *
 * @see [`./RichTextEditor.vue`](./RichTextEditor.vue) 组件本体
 * @see [`./types.ts`](./types.ts) Props / Emits / UploadResult 类型
 * @group 通用组件：RichTextEditor
 */
export { default as RichTextEditor } from './RichTextEditor.vue'

/** RichTextEditor Props @see ./types.ts */
export type { RichTextEditorProps } from './types'
/** RichTextEditor Emits @see ./types.ts */
export type { RichTextEditorEmits } from './types'
/** 自定义图片上传返回值（调用方实现 uploadApi 时的返回类型） @see ./types.ts */
export type { UploadResult } from './types'
