/**
 * useRowEdit —— 行内编辑状态机（spec §5.1）
 * draft Map 与表格 data 完全隔离，取消编辑不污染原数据 + 多行并行编辑互不干扰。
 * @group ProTable composables
 */

/** 行内编辑 composable 选项（spec §5.1）。@group ProTable Composables */
export interface UseRowEditOptions {
  /** 行 key 字段名（默认 'id'）—— _save 按该字段在 data 中定位行 @group 编辑配置 */
  rowKey?: string
  /** 保存前业务校验/提交；返回 false 中止（保留编辑态），抛错走 onSaveError。@group 编辑钩子 */
  onSave?: (
    row: Record<string, unknown>,
    changes: Record<string, unknown>
  ) => boolean | Promise<boolean>
  /** 保存成功且 draft 已合并进 data 后触发。@group 编辑钩子 */
  onSaved?: (row: Record<string, unknown>) => void
  /** onSave 抛错时触发，常在此调用 setError 写字段级错误。@group 编辑钩子 */
  onSaveError?: (row: Record<string, unknown>, error: unknown) => void
}

/** 行内编辑状态机（spec §5.1）。@group ProTable Composables */
export function useRowEdit(options: UseRowEditOptions) {
  const editingKeys = ref<Set<string | number>>(new Set())
  const drafts = ref<Map<string | number, Record<string, unknown>>>(new Map())
  const errors = ref<Map<string | number, Record<string, string>>>(new Map())
  const validating = ref<Set<string | number>>(new Set())

  const isEditing = (rowKey: string | number) => editingKeys.value.has(rowKey)
  const getValue = (rowKey: string | number, field: string): unknown => {
    const draft = drafts.value.get(rowKey)
    return draft && field in draft ? draft[field] : undefined
  }
  const setValue = (rowKey: string | number, field: string, value: unknown) => {
    if (!drafts.value.has(rowKey)) drafts.value.set(rowKey, {})
    drafts.value.get(rowKey)![field] = value
  }
  const getError = (rowKey: string | number, field: string) => errors.value.get(rowKey)?.[field]
  const setError = (rowKey: string | number, field: string, message: string) => {
    if (!errors.value.has(rowKey)) errors.value.set(rowKey, {})
    errors.value.get(rowKey)![field] = message
  }
  /**
   * v3.0 修复：_start 初始化 drafts 时从原始行数据复制当前字段值。
   * 之前 drafts 是空 {} → getValue 返回 undefined → EditCell 渲染空 input。
   * 现在 drafts 预填当前行各字段 → 双击进编辑时 input 显示原值。
   *
   * @param rowKey 行唯一键
   * @param rowData 原始行数据（v2.0 通过 onStart 钩子传入；v3.0 兼容直接传 row）
   */
  const _start = (rowKey: string | number, rowData?: Record<string, unknown>) => {
    editingKeys.value.add(rowKey)
    if (!drafts.value.has(rowKey)) {
      drafts.value.set(rowKey, rowData ? { ...rowData } : {})
    }
  }
  const _cancel = (rowKey: string | number) => {
    editingKeys.value.delete(rowKey)
    drafts.value.delete(rowKey)
    errors.value.delete(rowKey)
  }
  const _save = async (
    rowKey: string | number,
    data: Record<string, unknown>[]
  ): Promise<boolean> => {
    if (validating.value.has(rowKey)) return false
    validating.value.add(rowKey)
    const keyField = options.rowKey ?? 'id'
    try {
      const draft = drafts.value.get(rowKey) ?? {}
      const row = data.find((r) => r[keyField] === rowKey)
      if (!row) return false
      const result = await options.onSave?.(row, draft)
      if (result === false) return false
      Object.assign(row, draft)
      editingKeys.value.delete(rowKey)
      drafts.value.delete(rowKey)
      errors.value.delete(rowKey)
      options.onSaved?.(row)
      return true
    } catch (err) {
      const row = data.find((r) => r[keyField] === rowKey)
      if (row) options.onSaveError?.(row, err)
      return false
    } finally {
      validating.value.delete(rowKey)
    }
  }

  return {
    editingKeys: computed(() => editingKeys.value),
    isEditing,
    getValue,
    setValue,
    getError,
    setError,
    _start,
    _cancel,
    _save,
  }
}
