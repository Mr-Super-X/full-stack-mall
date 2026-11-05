# src 注释优化收尾（公开 API + 关键逻辑深度）设计文档

> 接力 `148d29e docs(api): 为网络基建和业务API模块添加JSDoc注释`，对剩余 ~149 个源文件（components / directives / enums / layouts / locales / modules / plugins / store / App.vue / main.ts）按 4 层注释结构（文件级 / 函数级 / 关键分支 / 跨文件钩子）做对齐补齐，对齐基线为 `src/api/cache.ts` 与 `src/utils/bem.ts`。

| 属性 | 值 |
|------|-----|
| 版本 | v1.0.0 |
| 日期 | 2026-09-07 |
| 状态 | 设计稿待用户复核 |
| 关联项目 | `vue3-vite-project` |
| 关联分支 | `feature/engine-optimization` |
| 上游基线 | `148d29e docs(api): 为网络基建和业务API模块添加JSDoc注释`（50 文件已落库） |
| 关联规范 | 全局 `~/.claude/CLAUDE.md` §5 + `~/.claude/rules/zh/comments.md` + 本地 `CLAUDE.md` §1.6.1（AutoImport 来源注释） |

---

## 1. 背景 & 需求

### 1.1 现状

- `feature/engine-optimization` 分支已在上一次提交（`148d29e`）完成 4 个一级目录的注释补齐：`src/api/` (19) + `src/composables/` (6) + `src/router/` (15) + `src/utils/` (10) = **50 文件，+852/-424 行**。
- 剩余 `src/` 源代码（*.ts / *.vue，排除 *.spec.ts、*.d.ts、modules/demo）共 **~149 文件**，按一级目录分布：

  | 一级目录 | 待处理 | 备注 |
  |---------|-------|------|
  | `components/form-schema/` | 73 | 核心：XForm 自研表单引擎，含 composables/、components/、types/、根组件 XForm.vue |
  | `modules/home/` | 22 | 门户首页（Hero / Search / Overview / Footer） |
  | `layouts/portal/` | 5 | Portal 布局（Header / Nav / 入口 + config） |
  | `layouts/default/` | 3 | 默认布局（Header / index / 样式入口） |
  | `layouts/blank/` | 1 | 空白布局 |
  | `components/common/` | 4 | AsyncState / ErrorBoundary / TagsView / 出口 index |
  | `directives/` | 6 | permission / inputDebounce / buttonDebounce / auth + _utils + 出口 |
  | `enums/` | 2 | httpEnum / roleEnum |
  | `plugins/` | 3 | errorHandler / webVitals + 出口 |
  | `store/` | 7 | index + 6 modules |
  | `locales/` | 3 | zh-CN / en-US + 出口 |
  | `modules/{auth,user,error,reports}/` | 14 | 业务模块 |
  | `App.vue` + `main.ts` | 2 | 根组件 + 入口 |

- 注释规范**已在**全局 `~/.claude/CLAUDE.md` §五、§5.1 + `rules/zh/comments.md` 明确（4 层结构 + 5 条 IDE 提示陷阱），本地 `CLAUDE.md` §1.6.1 额外要求 AutoImport 来源注释。
- 当前对未处理文件的注释现状差异较大：部分文件完全无注释（如 `enums/roleEnum.ts`），部分文件有零散行级注释（如 `directives/permission.ts`），需统一标准。

### 1.2 目标

按既有基线（`src/api/cache.ts` / `src/utils/bem.ts`）的 4 层结构 + 5.1 陷阱约束，为剩余 ~149 个源文件补齐注释，**仅添加文档，不改动运行时行为、不改架构、不引入新依赖**。

完成后整体效果：
- IDE hover 任何 export 标识符都能看到"业务意图 + 关键参数 + 跨文件钩子"
- 关键 if/switch 分支的"为什么"留下 why 注释
- 跨 ≥3 文件调用的关系有 @see 锚定

### 1.3 范围

**包含**：
- `components/form-schema/` 73 个文件（含 composables/、components/、types/、根组件 XForm.vue）
- `components/common/` 4 个 + `components/index.ts` 1 个
- `directives/` 6 个
- `enums/` 2 个
- `layouts/` 9 个（portal 5 + default 3 + blank 1）
- `locales/` 3 个
- `modules/{auth,user,home,error,reports}/` 共 36 个
- `plugins/` 3 个
- `store/` 7 个（index + 6 modules）
- `App.vue` + `main.ts` 2 个

**不包含**（YAGNI）：
- `modules/demo/` 75 个示例文件 —— 用户明确指定跳过
- `*.spec.ts` / `*.test.ts` 测试用例
- `types/*.d.ts` 类型声明文件（无运行时行为）
- 已注释的 50 个文件（`api/` / `composables/` / `router/` / `utils/`）—— 信任上次提交
- 任何运行时行为变更、架构调整、新依赖引入

### 1.4 风险

- **form-schema 复杂类型断言 `as never`**：参见 `types/TYPE-CAST-AUDIT.md`（上次已建立），JSDoc 需在类型断言附近解释"为什么不能更优雅"
- **barrel re-export 文件**（如 `components/index.ts`、`composables/useDict.ts`）：按 §5.1 陷阱 #3 使用 `export { type X }` 而非 `export type { X }`
- **App.vue 根组件**：被多文件 import，JSDoc 变更会扩散到 IDE hover 提示面，谨慎加 @example
- **AutoImport 标识符**（`useAppRouter` / `storeToRefs` / `createNamespace` 等）：按本地 `CLAUDE.md` §1.6.1 加 1 行 40 字内来源注释

---

## 2. 关键决策摘要

| # | 决策维度 | 选择 | 关键依据 |
|---|---------|-----|----------|
| 1 | 覆盖范围 | 跳过 demo + 测试 + .d.ts | 用户在 brainstorming 第 1 题明确"跳过demo和测试用例" |
| 2 | 并发策略 | 单 agent 串行（本会话内） | 用户在第 2 题明确"单 agent 串行"，避免多 agent 风格漂移 |
| 3 | 注释深度 | 公开 API + 关键逻辑 | 用户在第 3 题明确"公开 API + 关键逻辑（推荐）"；4 层结构中只强制前 3 层 + 跨文件钩子（≥3 文件） |
| 4 | 处理顺序 | 全局件 → 业务模块 → form-schema | 用户在第 4 题明确"全局件 → 业务模块 → form-schema（推荐）"，逐组暂停输出变更清单 |
| 5 | Git 工作流 | 不自动 commit、不 push | 用户在第 5 题明确"不 commit 你手动"，由用户手 commit |
| 6 | 风格基线 | `src/api/cache.ts` + `src/utils/bem.ts` | 既已落库且通过上次审查的样板 |
| 7 | 跨文件 @see 阈值 | 仅当调用关系涉及 ≥3 文件时必加 | 防止 149 文件中产生 @see 噪声；非阈值场景按需 |
| 8 | AutoImport 来源注释 | 按本地 `CLAUDE.md` §1.6.1 表格 | 已落库的全局规则，40 字内 |
| 9 | 类型导入 JSDoc | `import type { X }` 保留 hover 提示 | 按 §5.1 陷阱 #3：barrel 用 `export { type X }`；避免 `export type { X } from` |

---

## 3. 注释风格样板（已对齐既有基线）

### 3.1 文件级 JSDoc

参照 `src/utils/bem.ts:1-25`：

```ts
/**
 * <文件功能一句话>。
 *
 * <角色定位：在哪一层、被谁引用>。
 * <与其他模块的关系：互补/上游/下游>。
 *
 * <关键约束：magic number 业务来源、命名规则、特殊场景>。
 *
 * @see <跨文件钩子 1>
 * @see <跨文件钩子 2>
 * @group <分组名（IDE 折叠面板锚点）>
 */
```

### 3.2 公开 API JSDoc

参照 `src/api/cache.ts:24-30`：

```ts
/**
 * <业务意图，不是 "做什么">。
 * <副作用/幂等性/输入输出边界>。
 *
 * @param <name> <业务含义，不是类型>
 * @returns <业务承诺>
 * @example  // 仅关键 API
 * @see       // 跨 ≥3 文件调用
 */
```

### 3.3 关键分支注释

参照既有惯例：

```ts
// <业务场景>：<为什么走这条分支，而不是另一条>
if (xxx) {
  ...
}
```

### 3.4 跨文件钩子

- `@see <path>:<line>` 标注调用方 / 被调用方
- `@trigger` 标注本函数被哪个上层触发

### 3.5 反模式（禁止出现）

参见全局 `~/.claude/CLAUDE.md` §五"绝对禁止"表 + `comments.md` "有害注释"表：
- 复读代码本体（"// Set the user name"）
- 描述组件/函数"是什么"（"// This component renders..."）
- 无责任人 TODO
- 冗余 `@param id - The user ID`（TS 已声明类型）
- 硬编码前缀字符串（违反 BEM 命名空间，参见本地 `CLAUDE.md` §3）

### 3.6 IDE 提示 5 条陷阱（强约束）

参见全局 `~/.claude/CLAUDE.md` §5.1：

| # | 陷阱 | 规避 |
|---|------|------|
| 1 | 删 `@group` / `@see` / `@trigger` / `@defaultValue` / `@example` | 结构性标签**不得删** |
| 2 | JSDoc 单属性多段 | `/** 业务说明 @group X */` 一段合并 |
| 3 | barrel `export type { X } from` 丢失 hover | 用 `export { type X }` + 上方 JSDoc |
| 4 | JSDoc 距 export 太远 | JSDoc **必须紧贴** export 声明 |
| 5 | `@group` 替代业务描述 | 每个字段必须有 1-3 行业务说明，`@group` 仅分组 |

---

## 4. 工作流（3 组顺序处理）

### 4.1 Group 1：全局件（~41 文件）

按依赖关系自下而上：

```
enums/(2) → directives/(6) → plugins/(3) → store/(7) → 
layouts/(9) → components/common/(4) → components/index.ts(1) → 
locales/(3) → App.vue + main.ts(2)
```

每完成一个文件：执行 §5 自检清单。
Group 1 全部完成后：暂停 → 输出 Group 1 变更清单（文件路径 + 行数增量）→ 等待用户 review。

### 4.2 Group 2：业务模块（~36 文件）

```
modules/auth/(4) → modules/user/(4) → modules/home/(22) → 
modules/error/(4) → modules/reports/(2)
```

每完成一个文件：执行 §5 自检清单。
Group 2 全部完成后：暂停 → 输出 Group 2 变更清单 → 等待用户 review。

### 4.3 Group 3：form-schema（73 文件）

按内部目录深度：

```
form-schema/types/ → form-schema/composables/ → 
form-schema/components/ → form-schema/XForm.vue
```

form-schema 是核心：含复杂 `as never` 类型断言、barrel re-export、20+ composable。
每完成一个文件：执行 §5 自检清单（含 §3.6 五条 IDE 提示检查）。
Group 3 全部完成后：暂停 → 输出 Group 3 变更清单 + 全局总览 → 等待用户 review。

### 4.4 收尾

3 组全部完成后输出：
- 全局「变更清单」：每个文件的 +行/-行
- 「手动验证步骤」：`pnpm type-check:full` + 抽查 1-2 个文件的 hover 提示
- 不 commit、不 push（用户手 commit）

---

## 5. 自检清单（每文件完成时）

| # | 检查项 | 期望 |
|---|--------|------|
| 1 | 文件级 JSDoc | 在位，含 @group |
| 2 | export 函数/类/接口 JSDoc | 业务意图 + @param + @returns |
| 3 | 关键 if/switch/try 分支注释 | why 注释（非 what） |
| 4 | 跨 ≥3 文件 @see | 存在 |
| 5 | 风格与 `cache.ts` / `bem.ts` 一致 | 4 层结构 |
| 6 | 无 0 增量注释（"// 这是一个函数"） | 0 处 |
| 7 | 无 new 依赖、无架构变更、无运行时行为变更 | diff 仅有注释增删 |
| 8 | §3.6 IDE 提示 5 条陷阱 | 全过 |
| 9 | AutoImport 标识符来源注释（如使用） | 1 行 40 字内 |
| 10 | BEM 命名空间（如有 .vue） | 严格按本地 `CLAUDE.md` §3 |

---

## 6. 交付物

- 修改的 ~149 个文件（**仅注释**）
- 3 个 Group 末尾的「变更清单 + 手动验证步骤」
- 全局收尾「变更总览 + 手动验证步骤」
- 本设计文档（本文件）作为可追溯凭证
- 后续 `writing-plans` skill 输出的实施计划 `docs/superpowers/plans/2026-09-07-src-comments-finalize.md`

---

## 7. 不在范围（YAGNI）

- 重构任何导出 API 签名
- 拆分超大文件（如 `use-xform-composer.ts` 175 行已知，但**不**在本次拆分）
- 补 unit test / e2e test
- 升级任何依赖
- 重写文档（README / ARCHITECTURE / CHANGELOG）—— 注释补齐后**如需**由 doc-updater 单独评估
- 处理已注释 50 个文件（信任上次 `148d29e` 提交）
- 改 `package.json` / `vite.config.ts` / `tsconfig.*` / `eslint.config.mjs`

---

## 8. 验收标准

全部 ~149 个文件满足以下 3 条即视为"完成"：

1. **覆盖率**：100% 文件级 JSDoc + 100% export JSDoc
2. **正确性**：所有 JSDoc 信息可在 IDE hover 中显示（无 §3.6 陷阱）
3. **可维护性**：删除所有 JSDoc 后，代码仍易读（避免过度注释）

---

## 9. 关联文档

- 全局注释规范：`~/.claude/CLAUDE.md` §五 + `~/.claude/rules/zh/comments.md`
- 项目级规范：本地 `CLAUDE.md` §1.6.1（AutoImport 来源注释）+ §2（src/ Architecture Lockdown）+ §3（BEM 命名空间）
- 注释基线样板：`src/api/cache.ts` / `src/utils/bem.ts` / `src/composables/useAppRouter.ts`（上次提交落库）
- 上次提交：`.git` ref `148d29e docs(api): 为网络基建和业务API模块添加JSDoc注释`
- 上游设计：`docs/superpowers/specs/2026-08-19-form-schema-design.md`（form-schema 架构）

---

*文档版本：v1.0.0 | 生成日期：2026-09-07*
