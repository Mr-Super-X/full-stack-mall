<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# mock

## 用途

`@vv/mock`——mock 数据源：按业务域划分的 mock 模块（auth / dict / menu / user / stream / pro-table 等）+ `mockProdServer.ts` 生产环境手动接线；dev 由 vite-plugin-mock 扫描，生产由 createProdMockServer 装配。

## 子目录

| Directory | Purpose                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| `src/`    | 一个业务域一个 mock 文件 + 共享 `_utils.ts` + `mockProdServer.ts` 生产接线 + `pro-table/` 子域 |

## 依赖

### 内部依赖

- 仅以 `import type` 消费 `@vv/shared` 契约类型（编译期擦除，无运行时依赖）——方向铁律 mock → shared。

### 外部依赖

- vue / element-plus / axios / lodash-es / vue-router / pinia 等 peerDependencies + catalog（类型对齐用）。

## 给 AI 代理的规则

### 在本目录工作

- `mockProdServer.ts` 手动 import 注册：新增 / 删除 mock 文件必须三处同步（import 语句 / 注册数组 / 注释）——漏同步 dev 测试发现不了，靠 `type-check:full` 兜底。
- 生产 mock 须由消费方 main.ts 以 `import.meta.env.PROD` 守卫装配，防 dev 双重劫持。
- 消费方经 `@mock` 别名引用（barrel 刻意不聚合 mock 的既定例外）。

### 测试要求

- `pnpm -C packages/mock type-check`；双接线一致性由根 `pnpm check:mock-wiring` 校验。

### 常见模式

- mock 模块遵循 vite-plugin-mock 的 MockMethod 契约；流式场景见 `stream.ts`（规范在 docs/13）。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
