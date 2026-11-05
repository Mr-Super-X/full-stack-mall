<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# scripts

## 用途

仓库工程脚本层：CI 门禁校验（check-routes / check-aliases / check-doc-currency / check-mock-wiring）、开发网关与生产网关（dev-gateway / node-gateway）、脚手架（new-app / new-module / remove-module）、聚合与生产构建（build-pages / build-prod）、类型声明与 tsconfig paths 生成（generate-declarations / generate-tsconfig-paths）、提交信息检查（check-commit-msg.sh / commitlint-formatter）。TS 脚本经 `node --experimental-strip-types` 直接执行，入口统一注册在根 package.json scripts。

## 子目录

| Directory       | Purpose                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `templates/`    | 脚手架模板（`app/`——new-app 生成新应用的骨架来源）                                                                       |
| `eslint-rules/` | 本地 ESLint 规则：`package-contract`（强制 packages/* 消费的 npm 包声明在自身 package.json，含 @vv/* 方向检查）及其 spec |

## 依赖

### 内部依赖

- `apps-registry.mjs` 是 app 清单（名称 / 端口）的单一事实源，被 `eslint.config.mjs`、dev-gateway、check-routes、new-module 等多处消费——改动它必须过 `pnpm check:routes`。
- 根 package.json scripts 注册全部入口（`check:*` / `new-*` / `remove-module` / `build:*` / `generate:*` / `test:check-scripts` / `test:gateway` 等）。

### 外部依赖

- Node `>=22.18` 的 `--experimental-strip-types` 能力（TS 直跑）；`node --test` 运行 `*.spec.ts`。

## 给 AI 代理的规则

### 在本目录工作

- 新增 CI 门禁须在 ci.yml 注释声明其保护的事故史；连续两个审查周期零拦截且保护面被上游覆盖的门禁列入退役评估（根 AGENTS.md「治理退役准则」）。
- check-* 门禁多带配套 `.spec.ts`——修改门禁逻辑必须同步 spec 并跑 `pnpm test:check-scripts`。
- 新建业务模块 / 应用优先用脚手架（`pnpm new-module` / `pnpm new-app`），不手写骨架文件。

### 测试要求

- `pnpm test:check-scripts`（check-* 系列 spec）、`pnpm test:gateway`（网关 spec）、单文件：`node --test --experimental-strip-types scripts/<name>.spec.ts`。

### 常见模式

- 实现与测试同目录（`xxx.ts` + `xxx.spec.ts`）；共享常量集中放 `apps-registry.mjs` 等 `.mjs` 文件供 TS / ESLint 配置双侧消费。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
