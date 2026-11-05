<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# big

## 用途

`@vv-app/big`——数据大屏端（端口 5178）：可视化大屏展示，采用 scale 整体缩放适配方案（设计与决策见 docs/35、docs/38）。

## 子目录

| Directory | Purpose                                                                           |
| --------- | --------------------------------------------------------------------------------- |
| `src/`    | 端骨架（无 plugins 目录，与其他端不同）——一级目录增删属架构锁定事件，须经用户批准 |

## 依赖

### 内部依赖

- `@vv/shared` / `@vv/ui` / `@vv/mock`（与其他端一致）；禁止依赖其他 apps/*。

### 外部依赖

- echarts（大屏图表主力）+ vue / vue-router / pinia，peer + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 通用工作规则（模块边界 / 业务封装 / AutoImport / BEM / 架构锁定）见 `../AGENTS.md` 与根 AGENTS.md，本文件不重复。
- 布局适配只走 scale 方案（docs/38 决策记录），不引入 rem / vw 第二套适配。
- 跨组件大屏状态经 `layouts/big/config` 暴露的 inject/provide 契约传递（模块边界铁律的合法跨层通道）。

### 测试要求

- `pnpm -C apps/big test` / `type-check:full`；scale 布局有 e2e 锁定（`tests/e2e/big/layout-scale.spec.ts`）。

### 常见模式

- 图表组件经 @vv/ui 的 BaseChart 封装使用，不直接操作 echarts 实例生命周期。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
