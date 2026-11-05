<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# packages

## 用途

4 个共享包，承载 workspace 的全部可复用能力：构建装配工厂、运行时共享层、mock 数据源、UI 组件库。包间遵守单向依赖铁律 `config ∥ shared（并列上游）→ mock → ui`，任何包禁止依赖 `apps/*`。

## 子目录

| Directory | Purpose                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/` | `@vv/config`——构建装配工厂：create-vite-config / create-vitest-config / app-aliases / app-manifest / vendor-chunks / proxy / scss / server / postcss / version-check-vite 等顶层模块 |
| `shared/` | `@vv/shared`——运行时共享层：api / auth / composables / directives / enums / locales / plugins / router / router-guards / store / app-bootstrap / app-mount 等                        |
| `mock/`   | `@vv/mock`——mock 数据源（auth / credentials / dict / menu / user / stream / pro-table）+ mockProdServer 生产接线；仅以 import type 消费 @vv/shared 契约类型                          |
| `ui/`     | `@vv/ui`——组件库：components/common + components/ProTable + components/form-schema 三自动注册目录、composables（useDialog / useConfirm / useLogout）、global-components              |

## 依赖

### 内部依赖

- 方向铁律：`mock → shared`（仅 import type，编译期擦除）、`ui → shared`、`config` 与 `shared` 并列互不依赖；上游禁止反向依赖下游。
- 消费方（apps/*）一律经包名 barrel（`@vv/shared`、`@vv/ui`）引用；别名深层路径（`@utils/*` / `@store/*` 等）是过渡态遗留，新代码禁止新增。

### 外部依赖

- 运行时依赖（vue / element-plus / pinia / echarts / vxe-table / @wangeditor 等）一律 peerDependencies + catalog，版本以 `pnpm-workspace.yaml` catalog 为唯一事实源。
- 每个包消费的每个 npm 包必须声明在自身 package.json——本地规则 `local/package-contract`（error 级，`pnpm lint` + CI）机械兜底。

## 给 AI 代理的规则

### 在本目录工作

- 生产源码一律显式 import（含 vue / pinia 高频 API 与 ElMessage 样式副作用）——AutoImport 隐式注入只停留在 apps/* 宿主，包源码必须可脱离宿主转换独立运行。
- 禁止 import 任何 `apps/*` 路径（ESLint `app/boundary-packages` error 级拦截）。
- 新增对外能力经包根 barrel（index.ts）导出收敛公共 API，不让消费方直达包内部文件路径。

### 测试要求

- `pnpm -C packages/<p> test` / `pnpm -C packages/<p> type-check`；新增 composable / store / 类型必须带 `.spec.ts`（覆盖率 ≥ 80%，根 AGENTS.md「项目约束」第 6 条）。

### 常见模式

- 包导出形态：`exports` 含 `.` 与 `./*`（ui 额外显式暴露 useDialog / useConfirm / useLogout 子路径）。
- @vv/ui 组件三目录（common / ProTable / form-schema）经 unplugin-vue-components 在 app 侧自动注册，消费方模板中直接使用、不写 import。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
