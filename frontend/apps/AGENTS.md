<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# apps

## 用途

6 个可独立构建、独立部署的端应用（showroom apps），包名统一 `@vv-app/*`，由 pnpm workspace + turbo 编排。每个 app 携带 `app.manifest.json`（name / port / requiredRoutes 三字段），是端口与必备路由的单一事实源，被 `scripts/apps-registry.mjs`、check-routes、dev-gateway 等工程脚本消费。

## 子目录

| Directory | Purpose                                                         |
| --------- | --------------------------------------------------------------- |
| `admin/`  | 主管理端（企业中后台主应用），端口 5174                         |
| `auth/`   | 统一认证端（登录页，requiredRoutes 含 Login），端口 5179        |
| `big/`    | 数据大屏端（scale 适配，见 docs/35、docs/38），端口 5178        |
| `docs/`   | 组件示例与文档站点（见 docs/09），端口 5175                     |
| `h5/`     | 移动端 H5（rem 适配 + vant，见 docs/34、docs/37），端口 5177    |
| `portal/` | 门户企业官网（整页跳转协议的根路径落点，见 docs/41），端口 5176 |

## 依赖

### 内部依赖

- 全部 6 个 app 依赖 `@vv/shared`（运行时共享层）、`@vv/ui`（组件库）、`@vv/mock`（mock 数据源）。
- `apps/*` 之间禁止互相依赖——跨 app 通信走整页跳转协议（见 docs/43 §统一登录协议）。

### 外部依赖

- 运行时依赖经 peerDependencies + catalog（`pnpm-workspace.yaml` 单一版本源）消费：vue（精确钉版 3.6.0-beta.17）、element-plus、pinia、vue-router、vue-i18n、vxe-table、echarts 等；h5 额外使用 vant。

## 给 AI 代理的规则

### 在本目录工作

- 架构锁定（根 AGENTS.md「工作区架构锁定」）：未经用户明确批准，严禁新增 / 删除 / 重命名 / 移动任何 app；新增 app 一律走 `pnpm new-app`。
- 模块边界：`src/modules/<m>` 模块之间禁止互 import，模块间通信走 `modules/<m>/index.ts` 对外接口。
- 业务代码强制封装：路由用 `useAppRouter`、请求用 `useRequest`、权限用 `useAuth`、弹窗用 `useDialog` / `useConfirm`（前两条由 ESLint error 级机械拦截）。
- AutoImport：vue / vue-router / pinia 高频 API 与项目已注入 composables 不写显式 import；全局组件（@vv/ui 三目录与各 app `src/components/`）模板中直接使用。
- 样式：`.vue` 遵循 BEM 规范（`createNamespace` + 非 scoped scss，见根 AGENTS.md「BEM 编写规范」与 docs/49 样式分层）。

### 测试要求

- 单测：`pnpm -C apps/<a> test [path]`；全量类型校验：`pnpm -C apps/<a> type-check:full`。
- E2E：根目录 `tests/e2e/`（Playwright），跨 app 冒烟不经各 app 自测。

### 常见模式

- 每个 app 的入口装配（bootstrap / mount / router / store）来自 `@vv/shared` 工厂，app 内只写业务差异。
- 端口修改必须同步 `app.manifest.json` 与 `scripts/apps-registry.mjs`（check:routes 双写锁死校验）。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
