<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# h5

## 用途

`@vv-app/h5`——移动端 H5 端（端口 5177）：vant 技术栈（不使用 element-plus）+ rem 适配方案（设计与决策见 docs/34、docs/37）。

## 子目录

| Directory | Purpose                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `src/`    | 标准端骨架（含 layouts / plugins）——一级目录增删属架构锁定事件，须经用户批准 |

## 依赖

### 内部依赖

- `@vv/shared` / `@vv/ui` / `@vv/mock`（与其他端一致）；禁止依赖其他 apps/*。

### 外部依赖

- vant + vue / vue-router / pinia——本端无 element-plus 依赖，peer + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 通用工作规则（模块边界 / 业务封装 / AutoImport / BEM / 架构锁定）见 `../AGENTS.md` 与根 AGENTS.md，本文件不重复。
- UI 组件只用 vant，禁止为补组件缺口引入 element-plus（技术栈隔离是本端存在的意义）。
- 适配只走 rem（postcss-pxtorem 装配），不引入第二套 vw / scale 方案（docs/37 决策记录）。

### 测试要求

- `pnpm -C apps/h5 test` / `type-check:full`；rem 激活有 e2e 锁定（`tests/e2e/h5/rem-activation.spec.ts`）。

### 常见模式

- 移动端交互（touch / 安全区）优先用 vant 既有能力，不手写手势逻辑。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
