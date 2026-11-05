/**
 * ProDialog 高级弹窗 —— barrel 导出层。
 *
 * 角色：对外统一出口。声明式组件（`ProDialog.vue`）+ 全部类型定义从这里导出，
 * 消费方只需 `import { ProDialog } from '@components/common/ProDialog'`。
 *
 * 注意：本目录下的 `ProDialog.vue` 同时被 `@vv/ui` 的 global-components（createGlobalComponents）
 * glob 扫描全局注册为 `<ProDialog>`（按 BEM 文件名解析组件名），barrel 不影响该机制。
 *
 * @see [`./ProDialog.vue`](./ProDialog.vue) 组件本体
 * @group 通用组件：ProDialog
 */
export { default as ProDialog } from './ProDialog.vue'

/** ProDialog Props：ElDialog 原生 Props 全量继承 + draggable / fullScreen / showFullScreenButton @see ./types.ts */
export { type ProDialogProps } from './types'
/** ProDialog 事件：update:modelValue / open / close / confirm / fullScreenChange @see ./types.ts */
export { type ProDialogEmits } from './types'
/** useDialog 命令式 Hook 的配置类型 @see ./types.ts */
export { type UseDialogOptions } from './types'
