# AGENTS.md

> 本文件收录对本仓库任何 AI 编码工具与协作者都成立的工程标准——只写长期为真的常量，一律以祈使句表述。
> 目录结构与文件清单以 codegraph 索引为准，本文件不重复；Claude Code 专属指令见 `CLAUDE.md`（其首行以 `@AGENTS.md` 导入本文件）。

## 项目定位与环境

- 视本仓库为 Feature-Sliced 风格的企业中后台门户前端 Monorepo：Vue 3.6（beta 精确钉版 3.6.0-beta.17，2027-01-31 前回稳定线）+ TypeScript + Vite + Pinia + Element Plus + Vue Router。
- 以 pnpm workspace + turbo@2 组织 `apps/*`（6 应用）+ `packages/*`（4 包）；以根 package.json 与 git tag 作为对外 semver 的唯一事实源。
- 使用 Node `>=22.18` 或 `>=24.12`、pnpm `>=11.x`（`preinstall` 硬强制 `only-allow pnpm`）。

## 常用命令

| 任务                   | 命令                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| 安装依赖               | `pnpm install`                                                                                    |
| 启动 dev               | 日常首推 `pnpm dev:gateway`；`pnpm dev` 并行 6 app 有 mock 共享竞态（见 docs/43 §9.3）            |
| 启动单 app dev         | `pnpm -C apps/<a> dev`（或 `dev:local` 本地菜单模式）                                             |
| 跑全部单测             | `pnpm test`（turbo 拓扑序 6 app + 4 包）                                                          |
| 跑单 app / 单文件单测  | `pnpm -C apps/<a> test [path]`（如 `pnpm -C apps/admin test src/utils/dayjs.spec.ts`）            |
| 类型校验               | `pnpm type-check`（单 app 增量）/ `pnpm -C apps/<a> type-check:full`（全量）                      |
| 构建                   | `pnpm build`（含类型门禁）/ `pnpm -C apps/<a> build-only`（跳过类型门禁）                         |
| Lint 检查 / 自动修复   | `pnpm lint` / `pnpm lint:fix`                                                                     |
| Prettier 格式化 / 检查 | `pnpm format` / `pnpm format:check`                                                               |
| 一致性校验（CI 阻断）  | `pnpm check:routes` / `pnpm check:aliases` / `pnpm check:mock-wiring` / `pnpm check:doc-currency` |
| 新建 / 移除业务模块    | `pnpm new-module <kebab-name>` / `pnpm remove-module <kebab-name>`（默认 dry-run + 确认）         |

其余低频命令（覆盖率、基准、预览、聚合构建、发布等）查根 `package.json` scripts。

## 架构不变量

- 遵守 workspace 依赖方向铁律：`apps/*` 可依赖 `packages/*`；`apps/*` 之间禁止互相依赖（跨 app 通信走整页跳转协议，见 docs/43）；`packages/*` 按 `config ∥ shared → mock → ui` 单向依赖（mock 仅以 import type 消费 shared 契约类型）；`packages/*` 禁止依赖 `apps/*`；运行时依赖（vue / element-plus 等）一律 peerDependencies + catalog。
- 保持 app 内模块边界：`src/modules/<m>` 模块之间禁止互 import，模块间通信走 `modules/<m>/index.ts` 对外接口；`components/common`、`layouts/<m>`、`store/modules`、`directives/`、`plugins/` 禁止引用任何 `modules/` 内容。
- 只把跨模块共享状态放进全局 `store/modules` barrel（app / user / theme / tags-view / dict）；模块私有 store 归 `modules/<m>/store/`；使用 Pinia Setup Store 风格；持久化仅按字段 `pick` 白名单（tags-view 刻意不持久化，dict 5min TTL）；不在 store 中存网络请求中间态。
- 给每个异步组件提供 Loading / Error / Empty 三态：用 `useRequest` 包数据、用 `<AsyncState>` 包渲染。

## 业务代码强制封装

- 路由跳转 / 参数 / back 一律用 `useAppRouter`，禁止直接 `import { useRouter } from 'vue-router'`。
- 网络请求一律用 `useRequest`，禁止直接 import axios。
- 权限判断一律用 `useAuth`（`hasPerm` / `hasAnyPerm`）。
- 命令式弹窗一律用 `useDialog`；二次确认一律用 `useConfirm`。
- 前两条由 ESLint `no-restricted-imports`（error 级）机械拦截；后三条靠本规范 + code review 兜底。

## AutoImport 与组件注册

- 不要为 vue / vue-router / pinia 高频 API 及项目已注入的 composables / utils（useAppRouter / useRequest / useAuth / useDict / useDialog / useConfirm / useLogout / createNamespace 等）写显式 import——unplugin-auto-import 已将其注入 `<script setup>` 全局作用域；新增注入标识符只改 `packages/config/src/create-vite-config.ts` 的 `AutoImport.imports`。
- 给不常见的自动注入标识符（如 `storeToRefs`、`useLink`、`createNamespace`）在首次出现处加一行来源注释（≤40 字）。
- packages/* 生产源码一律显式 import（含 vue / pinia 高频 API 与 ElMessage 样式副作用）——AutoImport 隐式注入只停留在 apps/* 宿主；packages/* 消费的每个 npm 包必须声明在自身 package.json（本地规则 `local/package-contract` error 级兜底）。
- 跨包消费走 `@vv/shared` / `@vv/ui` 包名 barrel；别名深层路径（`@utils/*` / `@store/*` / `@components/*` 等直达包内部）是过渡态遗留——新代码禁止新增，存量渐进收敛；`@api` / `@locales` / `@directives` / `@mock` 别名消费为既定例外。
- 不要显式 import 自动注册目录（@vv/ui 包 components/common + components/ProTable + components/form-schema 三目录与各 app `src/components/`）下的全局组件——模板中直接使用；唯一例外：`<script setup>` 中需要 `InstanceType<typeof Xxx>` 作 ref 类型声明时。
- 让 `vi.mock()` 说明符与被测模块的 import 说明符保持一致（语义路径同步，否则 mock 失去拦截）。

## 测试与验收规则（强制）

- 让测试预期独立于实现代码，禁止在实现完成后依据实现逻辑反推断言；绿灯只证明实现与测试一致，不证明实现与需求一致。
- 只接受人工确认的验收标准、Given/When/Then 条件、输入-输出对照表或契约定义作为测试断言来源；验收标准须存放在独立位置（如 `specs/acceptance/`）并在实现开始前存在，实现 Agent 无权修改；标准缺失或模糊时，测试 Agent 必须停止并报告，禁止猜测后生成断言。
- 实现 Agent 只写代码：可看验收标准，但不得读取、修改、弱化测试文件；测试 Agent 在独立会话中仅凭验收标准生成测试，不得读取 `src/` 实现或参考实现 Agent 的对话历史；人类负责人确认验收标准，并裁决测试失败时改测试还是改实现。
- 只测功能边界与外部行为：黑盒测试模拟真实行为并断言可观察结果，契约测试验证接口语义符合消费者期望；禁止测内部方法、私有函数和实现细节。
- 可用时优先回放真实请求并对比响应差异，输入与预期均来自真实世界、不经 AI 生成；故障注入只覆盖验收标准写明的异常条件。
- 用变异测试验证测试有效性：关键路径注入人为缺陷后仍全绿则打回重写；禁止实现 Agent 自行认证自己的测试，变异结果由独立验证者或人类审查。
- 测试失败先判断是否偏离验收标准：偏离则修正测试并记录原因，否则修改实现；严禁为让测试变绿而删除、放宽或跳过断言，或修改验收标准迁就代码。
- 禁止把 AI 自生成测试全绿作为交付证据；交付证据必须包含验收标准来源、独立测试会话记录和变异测试结果。

## 工作区架构锁定（最高优先级）

未经用户在当前任务中明确批准，严禁：

- 新增 / 删除 / 重命名 / 移动任何 app（`apps/<a>`）、包（`packages/<p>`）或根一级目录。
- 违反上述依赖方向铁律。
- 改变任何 app / 包内部一级目录的职责定位。
- 修改 `pnpm-workspace.yaml`、`turbo.json`、根 package.json scripts、各 app `vite.config.ts`、`packages/config` 工厂、根 `tsconfig.*`、`eslint.config.mjs` 中任何与 workspace 解析相关的配置。
- 增删 / 移动 / 重命名 app 内部 `src/` 一级目录（api / assets / components / composables / directives / enums / layouts / locales / modules / plugins / router / store / styles / types / utils）。

例外与流程：将用户在当前轮对话中明确指定目标文件路径的操作视为对该次操作预先批准（仅限该次明确提及的文件）；其余情况先输出修改申请（模板见 `CLAUDE.md`「Claude 专属」节）并等用户单独批准；每次任务完成后以表格列出本次对 workspace 的全部写操作清单（含文件路径 / 操作 / 原功能 / 本次变更）。

## 治理退役准则

- 新增 CI 门禁时在 ci.yml 注释声明其保护的事故史；把连续两个审查周期零拦截且保护面已被上游机制覆盖的门禁列入退役评估（降级为 warn 或删除）。
- 在 vue 大版本升级等全量验证窗口前，对每个 showroom app 做 keep/kill 复审（回答「删掉它我会损失什么」）。
- 用 `check:doc-currency` 冻结 docs/ 根级文档数；新增文档先改预算值并说明理由；瘦身先合并 / 归档再降预算。

## BEM 编写规范（.vue 强约束）

- 用 `const bem = createNamespace('<kebab-case>')` 声明命名空间（由 unplugin-auto-import 注入，禁止显式 import）；组件名必须 kebab-case，与 sass 根选择器 `.#{$BEM_PREFIX}-<kebab-case>` 严格对齐。
- 模板 class 一律通过 `bem.b()` / `bem.e()` / `bem.m()` / `bem.em()` / `bem.is()` / `bem.has()` 拼装，禁止硬编码 `vv-` 前缀字符串。
- `<style>` 块必须写 `lang="scss"` 且禁止加 `scoped`。
- 区分 block modifier（`bem.m('xxx')` → `vv-<block>--xxx`）与 element modifier（`bem.em('elem','xxx')` → `vv-<block>__elem--xxx`）。
- 非 scoped 样式下 `:deep()` / `::v-deep` / `:v-deep` 不会被编译——穿透第三方组件样式一律直接写后代选择器。
- 每个组件只声明一份 `bem` 实例。

## 设计工作规范

> impeccable 管体系与落地（PRODUCT.md / DESIGN.md / live 变体 / craft-floor）；taste-skill（`design-taste-frontend`，用户自行安装）管艺术指导、开放档案真实图片与浏览器自检。taste 未安装时，跳过其专属条款。

- 动任何视觉前先读根目录 `PRODUCT.md`、`DESIGN.md` 与对应端 token 表；新增自有色值 / 字号 / 间距先登记 DESIGN.md 再使用。
- 按 surface mode 投入：Persuade / Experience 端（portal / big / docs）允许大胆实验；Operate / Read 端（admin / auth / h5 生产面）精确克制优先。
- 整页新视觉走 taste 六步（brief → 三方向选一 → 一句创意 → 开放档案真实图片并署名 → 三宽浏览器自检 → 截图自修至多三轮），再经 impeccable polish / critique / live 收尾，实验结论回登 DESIGN.md；既有面迭代优先 impeccable scoped 命令与 `/impeccable live`，taste 仅作审计与方向参考。
- 不用 taste 的“三方向”推翻 DESIGN.md 既有锚与 Element Plus 基座；偏离骨架前先更新 DESIGN.md 并说明取舍。
- 视觉完成以真实浏览器渲染为准，禁止凭代码想象宣称“看起来没问题”；375 / 1440 / 1920 三宽度至少各看一眼，大屏另测其设计稿宽度。

## 项目约束

1. 包管理强制 pnpm。
2. 新增业务模块必须用 `pnpm new-module <kebab-name>`。
3. app 内模块间通信走 `modules/<m>/index.ts`；跨 app 通信走整页跳转协议。
4. 禁止 `@vv/ui` 组件 import 自任何 `apps/*`。
5. 引用第三方 npm 包前先 `npm view <pkg>` 验证其存在。
6. 新增 composable / store / 类型必须带 `.spec.ts`（覆盖率 ≥ 80%）。
7. 功能性变更同步 CHANGELOG.md（仅 typo 免记）。
8. 编写 CSS 禁止使用 `!important`（仅当用户主动要求时例外）；用选择器特异性 / BEM 命名空间 / 源码顺序解决优先级。
9. app 内跨目录引用优先 alias 路径，禁止 `../../` 深层相对路径（`apps/docs/src/modules/demo/` 豁免）。
10. 改 ESLint 规则 / 架构级约定前，先在 `docs/superpowers/specs/` 写设计稿并等批准；设计文档命名 `[序号]-中文主题.md`。
11. 用中文写 commit message（约定式前缀 `feat:`/`fix:`/`refactor:`/`docs:`/`test:`/`chore:`/`perf:`），禁止出现任何 AI 协作痕迹（`Co-Authored-By` trailer、"Generated with \<AI\>" 类标注；`scripts/check-commit-msg.sh` 硬拦截，真人协作例外走 `git commit --no-verify`）。
12. 样式分层规范（五层架构 / tokens / z-index / EP 覆盖三级）遵循 docs/49。

## 专题文档速查

- 查专题文档：新手指引 docs/10、代码组织决策 docs/18、图标规范 docs/39、Monorepo 设计 docs/43、样式分层 docs/49、页面组件选型 docs/50。
