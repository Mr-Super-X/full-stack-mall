<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# shared

## 用途

`@vv/shared`——运行时共享层：app 装配（app-bootstrap / app-mount / app-router）、http 请求层、auth、composables、directives、enums、locales、plugins、router-guards、store 等跨端复用能力的唯一来源。

## 子目录

| Directory | Purpose                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/`    | 按能力域分目录（api / auth / composables / directives / enums / locales / plugins / router / router-guards / store …）+ 装配顶层模块 |

## 依赖

### 内部依赖

- 与 `@vv/config` 并列互不依赖；下游：`@vv/mock`（仅 import type）、`@vv/ui`、全部 apps/*。

### 外部依赖

- vue / vue-router / pinia / axios / vue-i18n / element-plus / lodash-es / dayjs / zod 等 peerDependencies + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 生产源码一律显式 import（含 vue / pinia 高频 API 与 ElMessage 样式副作用），不依赖 AutoImport。
- 根 barrel（`src/index.ts`）刻意不聚合 `./api`（加载即建 axios 实例）、`./directives`（glob 注册副作用）、`./locales`（createI18n 副作用）——此三类消费走 `@api` / `@directives` / `@locales` 别名既定例外。
- 全局 store barrel 仅 5 个跨模块共享 store（app / user / theme / tags-view / dict）；useRouterStore 不在 barrel（由 router-guards 内部消费）。
- 新增对外能力经根 barrel 导出收敛，不让消费方直达包内部路径。

### 测试要求

- `pnpm -C packages/shared test` / `type-check`；新增 composable / store / 类型必须带 `.spec.ts`。

### 常见模式

- 装配函数（app-bootstrap / app-mount）由 app 的 main.ts 调用一次；领域能力以 composable / store 形态导出。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
