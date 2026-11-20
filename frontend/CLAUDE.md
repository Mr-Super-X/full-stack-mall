@AGENTS.md

# CLAUDE.md

> 本文件只保留 Claude Code 专属流程和 `AGENTS.md` 未展开的项目细则。团队通用标准以 `AGENTS.md` 为准；跨项目个人规则由 `~/.claude/CLAUDE.md` 承载，不在此重复。规则冲突时以项目文件为准。

<!-- 历史引用：§4 #16 = AGENTS.md「项目约束」第 11 条；§1.4 =「架构不变量」第 4 条；Commands / §5 分别对应「常用命令」/「专题文档速查」。 -->

## Claude 专属

### 工作区变更流程

涉及 `AGENTS.md`「工作区架构锁定」所列操作，且不属于“用户明确指定目标文件”的例外时，先输出以下申请（≤10 行）并等待单独批准：

```markdown
【workspace 修改申请】<方案名>

- 操作类型：[新增 app / 新增包 / 删除 / 重命名 / 移动 / 改职责 / 改依赖方向]
- 目标路径：apps|packages|scripts/xxx（可多行）
- 原因：[业务原因，≤2 句]
- 影响面：[影响哪些 app/包/调用方/路由/类型/turbo 拓扑]
- 备选：[是否考虑过其他归属，引用 docs/43 / docs/18 §2 决策矩阵]
- 回退：[如何恢复，是否需要备份]
```

任务完成后，以表格列出本次对 workspace 的全部写操作（含 `apps/*` / `packages/*` / `scripts/` / 根配置），无清单视为未完成：

| 文件路径 | 操作（新增/修改/删除） | 原功能/原状 | 本次变更 |
| -------- | ---------------------- | ----------- | -------- |
| 逐行登记 |                        |             |          |

涉及 `.vue` 文件时，另附 BEM 核查清单，逐项核对 `AGENTS.md`「BEM 编写规范」；`pnpm lint` / `pnpm type-check:full` 未覆盖的条款以人工核查为准。

## 项目实现细则

### 模块与状态

- 在 `AGENTS.md` 模块边界基础上，`modules/<m>/views` 只可复用本模块 components / composables / utils / api，以及 `layouts/<m>/config` 暴露的跨层类型契约；本模块 components 可引用 views / composables / utils，store 可引用 api / types。
- `layouts/<m>/` 只引用本布局的 components / config / images / styles 与 utils / enums / types / store/modules / composables，禁止引用 `@/components/` 和其他布局；`directives/`、`plugins/` 只引用 utils / enums / types / store/modules。
- `user` 使用 httpOnly cookie；`Session.get('auth')` 仅为守卫同步判断的登录标记，禁止把 token 写入 localStorage。`useRouterStore` 只供 `router/guards/remote-menu.ts` 内部消费，不进全局 barrel。

### 业务封装语义

- `useDialog` 取消时 reject `DialogCancelledError`；`useConfirm` 取消时 resolve `false`，调用方无须 try/catch。

### AutoImport、别名与组件注册

- 注入清单以各 app 的 `src/types/auto-imports.d.ts` 生成产物为准；新增注入标识符只改 `packages/config/src/create-vite-config.ts` 的 `AutoImport.imports`，并重启 dev server。
- 未注入的第三方图标、工具、类型与 SCSS 资源仍需显式 import；不在自动注册 dirs 内的组件也需显式 import。`useTheme` 从 `@vv/shared` 显式导入。
- app 自身 src 使用 `@/`；`@vv/shared` 走根 barrel；`@vv/ui` composables 走包名路径或 AutoImport；`@components/*` 已收敛至 `@vv/ui/components/**` 显式文件路径。
- `@api` / `@locales` / `@directives` / `@mock` 保留别名消费；`packages/shared/src/index.ts` 刻意不聚合 api（axios 实例）、directives（glob 注册）和 locales（createI18n 副作用）。
- 同一 barrel 消费多个导出时，用单点 `vi.mock()` + `importOriginal` 展开覆盖，避免重复声明相互覆盖。
- 存量深层别名按热点批次收敛，每批通过 `pnpm type-check`、`pnpm check:aliases`、`pnpm test`；保留 `packages/config/src/app-aliases.ts` 的别名定义。
- `packages/ui` 存量注入式源码与 `src/types/auto-globals.d.ts` 暂保留；新代码仍须遵守 `packages/*` 显式 import 约定。
- `apps/<a>/src/types/components.d.ts` 是 dev / build 生成的 gitignore 产物，不手工维护。
