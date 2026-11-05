<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# auth

## 用途

`@vv-app/auth`——统一认证端（端口 5179）：登录页与统一登录协议落点，6 端共享的认证入口（requiredRoutes：Login / NotFound）。

## 子目录

| Directory | Purpose                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `src/`    | 标准端骨架（含 layouts / plugins）——一级目录增删属架构锁定事件，须经用户批准 |

## 依赖

### 内部依赖

- `@vv/shared` / `@vv/ui` / `@vv/mock`（与其他端一致）；禁止依赖其他 apps/*。

### 外部依赖

- element-plus 技术栈（vue / vue-router / pinia / vue-i18n），peer + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 通用工作规则（模块边界 / 业务封装 / AutoImport / BEM / 架构锁定）见 `../AGENTS.md` 与根 AGENTS.md，本文件不重复。
- 跨 app 登录态走整页跳转协议（见 docs/43 §统一登录协议）；凭证为 httpOnly cookie——前端不可读写 token，禁止在 localStorage 存凭证。
- 公开访问路由只能按 name 加入白名单常量（改 `meta` 字段无效）。

### 测试要求

- `pnpm -C apps/auth test` / `pnpm -C apps/auth type-check:full`。

### 常见模式

- 登录成功后按协议整页跳转目标端，不做端内路由嵌套承载其他端页面。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
