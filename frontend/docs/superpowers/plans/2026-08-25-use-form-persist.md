# useFormPersist 表单草稿持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 form-schema 组件体系新增 `useFormPersist` composable：model 防抖自动落盘 + beforeunload 刷新兜底 + 按需恢复草稿。

**Architecture:** 纯函数层 `draft-storage.ts`（序列化/存取/异常收敛）+ 组合层 `use-form-persist.ts`（watch 防抖、pendingSave 标记、生命周期清理），经 `index.ts` 公共出口暴露。XForm.vue 零改动。

**Tech Stack:** Vue 3.5（watch/onScopeDispose/effectScope）、lodash-es（cloneDeep/omit/debounce）、vitest + jsdom（fake timers）、项目自研 `@/utils/storage`。

**Spec:** `docs/superpowers/specs/2026-08-25-use-form-persist-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/form-schema/composables/draft-storage.ts` | 新增 | 草稿序列化/读写/删除纯函数（JSON 序列化异常收敛，≤40 行） |
| `src/components/form-schema/composables/use-form-persist.ts` | 新增 | 主 composable（防抖/手动补丁/beforeunload/生命周期，≤80 行） |
| `src/components/form-schema/composables/use-form-persist.spec.ts` | 新增 | 14 条用例（覆盖率 ≥80%） |
| `src/components/form-schema/index.ts` | 修改 | 追加导出 useFormPersist + 类型 |
| `src/modules/demo/examples/XFormPersist.vue` | 新增 | demo 页（路由自动注册） |
| `src/components/form-schema/README.md` | 修改 | 追加"草稿持久化"章节 + 示例表新增一行 |
| `CHANGELOG.md` | 修改 | 未发布 → Features 下 form-schema-engine v3 追加子项 |

> 说明：spec 文件清单为 5 项，实现时为满足"composable ≤80 行"硬约束，将序列化/存取纯逻辑拆出 `draft-storage.ts`（实现细节，不改设计语义）。

---

## Task 1: draft-storage.ts + use-form-persist.ts 骨架（hasDraft 初始化）

**Files:**
- Create: `src/components/form-schema/composables/draft-storage.ts`
- Create: `src/components/form-schema/composables/use-form-persist.ts`
- Create: `src/components/form-schema/composables/use-form-persist.spec.ts`

- [ ] **Step 1: 写失败测试（spec 骨架 + 初始化 2 用例）**

```ts
/**
 * useFormPersist 单元测试
 * 覆盖：hasDraft 初始化 / load 恢复 / restoreFilter / 防抖自动保存 /
 * exclude 敏感字段 / save 手动 flush / clear 清理 / 序列化与配额错误 /
 * beforeunload 兜底 / 卸载清理 / session 介质
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, type EffectScope } from 'vue'
import { useFormPersist } from './use-form-persist'
import { Local, Session } from '@/utils/storage'

const KEY = 'form-persist.spec.draft'

let scope: EffectScope

beforeEach(() => {
  Local.remove(KEY)
  Session.remove(KEY)
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

function run(options: Parameters<typeof useFormPersist>[0]) {
  return scope.run(() => useFormPersist(options))!
}

describe('useFormPersist / 初始化', () => {
  it('无草稿时 hasDraft=false 且 lastSavedAt=null', () => {
    const model = reactive<Record<string, unknown>>({})
    const persist = run({ key: KEY, model })
    expect(persist.hasDraft.value).toBe(false)
    expect(persist.lastSavedAt.value).toBeNull()
  })

  it('存在草稿时 hasDraft=true', () => {
    Local.set(KEY, { name: '张三' })
    const model = reactive<Record<string, unknown>>({})
    const persist = run({ key: KEY, model })
    expect(persist.hasDraft.value).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: FAIL —— 模块 `./use-form-persist` 不存在（Cannot find module）

- [ ] **Step 3: 实现 draft-storage.ts（完整文件）**

```ts
import { cloneDeep, omit } from 'lodash-es'
import { Local, Session } from '@/utils/storage'

/** 草稿存储介质 */
export type DraftStorageKind = 'local' | 'session'

function pickStore(kind: DraftStorageKind) {
  return kind === 'session' ? Session : Local
}

/** 读草稿；无草稿或数据损坏（storage.ts safeParse 自动清脏）时返回 null */
export function readDraft(key: string, kind: DraftStorageKind): Record<string, unknown> | null {
  return pickStore(kind).get<Record<string, unknown>>(key)
}

/** 写草稿：cloneDeep 剥离 reactive Proxy + omit 剔除敏感路径；异常仅 warn 不抛出 */
export function writeDraft(
  key: string,
  kind: DraftStorageKind,
  model: Record<string, unknown>,
  exclude: string[]
): void {
  try {
    pickStore(kind).set(key, omit(cloneDeep(model) as Record<string, unknown>, exclude))
  } catch (err) {
    console.warn(`[useFormPersist] 草稿写入失败 (key: ${key}):`, err)
  }
}

/** 删除草稿 */
export function removeDraft(key: string, kind: DraftStorageKind): void {
  pickStore(kind).remove(key)
}
```

- [ ] **Step 4: 实现 use-form-persist.ts 骨架（本任务只实现初始化，save/load/clear 为 stub，Task 2/4 替换）**

```ts
import { ref } from 'vue'
import { readDraft } from './draft-storage'

export interface FormPersistOptions {
  /** 草稿唯一 key：建议 '<模块>.<表单名>.draft'，经 storage.ts namespace 隔离 */
  key: string
  /** 被监听的 reactive model */
  model: Record<string, unknown>
  /** 默认 'local'（跨会话保留）；'session' 关标签页失效 */
  storage?: 'local' | 'session'
  /** 自动保存防抖 ms，默认 400 */
  debounce?: number
  /** 敏感字段 lodash 路径（如 'card.cvv'），序列化剔除、不落盘 */
  exclude?: string[]
  /** schema 升级后裁剪旧草稿；返回 null 丢弃草稿 */
  restoreFilter?: (draft: Record<string, unknown>) => Record<string, unknown> | null
}

export interface FormPersistReturn {
  save(): void
  load(): boolean
  clear(): void
  hasDraft: Ref<boolean>
  lastSavedAt: Ref<number | null>
}

/**
 * 草稿持久化：deep watch model 防抖自动落盘，beforeunload 同步 flush 兜底。
 * 不自动恢复——使用方按 hasDraft 决定 load() 时机，恢复后建议 formRef.resetDirty()。
 * 边界：exclude 字段不落盘；序列化/配额异常仅 console.warn，不抛出。
 */
export function useFormPersist(options: FormPersistOptions): FormPersistReturn {
  const { key, model, storage = 'local' } = options
  const hasDraft = ref(readDraft(key, storage) !== null)
  const lastSavedAt = ref<number | null>(null)
  // save / load / clear 由 Task 2、Task 4 实现
  return { save: () => {}, load: () => false, clear: () => {}, hasDraft, lastSavedAt }
}
```

- [ ] **Step 5: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: PASS —— 2 passed

- [ ] **Step 6: 提交（须用户同意后执行，项目全局规则禁止擅自 commit）**

```bash
git add src/components/form-schema/composables/draft-storage.ts src/components/form-schema/composables/use-form-persist.ts src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "feat(form-schema): 新增useFormPersist草稿持久化骨架与存储纯函数层"
```

---

## Task 2: load() 恢复 + restoreFilter

**Files:**
- Modify: `src/components/form-schema/composables/use-form-persist.ts`
- Modify: `src/components/form-schema/composables/use-form-persist.spec.ts`

- [ ] **Step 1: 追加 3 条失败测试**（spec 文件末尾新增 describe）

```ts
describe('useFormPersist / load 恢复', () => {
  it('load() 浅合并草稿到 model 且返回 true、草稿保留', () => {
    Local.set(KEY, { name: '张三', age: 30 })
    const model = reactive<Record<string, unknown>>({ name: '', bio: '' })
    const persist = run({ key: KEY, model })
    expect(persist.load()).toBe(true)
    expect(model.name).toBe('张三')
    expect(model.age).toBe(30) // 草稿字段全量合并（form-schema 惯例 model 从空对象起步）
    expect(model.bio).toBe('') // model 原有字段保留
    expect(Local.get(KEY)).toEqual({ name: '张三', age: 30 }) // 草稿保留可反复 load
  })

  it('restoreFilter 返回 null 时丢弃草稿且不合并', () => {
    Local.set(KEY, { name: '张三' })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model, restoreFilter: () => null })
    expect(persist.load()).toBe(false)
    expect(model.name).toBe('')
    expect(Local.get(KEY)).toBeNull()
    expect(persist.hasDraft.value).toBe(false)
  })

  it('restoreFilter 裁剪后仅合并过滤后的字段', () => {
    Local.set(KEY, { name: '张三', obsolete: 'x' })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({
      key: KEY,
      model,
      restoreFilter: (draft) => ({ name: draft.name }),
    })
    expect(persist.load()).toBe(true)
    expect(model.name).toBe('张三')
    expect('obsolete' in model).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts -t "load 恢复"`
Expected: FAIL —— load() 返回 false（stub），断言失败

- [ ] **Step 3: 实现 load()**（Edit 两处）

Edit 1 —— 在 use-form-persist.ts 顶部 import 中补 readDraft 兄弟导入：

```ts
// old
import { readDraft } from './draft-storage'
// new
import { readDraft, removeDraft } from './draft-storage'
```

Edit 2 —— 解构与 load 实现：

```ts
// old
const { key, model, storage = 'local' } = options
const hasDraft = ref(readDraft(key, storage) !== null)
const lastSavedAt = ref<number | null>(null)
// save / load / clear 由 Task 2、Task 4 实现
return { save: () => {}, load: () => false, clear: () => {}, hasDraft, lastSavedAt }
// new
const { key, model, storage = 'local', restoreFilter } = options
const hasDraft = ref(readDraft(key, storage) !== null)
const lastSavedAt = ref<number | null>(null)

function load(): boolean {
  const draft = readDraft(key, storage)
  if (draft === null) return false
  const filtered = restoreFilter ? restoreFilter(draft) : draft
  if (filtered === null) {
    removeDraft(key, storage)
    hasDraft.value = false
    return false
  }
  Object.assign(model, filtered)
  return true
}

// save / clear 由 Task 4 实现
return { save: () => {}, load, clear: () => {}, hasDraft, lastSavedAt }
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: PASS —— 5 passed

- [ ] **Step 5: 提交（须用户同意）**

```bash
git add src/components/form-schema/composables/use-form-persist.ts src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "feat(form-schema): useFormPersist支持load恢复与restoreFilter草稿裁剪"
```

---

## Task 3: 自动保存防抖 + exclude 敏感字段

**Files:**
- Modify: `src/components/form-schema/composables/use-form-persist.ts`
- Modify: `src/components/form-schema/composables/use-form-persist.spec.ts`

- [ ] **Step 1: 追加 2 条失败测试**

```ts
describe('useFormPersist / 自动保存', () => {
  it('model 变化后防抖 400ms 才写入', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull() // 防抖窗口内不写入
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    expect(persist.lastSavedAt.value).not.toBeNull()
    vi.useRealTimers()
  })

  it('exclude 字段不落盘（含嵌套路径）', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({
      name: '张三',
      password: '123456',
      card: { cvv: '999' },
    })
    run({ key: KEY, model, exclude: ['password', 'card.cvv'] })
    model.name = '李四'
    await nextTick()
    vi.advanceTimersByTime(400)
    const draft = Local.get<Record<string, unknown>>(KEY)
    expect(draft).toEqual({ name: '李四', card: {} }) // password 剔除；card.cvv 剔除后 card 留空对象
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts -t "自动保存"`
Expected: FAIL —— model 变化后无 watch，storage 始终为 null

- [ ] **Step 3: 实现防抖自动保存**（Edit 两处）

Edit 1 —— import 行：

```ts
// old
import { ref } from 'vue'
import { readDraft, removeDraft } from './draft-storage'
// new
import { onScopeDispose, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { readDraft, removeDraft, writeDraft } from './draft-storage'
```

Edit 2 —— 解构与 load 之后插入：

```ts
// old
const { key, model, storage = 'local', restoreFilter } = options
// new
const { key, model, storage = 'local', debounce: debounceMs = 400, exclude = [], restoreFilter } =
  options
```

Edit 3 —— 在 `function load()` 块之后、`// save / clear 由 Task 4 实现` 之前插入：

```ts
  // pendingSave：防抖窗口内存在未落盘变更的标记，beforeunload 据此同步 flush
  let pendingSave = false
  const debouncedWrite = debounce(() => {
    pendingSave = false
    writeDraft(key, storage, model, exclude)
    lastSavedAt.value = Date.now()
  }, debounceMs)

  watch(model, () => {
    pendingSave = true
    debouncedWrite()
  })
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: PASS —— 7 passed

- [ ] **Step 5: 提交（须用户同意）**

```bash
git add src/components/form-schema/composables/use-form-persist.ts src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "feat(form-schema): useFormPersist实现防抖自动保存与exclude敏感字段剔除"
```

---

## Task 4: save() / clear() 手动补丁

**Files:**
- Modify: `src/components/form-schema/composables/use-form-persist.ts`
- Modify: `src/components/form-schema/composables/use-form-persist.spec.ts`

- [ ] **Step 1: 追加 2 条失败测试**

```ts
describe('useFormPersist / 手动补丁', () => {
  it('save() 立即 flush 防抖窗口内的变更', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull()
    persist.save()
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 立即落盘，无需推进定时器
    expect(persist.lastSavedAt.value).not.toBeNull()
    vi.useRealTimers()
  })

  it('clear() 清除草稿并复位状态', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).not.toBeNull()
    persist.clear()
    expect(Local.get(KEY)).toBeNull()
    expect(persist.hasDraft.value).toBe(false)
    expect(persist.lastSavedAt.value).toBeNull()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts -t "手动补丁"`
Expected: FAIL —— save() 是 stub，Local.get 仍为 null

- [ ] **Step 3: 实现 save/clear**（Edit 两处）

Edit 1 —— watch 块之后插入 save/clear：

```ts
// old
  watch(model, () => {
    pendingSave = true
    debouncedWrite()
  })
// new
  watch(model, () => {
    pendingSave = true
    debouncedWrite()
  })

  function save(): void {
    debouncedWrite.cancel()
    pendingSave = false
    writeDraft(key, storage, model, exclude)
    lastSavedAt.value = Date.now()
  }

  function clear(): void {
    debouncedWrite.cancel()
    pendingSave = false
    removeDraft(key, storage)
    hasDraft.value = false
    lastSavedAt.value = null
  }
```

Edit 2 —— 返回值替换 stub：

```ts
// old
// save / clear 由 Task 4 实现
return { save: () => {}, load, clear: () => {}, hasDraft, lastSavedAt }
// new
return { save, load, clear, hasDraft, lastSavedAt }
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: PASS —— 9 passed

- [ ] **Step 5: 提交（须用户同意）**

```bash
git add src/components/form-schema/composables/use-form-persist.ts src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "feat(form-schema): useFormPersist支持save手动flush与clear清除草稿"
```

---

## Task 5: 错误处理（循环引用 / 配额超限）

**Files:**
- Modify: `src/components/form-schema/composables/use-form-persist.spec.ts`（实现已在 draft-storage.ts，本任务只补测试验证行为）

- [ ] **Step 1: 追加 2 条测试**

```ts
describe('useFormPersist / 错误处理', () => {
  it('model 含循环引用时 save 不抛出（console.warn）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = reactive<Record<string, unknown>>({})
    model.self = model
    const persist = run({ key: KEY, model })
    expect(() => persist.save()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('storage 写入配额超限时 save 不抛出（console.warn）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const model = reactive<Record<string, unknown>>({ name: 'a' })
    const persist = run({ key: KEY, model })
    expect(() => persist.save()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    setItemSpy.mockRestore()
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts -t "错误处理"`
Expected: PASS —— 2 passed（draft-storage.ts 的 try-catch 已收敛异常，此任务为行为锁定，若失败则说明 writeDraft 异常收敛有缺陷，修复 draft-storage.ts 后重跑）

- [ ] **Step 3: 提交（须用户同意）**

```bash
git add src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "test(form-schema): useFormPersist补充序列化异常与配额超限行为测试"
```

---

## Task 6: beforeunload 刷新兜底 + 卸载清理 + session 介质

**Files:**
- Modify: `src/components/form-schema/composables/use-form-persist.ts`
- Modify: `src/components/form-schema/composables/use-form-persist.spec.ts`

- [ ] **Step 1: 追加 3 条失败测试**

```ts
describe('useFormPersist / 刷新兜底与生命周期', () => {
  it('beforeunload 时 flush 防抖窗口内的变更（同步写入）', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull()
    window.dispatchEvent(new Event('beforeunload'))
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 同步 flush，无需推进定时器
    vi.useRealTimers()
  })

  it('scope.stop 模拟卸载：flush pending + 移除监听 + 停止自动保存', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    scope.stop() // 触发 onScopeDispose：flushPending 写入 + 移除 beforeunload 监听
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    model.name = '李四'
    await nextTick()
    vi.advanceTimersByTime(1000)
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 卸载后不再自动保存
    window.dispatchEvent(new Event('beforeunload'))
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 监听已移除
    vi.useRealTimers()
  })

  it("storage: 'session' 走 Session 介质", async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model, storage: 'session' })
    model.name = '张三'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Session.get(KEY)).toEqual({ name: '张三' })
    expect(Local.get(KEY)).toBeNull()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts -t "刷新兜底与生命周期"`
Expected: FAIL —— beforeunload 无监听、scope.stop 无清理逻辑（第一条 FAIL，后两条行为不满足）

- [ ] **Step 3: 实现 flushPending + 生命周期**（Edit 两处）

Edit 1 —— 在 clear() 之后、`return` 之前插入：

```ts
  function flushPending(): void {
    if (!pendingSave) return
    debouncedWrite.cancel()
    pendingSave = false
    writeDraft(key, storage, model, exclude)
    lastSavedAt.value = Date.now()
  }

  function onBeforeUnload(): void {
    flushPending()
  }

  window.addEventListener('beforeunload', onBeforeUnload)
  onScopeDispose(() => {
    flushPending()
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
```

Edit 2 —— 确认 import 已含 onScopeDispose（Task 3 Edit 1 已引入 `onScopeDispose, ref, watch`，本任务无需再改；若执行者跳过 Task 3 需先补齐）。

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts`
Expected: PASS —— 14 passed

- [ ] **Step 5: 提交（须用户同意）**

```bash
git add src/components/form-schema/composables/use-form-persist.ts src/components/form-schema/composables/use-form-persist.spec.ts
git commit -m "feat(form-schema): useFormPersist实现beforeunload刷新兜底与卸载清理"
```

---

## Task 7: index.ts 导出 + 覆盖率验收

**Files:**
- Modify: `src/components/form-schema/index.ts`

- [ ] **Step 1: 追加导出**（Edit）

```ts
// old
export { validate, validateWithZod } from './composables/use-validate'
// new
export { validate, validateWithZod } from './composables/use-validate'
export { useFormPersist } from './composables/use-form-persist'
export type { FormPersistOptions, FormPersistReturn } from './composables/use-form-persist'
```

- [ ] **Step 2: 验证类型与全量测试**

Run: `pnpm type-check`
Expected: PASS（无类型错误）

Run: `pnpm test src/components/form-schema`
Expected: form-schema 全部 spec 通过（新增 14 条 + 既有全部）

- [ ] **Step 3: 覆盖率验收**

Run: `pnpm test:coverage`，检查 `coverage/index.html` 中 `use-form-persist.ts` 与 `draft-storage.ts` 覆盖率 ≥80%
Expected: 行覆盖 ≥80%；未覆盖分支若有（如 storage='session' 之外的防御分支），在 spec 中补用例直至达标

- [ ] **Step 4: 提交（须用户同意）**

```bash
git add src/components/form-schema/index.ts
git commit -m "feat(form-schema): index.ts导出useFormPersist与类型"
```

---

## Task 8: demo 页 XFormPersist.vue

**Files:**
- Create: `src/modules/demo/examples/XFormPersist.vue`（路由自动注册：path `/demo/x-form-persist`，name `DemoXFormPersist`）

- [ ] **Step 1: 写完整 demo 组件**

```vue
<script setup lang="ts">
/**
 * 演示：useFormPersist —— 表单草稿持久化
 *
 * 【验证流程】
 * 1. 填"用户名"和"银行卡号"
 * 2. 观察状态面板：lastSavedAt 更新（防抖 400ms 后自动落盘）
 * 3. 刷新页面（F5）→ hasDraft=true，表单回到空值
 * 4. 点"恢复草稿"→ 用户名恢复、银行卡号不恢复（exclude 生效）→ isDirty=false（草稿为新基线）
 * 5. 点"模拟提交"→ 草稿清除，再刷新 hasDraft=false
 * 6. DevTools Application 面板可直接查看 localStorage 中的草稿内容（确认无 cardNo）
 */
import { computed, reactive, ref, watch } from 'vue'
import { ElButton, ElMessage, ElTag } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import { useFormPersist } from '@/components/form-schema'
import type { SchemaNode, XFormExpose } from '@/components/form-schema/types'
import DemoField from '../components/DemoField.vue'
import DocLayout from '../layouts/DocLayout.vue'
import persistSource from './XFormPersist.vue?raw'

const bem = createNamespace('demo-x-form-persist')

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      props: { placeholder: '请输入用户名', clearable: true },
    },
    {
      label: '银行卡号（敏感字段，不落盘）',
      name: 'cardNo',
      component: 'Input',
      props: { placeholder: '刷新后不会恢复（exclude 演示）', clearable: true },
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '请输入邮箱', clearable: true },
    },
    {
      label: '简介',
      name: 'bio',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '一句话介绍' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  cardNo: '',
  email: '',
  bio: '',
})

const persist = useFormPersist({
  key: 'demo.x-form-persist.draft',
  model,
  exclude: ['cardNo'], // 敏感字段不落 localStorage
})

const formRef = ref<XFormExpose | null>(null)
const isDirtyState = ref(false)

function refreshDirty() {
  isDirtyState.value = formRef.value?.isDirty() ?? false
}

// XForm 无 change 事件（XForm.vue 未定义 emits），用 watch(model, deep) 同步 isDirty（同 XFormSchemaIndex 模式）
watch(model, refreshDirty, { deep: true })

function onRestore() {
  if (!persist.hasDraft.value) {
    ElMessage.warning('当前没有草稿（先填几个字段刷新页面再试）')
    return
  }
  persist.load()
  formRef.value?.resetDirty() // 草稿为新基线：isDirty 从草稿起算
  refreshDirty()
  ElMessage.success('草稿已恢复（银行卡号被 exclude 剔除）')
}

function onClear() {
  persist.clear()
  ElMessage.success('草稿已清除')
}

function onSimulateSubmit() {
  // 模拟提交成功：清草稿 + 拍新基线
  persist.clear()
  formRef.value?.resetDirty()
  refreshDirty()
  ElMessage.success('模拟提交成功：草稿已清除、dirty 已归零')
}

const lastSavedText = computed(() =>
  persist.lastSavedAt.value === null ? '尚未保存' : new Date(persist.lastSavedAt.value).toLocaleTimeString()
)
</script>

<template>
  <DocLayout
    title="useFormPersist —— 表单草稿持久化"
    description="model 防抖自动落盘 + beforeunload 刷新兜底；刷新后按需恢复，敏感字段 exclude 剔除。XForm 零改动，一行接入。"
  >
    <DemoField
      title="草稿自动保存 + 刷新恢复 + 敏感字段剔除"
      description="按页面顶部注释的验证流程操作。核心：刷新页面前 400ms 内的输入也不会丢（beforeunload 同步 flush）。"
      :code="persistSource"
    >
      <div :class="bem.b()">
        <div :class="bem.e('status')">
          <ElTag :type="persist.hasDraft.value ? 'warning' : 'info'">
            草稿：{{ persist.hasDraft.value ? '存在' : '无' }}
          </ElTag>
          <ElTag type="success">最后保存：{{ lastSavedText }}</ElTag>
          <ElTag :type="isDirtyState ? 'danger' : 'success'">
            isDirty：{{ isDirtyState ? '是' : '否' }}
          </ElTag>
        </div>

        <XForm ref="formRef" :schema="schema" :model="model" />

        <div :class="bem.e('actions')">
          <ElButton type="primary" @click="onRestore">恢复草稿（load + resetDirty）</ElButton>
          <ElButton @click="onClear">清除草稿（clear）</ElButton>
          <ElButton type="success" @click="onSimulateSubmit">模拟提交（clear + resetDirty）</ElButton>
        </div>

        <p :class="bem.e('hint')">
          验证步骤：① 填用户名 + 银行卡号 → ② F5 刷新 → ③ 点"恢复草稿"：
          用户名恢复、银行卡号不恢复 → ④ 点"模拟提交" → ⑤ 再刷新：草稿已无。
        </p>
      </div>
    </DemoField>
  </DocLayout>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-persist {
  &__status {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
  &__hint {
    margin-top: 12px;
    font-size: 13px;
    color: #909399;
  }
}
</style>
```

- [ ] **Step 2: 验证 demo 编译与路由**

Run: `pnpm type-check`
Expected: PASS

Run: `pnpm check:routes`
Expected: PASS（新路由 DemoXFormPersist 已自动注册）

- [ ] **Step 3: 浏览器手动验证**（dev server `pnpm dev` → `/demo/x-form-persist`）

按 demo 顶部注释 6 步流程验证，重点确认：
1. 填字段后 lastSavedAt 更新；
2. F5 刷新后 hasDraft=true、表单为空；
3. 恢复草稿后用户名恢复、卡号为空；
4. 模拟提交后刷新 hasDraft=false；
5. localStorage 中 `vue3-vite-project:demo.x-form-persist.draft` 内容不含 cardNo。

- [ ] **Step 4: 提交（须用户同意）**

```bash
git add src/modules/demo/examples/XFormPersist.vue
git commit -m "feat(demo): 新增XFormPersist草稿持久化演示页"
```

---

## Task 9: README + CHANGELOG

**Files:**
- Modify: `src/components/form-schema/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README 追加章节**（插入到 `---\n\n## 决策指南` 之前）

```markdown
---

## 草稿持久化（useFormPersist）

表单数据自动防抖落盘、刷新不丢、按需恢复。XForm 零改动：

```ts
import { useFormPersist } from '@/components/form-schema'

const model = reactive<Record<string, unknown>>({})
const persist = useFormPersist({
  key: 'orders.create.draft', // 草稿唯一标识（经 storage namespace 隔离）
  model,
  exclude: ['password', 'card.cvv'], // 敏感字段不落盘（必配！）
})

// 挂载时按需恢复
onMounted(() => {
  if (persist.hasDraft.value) {
    persist.load()
    formRef.value?.resetDirty() // 草稿为新基线，isDirty 从草稿起算
  }
})

// 提交成功后
persist.clear()
```

| 配置 | 默认 | 说明 |
|------|------|------|
| `key` | 必填 | 草稿唯一标识，建议 `<模块>.<表单名>.draft` |
| `model` | 必填 | 被监听的 reactive model |
| `storage` | `'local'` | `'session'` 关标签页失效 |
| `debounce` | `400` | 自动保存防抖 ms |
| `exclude` | `[]` | 敏感字段 lodash 路径，序列化剔除 |
| `restoreFilter` | — | schema 升级后裁剪旧草稿；返回 null 丢弃草稿 |

返回：`{ save, load, clear, hasDraft, lastSavedAt }`——`save()` 立即 flush；`load()` 恢复草稿（草稿保留，可反复恢复）；`clear()` 清除草稿。

**已知限制**：File/Blob/函数等不可序列化值会退化丢失；多标签页并发编辑不同步（后写覆盖先写）；含密码/证件号等字段必须配置 `exclude`。
```

- [ ] **Step 2: README 示例表追加一行**（`## 示例` 表格末尾）

```ts
// old
| `/demo/x-form-base`         | 基础用法（5 字段 + 校验 + 重置）     |
// new
| `/demo/x-form-base`         | 基础用法（5 字段 + 校验 + 重置）     |
| `/demo/x-form-persist`      | 草稿持久化（自动保存 + 刷新恢复）    |
```

- [ ] **Step 3: CHANGELOG 追加条目**（`## 未发布` → `### ✨ Features | 新特性` → `* **form-schema-engine v3**（提升使用体验）` 子项列表末尾，即 `demo 复制 schema 按钮` 之后）

```markdown
  - **表单草稿持久化**：`useFormPersist` composable，model 防抖（400ms）自动落盘 + `beforeunload` 同步 flush 刷新兜底；`hasDraft`/`load`/`save`/`clear` 按需恢复与手动补丁；`exclude` 敏感字段剔除（含嵌套路径）；`restoreFilter` 草稿裁剪适配 schema 升级；与 `resetDirty()` 基线衔接 isDirty 从草稿起算
```

- [ ] **Step 4: 验证**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: 提交（须用户同意）**

```bash
git add src/components/form-schema/README.md CHANGELOG.md
git commit -m "docs: useFormPersist草稿持久化文档与CHANGELOG"
```

---

## 最终验收（全部任务完成后）

- [ ] `pnpm test src/components/form-schema` 全绿（新增 14 条 + 既有全部）
- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm check:routes` 通过（新 demo 路由已注册）
- [ ] 覆盖率：use-form-persist.ts + draft-storage.ts ≥80%
- [ ] demo 手动验证 6 步流程（Task 8 Step 3）
- [ ] CHANGELOG.md 已记录
- [ ] git status 无意外变更（`git diff` 核对 7 个文件清单）

---

*计划版本：v1.0.0 | 生成日期：2026-08-26 | 关联 spec：2026-08-25-use-form-persist-design.md*
