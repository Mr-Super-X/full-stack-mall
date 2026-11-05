<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# tests

## 用途

Playwright E2E 测试层：跨 app 冒烟与关键能力验证（admin 首页与工作台面板、big 大屏 scale 布局、docs 站 ProTable 查询与批量选择、gateway 跨应用漫游、h5 rem 激活），从真实浏览器口径守护多应用拓扑。

## 子目录

| Directory      | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| `e2e/admin/`   | admin 端冒烟（hello、workbench-panels）                           |
| `e2e/big/`     | big 大屏布局（layout-scale）                                      |
| `e2e/docs/`    | docs 站组件示例（protable-search-list、protable-selection-batch） |
| `e2e/gateway/` | 同域网关跨应用漫游（cross-app-roaming）                           |
| `e2e/h5/`      | h5 端 rem 适配激活（rem-activation）                              |

## 依赖

### 内部依赖

- 根 `playwright.config.ts`：测试运行配置；被测对象是各 app dev 服务器或 `pnpm dev:gateway` 的同域网关拓扑。

### 外部依赖

- `@playwright/test`（catalog 版本）；chromium 浏览器二进制（`pnpm test:e2e:install` 安装）。

## 给 AI 代理的规则

### 在本目录工作

- 新增用例按目标 app 归入对应 `e2e/<app>/` 子目录；网关行为用例放 `e2e/gateway/`。
- 断言优先确定性等待（元素状态 / URL），避免裸 `waitForTimeout`。

### 测试要求

- 运行：`pnpm test:e2e`；首次执行前先 `pnpm test:e2e:install`。
- gateway 用例依赖 `pnpm dev:gateway` 拓扑（网关 :8080 + 6 app 带 base）。

### 常见模式

- 用例文件命名 `<能力点>.spec.ts`，与被测能力一一对应。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
