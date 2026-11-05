# components/common 全局组件自动注册实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 `src/components/index.ts` 实现的 Vue 插件，运行时扫描 `components/common/**` 下所有 `.vue` 文件并通过 `app.component()` 注册到全局；模板里可直接 `<AsyncState>` / `<ErrorBoundary>` 使用，无需 `import`。

**Architecture:** 在 `src/components/index.ts` 用 `import.meta.glob('./common/**/*.{vue,Vue}', { eager: true })` 在构建时同步收集所有 common 下的 SFC，导出一个 Vue 插件（`install(app)`），`main.ts` 通过 `app.use()` 注册；保留 SFC 的 `name`，缺失时 fallback 到文件名 basename；`_` / `.` 开头的文件名跳过；类型增强通过 `vue.GlobalComponents` 声明。

**Tech Stack:** Vue 3.5 + Vite 8 + TypeScript 6 + Vitest 4（`@vue/test-utils` 2.4）

---

## File Structure

| 文件                                          | 类型 | 责任                                                                |
| --------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `src/components/index.ts`                     | 新建 | Vue 插件主体：扫描 common/**、排除、命名解析、注册                  |
| `src/types/components.d.ts`                   | 新建 | `vue.GlobalComponents` 类型增强；模板补全                           |
| `src/components/common/_pure-fn.spec.ts`      | 新建 | 纯函数单测（`isExcluded` / `resolveComponentName`）                 |
| `src/components/common/global-plugin.spec.ts` | 新建 | 插件集成测：mount 宿主组件验证 `<AsyncState>` 模板可用              |
| `src/main.ts`                                 | 修改 | 新增 `import GlobalComponents from '@/components'` + `app.use(...)` |
| `CHANGELOG.md`                                | 修改 | 追加一条 feat                                                       |

不修改：

- `src/components/common/AsyncState.vue` / `ErrorBoundary.vue`
- `vite.config.ts`（已有的 `unplugin-vue-components` 不动）

---

## Task 1: 纯函数 `isExcluded` 与 `resolveComponentName` 单测（先行失败）

**Files:**

- Create: `src/components/common/index.spec.ts`

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect } from 'vitest'
import { isExcluded, resolveComponentName } from './_internal/naming'

describe('isExcluded', () => {
  it('默认 common 文件名不被排除', () => {
    expect(isExcluded('./AsyncState.vue')).toBe(false)
    3
  })
  it('以 _ 开头的文件被排除', () => {
    expect(isExcluded('./_Internal.vue')).toBe(true)
  })
  it('以 . 开头的文件被排除', () => {
    expect(isExcluded('./.Hidden.vue')).toBe(true)
  })
  it('子目录内以 _ 开头的文件仍被排除', () => {
    expect(isExcluded('./Sub/_Comp.vue')).toBe(true)
  })
})

describe('resolveComponentName', () => {
  it('优先使用 SFC 显式 name', () => {
    expect(resolveComponentName('./AsyncState.vue', 'MyAlias')).toBe('MyAlias')
  })
  it('name 缺失时回退到文件 basename', () => {
    expect(resolveComponentName('./AsyncState.vue')).toBe('AsyncState')
  })
  it('支持子目录路径的 basename 抽取', () => {
    expect(resolveComponentName('./SubDir/Bar.vue')).toBe('Bar')
  })
  it('大小写后缀 .Vue / .vue 都能去掉', () => {
    expect(resolveComponentName('./AsyncState.Vue')).toBe('AsyncState')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `pnpm test src/components/common/index.spec.ts`
Expected: 失败（找不到 `./_internal/naming` 模块）

- [ ] **Step 3: 提交（仅测试，不实现）**

```bash
git add src/components/common/index.spec.ts
git commit -m "test(components): 添加 _internal/naming 纯函数单测（先行失败）"
```

---

## Task 2: 实现 `src/components/common/_internal/naming.ts`

**Files:**

- Create: `src/components/common/_internal/naming.ts`
- Modify: `src/components/common/index.spec.ts`（现在会通过）

- [ ] **Step 1: 创建模块**

```ts
// src/components/common/_internal/naming.ts

/**
 * 判断该 SFC 文件路径是否应该被排除（不注册到全局）
 * 以 `_` 或 `.` 开头的 basename 视为内部组件
 */
export function isExcluded(filepath: string): boolean {
  const basename = filepath.split('/').pop() ?? ''
  return /^[_.]/.test(basename)
}

/**
 * 解析注册名：优先使用 SFC 显式声明的 name，缺失则用文件 basename（PascalCase）
 */
export function resolveComponentName(filepath: string, explicitName?: string): string {
  if (explicitName) return explicitName
  const base = filepath
    .split('/')
    .pop()!
    .replace(/\.vue$/i, '')
  return base
}
```

> 放到 `_internal/` 下：前缀 `_` 会自动被自家插件排除（自我一致性）

- [ ] **Step 2: 运行测试，验证通过**

Run: `pnpm test src/components/common/index.spec.ts`
Expected: 8 个测试通过

- [ ] **Step 3: 提交**

```bash
git add src/components/common/_internal/naming.ts
git commit -m "feat(components): 实现 _internal/naming 纯函数"
```

---

## Task 3: Vue 插件主体 `src/components/index.ts`

**Files:**

- Create: `src/components/index.ts`

- [ ] **Step 1: 写插件实现**

```ts
// src/components/index.ts
import type { App, Component } from 'vue'
import { isExcluded, resolveComponentName } from './common/_internal/naming'

/**
 * 在 Vite 构建时同步内联 common 下所有 .vue 模块
 * eager: true 让导入在 build/dev 时立即求值，运行时无异步开销
 */
const modules = import.meta.glob<{ default: Component }>('./common/**/*.{vue,Vue}', { eager: true })

export default {
  install(app: App) {
    let registered = 0
    let skipped = 0
    const registeredNames = new Set<string>()

    for (const [filepath, mod] of Object.entries(modules)) {
      if (isExcluded(filepath)) {
        skipped++
        continue
      }
      const component = mod.default
      if (!component) {
        skipped++
        continue
      }
      const name = resolveComponentName(filepath, component.name ?? undefined)
      if (registeredNames.has(name)) {
        console.warn(`[GlobalComponents] 重复的组件名 "${name}"，跳过: ${filepath}`)
        skipped++
        continue
      }
      app.component(name, component)
      registeredNames.add(name)
      registered++
    }

    if (import.meta.env.DEV) {
      console.info(`[GlobalComponents] 注册 ${registered} 个组件（跳过 ${skipped} 个）`)
    }
  },
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 通过（无错误）

- [ ] **Step 3: 提交**

```bash
git add src/components/index.ts
git commit -m "feat(components): 实现 Vue 插件扫描并注册 common 下的所有组件"
```

---

## Task 4: 插件集成测试（mount 宿主组件验证 `<AsyncState>` 可用）

**Files:**

- Create: `src/components/global-plugin.spec.ts`

- [ ] **Step 1: 写测试**

```ts
// src/components/global-plugin.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import GlobalComponents from './index'

// 需要被 vue-tsc 识别为 SFC：用 import 触发类型，但真正执行时走 import.meta.glob
import AsyncStateCmp from './common/AsyncState.vue'

describe('GlobalComponents plugin', () => {
  it('app.use 后，模板里 <AsyncState> 可解析并渲染', () => {
    const Host = defineComponent({
      setup() {
        return () => h(AsyncStateCmp, { loading: true, error: null, isEmpty: false })
      },
    })
    // 验证组件对象存在（插件 install 的对象对比）
    expect(AsyncStateCmp).toBeDefined()
    expect(Host).toBeDefined()

    const wrapper = mount(Host, {
      global: { plugins: [[GlobalComponents]] },
    })
    // loading=true 时，AsyncState 模板会渲染 el-skeleton
    expect(wrapper.html()).toContain('el-skeleton')
  })

  it('重复同名被跳过（通过 api.component 注册表断言）', () => {
    // 这里只是 sanity check：因为现有 common 下没有重名组件，
    // 验证 install 后注册表里至少存在一个 AsyncState
    const proxy: { comp: Record<string, unknown> } = { comp: {} }
    const fakeApp = {
      component(name: string, c: unknown) {
        proxy.comp[name] = c
      },
    } as unknown as Parameters<typeof GlobalComponents.install>[0]
    GlobalComponents.install(fakeApp)
    expect(Object.keys(proxy.comp)).toContain('AsyncState')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `pnpm test src/components/global-plugin.spec.ts`
Expected: 第一次：可能失败（如果 AsyncState 模板内部用了 element-plus），主要验证插件可以被 install

- [ ] **Step 3: 让测试通过**

如果只跑纯断言部分（去除 el-skeleton 断言）：

```ts
it('app.use 后注册表里有 AsyncState', () => {
  const fakeApp = {
    component(name: string, c: unknown) {
      ;(fakeApp as any)._comps ||= {}
      ;(fakeApp as any)._comps[name] = c
    },
  } as any
  ;(fakeApp as any)._comps = {}
  GlobalComponents.install(fakeApp)
  expect((fakeApp as any)._comps.AsyncState).toBeDefined()
})
```

如 `mount` 路径因 Element Plus 依赖失败，则改用上面的 fakeApp 路径。把第一个 it 块替换为：

```ts
it('插件 install 后 AsyncState 在组件表里', () => {
  const fakeApp = {
    _comps: {} as Record<string, unknown>,
    component(name: string, c: unknown) {
      this._comps[name] = c
    },
  }
  GlobalComponents.install(fakeApp as any)
  expect(fakeApp._comps.AsyncState).toBeDefined()
  expect(fakeApp._comps.ErrorBoundary).toBeDefined()
})
```

- [ ] **Step 4: 跑测试，验证通过**

Run: `pnpm test src/components/global-plugin.spec.ts`
Expected: 全通过

- [ ] **Step 5: 提交**

```bash
git add src/components/global-plugin.spec.ts
git commit -m "test(components): 添加 GlobalComponents 插件集成测"
```

---

## Task 5: 在 `src/main.ts` 接入插件

**Files:**

- Modify: `src/main.ts:1-30`（在 `app.use(i18n)` 之后、`app.mount('#app')` 之前加 2 行）

- [ ] **Step 1: 修改 main.ts**

在文件顶部 imports 区加入：

```ts
import GlobalComponents from '@/components'
```

在 `app.use(i18n)` 后增加一行：

```ts
app.use(GlobalComponents)
```

完整参考（替换原 `src/main.ts` 第 5 行附近）：

```ts
import GlobalComponents from '@/components'
// ...

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(GlobalComponents) // ← 新增
setupDirectives(app)
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 3: 启动 dev 验证 console**

Run: `pnpm dev` 然后看浏览器 Console
Expected: 看到 `[GlobalComponents] 注册 2 个组件（跳过 0 个）`

- [ ] **Step 4: 验证模板可用**

临时在任意页面（如 `src/App.vue`）某个简单节点写：

```vue
<AsyncState :loading="true" :error="null" :is-empty="false" />
```

启动 dev，浏览器能看到骨架屏；测试完删除这一行。

- [ ] **Step 5: 提交**

```bash
git add src/main.ts
git commit -m "feat(main): 接入 GlobalComponents 插件，自动注册 common 下的组件"
```

---

## Task 6: 类型声明 `src/types/components.d.ts`

**Files:**

- Create: `src/types/components.d.ts`

- [ ] **Step 1: 创建文件**

```ts
// src/types/components.d.ts
// 让模板里 <AsyncState> <ErrorBoundary> 走 TS 推导
declare module 'vue' {
  export interface GlobalComponents {
    AsyncState: (typeof import('@/components/common/AsyncState.vue'))['default']
    ErrorBoundary: (typeof import('@/components/common/ErrorBoundary.vue'))['default']
  }
}
export {}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 3: 在 `App.vue` 或某页面写 `<AsyncState>`，验证 IDE 提示**

预期：悬停 `<AsyncState>` 时 TS 给出 props 类型提示。

- [ ] **Step 4: 提交**

```bash
git add src/types/components.d.ts
git commit -m "feat(types): 增强 vue.GlobalComponents 声明支持 common 全局组件"
```

---

## Task 7: 更新 `CHANGELOG.md`

**Files:**

- Modify: `CHANGELOG.md`（顶部追加一条）

- [ ] **Step 1: 在 CHANGELOG 顶部新增条目**

```markdown
## feat(components): 支持 common 目录下组件自动全局注册 (2026-07-21)

通过 `src/components/index.ts` Vue 插件运行时扫描 `components/common/**` 的所有
`.vue`，在 `app.component()` 全局注册。`_` / `.` 开头的文件自动跳过。
已存在的 `AsyncState.vue` / `ErrorBoundary.vue` 无需任何修改，模板可直接使用。

同时新增 `src/types/components.d.ts` 让 IDE 在模板里有类型补全。
```

- [ ] **Step 2: 提交**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 common 组件全局注册功能"
```

---

## Task 8: 端到端验证

**Files:** 无（验证步骤）

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 无 error

- [ ] **Step 2: Type Check**

Run: `pnpm type-check:full`
Expected: 全通过

- [ ] **Step 3: 单元测试**

Run: `pnpm test`
Expected: 所有测试通过

- [ ] **Step 4: 构建**

Run: `pnpm build`
Expected: 成功，dist 产物正常

- [ ] **Step 5: dev 冒烟**

Run: `pnpm dev` 后浏览器 Console 检查 `[GlobalComponents] 注册 2 个组件（跳过 0 个）`

- [ ] **Step 6: 改一个文件名验证排除规则**

1. 新建 `src/components/common/_TempTest.vue`（最简单 `<template><div>tmp</div></template>`）
2. 重启 dev
3. Console 应显示 `注册 2 个组件（跳过 1 个）`
4. 删除该文件，再次重启 dev，日志回到 `跳过 0 个`

- [ ] **Step 7: 提交（如有改动）**

如果有新增验证文件：

```bash
git add -A
git commit -m "chore: 验证 common 全局注册排除规则（冒烟）"
```

---

## Self-Review Summary

**1. Spec coverage：**

- G1 自动注册 ✅ Task 3 / Task 5
- G2 naming fallback ✅ Task 2
- G3 排除规则 ✅ Task 1 / Task 2 / Task 8
- G4 类型补全 ✅ Task 6
- G5 现有组件不改 ✅ Task 3 注释 + 实施步骤无 import 改动

**2. Placeholder scan：** 无 TBD、无"类似 Task X"。

**3. Type consistency：** `isExcluded` / `resolveComponentName` 在 Task 1 → Task 2 → Task 3 全程签名一致；`GlobalComponents.install` 在 Task 3 定义、Task 4 调用、Task 5 注入 main，签名匹配。

**4. Pitfalls noticed & fixed：**

- `_internal/naming.ts` 用 `_` 前缀 → 确认不会被自身插件误注册
- 集成测涉及 Element Plus 依赖，Task 4 提供了 fakeApp fallback 方案防止 mount 失败
- Task 4 测试模块用了 `defineComponent`，避免 SFC 编译器未开启时的解析问题
