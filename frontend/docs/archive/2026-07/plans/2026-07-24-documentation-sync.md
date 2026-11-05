# 文档与当前代码同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 README 与当前路由、首页模块、Mock、脚本和环境配置说明同步，并保留历史设计/实施计划的时间快照。

**Architecture:** 以 `package.json`、`src/router/`、`src/modules/`、`mock/` 和当前配置为事实来源，只修改面向当前使用者的 README 与 docs 规范/指引。`docs/superpowers/plans/` 和 `docs/superpowers/specs/` 作为历史记录保留，不把已执行前的路径改写成当前路径。

**Tech Stack:** Markdown、Vue 3、Vite 8、TypeScript 6、Vue Router 5、vite-plugin-mock、pnpm。

---

### Task 1: 固化文档差异清单

**Files:**

- Read: `README.md`
- Read: `docs/03-Git工作流工具链.md`
- Read: `docs/04-构建与测试工具.md`
- Read: `docs/07-路由模块设计.md`
- Read: `docs/10-新手指引.md`
- Read: `package.json`
- Read: `src/router/config.ts`
- Read: `src/router/types.ts`
- Read: `src/modules/home/routes/index.ts`
- Read: `mock/menu.ts`
- Read: `mock/portal-overview.ts`
- Read: `vite.config.ts`

- [ ] 确认当前事实：业务首页为 `Home`、路径 `/home`、模块目录 `src/modules/home/`；首页请求的实际 Mock 接口为 `/api/portal/overview`（业务 API 代码传 `/portal/overview`，由 `VITE_API_BASE_URL=/api` 拼接）；远程菜单由 `mock/menu.ts` 提供 `Home`；开发环境由 `vite.config.ts` 按 `NODE_ENV !== 'production'` 启用 mock；菜单默认 `remote`，`pnpm dev:local` 才切换为 `local`。
- [ ] 将明确过时项限定为当前说明：`README.md` Mock 表中的 `dashboard`、README 中不存在于当前代码的 `VITE_USE_MOCK` 操作说明、`docs/03` 的 scope 示例、`docs/04` 的 dashboard 状态树、`docs/10` 的 VITE_USE_MOCK 验证项。
- [ ] 将 `docs/superpowers/plans/` 与 `docs/superpowers/specs/` 中的旧路径标记为历史快照，不改写其实施前内容。

### Task 2: 更新 README 当前使用说明

**Files:**

- Modify: `README.md:316-330`（Mock 数据说明）
- Modify: `README.md:523-533`（环境变量说明）

- [ ] 将 Mock 表改为 `auth`、`user`、`menu`、`portal-overview` 四类当前接口；首页接口写为 `/portal/overview`，菜单接口写为 `/api/menu`。
- [ ] 删除“通过 `VITE_USE_MOCK` 切换 Mock”的操作说明，因为当前 `vite.config.ts` 没有读取该变量；改为说明开发/预览构建的实际启用边界，并保留 `VITE_API_BASE_URL` 的真实后端配置说明。
- [ ] 环境变量表只保留当前代码读取或路由配置读取的变量：`VITE_APP_TITLE`、`VITE_API_BASE_URL`、`VITE_MENU_SOURCE`、`VITE_HISTORY_MODE`、`VITE_BASE`、`VITE_STORAGE_NAMESPACE`；默认值与 `src/router/config.ts` 和 `src/api/http.ts` 对齐。

### Task 3: 更新当前规范文档并验证

**Files:**

- Modify: `docs/03-Git工作流工具链.md:296-302`
- Modify: `docs/04-构建与测试工具.md:488-497`
- Modify: `docs/10-新手指引.md:237-265`
- Modify: `CHANGELOG.md` 的 `Unreleased` 文档变更区

- [ ] 将 commit scope 示例中的 `dashboard` 改为 `home`，与 `.cz-config.json` 当前 scope 对齐。
- [ ] 将状态管理架构示例中的 `modules/dashboard/store/` 改为 `modules/home/store/`。
- [ ] 删除新手指引中验证 `VITE_USE_MOCK` 的失效步骤，改为验证 `pnpm dev` 的 `remote` 菜单与 `pnpm dev:local` 的 `local` 菜单；保留“Mock 仅开发环境生效”的真实说明。
- [ ] 在 `CHANGELOG.md` 的 `Unreleased` 中记录本次文档同步，不修改已发布历史条目。
- [ ] 运行 `pnpm type-check`、`pnpm test`、`pnpm check:routes`，并用检索确认当前说明中不再出现面向使用者的 `dashboard`、`/api/dashboard/stats` 或 `VITE_USE_MOCK` 旧说明；历史计划/设计文档中的旧路径应单独保留并在总结中说明。
- [ ] 运行 `git diff --check` 和 `git diff`，确认只包含文档、计划文件和 CHANGELOG 的预期变更。
