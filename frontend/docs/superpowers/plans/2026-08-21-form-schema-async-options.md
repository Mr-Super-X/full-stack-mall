# form-schema 异步数据源/远程选项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 XForm 的选项类组件（Select/Cascader/TreeSelect/Autocomplete）提供内置 `asyncOptions` 异步数据源能力，消费方只需在 schema 中声明 `source` 函数，无需在外部手动请求并回填 props。

**Architecture:** 在 `SchemaNode` 新增 `asyncOptions` 字段；新增 `useAsyncOptions` composable 管理请求生命周期（loading/error/data）；在 `use-schema-renderer.ts` 的 schema watch 中遍历并注册异步节点；在 `render-schema-node.ts` 渲染前将异步结果映射到对应组件 prop（Select/Cascader → `options`，TreeSelect → `data`，Autocomplete → `fetchSuggestions`）。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest + lodash-es

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/components/form-schema/types.ts` | 新增 `AsyncOptionsConfig` 类型、`SchemaNode.asyncOptions` 字段、选项 prop 映射类型辅助。 |
| `src/components/form-schema/composables/use-async-options.ts` | 管理单个节点的异步请求：source 调用、transform、loading/error、deps watch、onScopeDispose 清理。 |
| `src/components/form-schema/composables/use-schema-renderer.ts` | schema 变化时遍历所有节点，为含 `asyncOptions` 的节点注册请求与 watcher，并清理旧 watcher。 |
| `src/components/form-schema/composables/render-schema-node.ts` | 渲染时把异步结果注入组件 props；处理不同组件的 options prop 映射。 |
| `src/components/form-schema/composables/use-async-options.spec.ts` | 单元测试：source 调用、transform、deps 变化重新请求、error 处理。 |
| `src/components/form-schema/README.md` | 新增 `asyncOptions` 用法示例。 |
| `CHANGELOG.md` | 更新未发布特性。 |

---

## Task 1: 新增 `AsyncOptionsConfig` 类型与 `SchemaNode.asyncOptions`

**Files:**
- Modify: `src/components/form-schema/types.ts`

- [ ] **Step 1: 在 `SchemaNode` 接口前新增 `AsyncOptionsConfig`**

在 `SchemaNode` 接口定义之前（约第 188 行）插入：

```ts
/** 异步选项配置：为 Select/Cascader/TreeSelect/Autocomplete 等提供内置远程数据能力 */
export interface AsyncOptionsConfig<T = unknown> {
  /** 数据源函数，返回原始数据数组（支持 Promise） */
  source: () => Promise<T[]> | T[]
  /** 是否在节点创建时立即请求（默认 true） */
  immediate?: boolean
  /** 依赖字段路径（lodash 路径），任一依赖变化时重新请求 */
  deps?: string | string[]
  /** 数据转换：把 source 返回的原始数组转为组件需要的 { label, value } 数组 */
  transform?: (raw: T[]) => Array<{ label: string; value: unknown }>
  /** 请求出错时回调（默认仅写入内部 error 状态） */
  onError?: (err: unknown) => void
}
```

- [ ] **Step 2: 在 `SchemaNode` 接口内新增 `asyncOptions` 字段**

在 `SchemaNode` 接口的合适位置（如 `slots` 字段附近）新增：

```ts
  /** 异步选项数据源（Select/Cascader/TreeSelect/Autocomplete） */
  asyncOptions?: AsyncOptionsConfig
```

- [ ] **Step 3: 跑类型检查确认无回归**

Run: `pnpm type-check:full`
Expected: 无新增 TS 错误。

---

## Task 2: 创建 `useAsyncOptions` composable

**Files:**
- Create: `src/components/form-schema/composables/use-async-options.ts`

- [ ] **Step 1: 编写 composable**

```ts
import { ref, watch, type Ref } from 'vue'
import { get } from 'lodash-es'
import type { SchemaNode, AsyncOptionsConfig } from '../types'

export interface AsyncOptionsState {
  data: Ref<unknown[]>
  loading: Ref<boolean>
  error: Ref<unknown>
}

/**
 * 管理单个 schema 节点的异步选项生命周期
 * - immediate 默认 true：创建时立即请求
 * - deps 变化时自动重新请求
 * - source 返回值经 transform 后存入 state.data
 * - 错误时调用 onError 并写入 state.error
 */
export function useAsyncOptions(
  node: SchemaNode,
  model: Ref<Record<string, unknown>>
): AsyncOptionsState {
  const cfg = node.asyncOptions
  const data = ref<unknown[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function fetch(): Promise<void> {
    if (!cfg) return
    loading.value = true
    error.value = null
    try {
      const raw = await cfg.source()
      data.value = cfg.transform ? cfg.transform(raw) : raw
    } catch (err) {
      error.value = err
      cfg.onError?.(err)
    } finally {
      loading.value = false
    }
  }

  if (cfg?.immediate !== false) {
    fetch()
  }

  const stops: (() => void)[] = []

  if (cfg?.deps) {
    const depList = Array.isArray(cfg.deps) ? cfg.deps : [cfg.deps]
    const stop = watch(
      () => depList.map((dep) => get(model.value, dep)),
      fetch,
      { deep: true }
    )
    stops.push(stop)
  }

  return {
    data,
    loading,
    error,
  }
}

/** 停止异步 watcher（由调用方在 schema 变化时统一调用） */
export function createAsyncOptionsWatcher(
  node: SchemaNode,
  model: Ref<Record<string, unknown>>,
  onStateChange: (state: AsyncOptionsState) => void
): () => void {
  const state = useAsyncOptions(node, model)
  const stopDeps = watch(
    () => [state.data.value, state.loading.value, state.error.value],
    () => onStateChange(state),
    { immediate: true, deep: true }
  )
  return () => {
    stopDeps()
  }
}
```

- [ ] **Step 2: 跑类型检查**

Run: `pnpm type-check:full`
Expected: 通过。

---

## Task 3: 在 `use-schema-renderer.ts` 中集成异步节点注册

**Files:**
- Modify: `src/components/form-schema/composables/use-schema-renderer.ts`

- [ ] **Step 1: 导入 `createAsyncOptionsWatcher`**

```ts
import { createAsyncOptionsWatcher } from './use-async-options'
```

- [ ] **Step 2: 在 `useSchemaRenderer` 中新增 async watchers 清理与注册逻辑**

在 `watch(() => opts.schema.value, (val) => { ... })` 内部，在清理 `stoppers` 之后、设置 `reactiveSchema.value` 之前，新增：

```ts
      // 清理旧异步 watcher
      asyncStoppers.forEach((s) => s())
      asyncStoppers.length = 0
      // 注册新异步 watcher：把异步结果写入对应 node.props
      registerAsyncOptions(normalized, opts.formData, asyncStoppers)
```

并在函数顶部初始化 `asyncStoppers`：

```ts
  const asyncStoppers: (() => void)[] = []
```

在 `onScopeDispose` 中清理：

```ts
  onScopeDispose(() => {
    stoppers.forEach((s) => s())
    stoppers.length = 0
    asyncStoppers.forEach((s) => s())
    asyncStoppers.length = 0
  })
```

- [ ] **Step 3: 新增 `registerAsyncOptions` 函数**

在文件末尾（`traverse` 函数之后）新增：

```ts
function registerAsyncOptions(
  node: SchemaNode | SchemaNode[],
  model: Ref<Record<string, unknown>>,
  asyncStoppers: (() => void)[]
): void {
  if (Array.isArray(node)) {
    node.forEach((n) => registerAsyncOptions(n, model, asyncStoppers))
    return
  }
  if (node.asyncOptions) {
    const stop = createAsyncOptionsWatcher(node, model, (state) => {
      const targetProp = resolveAsyncOptionsProp(node)
      if (targetProp) {
        node.props = { ...(node.props ?? {}), [targetProp]: state.data.value }
      }
      node.props = { ...(node.props ?? {}), loading: state.loading.value }
    })
    asyncStoppers.push(stop)
  }
  if (node.children) {
    if (Array.isArray(node.children)) {
      registerAsyncOptions(node.children, model, asyncStoppers)
    } else if (typeof node.children === 'object') {
      registerAsyncOptions(node.children, model, asyncStoppers)
    }
  }
  if (node.slots) {
    for (const slot of Object.values(node.slots)) {
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        registerAsyncOptions(slot, model, asyncStoppers)
      } else if (Array.isArray(slot)) {
        slot.forEach((s) => registerAsyncOptions(s, model, asyncStoppers))
      }
    }
  }
}

/** 根据组件名决定 asyncOptions 数据注入哪个 prop */
function resolveAsyncOptionsProp(node: SchemaNode): string | null {
  const name = typeof node.component === 'string' ? node.component : null
  if (!name) return null
  if (name === 'TreeSelect' || name === 'ElTreeSelect') return 'data'
  if (name === 'Autocomplete' || name === 'ElAutocomplete') return null // Autocomplete 走 fetchSuggestions
  return 'options'
}
```

- [ ] **Step 4: 跑类型检查**

Run: `pnpm type-check:full`
Expected: 通过。

---

## Task 4: 在 `render-schema-node.ts` 中处理 Autocomplete 的 `fetchSuggestions`

**Files:**
- Modify: `src/components/form-schema/composables/render-schema-node.ts`

- [ ] **Step 1: 在 `renderToComponentInner` 中注入 asyncOptions 数据**

在 `eventBindings` 合并后的位置，为所有组件注入 `loading` 和对应 prop：

```ts
    const asyncProps = buildAsyncProps(node)
```

然后在所有 `h(Comp as never, { ...eventBindings, ...asyncProps, ...getComponentDefaultProps(...) })` 处把 `asyncProps` 展开。

- [ ] **Step 2: 新增 `buildAsyncProps` 函数**

在文件合适位置新增：

```ts
function buildAsyncProps(node: SchemaNode): Record<string, unknown> {
  if (!node.asyncOptions) return {}
  const name = typeof node.component === 'string' ? node.component : null
  if (name === 'Autocomplete' || name === 'ElAutocomplete') {
    return {
      fetchSuggestions: buildAutocompleteFetcher(node.asyncOptions),
      loading: node.props?.loading ?? false,
    }
  }
  return {}
}

function buildAutocompleteFetcher(
  cfg: AsyncOptionsConfig
): (queryString: string, cb: (suggestions: Array<{ value: unknown }>) => void) => void {
  return (_queryString, cb) => {
    Promise.resolve(cfg.source())
      .then((raw) => {
        const data = cfg.transform ? cfg.transform(raw) : raw
        cb(data as Array<{ value: unknown }>)
      })
      .catch((err) => {
        cfg.onError?.(err)
        cb([])
      })
  }
}
```

注意：实际注入 `options`/`data` 已经在 `use-schema-renderer.ts` 中完成，render 阶段只需额外处理 Autocomplete 的 `fetchSuggestions`。

- [ ] **Step 3: 跑类型检查与单测**

Run: `pnpm type-check:full`
Run: `pnpm test src/components/form-schema/`
Expected: 通过。

---

## Task 5: 新增 `use-async-options.spec.ts` 单元测试

**Files:**
- Create: `src/components/form-schema/composables/use-async-options.spec.ts`

- [ ] **Step 1: 编写测试**

```ts
import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useAsyncOptions } from './use-async-options'
import type { SchemaNode } from '../types'

describe('useAsyncOptions', () => {
  it('calls source immediately by default and stores transformed data', async () => {
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: {
        source: async () => [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
        transform: (raw) => raw.map((item: { id: number; name: string }) => ({
          label: item.name,
          value: item.id,
        })),
      },
    }
    const model = ref({})
    const state = useAsyncOptions(node, model)
    expect(state.loading.value).toBe(true)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.loading.value).toBe(false)
    expect(state.data.value).toEqual([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ])
  })

  it('does not call source when immediate is false', () => {
    const source = vi.fn().mockResolvedValue([])
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: { source, immediate: false },
    }
    const model = ref({})
    useAsyncOptions(node, model)
    expect(source).not.toHaveBeenCalled()
  })

  it('re-fetches when deps change', async () => {
    const source = vi.fn().mockImplementation(() => Promise.resolve([{ label: 'x', value: 1 }]))
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: { source, deps: 'category' },
    }
    const model = ref({ category: 'a' })
    useAsyncOptions(node, model)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(source).toHaveBeenCalledTimes(1)
    model.value.category = 'b'
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(source).toHaveBeenCalledTimes(2)
  })

  it('calls onError when source rejects', async () => {
    const onError = vi.fn()
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: {
        source: async () => {
          throw new Error('network')
        },
        onError,
      },
    }
    const model = ref({})
    const state = useAsyncOptions(node, model)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.error.value).toBeInstanceOf(Error)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })
})
```

- [ ] **Step 2: 跑测试**

Run: `pnpm test src/components/form-schema/composables/use-async-options.spec.ts`
Expected: 通过。

---

## Task 6: 更新 README 与 CHANGELOG

**Files:**
- Modify: `src/components/form-schema/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 在 README 新增 `asyncOptions` 小节**

在 `## reaction（响应式联动）` 之前插入：

```markdown
## asyncOptions（异步选项）

`Select`、`Cascader`、`TreeSelect`、`Autocomplete` 支持内置异步数据源：

```ts
{
  component: 'Select',
  name: 'city',
  asyncOptions: {
    source: async () => fetch('/api/cities').then(r => r.json()),
    transform: (raw: Array<{ id: number; name: string }>) =>
      raw.map((item) => ({ label: item.name, value: item.id })),
  },
}
```

带依赖联动：

```ts
{
  component: 'Select',
  name: 'district',
  asyncOptions: {
    source: async () => fetch(`/api/districts?city=${form.city}`).then(r => r.json()),
    deps: 'city',
    transform: (raw) => raw.map((item: { name: string }) => ({ label: item.name, value: item.name })),
  },
}
```

| 字段 | 说明 |
| --- | --- |
| `source` | 返回选项数组的函数，支持 Promise |
| `immediate` | 是否立即请求（默认 true） |
| `deps` | 依赖字段路径，变化时重新请求 |
| `transform` | 把 source 结果转为 `{ label, value }` 数组 |
| `onError` | 请求失败回调 |
```

- [ ] **Step 2: 更新 CHANGELOG**

在“form-schema-engine v3”下追加：

```markdown
  - **异步选项数据源**：`SchemaNode.asyncOptions` 支持 Select/Cascader/TreeSelect/Autocomplete 内置远程数据，含 `source/immediate/deps/transform/onError`，deps 变化自动重新请求
```

---

## Task 7: 回归验证

- [ ] **Step 1: 跑全量单测**

Run: `pnpm test src/components/form-schema/`
Expected: 全部通过。

- [ ] **Step 2: 跑全量类型检查**

Run: `pnpm type-check:full`
Expected: 无新增 TS 错误。

- [ ] **Step 3: 跑 lint**

Run: `pnpm lint`
Expected: 无新增 lint 错误。

- [ ] **Step 4: 跑 build**

Run: `pnpm build`
Expected: 通过。

- [ ] **Step 5: 派发 code-reviewer 审查**

使用 `code-reviewer` agent 审查变更。

---

## Self-Review

- **Spec coverage:** asyncOptions 类型、useAsyncOptions、schema-renderer 集成、render 注入、单元测试、文档、CHANGELOG 均已覆盖。
- **Placeholder scan:** 无 TBD/TODO。
- **Type consistency:** `AsyncOptionsConfig` 贯穿 types.ts、use-async-options.ts、use-schema-renderer.ts、render-schema-node.ts。
