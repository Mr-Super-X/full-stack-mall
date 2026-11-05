# src 注释优化收尾 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接力 `148d29e docs(api): 为网络基建和业务API模块添加JSDoc注释`，按 4 层注释结构（文件级 / 函数级 / 关键分支 / 跨文件钩子）为剩余 ~149 个源文件补齐注释，**仅添加文档，不改动运行时行为、不改架构、不引入新依赖**。

**Architecture:** 单 agent（本会话）按"全局件 → 业务模块 → form-schema"3 组顺序串行处理。每组完成后暂停输出变更清单，由用户手 commit。每文件执行 Read → Edit（按样板）→ 自检清单 → 下一文件。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vite 8 + Pinia 3 + Element Plus 2.14 + 注释样板 `src/api/cache.ts` + `src/utils/bem.ts`

---

## 前置约定（适用于所有任务）

### 样板文件（必读）

每个文件注释优化前必须先 Read 这两个样板对齐风格：

- `src/api/cache.ts:1-90` —— 文件级 JSDoc + 内部函数 JSDoc + 关键 if 分支注释样板
- `src/utils/bem.ts:1-60` —— 文件级 JSDoc + @group/@see/@example 全套 + AutoImport 标识符注释样板

### 4 层注释结构（每次写注释时严格按此顺序）

| 层 | 必加场景 | 模板 |
|---|---------|------|
| L1 文件级 | 任何文件 | 文件级 JSDoc + `@group <分类>` |
| L2 公开 API | `export` 函数/类/接口/类型 | JSDoc 含业务意图 + @param + @returns，必要时 @example + @see |
| L3 关键分支 | if/switch/try-catch 涉及业务分流 | 行级注释"为什么走这条分支" |
| L4 跨文件钩子 | 调用关系涉及 ≥3 文件 | `@see <path>:<line>` / `@trigger <caller>` |

### AutoImport 标识符（按本地 `CLAUDE.md` §1.6.1）

如使用 `useAppRouter` / `storeToRefs` / `createNamespace` 等 AutoImport 标识符，**第一次出现**处加 1 行 ≤40 字注释说明来源包。

### §5.1 IDE 提示 5 条陷阱（不可违反）

| # | 陷阱 | 规避 |
|---|------|------|
| 1 | 删 @group / @see / @trigger / @defaultValue / @example | 结构性标签**不得删** |
| 2 | JSDoc 单属性多段 | `/** 业务说明 @group X */` 一段合并 |
| 3 | barrel `export type { X } from` 丢失 hover | 用 `export { type X }` + 上方 JSDoc |
| 4 | JSDoc 距 export 太远 | JSDoc **必须紧贴** export 声明 |
| 5 | `@group` 替代业务描述 | 每个字段必须有 1-3 行业务说明 |

### 自检清单（每文件完成后必过）

```
□ 1. 文件级 JSDoc + @group 在位
□ 2. 所有 export 函数/类/接口有 JSDoc（业务意图 + @param + @returns）
□ 3. 关键 if/switch/try 分支有 why 注释
□ 4. 跨 ≥3 文件调用有 @see
□ 5. 风格与 src/api/cache.ts / src/utils/bem.ts 一致
□ 6. 无 0 增量注释（"// 这是一个函数" 类）
□ 7. §5.1 五条 IDE 提示陷阱全过
□ 8. 未引入新依赖、未改运行时行为
□ 9. Edit diff 仅有注释增删，无逻辑变更
```

### 通用执行模式（每个文件）

```bash
# 1. Read 文件（必须 Read 后才能 Edit）
Read: <path>

# 2. 找到文件顶部，添加文件级 JSDoc（按样板）
# 3. 逐个 export 标识符添加 JSDoc
# 4. 给关键 if/switch/try 分支加 why 注释
# 5. 给跨 ≥3 文件调用加 @see

# 6. 自检清单逐条过
# 7. 移到下一文件
```

---

## Task 0: 启动前确认（5 分钟）

**Files:**
- Read: `src/api/cache.ts`（1-90 行）
- Read: `src/utils/bem.ts`（1-60 行）

- [ ] **Step 1**: Read `src/api/cache.ts:1-90` 确认样板
- [ ] **Step 2**: Read `src/utils/bem.ts:1-60` 确认样板
- [ ] **Step 3**: Read `docs/superpowers/specs/2026-09-07-src-comments-finalize-design.md` 确认范围
- [ ] **Step 4**: `git status --short | wc -l` 确认当前修改数（应 = 50 或 ≤ 50）

**Step 4 Expected Output:** 数字 ≥ 0（看上次提交后是否有未跟踪修改），不大于 50（已注释文件数）

---

## Task 1: Group 1 全局件注释（~41 文件，估 60-90 分钟）

**Files（按顺序处理）:**

```
enums/roleEnum.ts
enums/httpEnum.ts
directives/_utils.ts
directives/permission.ts
directives/inputDebounce.ts
directives/buttonDebounce.ts
directives/auth.ts
directives/index.ts
plugins/errorHandler.ts
plugins/webVitals.ts
plugins/index.ts
store/index.ts
store/modules/dict.ts
store/modules/tags-view.ts
store/modules/user.ts
store/modules/app.ts
store/modules/router.ts
store/modules/theme.ts
layouts/blank/index.vue
layouts/default/index.vue
layouts/default/components/Header.vue
layouts/portal/index.vue
layouts/portal/components/PortalHeader.vue
layouts/portal/components/PortalNav.vue
layouts/portal/config/nav.ts
layouts/portal/config/types.ts
components/common/AsyncState.vue
components/common/ErrorBoundary.vue
components/common/TagsView/index.vue
components/common/index.ts
components/index.ts
locales/zh-CN.ts
locales/en-US.ts
locales/index.ts
App.vue
main.ts
```

约 36 个文件（注：6 个 store/modules 中 `app.ts` / `router.ts` / `theme.ts` 可能不存在于实际文件，需以 `Glob src/store/modules/*.ts` 实际列表为准）

- [ ] **Step 1**: 用 `Glob src/store/modules/*.ts` 列出实际 store modules，校正本任务文件清单
- [ ] **Step 2**: 按清单顺序对每个文件执行「Read → 加文件级 JSDoc → 加 export JSDoc → 加关键分支注释 → 加 @see」
- [ ] **Step 3**: 每文件完成后跑自检清单 9 项
- [ ] **Step 4**: Group 1 全部完成后跑：`git diff --stat src/enums src/directives src/plugins src/store src/layouts src/components/common src/components/index.ts src/locales src/App.vue src/main.ts`
- [ ] **Step 5**: 输出 Group 1 「变更清单 + 手动验证步骤」，暂停等用户 review

**Step 4 Expected Output:** 每个文件 +N 行（注释），0 个 - 行（除修正既有错注释）

**Step 5 必含**：
- 文件清单（路径 + +行/-行）
- `pnpm type-check:full` 跑通确认
- 抽查 1-2 个文件的 hover 提示

---

## Task 2: Group 2 业务模块注释（~36 文件，估 50-80 分钟）

**Files（按顺序处理）:**

```
modules/auth/index.ts
modules/auth/routes/index.ts
modules/auth/views/Login.vue
modules/auth/store/index.ts
modules/user/index.ts
modules/user/routes/index.ts
modules/user/views/List.vue
modules/user/store/index.ts
modules/home/index.ts
modules/home/routes/index.ts
modules/home/components/SearchBar.vue
modules/home/components/OverviewSection.vue
modules/home/components/Hero.vue
modules/home/components/Footer.vue
modules/home/store/portal-overview.ts
modules/home/types/portal-overview.ts
modules/home/config/hero.ts
modules/home/config/footer.ts
modules/home/config/types.ts
modules/home/views/Home.vue          # 如果存在
modules/error/index.ts
modules/error/routes/index.ts
modules/error/views/NotFound.vue
modules/error/views/Forbidden.vue
modules/reports/index.ts
modules/reports/routes/index.ts
modules/reports/views/List.vue
modules/reports/views/Detail.vue
```

约 28 个文件（实际数量以 `Glob` 结果为准，Home 视图可能不止一个）

- [ ] **Step 1**: 用 `Glob` 校正各模块下的实际文件清单
- [ ] **Step 2**: 按模块顺序（auth → user → home → error → reports）逐文件执行「Read → 加注释 → 自检」
- [ ] **Step 3**: Group 2 全部完成后跑：`git diff --stat src/modules/{auth,user,home,error,reports}`
- [ ] **Step 4**: 输出 Group 2 「变更清单 + 手动验证步骤」，暂停等用户 review

---

## Task 3: Group 3 form-schema 注释（73 文件，估 120-180 分钟）

**Files（按深度顺序处理）:**

```
form-schema/types/*.ts                 # 类型层（约 10 文件）
form-schema/composables/*.ts           # 组合式层（约 15 文件）
form-schema/components/*.vue           # 子组件层（约 25 文件）
form-schema/element-plus-adapter.ts    # 适配层
form-schema/registry*.ts               # 注册器（按需）
form-schema/utils/*.ts                 # 工具
form-schema/XForm.vue                  # 根组件（最后）
form-schema/index.ts                   # 出口
```

- [ ] **Step 1**: 用 `Glob src/components/form-schema/**/*.{ts,vue}` 列出实际文件清单
- [ ] **Step 2**: 按 types → composables → components → 根组件顺序逐文件处理
- [ ] **Step 3**: 重点检查 §5.1 陷阱：
  - **barrel re-export** 用 `export { type X }` 而非 `export type { X } from`
  - **JSDoc 紧贴 export**（不隔 import/type alias）
  - **`as never` 类型断言** 附近加 why 注释（参见 `types/TYPE-CAST-AUDIT.md`）
- [ ] **Step 4**: `XForm.vue` 最后处理（核心、根组件、跨多文件 import）
- [ ] **Step 5**: Group 3 全部完成后跑：`git diff --stat src/components/form-schema/`
- [ ] **Step 6**: 输出 Group 3 「变更清单 + 手动验证步骤」，暂停等用户 review

---

## Task 4: 全局收尾（10 分钟）

- [ ] **Step 1**: 跑 `pnpm type-check:full` 确认无类型错误（注释不应引发）
- [ ] **Step 2**: 跑 `pnpm lint` 确认无 lint 错误（仅注释也应通过）
- [ ] **Step 3**: 抽查 5 个文件的 IDE hover（手动）：从每个 Group 抽 1-2 个代表性文件，确认 4 层注释 + @group 可见
- [ ] **Step 4**: 输出全局「变更总览」：
  - 总文件数 / +行 / -行（`git diff --stat | tail -1`）
  - Group 1/2/3 各自的 +行 / -行
  - 5 个抽查文件的 hover 验证结果
- [ ] **Step 5**: 输出「手动 commit 步骤」：建议拆 3 commit（按 Group）+ commit message 模板

**Step 5 commit message 模板**：
```
docs(comments): <group-name> 文件补齐 JSDoc 注释

- 覆盖：<Group 范围>
- 文件数：N
- +行/-行：+X / -Y
- 风格基线：src/api/cache.ts / src/utils/bem.ts
- 关联设计：docs/superpowers/specs/2026-09-07-src-comments-finalize-design.md
```

---

## Self-Review（撰写计划时自检）

**1. Spec coverage:**
- [x] §1 范围（~149 文件）→ Task 1/2/3 文件清单
- [x] §2 关键决策（9 条）→ 前置约定
- [x] §3 注释风格样板 → 前置约定
- [x] §4 工作流（3 组）→ Task 1/2/3
- [x] §5 自检清单 → 前置约定
- [x] §6 交付物 → Task 4
- [x] §7 不在范围（YAGNI）→ 全程不触碰
- [x] §8 验收标准 → Task 4 自检
- [x] §9 关联文档 → 前置约定引用

**2. Placeholder scan:**
- 无 TBD / TODO / "类似 Task N" / "适当错误处理"
- 每个文件 Edit 都按样板模式，无占位

**3. Type consistency:**
- 文件路径以 `Glob` 实际结果为准
- 自检清单 9 项全程一致
- commit message 模板不变量

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-07-src-comments-finalize.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 派发 subagent per task，主线程 review 后继续
**2. Inline Execution (本会话已确认)** - 本会话内串行执行 Task 0/1/2/3/4，按 Group 暂停

> 由于用户在 brainstorming 已明确"单 agent 串行"+"不 commit 你手动"，本计划默认按 **Inline Execution** 在本会话执行，由用户在每 Group 末尾手 commit。
