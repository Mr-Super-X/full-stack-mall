<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# docs

## 用途

`@vv-app/docs`——组件示例与文档站点（端口 5175）：@vv/ui 组件能力的交互式 demo 集合与使用指引，是组件变更的对照验收端。

## 子目录

| Directory | Purpose                                                                           |
| --------- | --------------------------------------------------------------------------------- |
| `src/`    | 端骨架（无 layouts 目录，与其他端不同）——一级目录增删属架构锁定事件，须经用户批准 |

## 依赖

### 内部依赖

- `@vv/shared` / `@vv/ui` / `@vv/mock`（与其他端一致）；禁止依赖其他 apps/*。

### 外部依赖

- element-plus / echarts / highlight.js / dompurify / lodash-es / dayjs / zod（依赖面全端最全，覆盖组件演示所需），peer + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 通用工作规则（模块边界 / 业务封装 / AutoImport / BEM / 架构锁定）见 `../AGENTS.md` 与根 AGENTS.md，本文件不重复。
- 新增 demo 遵循 docs/09 开发指引与既定 demo 范式（文档布局 / 演示框架 / API 表格等既有约定），缺一不可。
- demo 路由命名以组件名为准（XForm 前缀不拆词，如 XFormBase → `/demo/xform-base`）。

### 测试要求

- `pnpm -C apps/docs test` / `type-check:full`；ProTable 查询与批量选择有 e2e 锁定（`tests/e2e/docs/`）。

### 常见模式

- demo 页展示组件真实用法而非桩数据；`src/modules/demo/` 是跨目录深相对路径禁令的豁免区（项目约束第 9 条）。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
