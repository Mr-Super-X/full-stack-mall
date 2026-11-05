<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# ui

## 用途

`@vv/ui`——组件库：三个自动注册目录（`components/common` 基础组件、`components/ProTable`、`components/form-schema` 即 XForm）+ 命令式 composables（useDialog / useConfirm / useLogout）+ 全局组件装配。

## 子目录

| Directory                   | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `src/components/`           | common / ProTable / form-schema 三目录，app 侧按目录自动全局注册 |
| `src/composables/`          | useDialog / useConfirm / useLogout（命令式弹窗与登出）           |
| `src/assets/`、`src/types/` | 组件样式资源与公共类型                                           |

## 依赖

### 内部依赖

- `@vv/shared`（唯一上游）。

### 外部依赖

- element-plus / echarts / vxe-table / @wangeditor / dompurify / sortablejs 等 peerDependencies + catalog。

## 给 AI 代理的规则

### 在本目录工作

- 新组件放入三自动注册目录之一即在 app 侧全局可用——消费方模板直接使用、不写 import（唯一例外：`InstanceType<typeof Xxx>` ref 类型声明需显式 import）。
- 生产源码一律显式 import（含 ElMessage 样式副作用）；存量注入式源码与 `src/types/auto-globals.d.ts` 暂保留，收敛为独立批次。
- form-schema（XForm）受 docs/25 架构文档与 check-doc-currency 硬数据锁定——改其字段数 / composable 数 / spec 数须同步门禁预期值。

### 测试要求

- `pnpm -C packages/ui test` / `type-check`；新组件 / composable 必须带 `.spec.ts`。

### 常见模式

- 组件对外方法经 `defineExpose` 收敛；「初始化一次性读取」的第三方组件 prop（如 wangEditor config）必须在 JSDoc 标注运行时不响应。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
