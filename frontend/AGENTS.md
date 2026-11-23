# AGENTS.md

> 本文件收录对本仓库任何 AI 编码工具与协作者都成立的工程标准——只写长期为真的常量，一律以祈使句表述。
> 目录结构与文件清单以 codegraph 索引为准，本文件不重复；Claude Code 通过根目录 `CLAUDE.md` 的 `@AGENTS.md` 导入本文件。

## 项目环境与命令

- 本仓库用 pnpm workspace 和 Turbo 管理 Vue 3 / TypeScript / Vite 前端应用。用 pnpm 安装和执行脚本。运行环境和脚本查根 `package.json`，发布版本同时查 Git tag，依赖钉版查 `pnpm-workspace.yaml`，Vue 稳定线计划见 docs/45。
- 开发优先 `pnpm dev:gateway`，避免并行启动共享 mock 的竞态（见 docs/43 §9.3）。单应用用 `pnpm -C apps/<a> dev`，本地菜单模式用 `dev:local`。
- 验证常用 `pnpm lint`、`pnpm test`、`pnpm type-check`、`pnpm build`。后三项由 Turbo 运行声明了相应脚本的 workspace 项目。单应用全量类型检查用 `pnpm -C apps/<a> type-check:full`，单文件单测例如 `pnpm -C packages/shared test src/utils/dayjs.spec.ts`。
- 新建业务模块必须用 `pnpm new-module <kebab-name>`，执行时写入脚手架。移除用 `pnpm remove-module <kebab-name>`，默认先预览再确认。其他命令查根 `package.json`，CI 门禁查 `.github/workflows/ci.yml`。

## 架构不变量

- 遵守 workspace 依赖方向铁律：`apps/*` 可依赖 `packages/*`；`apps/*` 之间禁止互相依赖（跨 app 通信走整页跳转协议，见 docs/43）；包内依赖按消费方向为 `ui → shared`、`mock → shared`（mock 仅消费类型），config 与其他 workspace 包独立；`packages/*` 禁止依赖 `apps/*`；运行时依赖（vue / element-plus 等）一律 peerDependencies + catalog。
- app 内模块间依赖只经目标模块的 `modules/<m>/index.ts`，禁止深入其内部。公共组件、布局、全局 store、指令及插件禁止反向引用业务模块。
- 使用 Pinia Setup Store。跨应用共享状态经 `@vv/shared` 的 store 出口，应用级共享状态留在本应用，模块私有状态归 `modules/<m>/store/`（见 docs/18 §7）。持久化用 `pick` 白名单，tags-view 保持不持久化，网络请求中间态留在请求层。
- 给每个异步组件提供 Loading / Error / Empty 三态：用 `useRequest` 包数据、用 `<AsyncState>` 包渲染。
- `modules/<m>/views` 复用本模块 components / composables / utils / API、共享包公开能力和既定 API 别名，以及 `layouts/<m>/config` 暴露的跨层类型契约；本模块 components 可引用 views / composables / utils，store 可引用 api / types。
- `layouts/<m>/` 只引用本布局资源、共享包公开能力和应用公共能力（utils / enums / types / store/modules / composables），禁止引用 `@/components/` 和其他布局；`directives/`、`plugins/` 只引用 utils / enums / types / store/modules。
- `user` 使用 httpOnly cookie；`Session.get('auth')` 仅为守卫同步判断的登录标记，禁止把 token 写入 localStorage。`useRouterStore` 是 admin 私有路由状态，通过本地模块访问，不进全局 barrel。

## 业务代码强制封装

- 业务路由跳转、参数与返回用 `useAppRouter`，禁止直引 `vue-router` 的 `useRouter`。
- 网络请求一律用 `useRequest`，禁止直接 import axios。
- 权限判断一律用 `useAuth`（`hasPerm` / `hasAnyPerm`）。
- 命令式弹窗一律用 `useDialog`；二次确认一律用 `useConfirm`。
- 查 `eslint.config.mjs` 中的导入限制和 `local/prefer-wrapped-component` 提示。
- `useDialog` 取消时 reject `DialogCancelledError`；`useConfirm` 取消时 resolve `false`，取消无需捕获异常，其他错误仍会抛出。

## AutoImport 与组件注册

- app 的 `<script setup>` 使用 Vite 已注入的 API，其他标识符显式导入（如从 `@vv/shared` 导入 `useTheme`）。新增注入改 `packages/config/src/create-vite-config.ts` 的 `AutoImport.imports`，重启 dev server，以生成的 `src/types/auto-imports.d.ts` 核对。给不常见的注入标识符首次使用处加来源注释（≤40 字）。
- 包内新生产源码显式导入依赖，包括 Vue / Pinia API 和 ElMessage 样式副作用。每个 npm 依赖声明在消费包的 `package.json`，由 `local/package-contract` 校验。保留 `packages/ui` 存量注入源码与 `src/types/auto-globals.d.ts` 的兼容机制。
- app 内用 `@/`，跨包经 `@vv/shared` / `@vv/ui` 的公开出口。新代码禁止用 `@utils/*` / `@store/*` / `@components/*` 等别名直达包内部。`@api` / `@locales` / `@directives` / `@mock` 保留；存量迁移保留 alias 定义，并通过 type-check、check:aliases 和 test。
- 在 Vite 自动注册范围内的组件直接用于模板，只有声明 `InstanceType<typeof Xxx>` 的 ref 类型时才显式导入。注册目录查 `create-vite-config.ts`，生成的 `src/types/components.d.ts` 由工具维护。
- `vi.mock()` 的说明符与被测模块的 import 一致。同一 barrel 的多个导出用一次 `vi.mock()` 配合 `importOriginal` 覆盖。

## 测试与验收规则（强制）

- 以人工确认的独立验收标准作为断言来源（如 Given/When/Then、输入输出对照或接口契约）；验收标准须存放在独立位置（如 `specs/acceptance/`）并在实现开始前存在，实现 Agent 不得修改标准或从实现反推断言；标准缺失或模糊时，测试 Agent 必须停止并报告，禁止猜测后生成断言。
- 实现 Agent 只写代码：可看验收标准，但不得读取、修改、弱化测试文件；测试 Agent 在独立会话中仅凭验收标准生成测试，不得读取 `src/` 实现或参考实现 Agent 的对话历史；测试失败由人类负责人按验收标准裁决。
- 只测功能边界与外部行为：黑盒测试模拟真实行为并断言可观察结果，契约测试验证接口语义符合消费者期望；禁止测内部方法、私有函数和实现细节。
- 可用时优先回放真实请求并对比响应差异，输入与预期均来自真实世界、不经 AI 生成；故障注入只覆盖验收标准写明的异常条件。
- 用变异测试验证测试有效性：关键路径变异后仍通过则重写测试，由独立验证者或人类审查结果。
- 测试失败先判断是否偏离验收标准：偏离则修正测试并记录原因，否则修改实现；严禁为让测试变绿而删除、放宽或跳过断言，或修改验收标准迁就代码。
- 禁止把 AI 自生成测试全绿作为交付证据；交付证据必须包含验收标准来源、独立测试会话记录和变异测试结果。
- 新增 composable / store / 类型须由独立测试角色补 `.spec.ts`，新增代码覆盖率要求 ≥80%。CI 聚合覆盖率门禁另见 `apps/admin/vitest.config.ts`。

## 工作区架构锁定（最高优先级）

未经用户在当前任务中明确批准，严禁：

- 新增 / 删除 / 重命名 / 移动任何 app（`apps/<a>`）、包（`packages/<p>`）或根一级目录。
- 违反上述依赖方向铁律。
- 改变任何 app / 包内部一级目录的职责定位。
- 修改 `pnpm-workspace.yaml`、`turbo.json`、根 package.json scripts、各 app `vite.config.ts`、`packages/config` 工厂、根 `tsconfig.*`、`eslint.config.mjs` 中任何与 workspace 解析相关的配置。
- 增删 / 移动 / 重命名 app 内部 `src/` 一级目录（api / assets / components / composables / directives / enums / layouts / locales / modules / plugins / router / store / styles / types / utils）。

### 工作区变更流程

将用户在当前轮对话中明确指定目标文件路径的操作视为对该次操作预先批准（仅限该次明确提及的文件）。其余涉及本节锁定的操作，先按以下模板输出修改申请（≤10 行），等待用户单独批准。

```markdown
【workspace 修改申请】<方案名>

- 操作类型：[新增 app / 新增包 / 删除 / 重命名 / 移动 / 改职责 / 改依赖方向]
- 目标路径：apps|packages|scripts/xxx（可多行）
- 原因：[业务原因，≤2 句]
- 影响面：[影响哪些 app/包/调用方/路由/类型/turbo 拓扑]
- 备选：[是否考虑过其他归属，引用 docs/43 / docs/18 §2 决策矩阵]
- 回退：[如何恢复，是否需要备份]
```

交付时用表格列全本次 workspace 写操作，包含文件路径、操作、原状和本次变更。

涉及 `.vue` 文件时，另附 BEM 核查清单，逐项核对下文「BEM 编写规范」；`pnpm lint` / `pnpm -C apps/<a> type-check:full` 未覆盖的条款以人工核查为准。

## 治理退役准则

- 新增 CI 门禁时在 ci.yml 注释声明其保护的事故史；把连续两个审查周期零拦截且保护面已被上游机制覆盖的门禁列入退役评估（降级为 warn 或删除）。
- 在 vue 大版本升级等全量验证窗口前，对每个 showroom app 做 keep/kill 复审（回答「删掉它我会损失什么」）。
- 用 `check:doc-currency` 冻结 docs/ 根级文档数；新增文档先改预算值并说明理由；瘦身先合并 / 归档再降预算。

## BEM 编写规范（.vue 强约束）

- 用 `const bem = createNamespace('<kebab-case>')` 声明唯一命名空间（app 使用 AutoImport，包内新代码显式导入）；组件名必须 kebab-case，与 sass 根选择器 `.#{$BEM_PREFIX}-<kebab-case>` 严格对齐。
- 模板 class 一律通过 `bem.b()` / `bem.e()` / `bem.m()` / `bem.em()` / `bem.is()` / `bem.has()` 拼装，禁止硬编码 `vv-` 前缀字符串。
- `<style>` 块必须写 `lang="scss"` 且禁止加 `scoped`。
- 区分 block modifier（`bem.m('xxx')` → `vv-<block>--xxx`）与 element modifier（`bem.em('elem','xxx')` → `vv-<block>__elem--xxx`）。
- 非 scoped 样式下 `:deep()` / `::v-deep` / `:v-deep` 不会被编译——穿透第三方组件样式一律直接写后代选择器。

## 设计工作规范

> impeccable 管体系与落地（PRODUCT.md / DESIGN.md / live 变体 / craft-floor）；taste-skill（`design-taste-frontend`，用户自行安装）管艺术指导、开放档案真实图片与浏览器自检。taste 未安装时，跳过其专属条款。

- 动任何视觉前先读根目录 `PRODUCT.md`、`DESIGN.md` 与对应端 token 表；新增自有色值 / 字号 / 间距先登记 DESIGN.md 再使用。
- 按 surface mode 投入：Persuade / Experience 端（portal / big / docs）允许大胆实验；Operate / Read 端（admin / auth / h5 生产面）精确克制优先。
- 整页新视觉走 taste 六步（brief → 三方向选一 → 一句创意 → 开放档案真实图片并署名 → 三宽浏览器自检 → 截图自修至多三轮），再经 impeccable polish / critique / live 收尾，实验结论回登 DESIGN.md；既有面迭代优先 impeccable scoped 命令与 `/impeccable live`，taste 仅作审计与方向参考。
- 不用 taste 的“三方向”推翻 DESIGN.md 既有锚与 Element Plus 基座；偏离骨架前先更新 DESIGN.md 并说明取舍。
- 视觉完成以真实浏览器渲染为准，禁止凭代码想象宣称“看起来没问题”；375 / 1440 / 1920 三宽度至少各看一眼，大屏另测其设计稿宽度。

## 其他项目约束

1. 引用第三方 npm 包前先 `npm view <pkg>` 验证其存在，有稳定维护和高下载量。
2. 功能性变更同步 CHANGELOG.md（仅 typo 免记）。
3. 编写 CSS 禁止使用 `!important`（仅当用户主动要求时例外）；用选择器特异性 / BEM 命名空间 / 源码顺序解决优先级。
4. app 内跨目录引用优先 alias 路径，禁止 `../../` 深层相对路径（`apps/docs/src/modules/demo/` 豁免）。
5. 改 ESLint 规则 / 架构级约定前，先在 `docs/superpowers/specs/` 写设计稿并等批准；设计文档命名 `[序号]-中文主题.md`。
6. 用中文写 commit message（约定式前缀 `feat:`/`fix:`/`refactor:`/`docs:`/`test:`/`chore:`/`perf:`），禁止出现任何 AI 协作痕迹（`Co-Authored-By` trailer、"Generated with \<AI\>" 类标注；`scripts/check-commit-msg.sh` 硬拦截，真人协作例外走 `git commit --no-verify`）。
7. 样式分层规范（五层架构 / tokens / z-index / EP 覆盖三级）遵循 docs/49。

## 专题文档速查

- 查专题文档：新手指引 docs/10、代码组织决策 docs/18、图标规范 docs/39、Monorepo 设计 docs/43、样式分层 docs/49、页面组件选型 docs/50。
