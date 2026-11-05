<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# portal

## 用途

`@vv-app/portal`——门户企业官网（端口 5176）：对外官网站点，同时是整页跳转协议的根路径落点（`/` → 302 `/portal/`，见 deploy 网关模板与 docs/41）。

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
- 根路径落点语义由 dev 网关（`scripts/node-gateway.ts`）与生产网关（`deploy/nginx.prod.conf.template`）双侧锁定——改落点须三处同步（双侧网关 + 本端路由）。
- 官网内容为对外门面，文案与结构变更遵循 docs/41 站点说明。

### 测试要求

- `pnpm -C apps/portal test` / `type-check:full`；跨端漫游有 e2e 锁定（`tests/e2e/gateway/cross-app-roaming.spec.ts`）。

### 常见模式

- 官网站点以内容展示为主，不承载需登录的业务页面（业务入口整页跳转到对应端）。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
