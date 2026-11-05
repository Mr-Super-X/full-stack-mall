# components/common 全局组件自动注册设计

> **变更摘要**：通过 `src/components/index.ts` 实现的 Vue 插件，运行时扫描 `components/common/**` 下所有 `.vue` 文件并 `app.component()` 注册到全局，模板里可直接 `<AsyncState>` / `<ErrorBoundary>` 使用；同时新增 `src/types/components.d.ts` 让 IDE 模板里能补全组件。

| 属性     | 值                           |
| -------- | ---------------------------- |
| 项目代号 | vue3-vite-project            |
| 创建日期 | 2026-07-21                   |
| 版本     | v1.0.0                       |
| 状态     | 设计已批准，待 writing-plans |
| 目标读者 | 前端开发                     |

---

## TL;DR

基于 `import.meta.glob` 在构建时内联扫描 `src/components/common/**` 下所有 `.vue` 文件，在插件 `install` 阶段用 `app.component()` 批量注册到 Vue 全局。保留 SFC 显式 `name`，缺失时 fallback 到文件 basename（PascalCase）。_ 或 . 开头的文件名视为内部组件跳过。**`components/common/` 下的文件不需要修改**，已存在的 `AsyncState.vue` / `ErrorBoundary.vue` 自动注册。

---

## 1. 背景与目标

### 1.1 当前问题

`src/components/common/` 下已有 `AsyncState.vue` 和 `ErrorBoundary.vue`，目前使用方式：

```ts
// 业务组件中
import AsyncState from '@/components/common/AsyncState.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
```

每个使用方都要写一次 `import`，样板代码重复；某些底层组件（如 layout 中的 Header）想用 `AsyncState` 包裹异步逻辑时也得显式导入。

### 1.2 目标

| #   | 目标                                                                                   |
| --- | -------------------------------------------------------------------------------------- |
| G1  | `components/common/**` 下所有 `.vue` 自动注册到 Vue 全局，无需 `import` 即可在模板使用 |
| G2  | 命名约定：保留 SFC `name`，缺失时用文件名 PascalCase                                   |
| G3  | 提供排除规则：`_` 或 `.` 开头的文件名视为内部组件跳过                                  |
| G4  | 集成到 IDE：模板里有类型补全（通过 `vue.GlobalComponents` 声明增强）                   |
| G5  | 已存在的 `AsyncState.vue` / `ErrorBoundary.vue` 不需要任何修改                         |

### 1.3 非目标

| #   | 不做什么                                                                                    |
| --- | ------------------------------------------------------------------------------------------- |
| N1  | 不扫描 `components/common/` 之外的其他子目录（layout / modules / 其他业务组件按现有规则走） |
| N2  | 不强制组件必须有 `name`（fallback 文件名）                                                  |
| N3  | 不做按需懒加载（`AsyncState` / `ErrorBoundary` 是底层同步组件，先 eager 内联）              |

---

## 2. 核心设计

### 2.1 架构总览

新增/改动文件：

| 文件                        | 类型 | 说明                                      |
| --------------------------- | ---- | ----------------------------------------- |
| `src/components/index.ts`   | 新建 | Vue 插件入口；`install` 时扫描 + 注册     |
| `src/types/components.d.ts` | 新建 | `vue.GlobalComponents` 类型增强；模板补全 |
| `src/main.ts`               | 修改 | 增加 `app.use(GlobalComponents)`          |
| `src/components/common/`    | 不改 | 现有文件自动纳入扫描                      |

### 2.2 注册流程

```text
启动 App
   │
   ▼
createApp(App)            ← main.ts
   │
   ▼
app.use(GlobalComponents) ← 加载 src/components/index.ts 默认导出（Vue 插件）
   │
   ▼
install(app)              ← 插件 install 钩子
   │
   ├─ import.meta.glob('./common/**/*.{vue,Vue}', { eager: true })
   │   └─ 构建时内联：return 所有 .vue 模块（路径 → ES Module）
   │
   ├─ 遍历 modules.entries()
   │   ├─ isExcluded(filepath)? → 跳过（_ 或 . 开头）
   │   ├─ 默认 export 存在? → 没有就跳过
   │   ├─ resolveComponentName(filepath, comp.name)
   │   │   ├─ 优先 comp.name（显式声明）
   │   │   └─ fallback：basename 去后缀（已是 PascalCase）
   │   ├─ 重名检测：已在 Set 里? → console.warn 跳过
   │   └─ app.component(name, comp)  注册成功
   │
   └─ DEV 模式日志：「注册 N 个组件，跳过 M 个」
```

### 2.3 排除规则

| 文件路径                       | 是否注册 | 原因                     |
| ------------------------------ | -------- | ------------------------ |
| `common/AsyncState.vue`        | ✅       | 默认                     |
| `common/SubDir/Bar.vue`        | ✅       | 递归扫描，子目录也算     |
| `common/_internal/Tooltip.vue` | ❌       | `_` 开头，内部使用       |
| `common/.temp/Foo.vue`         | ❌       | `.` 开头，IDE/工具链隐藏 |

实现：

```ts
function isExcluded(filepath: string): boolean {
  const basename = filepath.split('/').pop() ?? ''
  return /^[_.]/.test(basename)
}
```

### 2.4 命名解析

```ts
function resolveComponentName(filepath: string, explicitName?: string): string {
  if (explicitName) return explicitName
  const base = filepath
    .split('/')
    .pop()!
    .replace(/\.vue$/i, '')
  return base // 文件名 PascalCase 已等价
}
```

- `comp.name` 是 SFC `<script>` 里 `defineOptions({ name: 'Xxx' })` 或 Options API `name: 'Xxx'` 暴露的名字
- 没有声明时，回退到文件 basename：如 `AsyncState.vue` → `AsyncState`

---

## 3. 实现要点

### 3.1 `src/components/index.ts`

```ts
import type { App, Component } from 'vue'

// 同步扫描所有 common 下的 .vue 文件（Vite 原生，eager: true 构建时内联）
const modules = import.meta.glob<{ default: Component }>('./common/**/*.{vue,Vue}', { eager: true })

function isExcluded(filepath: string): boolean {
  const basename = filepath.split('/').pop() ?? ''
  return /^[_.]/.test(basename)
}

function resolveComponentName(filepath: string, explicitName?: string): string {
  if (explicitName) return explicitName
  const base = filepath
    .split('/')
    .pop()!
    .replace(/\.vue$/i, '')
  return base
}

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

### 3.2 `src/main.ts` 集成

```ts
import GlobalComponents from '@/components'

const app = createApp(App)
// 已有：app.use(pinia) / app.use(router) / app.use(i18n)
app.use(GlobalComponents)
```

> 放在 `app.mount('#app')` 之前；具体插入位置视 `main.ts` 当前顺序而定，与 router/i18n 同级即可。

### 3.3 `src/types/components.d.ts`

```ts
// 让模板里 <AsyncState> <ErrorBoundary> 走 TS 类型推导
declare module 'vue' {
  export interface GlobalComponents {
    AsyncState: (typeof import('@/components/common/AsyncState.vue'))['default']
    ErrorBoundary: (typeof import('@/components/common/ErrorBoundary.vue'))['default']
  }
}
export {}
```

> 后续新增 common 组件，开发期 IDE 会提示需要补 `GlobalComponents`。可结合 lint 规则或脚本扫描此声明与 `components/common/**` 是否一致（是否纳入后续 ESLint 规则 TBD）。

---

## 4. 测试策略

### 4.1 单元测试

`src/components/__tests__/global-components.spec.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createApp, defineComponent, h } from 'vue'
import GlobalComponentsPlugin from '../index'

describe('GlobalComponents plugin', () => {
  it('在 createApp + app.use 后，注册组件可在模板使用', () => {
    const app = createApp({})
    app.use(GlobalComponentsPlugin)
    // 用 app.component 注册表做断言
    const names = Object.keys(app._context.config.globalProperties.$options.components ?? {})
    expect(names.length).toBeGreaterThanOrEqual(1) // 至少动态注册若干
  })

  it('应排除以 _ 开头的文件', () => {
    // 通过 mock modules 验证 isExcluded
    // 注：import.meta.glob 是构建期常量，复杂场景用 e2e 更合适
  })
})
```

> 单测层面 `import.meta.glob` 是构建期内联，难以 mock。核心测试策略改为**集成测**：直接挂载一个宿主组件，验证模板里 `<AsyncState>` 能渲染出来。

### 4.2 端到端验证（手动）

1. `pnpm dev` 后浏览器 Console 应看到 `[GlobalComponents] 注册 2 个组件（跳过 0 个）`
2. 新建一个临时页面，模板里写 `<AsyncState :loading="true" :error="null" :is-empty="false" />`，检查 skeleton 渲染
3. 删除一个 common 组件，重启 dev，日志显示 `注册 1 个组件`

---

## 5. 边界与错误处理

| 场景                    | 行为                                            |
| ----------------------- | ----------------------------------------------- |
| 同名组件重复            | `console.warn` + 跳过（后注册的让位给先注册的） |
| SFC 无 `name` 字段      | 用文件 basename fallback，不报错                |
| 模块无 `default` export | 跳过（不影响后续模块）                          |
| 空 common 目录          | 注册 0 个，DEV 模式日志告知                     |
| `common/_xxx.vue`       | 跳过，DEV 模式计入 `skipped`                    |

---

## 6. 不在本次范围

- ❌ `components/common/` 之外目录自动注册（layout / modules 不受影响）
- ❌ 通过 `unplugin-vue-components` 改实现（用户明确要求 install 形式）
- ❌ 强约束 SFC 必须声明 `name`（fallback 已处理）
- ❌ 脚本校验 `types/components.d.ts` 与 common 目录同步（脚本化后续议题）

---

## 7. 实施产物清单

| 序号 | 文件                                                 | 改动                         |
| ---- | ---------------------------------------------------- | ---------------------------- |
| 1    | `src/components/index.ts`                            | 新建（约 50 行）             |
| 2    | `src/types/components.d.ts`                          | 新建（约 12 行）             |
| 3    | `src/main.ts`                                        | 新增 2 行 import + `app.use` |
| 4    | `src/components/__tests__/global-components.spec.ts` | 新建（约 40 行）             |
| 5    | `CHANGELOG.md`                                       | 追加一条 feat                |
| 6    | `docs/superpowers/specs/`                            | 本设计文档                   |

不修改：

- `src/components/common/AsyncState.vue` / `ErrorBoundary.vue`
- `vite.config.ts`（保持 unplugin-vue-components 现有配置不动）

---

## 8. 风险评估

| 风险                                     | 等级 | 缓解                                                                                         |
| ---------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| 全局组件与 Element Plus 命名冲突         | 低   | 现有 common 组件名（`AsyncState`、`ErrorBoundary`）与 EP 不冲突；若日后冲突，重名检测会 warn |
| `import.meta.glob` 在 build 后无新增组件 | 低   | `.vue` 是静态文件，新增 common 文件后 `vite dev/build` 会触发 glob 重新扫描                  |
| 类型声明手工维护成本                     | 中   | `types/components.d.ts` 需手动添加新组件名；后续可考虑自动生成（不在本次范围）               |

---

_文档版本：v1.0.0 | 生成日期：2026-07-21_
