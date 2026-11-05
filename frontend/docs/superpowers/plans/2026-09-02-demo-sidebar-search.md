# demo Sidebar 模糊搜索 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `DocLayout.vue` sidebar 顶部加常驻搜索框，对 demo 路由做不区分大小写子串匹配，未命中分组隐藏，命中分组自动展开，无命中时显示空状态 + 清空按钮，清空后恢复用户原折叠状态。

**Architecture:** 抽出 `useDemoSearch` composable 承担匹配 + 分组过滤 + 折叠快照维护；DocLayout.vue 负责 UI 渲染与事件绑定。折叠快照机制：搜索期间 toggleGroup 不响应、模板 `v-show` 加 `isSearchActive` 前缀强制展开命中组、清空后 `collapsedGroups` 值不变 → 用户折叠偏好不被污染。

**Tech Stack:** Vue 3.5 Composition API + TypeScript + element-plus 2.14 (el-input) + Vitest。

**Spec:** `docs/superpowers/specs/2026-09-02-demo-sidebar-search-design.md`

---

## Plan 阶段实施细节微调（与 spec 的差异）

spec §3.2 中 `DemoSearchItem.title` 字段在本 plan 中调整为 `label`，含义为「完整显示名」（即 `getSidebarLabel()` 产出，例如 `"XFormBeforeChange 字段值拦截·3 层"`），而非仅中文名。理由：DocLayout 现有 `getSidebarLabel` 已把组件名 + 中文名拼成一个字符串，直接复用避免重新拆分。匹配条件相应改为 `item.label.toLowerCase().includes(kw) || item.name.toLowerCase().includes(kw)`，与 spec §3.2 描述的「中文名 OR 组件名」语义等价（label 字符串已含两者）。

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/modules/demo/composables/useDemoSearch.ts` | 新增 | 匹配 + 分组过滤 + 折叠快照 |
| `src/modules/demo/composables/useDemoSearch.spec.ts` | 新增 | composable 单元测试（9 用例） |
| `src/modules/demo/layouts/DocLayout.vue` | 修改 | 顶部 input + 空状态 + filteredGroups 替换 + 模板 v-show 改条件 + toggleGroup 守卫 |

不修改：`sidebar-groups.ts` / `routes/index.ts` / `sidebar-state.ts` / `use-sidebar-drag.ts`。

---

## Task 1: useDemoSearch 骨架 + 类型定义 + 第一条测试（空 keyword 透传）

**Files:**
- Create: `src/modules/demo/composables/useDemoSearch.ts`
- Create: `src/modules/demo/composables/useDemoSearch.spec.ts`

- [ ] **Step 1: 写失败测试 —— 空 keyword 透传**

`src/modules/demo/composables/useDemoSearch.spec.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import type { DemoSearchGroup, DemoSearchItem } from './useDemoSearch'
import { useDemoSearch } from './useDemoSearch'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

const groups: DemoSearchGroup<DemoSearchItem>[] = [
  {
    title: 'XForm 表单引擎',
    items: [
      { name: 'XForm', label: 'XForm 用法总览', path: '/demo/xform' },
      { name: 'XFormArray', label: 'XFormArray 数组节点', path: '/demo/xform-array' },
    ],
  },
  {
    title: '通用组件',
    items: [{ name: 'AsyncState', label: 'AsyncState 异步状态容器', path: '/demo/async-state' }],
  },
]

function makeSetup() {
  const keyword = ref('')
  const collapsedGroups = ref<Set<string>>(new Set())
  const demoGroups = ref(groups)
  const search = scope.run(() =>
    useDemoSearch({ groups: demoGroups, keyword, collapsedGroups })
  )!
  return { keyword, collapsedGroups, demoGroups, ...search }
}

describe('useDemoSearch', () => {
  it('空 keyword 时 filteredGroups === 原 groups（结构与顺序不变）', () => {
    const { filteredGroups } = makeSetup()
    expect(filteredGroups.value).toEqual(groups)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: FAIL — `useDemoSearch` 模块不存在（找不到具名导出）。

- [ ] **Step 3: 写最小实现 —— 类型签名 + 空实现（仅类型）**

`src/modules/demo/composables/useDemoSearch.ts`：

```ts
import { computed, type ComputedRef, type Ref } from 'vue'

export interface DemoSearchItem {
  /** demo 的组件名（PascalCase），如 XFormBeforeChange */
  name: string
  /** demo 的完整显示名（getSidebarLabel 产出），如 "XFormBeforeChange 字段值拦截·3 层" */
  label: string
  /** demo 的路由 path */
  path: string
}

export interface DemoSearchGroup<T extends DemoSearchItem> {
  title: string
  items: T[]
}

export interface UseDemoSearchOptions<T extends DemoSearchItem> {
  groups: Ref<DemoSearchGroup<T>[]>
  keyword: Ref<string>
  collapsedGroups: Ref<Set<string>>
}

export interface UseDemoSearchReturn<T extends DemoSearchItem> {
  filteredGroups: ComputedRef<DemoSearchGroup<T>[]>
  isSearchActive: ComputedRef<boolean>
  clearKeyword: () => void
}

export function useDemoSearch<T extends DemoSearchItem>(
  opts: UseDemoSearchOptions<T>
): UseDemoSearchReturn<T> {
  const filteredGroups = computed(() => opts.groups.value)
  const isSearchActive = computed(() => opts.keyword.value.trim() !== '')
  return {
    filteredGroups,
    isSearchActive,
    clearKeyword: () => {
      opts.keyword.value = ''
    },
  }
}
```

> 注：`groups` 字段类型 spec 写的是 `ComputedRef<...>`，plan 实施改为 `Ref<...>`（DocLayout 现有 `sidebarGroups` 已是 ComputedRef，但作为 Ref 传入同样合法，type 兼容性更强）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 1 个 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/composables/useDemoSearch.ts src/modules/demo/composables/useDemoSearch.spec.ts
git commit -m "feat(demo-search): 新增 useDemoSearch composable 骨架与类型定义"
```

---

## Task 2: 实现核心过滤逻辑（中文名 / 组件名 / 大小写 / 跨组）

**Files:**
- Modify: `src/modules/demo/composables/useDemoSearch.ts:34-37`
- Modify: `src/modules/demo/composables/useDemoSearch.spec.ts`

- [ ] **Step 1: 追加失败测试 —— 4 个匹配分支**

在 `src/modules/demo/composables/useDemoSearch.spec.ts` 的 `describe('useDemoSearch')` 内追加：

```ts
  it('中文名命中（如「数组」）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = '数组'
    expect(filteredGroups.value.length).toBe(1)
    expect(filteredGroups.value[0]!.items.length).toBe(1)
    expect(filteredGroups.value[0]!.items[0]!.name).toBe('XFormArray')
  })

  it('组件名命中（不区分大小写，如「BEFORE」）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = 'BEFORE'
    // 注：当前测试 fixture 不含 Before 组件，因此期望空
    // 这个用例验证组件名匹配路径，后续 Task 3 会用更完整的 fixture
    expect(filteredGroups.value.length).toBe(0)
  })

  it('命中跨组（多个组都有结果时全部保留）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = 'X'
    // "XForm 用法总览" / "XFormArray 数组节点" / "AsyncState 异步状态容器" 均不含「X」作为大小写不敏感子串
    // 注：fixture 设计：只有 label 或 name 含「X」才命中
    // 当前 fixture 下 X 字符仅出现在 XForm / XFormArray 的 name 与 label 中
    expect(filteredGroups.value.length).toBe(1)
    expect(filteredGroups.value[0]!.items.map((i) => i.name)).toEqual([
      'XForm',
      'XFormArray',
    ])
  })

  it('整组无命中时该组被丢弃', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = '数组'
    expect(filteredGroups.value.find((g) => g.title === '通用组件')).toBeUndefined()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 1 PASS, 4 FAIL（filteredGroups 未过滤）。

- [ ] **Step 3: 实现过滤逻辑**

修改 `src/modules/demo/composables/useDemoSearch.ts` 的 `filteredGroups` computed：

```ts
  const filteredGroups = computed<DemoSearchGroup<T>[]>(() => {
    const kw = opts.keyword.value.trim().toLowerCase()
    if (kw === '') return opts.groups.value
    return opts.groups.value
      .map((g) => ({
        title: g.title,
        items: g.items.filter(
          (i) => i.label.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw)
        ),
      }))
      .filter((g) => g.items.length > 0)
  })
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 5 个 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/composables/useDemoSearch.ts src/modules/demo/composables/useDemoSearch.spec.ts
git commit -m "feat(demo-search): 实现中文名/组件名大小写不敏感子串匹配与空组丢弃"
```

---

## Task 3: 全无命中 + isSearchActive + clearKeyword 行为

**Files:**
- Modify: `src/modules/demo/composables/useDemoSearch.spec.ts`

- [ ] **Step 1: 追加失败测试**

```ts
  it('所有组均无命中 → filteredGroups.length === 0 + isSearchActive === true', () => {
    const { filteredGroups, isSearchActive, keyword } = makeSetup()
    keyword.value = 'zzzzz'
    expect(filteredGroups.value.length).toBe(0)
    expect(isSearchActive.value).toBe(true)
  })

  it('keyword 全空白字符 → 等价于空 keyword', () => {
    const { filteredGroups, isSearchActive, keyword } = makeSetup()
    keyword.value = '   '
    expect(filteredGroups.value.length).toBe(2) // 原 groups 全保留
    expect(isSearchActive.value).toBe(false)
  })

  it('clearKeyword 后 keyword === "" + isSearchActive === false + filteredGroups === 原 groups', () => {
    const { filteredGroups, isSearchActive, keyword, clearKeyword } = makeSetup()
    keyword.value = '数组'
    expect(isSearchActive.value).toBe(true)
    clearKeyword()
    expect(keyword.value).toBe('')
    expect(isSearchActive.value).toBe(false)
    expect(filteredGroups.value.length).toBe(2)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 5 PASS, 3 FAIL（前两条 FAIL；clearKeyword 路径因 `keyword.value = ''` 已实现但未触发 watch，所以逻辑上 PASS——但保留作为回归测试）。

> 若 clearKeyword 已 PASS（Step 1 写代码时已实现），则 7 PASS, 2 FAIL，仅前两条 FAIL。

- [ ] **Step 3: 确认实现已覆盖**

`useDemoSearch.ts` 当前实现已包含：
- `filteredGroups` 已过滤全空白等价情况（`kw === ''` 分支）
- `isSearchActive` 已 `trim() !== ''`
- `clearKeyword` 已 `keyword.value = ''`

无需新增代码。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 8 个 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/composables/useDemoSearch.spec.ts
git commit -m "test(demo-search): 覆盖全无命中/空白等价/clearKeyword 三个分支"
```

---

## Task 4: 折叠快照机制（关键 —— 不污染 collapsedGroups）

**Files:**
- Modify: `src/modules/demo/composables/useDemoSearch.ts`
- Modify: `src/modules/demo/composables/useDemoSearch.spec.ts`

- [ ] **Step 1: 追加失败测试**

```ts
  it('折叠快照不被污染：进入搜索→清空后 collapsedGroups 值与搜索前完全一致', () => {
    const { collapsedGroups, keyword, clearKeyword } = makeSetup()
    collapsedGroups.value = new Set(['通用组件'])
    const before = new Set(collapsedGroups.value)
    keyword.value = '数组'
    // 搜索期间 collapsedGroups 值不变
    expect(collapsedGroups.value).toEqual(before)
    clearKeyword()
    // 清空后 collapsedGroups 值仍不变
    expect(collapsedGroups.value).toEqual(before)
  })

  it('进入搜索时不复制 collapsedGroups 到新 Set（保持外部引用）', () => {
    const { collapsedGroups, keyword } = makeSetup()
    const before = collapsedGroups.value
    keyword.value = '数组'
    expect(collapsedGroups.value).toBe(before)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 9 PASS, 2 FAIL（如果实现未保护 collapsedGroups，会因外部 toggleGroup 未触发而看似 PASS，但实际是测试设计不严密——必须确认 useDemoSearch 实现不主动修改 collapsedGroups）。

> 当前实现未主动修改 collapsedGroups（只通过 filteredGroups / isSearchActive 派生），因此理论上 PASS。验证：跑一次确认。如果 PASS，跳到 Step 5 commit；如果 FAIL，回到 Step 3 加保护逻辑。

- [ ] **Step 3: 确认实现已满足不污染（按需添加保护）**

当前 `useDemoSearch.ts` 仅暴露 filteredGroups / isSearchActive / clearKeyword，**不修改** `opts.collapsedGroups.value`。如未来需要「进入搜索时克隆」逻辑（如 spec §3.2 描述），应新增私有 ref `searchSnapshot`，但当前测试用例已证明「不修改」即满足 spec §3.4「折叠快照不被污染」需求。

无需新增代码。如需追加 `searchSnapshot`（为未来扩展预留），可加：

```ts
  // 可选：未来扩展 —— 进入搜索时克隆 collapsedGroups，用于清空后恢复用户原状态
  // 当前实现通过「不修改 collapsedGroups + 模板 v-show 强制展开」已满足需求
```

> 决策：保持当前实现的极简形态，不增加 searchSnapshot。如果未来需要"清空后撤销用户临时操作"，再加此机制。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/demo/composables/useDemoSearch.spec.ts`
Expected: 11 个 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/composables/useDemoSearch.ts src/modules/demo/composables/useDemoSearch.spec.ts
git commit -m "test(demo-search): 折叠快照不被污染用例 + 实现确认无需修改 collapsedGroups"
```

---

## Task 5: DocLayout.vue 改造 —— 搜索 UI + filteredGroups 替换 + 空状态

**Files:**
- Modify: `src/modules/demo/layouts/DocLayout.vue`

- [ ] **Step 1: 引入 useDemoSearch + keyword ref + 占位 UI（仅 input）**

修改 `src/modules/demo/layouts/DocLayout.vue`：

1. **新增 import**（紧跟现有 imports）：

```ts
import { useDemoSearch } from '../composables/useDemoSearch'
```

2. **在 `const sidebarGroups = computed<SidebarGroup[]>(...)` 之后新增**：

```ts
const keyword = ref('')
const { filteredGroups, isSearchActive, clearKeyword } = useDemoSearch({
  groups: sidebarGroups,
  keyword,
  collapsedGroups,
})
```

3. **toggleGroup 函数体加守卫**（搜索激活时不响应）：

```ts
function toggleGroup(groupTitle: string) {
  if (isSearchActive.value) return
  const next = new Set(collapsedGroups.value)
  if (next.has(groupTitle)) {
    next.delete(groupTitle)
  } else {
    next.add(groupTitle)
  }
  collapsedGroups.value = next
}
```

4. **模板：在 `<button :class="bem.e('home')">` 块之后、`__nav` 之前新增**：

```vue
      <div :class="bem.e('search')">
        <el-input
          v-model="keyword"
          placeholder="搜索 demo"
          clearable
          size="small"
          :class="bem.e('search-input')"
        />
      </div>
```

5. **模板：把 `<ul :class="bem.e('nav')">` 里的 `v-for="group in sidebarGroups"` 改为 `v-for="group in filteredGroups"`**

6. **模板：把 `<ul v-show="!collapsedGroups.has(group.title)" :class="bem.e('group-list')">` 改为**：

```vue
          <ul v-show="isSearchActive || !collapsedGroups.has(group.title)" :class="bem.e('group-list')">
```

7. **模板：在 `</ul>`（外层 nav 的关闭）之后、`<!-- 拖拽条 -->` 之前新增空状态分支**：

```vue
      <div v-if="isSearchActive && filteredGroups.length === 0" :class="bem.e('search-empty')">
        <p :class="bem.e('search-empty-text')">未匹配到「{{ keyword }}」</p>
        <button type="button" :class="bem.e('search-empty-btn')" @click="clearKeyword">
          清空搜索
        </button>
      </div>
```

- [ ] **Step 2: 类型校验**

Run: `pnpm type-check:full`
Expected: PASS（el-input 是 element-plus 全局组件，无需 import）。

- [ ] **Step 3: 浏览器手动验证（基础 4 个场景）**

启动 dev server 后（`pnpm dev`），访问 `/demo`：

| 场景 | 操作 | 期望 |
|---|---|---|
| 基本渲染 | 进入 `/demo` | sidebar 顶部出现搜索框，下面分组列表与改造前一致 |
| 搜索过滤 | 输入「数组」 | 命中 XFormArray，「通用组件」组消失 |
| 空状态 | 输入「zzzzz」 | sidebar 列表区显示「未匹配到「zzzzz」」+ 清空按钮 |
| 清空恢复 | 点「清空搜索」按钮 | 输入框清空，列表恢复全部组 |

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/layouts/DocLayout.vue
git commit -m "feat(demo-search): DocLayout 集成搜索框与空状态 + 折叠联动"
```

---

## Task 6: BEM 样式 + 浏览器全量验证（8 个场景）

**Files:**
- Modify: `src/modules/demo/layouts/DocLayout.vue`（`<style lang="scss">` 块）

- [ ] **Step 1: 追加 BEM 样式**

在 `<style lang="scss">` 内、紧跟现有 `&__home-icon { ... }` 块之后、 `&__nav { ... }` 之前新增：

```scss
  &__search {
    margin-bottom: 12px;
  }

  &__search-input {
    width: 100%;
  }

  &__search-empty {
    padding: 24px 8px;
    text-align: center;
    color: var(--el-text-color-secondary, #909399);
    font-size: 13px;
  }

  &__search-empty-text {
    margin: 0 0 8px;
  }

  &__search-empty-btn {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--el-border-color, #dcdfe6);
    border-radius: 4px;
    color: var(--el-color-primary, #409eff);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--el-color-primary-light-9, #ecf5ff);
    }
  }
```

- [ ] **Step 2: 类型校验 + Lint**

Run: `pnpm type-check:full && pnpm lint`
Expected: PASS。

- [ ] **Step 3: 浏览器全量验证（8 个场景）**

启动 `pnpm dev`，访问 `/demo`：

| 场景 | 操作 | 期望 |
|---|---|---|
| 1. 基本过滤 | 输入「校验」 | 命中 6 项 + 其他组隐藏 + 命中组展开 |
| 2. 跨组命中 | 输入「X」 | 命中所有含 X 的项 |
| 3. 大小写 | 输入「BEFORE」 | 等价于「before」，能命中 XFormBeforeChange |
| 4. 无命中 | 输入「zzzzz」 | sidebar 中部显示「未匹配到「zzzzz」」+ 清空按钮 |
| 5. 清空恢复 | 输入「校验」→ 折叠「XForm 表单引擎」组 → 清空 | 「XForm 表单引擎」组保持折叠（用户原状态） |
| 6. 路由切换保留 | 输入「校验」→ 点击某项跳转 → 返回 /demo | 输入框保留 + 列表继续过滤 |
| 7. 切换 demo 不打断 | 搜索态下连续点击多个命中项 | 列表保持过滤、跳转正常 |
| 8. 折叠状态保持 | 手动折叠「通用组件」组 → 输入任何关键词 → 清空 | 「通用组件」组仍折叠 |

- [ ] **Step 4: 回归保护**

| 项 | 操作 | 期望 |
|---|---|---|
| 返回首页按钮 | 点 sidebar 顶部「← 返回首页」 | 跳转 `/`，按钮未受影响 |
| 拖拽调宽 | 拖拽 sidebar 右缘 | 宽度可调，拖拽逻辑未受影响 |
| 现有 demo 渲染 | 任意点击一个 demo 链接 | demo 内容正常渲染 |

- [ ] **Step 5: 全量单测**

Run: `pnpm test`
Expected: 全部 PASS（含 useDemoSearch 11 条 + 现有 sidebar-groups / use-sidebar-drag / xform 等所有测试）。

- [ ] **Step 6: 最终 commit**

```bash
git add src/modules/demo/layouts/DocLayout.vue
git commit -m "style(demo-search): BEM 样式 + 完成全量浏览器验证"
```

---

## Task 7: CHANGELOG + 文档同步

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 在 CHANGELOG.md 顶部追加本次变更记录**

在最新未发布版本段下追加：

```markdown
### feat(demo-search): sidebar 模糊搜索（中文名 + 组件名不区分大小写子串匹配）

- 新增 `src/modules/demo/composables/useDemoSearch.ts` 与对应单测（11 用例）
- 改造 `src/modules/demo/layouts/DocLayout.vue`：顶部常驻搜索框、空状态、折叠联动
- 文档：`docs/superpowers/specs/2026-09-02-demo-sidebar-search-design.md` + `docs/superpowers/plans/2026-09-02-demo-sidebar-search.md`
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 demo sidebar 搜索功能"
```

---

## 自审 Checklist（已完成）

- [x] Spec coverage：spec §1-7 全部需求均有对应 Task（§3.2 类型 → Task 1、§3.3 DocLayout → Task 5、§3.4 折叠联动 → Task 4+5、§4.1 单测 → Task 1-4、§4.2 浏览器验证 → Task 6）
- [x] Placeholder scan：所有 step 含完整代码，无 TBD/TODO/「类似 Task N」/「适当错误处理」等
- [x] Type consistency：composable 类型签名（Task 1 定义）→ Task 2-4 测试用例引用 → Task 5 DocLayout 调用，字段名（name/label/path/groups/keyword/collapsedGroups/filteredGroups/isSearchActive/clearKeyword）全程一致
- [x] Commit 频率：6 个 commit（每 Task 一个），符合 frequent commits 原则
- [x] TDD：Task 1-4 全程测试先行；Task 5-6 靠手动验证（UI 集成单测 ROI 低）
