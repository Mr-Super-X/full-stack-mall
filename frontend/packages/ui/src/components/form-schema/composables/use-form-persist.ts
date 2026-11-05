import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { readDraft, removeDraft, writeDraft } from './draft-storage'

/**
 * useFormPersist —— 表单草稿持久化（防抖自动落盘 + beforeunload flush）
 *
 * 关键不变量：
 * - exclude 字段不落盘（敏感字段如 cvv）；序列化异常仅 warn
 * - schemaVersion 注入时草稿写版本信封；版本不匹配的旧草稿 load 时自动丢弃（防 schema 升级污染 model）
 * - markResetting() / clear() 期间临时屏蔽 watch 回写（避免空 model 覆盖之前草稿）
 *
 * 副作用：写 storage、注册 beforeunload 监听（scope 内 onScopeDispose 自动清理）。
 *
 * @see ./draft-storage.ts 底层 storage 适配
 *
 * @group 表单编排：草稿
 */
export interface FormPersistOptions {
  key: string // 草稿唯一 key：建议 '<模块>.<表单名>.draft'，经 storage.ts namespace 隔离
  model: Record<string, unknown> // 被监听的 reactive model
  storage?: 'local' | 'session' // 默认 'local'（跨会话保留）；'session' 关标签页失效
  debounce?: number // 自动保存防抖 ms，默认 400
  exclude?: string[] // 敏感字段 lodash 路径（如 'card.cvv'），序列化剔除、不落盘
  restoreFilter?: (draft: Record<string, unknown>) => Record<string, unknown> | null // null=丢弃草稿
  /** schema 版本号：配置后草稿写版本信封，版本不匹配的旧草稿 load 时自动丢弃（防 schema 升级污染 model） */
  schemaVersion?: string | number
}
export interface FormPersistReturn {
  save(): void
  load(): boolean
  clear(): void
  /** 取消已调度的 debounce 写入（清空 model 时避免被空 model 覆盖草稿） */
  cancelPendingSave(): void
  /**
   * 标记进入「重置窗口」：屏蔽下一次 watch(model) 的 debouncedWrite，避免空 model 覆盖之前草稿。
   * 用法：先 markResetting()，再调用 formRef.resetFields()——model 被清空但不会触发落盘，
   *       localStorage 中仍是 reset前内容，可再次点恢复还原。
   * nextTick 后自动解除屏蔽（只屏蔽 1 次 watch，防止永久失活）。
   */
  markResetting(): void
  hasDraft: Ref<boolean>
  lastSavedAt: Ref<number | null>
}
/**
 * 草稿持久化：防抖自动落盘 + beforeunload flush 兜底；不自动恢复，由使用方按 hasDraft 决定 load() 时机。
 *
 * 边界：exclude 字段不落盘、序列化异常仅 warn；副作用：写 storage、注册 beforeunload 监听（scope 内自动清理）。
 */
export function useFormPersist(options: FormPersistOptions): FormPersistReturn {
  const { key, model, storage = 'local', exclude = [], restoreFilter, schemaVersion } = options
  const debounceMs = options.debounce ?? 400
  const hasDraft = ref(readDraft(key, storage) !== null)
  const lastSavedAt = ref<number | null>(null)
  function persistNow(): void {
    writeDraft(key, storage, model, exclude, schemaVersion)
    lastSavedAt.value = Date.now()
  }
  function cancelPending(): void {
    debouncedWrite.cancel()
    pendingSave = false
  }
  function load(): boolean {
    const raw = readDraft(key, storage)
    if (raw === null) return false
    let draft = raw
    if (schemaVersion !== undefined) {
      // 版本信封校验：无信封或版本不匹配 → 旧草稿直接丢弃（schema 升级后多余 key 会污染 model）
      if ((raw as { __v?: unknown }).__v !== schemaVersion) {
        removeDraft(key, storage)
        hasDraft.value = false
        return false
      }
      draft = ((raw as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>
    }
    const filtered = restoreFilter ? restoreFilter(draft) : draft
    if (filtered === null) {
      removeDraft(key, storage)
      hasDraft.value = false
      return false
    }
    mergeDraft(model, filtered)
    return true
  }

  /** 深合并草稿到 model：嵌套对象逐层合并（保留 schema 新增字段的默认值）；
   *  数组/原始值整体替换（数组按索引合并会残留旧尾项） */
  function mergeDraft(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(source)) {
      const existing = target[k]
      if (
        v !== null &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        existing !== null &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        mergeDraft(existing as Record<string, unknown>, v as Record<string, unknown>)
      } else {
        target[k] = v
      }
    }
  }
  // pendingSave：防抖窗口内存在未落盘变更的标记，beforeunload 据此同步 flush
  let pendingSave = false
  /** clear() 期间临时屏蔽 watch 写入：让业务代码可在 clear 后立即重置 model 而不触发空草稿回写 */
  let isClearing = false
  /** markResetting() 期间临时屏蔽下一次 watch 写入：让 formRef.resetFields() 触发的空 model 不覆盖之前草稿 */
  let isResetting = false
  const debouncedWrite = debounce(() => {
    pendingSave = false
    persistNow()
    // ⭐ auto-save 后同步更新 hasDraft —— 让「加载草稿」按钮在 fill 字段后立即可用
    // 修复 demo 反馈的「自动保存了但加载按钮还 disabled」问题
    if (!hasDraft.value) hasDraft.value = true
  }, debounceMs)
  watch(model, () => {
    if (isClearing) return
    if (isResetting) {
      // 屏蔽本次重置导致的空 model 回写；只屏蔽 1 次后自动解除
      isResetting = false
      return
    }
    pendingSave = true
    debouncedWrite()
  })
  function save(): void {
    cancelPending()
    persistNow()
    // ⭐ save 后同步更新 hasDraft —— 修复 demo 反馈的「save 后 hasDraft 仍 false」bug
    // init 时 hasDraft 已读 localStorage，但 save 是后续操作需手动同步
    if (!hasDraft.value) hasDraft.value = true
  }
  /** 暴露 cancelPendingSave：让 demo 在「清空 model 但保留草稿」场景调用 */
  function cancelPendingSave(): void {
    cancelPending()
  }
  /** 暴露 markResetting：让 demo 在调 formRef.resetFields() 前调用，
   *  屏蔽下一次 watch 触发（formRef.resetFields 会写空 model），避免空 model 覆盖之前草稿。
   *  仅屏蔽 1 次后自动解除，防止永久失活 */
  function markResetting(): void {
    isResetting = true
  }
  function clear(): void {
    cancelPending()
    // ⭐ 临时屏蔽下一次 watch(model) 写入：调用方常在 clear 后立刻重置 model（防止空草稿被自动写回）
    isClearing = true
    removeDraft(key, storage)
    hasDraft.value = false
    lastSavedAt.value = null
    // nextTick 后解除屏蔽，让 watch 恢复响应
    void nextTick(() => {
      isClearing = false
    })
  }
  function flushPending(): void {
    if (!pendingSave) return
    cancelPending()
    persistNow()
  }
  window.addEventListener('beforeunload', flushPending)
  onScopeDispose(() => {
    flushPending()
    window.removeEventListener('beforeunload', flushPending)
  })
  return { save, load, clear, cancelPendingSave, markResetting, hasDraft, lastSavedAt }
}
