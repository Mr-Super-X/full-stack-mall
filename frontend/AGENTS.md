# AGENTS.md

> 本文件收录对本仓库任何 AI 编码工具与协作者都成立的工程标准——只写长期为真的常量，一律以祈使句表述。
> 目录结构与文件清单以 codegraph 索引为准，本文件不重复；Claude Code 专属指令见 `CLAUDE.md`（其首行以 `@AGENTS.md` 导入本文件）。

## 项目定位

- 视本仓库为 Feature-Sliced 风格的企业中后台门户前端 Monorepo：Vue 3.6（beta 精确钉版 3.6.0-beta.17，2027-01-31 前回稳定线）+ TypeScript 6 + Vite 8 + Pinia 3 + Element Plus 2.14 + Vue Router 5。
- 以 pnpm workspace + turbo@2 组织 `apps/*`（6 应用）+ `packages/*`（4 包）。
- 以根 package.json 与 git tag 作为对外 semver 的唯一事实源。

## 环境要求

- 使用 Node `>=22.18` 或 `>=24.12`、pnpm `>=11.x`（`preinstall` 硬强制 `only-allow pnpm`）。

## 常用命令

| 任务                                                                                    | 命令                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 安装依赖                                                                                | `pnpm install`                                                                         |
| 启动 dev（⚠️ turbo 并行 6 app 有 mock 共享竞态，见 docs/43 §9.3；日常首推 dev:gateway） | `pnpm dev`                                                                             |
| 启动单 app dev                                                                          | `pnpm -C apps/<a> dev`（或 `dev:local` 本地菜单模式）                                  |
| 同域网关 dev（网关 :8080 + 6 app 带 base 单命令）                                       | `pnpm dev:gateway`                                                                     |
| 跑全部单测（turbo 拓扑序 6 app + 4 包）                                                 | `pnpm test`                                                                            |
| 跑单 app / 单文件单测                                                                   | `pnpm -C apps/<a> test [path]`（如 `pnpm -C apps/admin test src/utils/dayjs.spec.ts`） |
| 单测覆盖率 / UI 模式（admin 口径）                                                      | `pnpm test:coverage` / `pnpm test:ui`                                                  |
| 跑基准测试（vitest bench，admin）                                                       | `pnpm bench`                                                                           |
| 类型校验                                                                                | `pnpm type-check`（单 app 增量）/ `pnpm -C apps/<a> type-check:full`（全量）           |
| 构建生产包（turbo 拓扑序；含 type-check:full 门禁）                                     | `pnpm build`                                                                           |
| 单 app 仅构建（不门禁类型）                                                             | `pnpm -C apps/<a> build-only`                                                          |
| 预览单 app 生产包                                                                       | `pnpm -C apps/<a> preview`                                                             |
| gh-pages 六应用聚合构建（自动发现 apps/*）                                              | `pnpm build:pages`                                                                     |
| 包体积分析（admin，输出 dist/stats.html）                                               | `pnpm analyze`                                                                         |
| Lint 检查 / 自动修复                                                                    | `pnpm lint` / `pnpm lint:fix`                                                          |
| Prettier 格式化                                                                         | `pnpm format` / `pnpm format:check`                                                    |
| 路由一致性校验（CI 强制；含端口双写锁死 + 注册表反向校验）                              | `pnpm check:routes`                                                                    |
| alias 单一来源一致性校验（CI 阻断）                                                     | `pnpm check:aliases`                                                                   |
| mock 双接线一致性校验（CI 阻断）                                                        | `pnpm check:mock-wiring`                                                               |
| 文档与代码硬数据一致性校验（CI 阻断）                                                   | `pnpm check:doc-currency`                                                              |
| 从 app-aliases.ts 同步 tsconfig paths                                                   | `pnpm generate:tsconfig-paths`                                                         |
| 新建业务模块（自动生成骨架文件）                                                        | `pnpm new-module <kebab-name>`                                                         |
| 移除业务模块（默认 dry-run + 确认）                                                     | `pnpm remove-module <kebab-name>`                                                      |
| 提交并推送（add + cz + push 一站式）                                                    | `pnpm push`                                                                            |
| 发布版本（bump + CHANGELOG + tag + push）/ 预览（dry-run，0 副作用）                    | `pnpm release` / `pnpm release:dry`                                                    |

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

> 视觉 / 设计任务的工序与工具搭配。impeccable 管体系与落地（PRODUCT.md / DESIGN.md / live 变体 / craft-floor 质量底线）；taste-skill（`design-taste-frontend`，用户自行安装）管艺术指导、开放档案真实图片与浏览器自检。两者职责不重叠：taste 定向与供材，impeccable 定规与落地。

- 动任何视觉前先读根目录 `PRODUCT.md`、`DESIGN.md` 与对应端 token 表；新增自有色值 / 字号 / 间距**先登记 DESIGN.md 再使用**（The 登记先行 Rule）。
- 按 surface mode 投入：Persuade / Experience 端（portal / big / docs）允许大胆整页实验；Operate / Read 端（admin / auth / h5 生产面）精确克制优先——taste 的 app 路线（quiet panels、数字对齐、色花在数据上）恰为 Operate 端默认气质。
- 整页新视觉（showroom 端 / 新 surface）：走 taste 六步（brief → 三方向选一 → 一句创意 → 开放档案真实图片并署名 → 三宽浏览器自检 → 截图自修至多三轮），再经 impeccable 的 polish / critique / live 收尾；实验结论回登 DESIGN.md。
- 既有面迭代：优先 impeccable scoped 命令（bolder / quieter / polish / layout / typeset 等）与 `/impeccable live` 变体模式；taste 仅作审计与方向参考，不直接重写既有页面。
- 不拿 taste 的"三方向"推翻 DESIGN.md 既有锚与 Element Plus 基座：「无品牌约束」指无外部品牌资产，不指无视骨架；偏离骨架的 direction 必须先更新 DESIGN.md 并说明取舍。
- 视觉完成以真实浏览器渲染为准（taste inspect / impeccable live 预览 / chrome-devtools 截图），禁止凭代码想象宣称"看起来没问题"；375 / 1440 / 1920 三宽度至少各看一眼（大屏另测其设计稿宽度）。
- taste-skill 未安装时，以上涉及它的条款自动跳过——impeccable 单工具链路完整可用。

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

- 查专题文档：新手指引 docs/10、代码组织决策 docs/18、图标规范 docs/39、Monorepo 设计 docs/43、样式分层 docs/49。
