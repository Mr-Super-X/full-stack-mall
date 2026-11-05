<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# admin

## 用途

`@vv-app/admin`——主管理端（端口 5174）：企业中后台主应用，承载工作台、系统管理与业务能力主展示；同时是工程度量端——独有 `test:coverage` / `test:ui` / `bench` 脚本，根 `analyze`（bundle 分析）亦指向本端。

## 子目录

| Directory | Purpose                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`    | 标准端骨架（App.vue / main.ts / layouts / modules / plugins / router / store / styles / types / views）——一级目录增删属架构锁定事件，须经用户批准 |

## 依赖

### 内部依赖

- `@vv/shared` / `@vv/ui` / `@vv/mock`（与其他端一致）；禁止依赖其他 apps/*。

### 外部依赖

- element-plus 技术栈（vue / vue-router / pinia / vue-i18n / zod），peer + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 通用工作规则（模块边界 / 业务封装 / AutoImport / BEM / 架构锁定）见 `../AGENTS.md` 与根 AGENTS.md，本文件不重复。
- `app.manifest.json` 的 requiredRoutes（Forbidden / NotFound / ServerError）变更须经 `pnpm check:routes` 校验。
- 新增业务模块一律 `pnpm new-module <kebab-name>` 生成骨架。

### 测试要求

- `pnpm -C apps/admin test`；覆盖率 `pnpm -C apps/admin test:coverage`；基准 `pnpm bench`。

### 常见模式

- 工作台面板有 e2e 锁定（`tests/e2e/admin/workbench-panels.spec.ts`）——改工作台布局先跑该用例。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
