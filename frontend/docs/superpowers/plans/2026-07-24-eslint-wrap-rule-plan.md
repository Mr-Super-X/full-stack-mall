# ESLint 强制使用项目封装工具 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 ESLint 规则强制业务代码使用 `useAppRouter` 替代 `useRouter`、禁止直接 `import axios`，并把现有 6 个违规文件迁移到封装。

**Architecture:** 现有 `eslint.config.mjs` 平铺式 flat config 中追加一段路径限定的规则块。零新依赖、warning 级别、不支持自动修复。

**Tech Stack:** ESLint 10.7.0（flat config）+ 内置 `no-restricted-imports` 规则

**关联 Spec:** `docs/superpowers/specs/2026-07-24-eslint-wrap-rule-design.md`

---

## 任务概览

| Task | 内容 | 预估工时 |
|------|------|----------|
| 1 | 改造 `Sidebar.vue` | 5 min |
| 2 | 改造 `TagsView/index.vue` | 5 min |
| 3 | 改造 `OverviewCard.vue` | 3 min |
| 4 | 改造 `Login.vue` | 5 min |
| 5 | 改造 `DocLayout.vue` | 5 min |
| 6 | 改造 `DemoFrame.vue` | 3 min |
| 7 | 写入 ESLint 配置 | 3 min |
| 8 | 验证零警告 | 2 min |
| 9 | 验证规则能触发（故意写违规 → 还原） | 3 min |
| 10 | 更新 `docs/10-新手指引.md` | 5 min |
| 11 | 更新 `docs/18-代码组织决策表.md` | 3 min |
| 12 | 更新 `CHANGELOG.md` | 2 min |

**执行顺序原则**：先重构业务文件（Task 1-6），再加 ESLint 规则（Task 7），最后验证（Task 8-9）+ 文档（Task 10-12）。

---

## Task 1: 改造 `src/components/layout/Sidebar.vue`

**Files:**
- Modify: `src/components/layout/Sidebar.vue:23-39, 136`

**背景：`Sidebar.vue` 当前用法：**
- `useRoute, useRouter` from `'vue-router'`
- `const router = useRouter()`、`const route = useRoute()`
- 使用点：`router.getRoutes()`（路由列表派生）、`router.push(target)`（跳转）、`route.path`（判断激活）

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例（vue-router 原生 API 不变）
- `useRoute` 保留（读取路由状态的标准 API，不在拦截范围）

- [ ] **Step 1: 修改 import 和实例化**

当前 Sidebar.vue:23-39：
```js
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as ElIcons from '@element-plus/icons-vue'
import { useAppStore } from '@/store/modules/app'
import { resolveRouteTitle, extractRouteIcon } from '@/router/helpers'

...

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
```

改为：
```js
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as ElIcons from '@element-plus/icons-vue'
import { useAppStore } from '@/store/modules/app'
import { useAppRouter } from '@composables/useAppRouter'
import { resolveRouteTitle, extractRouteIcon } from '@/router/helpers'

...

const appStore = useAppStore()
const { router } = useAppRouter()
const route = useRoute()
const { t } = useI18n()
```

- [ ] **Step 2: 验证文件可被 ESLint 解析**

Run: `cd D:\personal\github\vue3工程模板\vue3-vite-project && pnpm eslint src/components/layout/Sidebar.vue`
Expected: 0 error（ESLint 规则尚未配置，因此不会产生 warning）

- [ ] **Step 3: 跑 type-check 验证**

Run: `cd D:\personal\github\vue3工程模板\vue3-vite-project && pnpm type-check`
Expected: 通过

- [ ] **Step 4: commit**

```bash
git add src/components/layout/Sidebar.vue
git commit -m "refactor(sidebar): 改用 useAppRouter 替代 useRouter"
```

---

## Task 2: 改造 `src/components/common/TagsView/index.vue`

**Files:**
- Modify: `src/components/common/TagsView/index.vue:11-18, 29-31, 42-43, 62, 66`

**背景：** `TagsView/index.vue` 多处调用 `router.push(tag.path)` 跳转。
- `useRoute, useRouter` from `'vue-router'`
- 使用点：`router.push(tag.path)` × 4 处（line 29、42、62、66）

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例
- `useRoute` 保留
- `router.push(tag.path)` 保留（pushByName 是按 name 跳转，tag 是按 path，无法直接替换）

- [ ] **Step 1: 修改 import 和实例化**

当前 TagsView/index.vue:11-18：
```js
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsViewStore, type TagView } from '@/store/modules/tags-view'
import { createNamespace } from '@utils/bem'

const route = useRoute()
const router = useRouter()
const store = useTagsViewStore()
```

改为：
```js
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTagsViewStore, type TagView } from '@/store/modules/tags-view'
import { createNamespace } from '@utils/bem'
import { useAppRouter } from '@composables/useAppRouter'

const route = useRoute()
const { router } = useAppRouter()
const store = useTagsViewStore()
```

- [ ] **Step 2: 验证**

Run: `pnpm eslint src/components/common/TagsView/index.vue && pnpm type-check`
Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add src/components/common/TagsView/index.vue
git commit -m "refactor(tags-view): 改用 useAppRouter 替代 useRouter"
```

---

## Task 3: 改造 `src/modules/home/views/components/OverviewCard.vue`

**Files:**
- Modify: `src/modules/home/views/components/OverviewCard.vue:1-28`

**背景：** OverviewCard 单文件，最简单。
- `useRouter` from `'vue-router'`
- 使用点：`router.push(props.viewDetailPath)` 1 处

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例

- [ ] **Step 1: 修改 import 和实例化**

当前 OverviewCard.vue:1-18：
```js
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import * as ElIcons from '@element-plus/icons-vue'
import type { Component } from 'vue'
import OverviewMetricRow from './OverviewMetricRow.vue'
import type { OverviewCardDto } from '@/modules/home/types/portal-overview'

const props = defineProps<{
  title: string
  iconName: string
  iconBg: string
  metrics: OverviewCardDto['metrics']
  // 允许显式 undefined 透传，避开 exactOptionalPropertyTypes 严格模式
  viewDetailPath?: string | undefined
}>()

const router = useRouter()
```

改为：
```js
<script setup lang="ts">
import { computed } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import type { Component } from 'vue'
import OverviewMetricRow from './OverviewMetricRow.vue'
import type { OverviewCardDto } from '@/modules/home/types/portal-overview'
import { useAppRouter } from '@composables/useAppRouter'

const props = defineProps<{
  title: string
  iconName: string
  iconBg: string
  metrics: OverviewCardDto['metrics']
  viewDetailPath?: string | undefined
}>()

const { router } = useAppRouter()
```

- [ ] **Step 2: 验证**

Run: `pnpm eslint src/modules/home/views/components/OverviewCard.vue && pnpm type-check`
Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add src/modules/home/views/components/OverviewCard.vue
git commit -m "refactor(overview-card): 改用 useAppRouter 替代 useRouter"
```

---

## Task 4: 改造 `src/modules/auth/views/Login.vue`

**Files:**
- Modify: `src/modules/auth/views/Login.vue:1-25`

**背景：** Login 登录后跳转。
- `useRouter, useRoute` from `'vue-router'`
- 使用点：`router.push(redirect)` 1 处（redirect 是从 route.query 读取的字符串）

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例
- `useRoute` 保留（route.query.redirect 读取）
- `router.push(redirect)` 保留（redirect 是 string，pushByName 不支持）

- [ ] **Step 1: 修改 import 和实例化**

当前 Login.vue:1-10：
```js
<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
```

改为：
```js
<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { ElMessage } from 'element-plus'
import { useAppRouter } from '@composables/useAppRouter'

const { router } = useAppRouter()
const route = useRoute()
const userStore = useUserStore()
```

- [ ] **Step 2: 验证**

Run: `pnpm eslint src/modules/auth/views/Login.vue && pnpm type-check`
Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add src/modules/auth/views/Login.vue
git commit -m "refactor(login): 改用 useAppRouter 替代 useRouter"
```

---

## Task 5: 改造 `src/modules/demo/layouts/DocLayout.vue`

**Files:**
- Modify: `src/modules/demo/layouts/DocLayout.vue:14-19, 42-44`

**背景：** DocLayout 通过 `router.getRoutes()` 派生 sidebar。
- `useRoute, useRouter, RouterLink` from `'vue-router'`
- 使用点：`router.getRoutes()`、`router.push('/')`、`RouterLink` 组件

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例
- `useRoute` 保留（route.name === item.name 判断激活）
- `RouterLink` 保留（这是 vue-router 暴露的 `<RouterLink>` 组件，不在拦截范围）

- [ ] **Step 1: 修改 import 和实例化**

当前 DocLayout.vue:14-19：
```js
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Back } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
```

改为：
```js
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { Back } from '@element-plus/icons-vue'
import { useAppRouter } from '@composables/useAppRouter'

const route = useRoute()
const { router } = useAppRouter()
```

- [ ] **Step 2: 验证**

Run: `pnpm eslint src/modules/demo/layouts/DocLayout.vue && pnpm type-check`
Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add src/modules/demo/layouts/DocLayout.vue
git commit -m "refactor(doc-layout): 改用 useAppRouter 替代 useRouter"
```

---

## Task 6: 改造 `src/modules/demo/components/DemoFrame.vue`

**Files:**
- Modify: `src/modules/demo/components/DemoFrame.vue:8-28`

**背景：** DemoFrame 仅 1 处 `router.push('/demo')`。
- `useRouter` from `'vue-router'`

**改造策略：**
- `useRouter` → `useAppRouter()` 的 `router` 实例

- [ ] **Step 1: 修改 import 和实例化**

当前 DemoFrame.vue:8-20：
```js
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'

defineProps<{
  /** 组件名（顶部大标题） */
  title: string
  /** 组件源文件路径（仅展示用，不做跳转） */
  source?: string
  /** 简介要点列表（字符串或 VNode 数组均可） */
  introductions?: string[]
}>()

const router = useRouter()
```

改为：
```js
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppRouter } from '@composables/useAppRouter'

defineProps<{
  title: string
  source?: string
  introductions?: string[]
}>()

const { router } = useAppRouter()
```

- [ ] **Step 2: 验证**

Run: `pnpm eslint src/modules/demo/components/DemoFrame.vue && pnpm type-check`
Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add src/modules/demo/components/DemoFrame.vue
git commit -m "refactor(demo-frame): 改用 useAppRouter 替代 useRouter"
```

---

## Task 7: 写入 ESLint 配置

**Files:**
- Modify: `eslint.config.mjs:30-37`（在现有规则块前插入新规则块）

- [ ] **Step 1: 修改 `eslint.config.mjs`**

当前 `eslint.config.mjs:29-37`：
```js
  // 项目级规则覆盖：
  // - 关闭单字组件名（项目刻意保持简洁命名）
  // - 允许 _ 前缀变量被忽略（用于"解构但暂不使用"的场景）
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
```

在该规则块之前插入新规则块：
```js
  // 业务目录强制使用项目封装
  // - 拦截 useRouter：业务代码必须用 @composables/useAppRouter
  // - 拦截 axios：业务代码必须用 @composables/useRequest 或 @api/_http
  // - 白名单：composables/router/plugins/main.ts 默认不受限
  {
    name: 'app/business-wrap-rule',
    files: ['src/modules/**/*.{ts,vue}', 'src/components/**/*.{ts,vue}', 'src/views/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['vue-router'],
              importNames: ['useRouter'],
              message: '业务代码禁止直接使用 vue-router 的 useRouter，请改用 @composables/useAppRouter',
            },
            {
              group: ['axios', 'axios/*'],
              message: '业务代码禁止直接使用 axios 包，请通过 @composables/useRequest 或 @api/_http 调用',
            },
          ],
        },
      ],
    },
  },
```

完整 `eslint.config.mjs` 改动后应为：
```js
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// 单一职责：组合 Vue/TS/Prettier 三层规则
// Prettier 规则必须放最后，避免与 Prettier 冲突
export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.husky/**',
      '**/mock/**',
      '**/scripts/**/*.cjs'
    ],
  },
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  // 业务目录强制使用项目封装
  // - 拦截 useRouter：业务代码必须用 @composables/useAppRouter
  // - 拦截 axios：业务代码必须用 @composables/useRequest 或 @api/_http
  // - 白名单：composables/router/plugins/main.ts 默认不受限
  {
    name: 'app/business-wrap-rule',
    files: ['src/modules/**/*.{ts,vue}', 'src/components/**/*.{ts,vue}', 'src/views/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['vue-router'],
              importNames: ['useRouter'],
              message: '业务代码禁止直接使用 vue-router 的 useRouter，请改用 @composables/useAppRouter',
            },
            {
              group: ['axios', 'axios/*'],
              message: '业务代码禁止直接使用 axios 包，请通过 @composables/useRequest 或 @api/_http 调用',
            },
          ],
        },
      ],
    },
  },
  // 项目级规则覆盖：
  // - 关闭单字组件名（项目刻意保持简洁命名）
  // - 允许 _ 前缀变量被忽略（用于"解构但暂不使用"的场景）
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  skipFormatting,
]
```

- [ ] **Step 2: 验证**

Run: `pnpm lint`
Expected: 0 error, 0 warning（6 个文件已改造完成）

- [ ] **Step 3: commit**

```bash
git add eslint.config.mjs
git commit -m "feat(eslint): 新增业务目录强制使用封装的规则"
```

---

## Task 8: 验证零警告

**Files:** 无

- [ ] **Step 1: 跑全量 lint**

Run: `pnpm lint`
Expected: `0 error, 0 warning`

- [ ] **Step 2: 检查输出**

如果出现 warning 或 error，逐文件查看并修复。

---

## Task 9: 验证规则能触发（故意写违规 → 还原）

**目的：** 验证规则确实开启，否则 Task 7 写的可能是空配置。

**Files:**
- Create: `src/modules/home/views/__test_violation.ts`（临时验证文件）
- Delete: 临时验证文件

- [ ] **Step 1: 写一个临时违规文件**

创建 `src/modules/home/views/__test_violation.ts`：
```ts
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
void router
void axios
```

- [ ] **Step 2: 跑 lint 验证规则触发**

Run: `pnpm eslint src/modules/home/views/__test_violation.ts`
Expected: 至少 2 条 warning，提示文案包含"业务代码禁止直接使用 vue-router 的 useRouter"和"业务代码禁止直接使用 axios 包"

- [ ] **Step 3: 删除临时验证文件**

```bash
rm src/modules/home/views/__test_violation.ts
```

- [ ] **Step 4: 确认清理后无残留**

Run: `pnpm lint`
Expected: 0 error, 0 warning

> **注意：** 此任务不创建 commit（仅作为验证手段）

---

## Task 10: 更新 `docs/10-新手指引.md`

**Files:**
- Modify: `docs/10-新手指引.md`

- [ ] **Step 1: 找到"封装使用"相关章节**

Run: `grep -n "封装" D:\personal\github\vue3工程模板\vue3-vite-project\docs\10-新手指引.md`
或 Read 该文件确认结构。

- [ ] **Step 2: 在合适章节末尾追加"强制使用封装"小节**

追加内容（章节标题以现有文档风格为准）：
```markdown
## 强制使用项目封装的 ESLint 规则

业务代码（src/modules/**、src/components/**、src/views/**）必须使用项目封装，禁止直接调用底层 API：

| 禁止 | 推荐替代 |
|------|----------|
| `import { useRouter } from 'vue-router'` | `import { useAppRouter } from '@composables/useAppRouter'` |
| `import axios from 'axios'` | `import { useRequest } from '@composables/useRequest'` 或 `@api/_http` |

违规时 ESLint 提示 warning（不阻塞构建），但请尽快修复。

**为什么这样设计？**
- `useAppRouter` 集中错误处理（toast）、i18n title 写入、类型安全的按 name 跳转
- `useRequest` 统一三态管理（loading / error / empty）、请求竞态保护、AbortController

**白名单位置（天然不受限制）：**
- `src/composables/**`（封装自身实现）
- `src/router/**`（路由守卫、动态路由）
- `src/plugins/**`（插件初始化）
- `src/main.ts`、`src/App.vue`
- `*.spec.ts`（测试用例）
```

- [ ] **Step 3: commit**

```bash
git add docs/10-新手指引.md
git commit -m "docs(guide): 新手文档补充强制使用封装的 ESLint 规则说明"
```

---

## Task 11: 更新 `docs/18-代码组织决策表.md`

**Files:**
- Modify: `docs/18-代码组织决策表.md`

- [ ] **Step 1: 找到"是否封装"相关行**

Run: `grep -n "封装\|composables" D:\personal\github\vue3工程模板\vue3-vite-project\docs\18-代码组织决策表.md`

- [ ] **Step 2: 新增一行决策项**

在决策表末尾新增：
```markdown
| 何时强制使用封装 | 业务代码（src/modules/components/views）禁止直接 import vue-router 的 useRouter 和 axios 包 | ESLint 规则自动检测（警告级别） |
```

具体格式参考文档现有风格。

- [ ] **Step 3: commit**

```bash
git add docs/18-代码组织决策表.md
git commit -m "docs(decision-table): 补充强制使用封装的决策项"
```

---

## Task 12: 更新 `CHANGELOG.md`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 在最新 Unreleased 章节追加**

追加内容（参考现有 CHANGELOG 风格）：
```markdown
### 新增
- ESLint 规则：业务目录强制使用 `useAppRouter` 替代 `useRouter`，禁止直接 `import axios`（详见 docs/superpowers/specs/2026-07-24-eslint-wrap-rule-design.md）

### 变更
- 重构 6 个业务文件：`Sidebar.vue`、`TagsView/index.vue`、`OverviewCard.vue`、`Login.vue`、`DocLayout.vue`、`DemoFrame.vue` 改用 `useAppRouter`
```

- [ ] **Step 2: commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 ESLint 强制封装规则与 6 文件重构"
```

---

## 完成验证

- [ ] `pnpm lint` 输出 0 error, 0 warning
- [ ] `pnpm type-check` 通过
- [ ] `pnpm test run` 既有测试通过
- [ ] git log 显示 12 个 commit 全部已提交
- [ ] 文档（10、18、CHANGELOG）已同步更新
- [ ] 不存在残留临时文件

---

## 风险与回滚

| 风险 | 缓解措施 |
|------|----------|
| 6 个文件重构引入运行时 bug | 每个文件改完立即跑 `pnpm type-check`；最后 Task 8 跑 `pnpm test` 验证 |
| 规则写错误伤 `src/composables/` | `files` 字段已限定业务目录；Task 9 故意违规验证规则才会触发 |
| 警告淹没真实错误 | 仅 2 条规则，IDE 易于过滤 |

**回滚方案：** 12 个 commit 提交前都在 cursor worktree，验证不通过 → 回退到 spec commit (`c036e17`) 即可。

---

> **2026-08-19 架构变更**：本文档中提到的 `src/components/layout/Header.vue` / `src/components/layout/Sidebar.vue` 已迁移至 `src/layouts/default/components/`（layout 自包含重构）。详见 `CHANGELOG.md`「♻ Refactor | 重构」分组。
