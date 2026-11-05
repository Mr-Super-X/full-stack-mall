// defineStore / ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）——原显式 import
// 是 v3.5 清理 65 处的漏网（2026-10-27 导入审计修复）

/**
 * Workbench 模块私有状态。
 *
 * 命名约束：首参数 `'module-workbench'` 必须全局唯一，否则 Pinia 启动时会冲突。
 * 私有状态不与跨模块共享，跨模块通信请走"模块对外接口"（本目录的 ../index.ts）。
 */
export const useWorkbenchStore = defineStore('module-workbench', () => {
  // 示例：列表查询条件 / 详情缓存 / 表单草稿
  const draft = ref<Record<string, unknown>>({})

  function setDraft(key: string, value: unknown): void {
    draft.value[key] = value
  }

  function clearDraft(): void {
    draft.value = {}
  }

  return { draft, setDraft, clearDraft }
})
