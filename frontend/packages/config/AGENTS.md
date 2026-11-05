<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# config

## 用途

`@vv/config`——构建装配工厂：以工厂函数家族（create-vite-config / create-vitest-config / app-aliases / vendor-chunks / proxy / scss / server / postcss / version-check-vite 等）为各 app 生成一致的 vite / vitest / tsconfig 装配，app 侧零重复配置。

## 子目录

| Directory | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| `src/`    | 顶层模块 = 一个工厂一个文件，实现与同目录 `.spec.ts` 配对 |

## 依赖

### 内部依赖

- 与 `@vv/shared` 并列互不依赖（并列上游）；被各 app 的 vite.config / vitest 装配消费。

### 外部依赖

- vite / vitest / unocss / unplugin 系 / sass / postcss 等全部 peerDependencies + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 新增工厂能力 = 新增顶层模块 + 经 `src/index.ts` barrel 导出 + 带 `.spec.ts`；`scripts/check-doc-currency.ts` 锁定本包顶层模块数，新增须同步该门禁预期值。
- `src/app-aliases.ts` 是别名单一事实源（vite / tsconfig / check-aliases 三处消费）——改别名后跑 `pnpm generate:tsconfig-paths` + `pnpm check:aliases`。
- AutoImport 注入清单在 `src/create-vite-config.ts` 的 `AutoImport.imports`——新增注入标识符只改这里（apps 侧重启 dev server 生效）。

### 测试要求

- `pnpm -C packages/config test` / `pnpm -C packages/config type-check`。

### 常见模式

- 一个工厂一个顶层文件、实现与 spec 同目录配对；app 差异经工厂参数注入。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
