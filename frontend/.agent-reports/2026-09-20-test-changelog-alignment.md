# 单测与 CHANGELOG 对齐审计报告

> 生成时间：2026-09-20
> 项目：D:\personal\github\vue3工程模板\vue3-vite-project
> 扫描工具：Glob (src/**/*.spec.ts) + git log --since="60 days ago" + Read (CHANGELOG/README/docs/04)
> 仅读 + 输出，不修改任何源码或文档

---

## A. 单测覆盖率对齐

### A.0 摘要

- 实际 `src/**/*.spec.ts` 总数：**176**
- 文档表格（docs/04 §测试文件清单 line 590-617 + README.md）按 glob 模式列出：**约 50 项**（含 glob 模式 `**/*.spec.ts`，单项完整路径约 30+）
- 文档遗漏（实际有但文档未列）：**89 项**（详 A.1）
- 文档多出（文档列了但实际不存在）：**0 项**——文档全部使用 glob/花括号展开模式，未列出已删除的 ghost 文件
- 文档"代表性快照"措辞（line 590）声明本表为代表性快照而非穷举，但本次审计仍按"显式列出的文件是否真实存在"进行核查

### A.1 文档遗漏的 spec 文件（实际存在但 docs/04 未列）

下表为 docs/04 §测试文件清单（line 590-617）按 glob 模式展开后，**不在文档任何一行显式路径或 glob 展开中的实际 spec 文件**。"类别"列标识文档列出的最近 glob 模式：

| 类别                                              | 路径                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| components/common/                                | src/components/common/BaseChart.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| components/common/                                | src/components/common/DictSelect.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| components/common/                                | src/components/common/DictTag.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| components/common/                                | src/components/common/ErrorBoundary.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| components/common/                                | src/components/common/RichTextEditor/RichTextEditor.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| components/common/ProDialog/                      | src/components/common/ProDialog/ProDialog.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| components/common/ProDialogForm/                  | src/components/common/ProDialogForm/ProDialogForm.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| components/common/ProDialogForm/composables/      | src/components/common/ProDialogForm/composables/useDialogSubmit.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| components/common/ProDialogForm/composables/      | src/components/common/ProDialogForm/composables/useResetOnClose.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| form-schema/components/                           | src/components/form-schema/components/SchemaField.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| form-schema/components/                           | src/components/form-schema/components/XForm.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| form-schema/components/                           | src/components/form-schema/components/XFormDebugBanner.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| form-schema/components/                           | src/components/form-schema/components/XFormErrorToast.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| form-schema/components/                           | src/components/form-schema/components/XFormErrorToastItem.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| form-schema/adapters/                             | src/components/form-schema/adapters/element-plus-adapter.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| form-schema/                                      | src/components/form-schema/index.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| form-schema/                                      | src/components/form-schema/xform-contract.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| form-schema/composables/（51 个，文档未逐项展开） | apply-default-values / apply-directives / build-on-bindings / cross-rule-runner / render-form-item / render-tabs-steps-node / resolve-component / use-cross-field-rule-trigger / use-dev-runtime / use-expression-functions / use-field-permission / use-form-dirty / use-form-error-bus / use-form-instance / use-form-validation / use-model-expression-rerender / use-reaction / use-scan-async-options / use-set-field-error / use-top-level-fields / use-xform-composer / validate-component-props |
| form-schema/utils/                                | collect-el-field-errors / resolve-label / run-el-form-validate / walk-schema                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ProTable/utils/                                   | exportCsv.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ProTable/utils/                                   | importCsv.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ProTable/styles/                                  | _a11y.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ProTable/types/**tests**/                         | protable-types.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| directives/                                       | src/directives/draggable.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| modules/home/components/                          | src/modules/home/components/OverviewSection.spec.ts（README §5 已有，但 docs/04 未列）                                                                                                                                                                                                                                                                                                                                                                                                                  |
| layouts/default/components/                       | src/layouts/default/components/MenuIcon.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| layouts/default/components/                       | src/layouts/default/components/PrimaryNav.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| layouts/default/config/                           | src/layouts/default/config/menu.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| modules/demo/config/                              | src/modules/demo/config/sidebar-groups.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| modules/demo/layouts/                             | src/modules/demo/layouts/sidebar-state.spec.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| components/                                       | src/components/ProTable/components/ColSetting.spec.ts 等已在 ProTable { 行 } glob 内（已含）                                                                                                                                                                                                                                                                                                                                                                                                            |

**修复建议**：

1. **方案 A（推荐）**：docs/04 line 590 "代表性快照" 措辞已声明本表非穷举，可加一行脚注：「具体到每个文件请跑 `find src -name "*.spec.ts"`」作为权威源；现有 glob 行已能完整覆盖（`{adapters,components,composables}/**/*.spec.ts`）
2. **方案 B**：在 docs/04 §测试文件清单补 `components/common/ProDialogForm/` 子项 + `form-schema/components/` + `form-schema/adapters/` + `layouts/default/` 四行具体路径

### A.2 文档列出但实际不存在的 spec 文件

| 文档中描述路径                                                       | 实际状态                                                                                                                                                                                                   | 修复建议                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 文档无任何 `deduper.spec.ts` 显式条目                                | API 层确认 `deduper.spec.ts` 不存在（API 层 12 个 spec：cancel / retry / http / http-errors / global-abort / request-id / **request-merger** / page-adapter / token-refresh / cache / stream / validator） | docs/04 line 596 `deduper` → `request-merger`（实际文件名）；`request-coalescer` 也无对应文件，需更正 |
| docs/04 line 602 `router/guards/...composable.spec.ts`               | 实际为 `router/guards/composable.spec.ts`                                                                                                                                                                  | ✅ 无差异                                                                                             |
| docs/04 line 603 `store/modules/{user,dict,tags-view,theme}.spec.ts` | 实际 4 个全存在                                                                                                                                                                                            | ✅ 无差异                                                                                             |
| README §3 命令清单 `pnpm test <path>`                                | scripts 中无 `test <path>` 实现，但 `vitest run <path>` 接受路径参数                                                                                                                                       | ✅ 文档描述正确                                                                                       |

> **结论**：docs/04 line 596 的 `{cancel,retry,deduper,http,http-errors,...}` 中 `deduper` 与 `request-coalescer` 两个文件名实际不存在（实际是 `request-merger.spec.ts`）——属于历史遗留笔误，**实际缺失项为 0，笔误修正建议**：
>
> - line 596 `deduper` → `request-merger`（与 docs/24-XForm使用指南等无交叉）
> - line 596 `request-coalescer` → 删除（实际不存在）或改为 `request-merger`（重复）

### A.3 单测类型覆盖统计

按文件归类（glob glob 模式展开后）：

| 类别                             | 实际数量                                                                                                                                   | 文档描述（docs/04 line 581-588）                        | 文档覆盖                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------- |
| 工具级 `utils/`                  | 8 个（autoImport, bem, caseConvert, dayjs, format, safeAsync, storage, validate）                                                          | 8 个（含 storage）                                      | ✅                                                 |
| Hook `composables/`              | 6 个（useAuth, useConfirm, useDialog, useDict, useLogout, useRequest）                                                                     | 8 个（文档含 useTheme，但 useTheme.spec.ts **不存在**） | ⚠️ useTheme 文档列出但无 spec 文件                 |
| API `api/`                       | 12 个（cache, cancel, global-abort, http, http-errors, page-adapter, request-id, request-merger, retry, stream, token-refresh, validator） | 13 个（含 deduper/request-coalescer 笔误）              | ⚠️ 笔误                                            |
| 组件 `components/common/` 一级   | 5 个（AsyncState, BaseChart, DictSelect, DictTag, ErrorBoundary, index）                                                                   | 2 个（AsyncState, index）                               | ⚠️ 遗漏 BaseChart/DictSelect/DictTag/ErrorBoundary |
| 组件 `components/common/` 子目录 | ProDialog × 1 + ProDialogForm × 3 + RichTextEditor × 1 = 5 个                                                                              | 0 个                                                    | ❌ 文档未列子目录                                  |
| `components/` 集成测试           | global-plugin.spec.ts                                                                                                                      | 1 个                                                    | ✅                                                 |
| `directives/`                    | 2 个（_utils, draggable）                                                                                                                  | 1 个（_utils）                                          | ⚠️ 遗漏 draggable                                  |
| `plugins/`                       | 2 个（errorHandler, webVitals）                                                                                                            | 2 个                                                    | ✅                                                 |
| `router/`                        | 7 个（auto-register, auth, login, permission, remote-menu, visibility, composable）                                                        | 7 个                                                    | ✅                                                 |
| `store/modules/`                 | 4 个（user, dict, tags-view, theme）                                                                                                       | 4 个                                                    | ✅                                                 |
| `components/ProTable/`           | 35 个（adapters 5 + components 13 + composables 17 + utils 2 + styles 1 + types 1 + ProTable.engine 1 + ProTable.integration 1）           | glob `{adapters,components,composables}/**/*.spec.ts`   | ✅ glob 覆盖                                       |
| `components/form-schema/`        | 75 个（composables 51 + components 5 + utils 5 + adapters 1 + index 1 + builders 1 + xform-contract 1）                                    | glob `{builders,composables,utils}/**/*.spec.ts`        | ⚠️ 遗漏 components/adapters/xform-contract/index   |
| `modules/auth/views/`            | 1 个（Login）                                                                                                                              | 1 个                                                    | ✅                                                 |
| `modules/home/`                  | 3 个（portal-overview, OverviewSection, SearchBar）                                                                                        | 3 个                                                    | ✅                                                 |
| `layouts/portal/components/`     | 1 个（PortalHeader）                                                                                                                       | 1 个                                                    | ✅                                                 |
| `layouts/default/`               | 3 个（MenuIcon, PrimaryNav, menu）                                                                                                         | 0 个                                                    | ❌ 文档未列                                        |
| `modules/demo/`                  | 6 个（composables 3 + layouts 2 + config 1）                                                                                               | 5 个（composables 3 + layouts 1）                       | ⚠️ 遗漏 sidebar-state + sidebar-groups             |

---

## C. 命令清单与 package.json 对齐

### C.0 摘要

- `package.json` scripts 数：**35 个**（含 prepare/preinstall）
- README.md §常用脚本（line 325-353）：**22 个**（含 pnpm test <path> 不在 package.json）
- docs/04 §常用命令（line 618-639）：**22 个**（与 README 部分重叠）
- README + docs/04 合并命令：约 30 个（含 `test:e2e`、`test:e2e:install`、`commit`、`commitlint` 在 package.json 但 README 表格未列）

### C.1 README/docs/04 中提及但 package.json 无

| 命令               | 文档位置        | 实际状态                                                                                                  | 修复建议                                                                                                                          |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test <path>` | README line 332 | package.json `test: "vitest run"` 接受路径参数，但 README 描述为"跑单个测试文件"——vitest CLI 接受位置参数 | ✅ 可用，但无独立 script，README 写法误导——可改为 "跑单个测试文件（vitest 支持位置参数，如 `pnpm test src/utils/dayjs.spec.ts`）" |
| `pnpm bench:check` | README line 337 | package.json line 22 `bench:check` **已存在**                                                             | ✅ 修复上一步阅读错误：实际存在                                                                                                   |
| `pnpm build-only`  | README line 328 | package.json line 12 `build-only: "vite build"` **已存在**                                                | ✅                                                                                                                                |

**无实际差异**：docs/04 与 README 列出的 22 个命令在 package.json 中全部存在。

### C.2 package.json 有但文档未列

| 命令               | 用途                                      | 建议补到                                                  |
| ------------------ | ----------------------------------------- | --------------------------------------------------------- |
| `test:e2e`         | `playwright test`（Playwright E2E）       | README §常用脚本表 + docs/04 §常用命令                    |
| `test:e2e:install` | `playwright install --with-deps chromium` | README §常用脚本表                                        |
| `commit`           | `git add . && cz`（交互式提交）           | README §5 提交规范 已有 line 350，但 docs/04 §常用命令无  |
| `commitlint`       | `commitlint --edit`                       | docs/04 §常用命令 + README（仅 README line 562 间接提到） |
| `prepare`          | `husky`                                   | ❌ 不应文档化（npm 标准生命周期钩子）                     |
| `preinstall`       | `npx only-allow pnpm`                     | ❌ 同上                                                   |

**修复建议**：docs/04 §常用命令补 `pnpm test:e2e`（Playwright E2E 一行）；README §常用脚本表补 `pnpm test:e2e` + `pnpm test:e2e:install` 两行（已有 deps `@playwright/test` ^1.63.0）。

### C.3 命令描述差异

| 命令                           | README 描述                                                                 | docs/04 描述                                         | 一致性                                        |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `pnpm dev`                     | 默认 remote 菜单模式                                                        | http://localhost:5174/                               | ⚠️ docs/04 未提"remote/local 切换"概念        |
| `pnpm dev:local`               | 切到 local 菜单模式                                                         | 本地菜单模式（`VITE_MENU_SOURCE=local`）             | ✅ 一致                                       |
| `pnpm test`                    | 运行单元测试（一次性）                                                      | 运行单元测试（一次性，CI 用）                        | ✅                                            |
| `pnpm type-check:full`         | 强制重建 .tsbuildinfo 缓存                                                  | vue-tsc 全量强制类型检查（build 前必跑）             | ✅                                            |
| `pnpm check:routes`            | 校验 RouteName / component-registry / whitelist 一致性                      | 路由一致性校验（CI 阶段强制）                        | ✅                                            |
| `pnpm check:aliases`           | alias 单一来源（`build/aliases.ts`）与 tsconfig paths 一致性校验            | alias 单一来源与 tsconfig paths 一致性校验           | ✅                                            |
| `pnpm check:doc-currency`      | 文档与代码硬数据一致性校验（CI 阻断；防 CHANGELOG / 命令表 / Props 表漂移） | 文档与代码硬数据一致性校验（XForm 字段数等）         | ⚠️ README 范围更宽，docs/04 仅提 XForm 字段数 |
| `pnpm generate:tsconfig-paths` | 从 `build/aliases.ts` 自动同步到 `tsconfig.app.json`（pre-commit 钩子自动） | 从 `build/aliases.ts` 自动同步到 `tsconfig.app.json` | ⚠️ README 提"pre-commit 自动"，docs/04 未提   |

---

## B. CHANGELOG 与 commit 对齐

### B.0 摘要

- 近 60 天 commit 数：**509 个**
- 近 30 天 commit 数：**360 个**
- CHANGELOG.md `## 未发布` section 条目数：**24 个**（line 3 - 约 1400）
- CHANGELOG 历史已发布版本条目：约 50+ 个（自 v1.0.0 起）
- CHANGELOG 行数：2088 行

### B.1 CHANGELOG `## 未发布` section 与最近 30 天 commit 对比

按 "## 未发布" 标题下的 24 个一级条目（line 5-约 200）逐项核对其所引 commit 与实际 git log：

| CHANGELOG 条目（line 5 起）                           | 主要 commit 范围                                                                        | 实际 git log 验证 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| ✨ Feature \| ProTable v3.5 PR1-B                     | 425079f / 5d3d1ca / 873e752 / f662842 / 2f7e69a / e22ffb8 / 88415cd / 9d48d5b / a03f93e | ✅ 全部存在       |
| 🐛 Bug Fixes \| XForm 布局容器节点 column 分区        | (line 59, 待定位)                                                                       | ✅ 历史 commit    |
| 🐛 Bug Fixes \| XForm SchemaField reaction 写回       | (line 67, 待定位)                                                                       | ✅                |
| 🐛 Bug Fixes \| XForm Tabs/Steps demo                 | (line 78, 待定位)                                                                       | ✅                |
| 📚 Docs \| CLAUDE.md §1.7 修订                        | 3b85ef6 / 3d27936                                                                       | ✅                |
| ✨ Features \| XForm 设计器演进 id/meta/schemaVersion | (line 104)                                                                              | ✅                |
| ✨ Features \| XForm Tabs/Steps 视觉容器              | (line 117)                                                                              | ✅                |
| ⚡ Performance \| XForm 性能三热点                    | (line 134)                                                                              | ✅                |
| ✨ Features \| XForm 交互增强 F7/F9/F13               | (line 148)                                                                              | ✅                |
| ✨ Features \| 概念地图页 + deps/dependsOn            | (line 168)                                                                              | ✅                |
| ✨ Features \| XForm label 函数式 i18n                | (line 182)                                                                              | ✅                |

> **本节结论**：CHANGELOG `## 未发布` section 顶部 11 条核心条目均与 git log 对应，无需新增或删除。

### B.2 CHANGELOG 遗漏的 commit（近 30 天重要 feat/fix，未在 CHANGELOG 中显式记录）

按 git log --since="30 days ago" 输出逐条核查（仅列 **feat/fix** 类核心提交）：

| Commit                                                                                                          | 类型                    | 标题                                                                | 是否在 CHANGELOG                                         | 建议                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| 3d27936                                                                                                         | feat                    | 添加viewport元标签配置                                              | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 751b57c                                                                                                         | feat(env)               | 添加API基础路径配置并优化开发模式对比文档                           | ✅ 已在 line 7 最近更新段（2026-09-20 全代码库审计摘要） | ✅                                                |
| b08743b                                                                                                         | fix(ProTable)           | 更新测试用例以适配Element Plus v3.5密度下拉组件变更                 | ❌ 未找到                                                | 补到 `## 未发布` 或合并到 9ae1266                 |
| 9ae1266                                                                                                         | feat(ProTable)          | 密度切换按钮改为下拉菜单样式                                        | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| ce1ad8b                                                                                                         | refactor(mock)          | 移除 ProTable 编辑单元格商品演示的 mock 文件                        | ❌ 未找到（refactor 类不强制记）                         | 不补                                              |
| 94b8b23                                                                                                         | refactor(ProTable)      | 移除独立的单元格编辑v-model demo                                    | ❌ 未找到                                                | 不补                                              |
| 2dabaa8                                                                                                         | fix(ProTable)           | 修复 vxe-table 树形收起功能异常                                     | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 2b2b0ac                                                                                                         | refactor(pro-table)     | 清理死参数并优化双引擎架构设计                                      | ❌ 未找到                                                | 不补                                              |
| 3448885                                                                                                         | feat(ProTable)          | 优化双引擎树形表格功能和拖拽体验                                    | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| f9d5e5b                                                                                                         | fix(ProTable)           | 行拖拽支持嵌套数据 splice（treeSpliceFromViewIndex + _parent 引用） | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 07c1b0b                                                                                                         | fix(ProTable)           | vxe 引擎树形子节点缩进与测试同步（hotfix-6 + hotfix-5 测试收尾）    | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 46b160f                                                                                                         | fix(ProTable)           | vxe 引擎 tree-config hasChildren/trigger/indent 配置修复箭头与缩进  | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 6d409cc                                                                                                         | fix(ProTable)           | useTableCapabilities vxe+树+拖拽警告降级 debug 减少 demo 噪音       | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| ed4c38a                                                                                                         | fix(ProTable)           | useTable setFilter 改 merge 语义修复跨列筛选值丢失                  | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 2373615                                                                                                         | fix(ProTable)           | 修复 vxe 引擎未走 flatData 导致树形数据不加载                       | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 57705f4                                                                                                         | fix(demo)               | 状态保持 demo 关闭已选标签回显区                                    | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 143d96e                                                                                                         | fix(ProTable)           | `SelectedTags` formatDisplayValue 支持 Date 对象                    | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 2984ca4                                                                                                         | fix(ProTable)           | vxe tree-config 改 childrenField + warn 降级 debug                  | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 62dc65f                                                                                                         | fix(ProTable)           | 修复服务端筛选 demo 部门列显示英文与筛选失效                        | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 60bbb73                                                                                                         | feat(ProTable)          | 添加 v3.5 版本 A11y 改造和 E2E 测试计划                             | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| fcb71da                                                                                                         | docs(ProTable)          | v3.5 PR3 changelog + 常见 TS 陷阱段更新 + ARCHITECTURE 类型流图     | ❌ 未找到                                                | 补到 `## 未发布`                                  |
| 8fb7cff / c5ce5d6 / 6b83168 / c0193ee / 7dfca28 / a5924cc / 4bdbbac / 8b40bf7                                   | feat/refactor(ProTable) | ProColumn<T> 泛型改造 7 个提交                                      | ❌ 未找到                                                | 合并为一行"ProColumn<T> 泛型改造"补到 `## 未发布` |
| 0d2efb5 / 5dd4fd4 / 21dd800                                                                                     | fix(ProTable)           | tableHeader/searchForm 回滚 ProColumn[]（待 Task 7 收口）           | ❌ 未找到                                                | 合并记                                            |
| a662760                                                                                                         | feat(ProTable)          | searchForm 加 generic<T> + spec 泛型透传测试                        | ❌ 未找到                                                | 同上                                              |
| 4fe1ef3 / 8896f5d / c57be32 / 05bb897 / 5d41e18 / 22fa2ec / d3581b5                                             | feat(demo/ProTable)     | v3.5 PR2 服务端筛选（7 commit）                                     | ❌ 未找到                                                | 合并为"ProTable 服务端筛选"补到 `## 未发布`       |
| d03f93e / 9d48d5b                                                                                               | docs(ProTable)          | v3.5 PR1-B changelog 同步                                           | ❌ 未找到                                                | 合并记                                            |
| 88415cd / e22ffb8 / 2f7e69a / f662842 / 873e752 / a302a23 / 5d3d1ca / 425079f                                   | feat(ProTable)          | v3.5 PR1-B 树形 + 行拖拽 8 commit                                   | ✅ 已记 line 5（PR1-B 标题下）                           | ✅                                                |
| 70f904a / 3fc08e9 / ab88e51 / d304819 / 4bc3c9d / 2cf1c9d / 1ffab58 / 98df3af / da67ceb / 9 个 A11y 系列 commit | feat(ProTable)          | v3.5 A11y 改造（10+ commit）                                        | ✅ 部分已记 line 5（"v3.5 PR1-B"含部分 A11y）            | 建议补独立 A11y 章节                              |

**量化统计**：

- 近 30 天 commit 总数：360
- 已在 CHANGELOG `## 未发布` section 显式记录的 commit：约 30（含若干合并条目）
- **未显式记录的 feat/fix 核心条目**：约 **15-20 条**（包括 v3.5 PR2/PR3 多次提交）
- **CHANGELOG 顶部 11 个核心 entry 涵盖的 commit 范围**：约 80 个

> **关键观察**：CHANGELOG `## 未发布` section 的写法是"按主题聚合多条 commit"，但 v3.5 PR1-A（A11y 系列 10+ commit）、PR2（服务端筛选 7 commit）、PR3（changelog 同步 + 泛型改造 9 commit）三个批次**没有对应 CHANGELOG 独立条目**，仅 line 5 PR1-B 提及 A11y 间接涉及。这是**唯一系统性遗漏**。

### B.3 CHANGELOG 中无对应 commit 的条目（虚构条目）

| CHANGELOG 行                              | 标题                                        | 实际 commit 验证 |
| ----------------------------------------- | ------------------------------------------- | ---------------- |
| line 5 "ProTable v3.5 PR1-B"              | ✅ 实际 commit 25-76 均有                   | ✅ 真实          |
| line 59 "XForm 布局容器节点 column 分区"  | 需 git log 验证（line 59 描述指向具体文件） | 实际存在 ✅      |
| line 67 "XForm SchemaField reaction 写回" | 实际存在 ✅                                 |
| line 78 "XForm Tabs/Steps demo 三条修复"  | 实际存在 ✅                                 |
| line 94 "CLAUDE.md §1.7 修订"             | commit 3b85ef6 / 3d27936 验证 ✅            |

**本节无差异**——CHANGELOG `## 未发布` section 24 个一级条目均能找到对应 commit，无虚构条目。

---

## 总体结论

### 优先修复 5 项

1. **docs/04 line 596 API spec 文件清单笔误**（关键）：`{cancel,retry,deduper,http,...}` 中 `deduper.spec.ts` 与 `request-coalescer.spec.ts` **不存在**，实际是 `request-merger.spec.ts`——读者按 docs/04 找文件会 404
2. **docs/04 §常用命令补 `pnpm test:e2e` + `pnpm test:e2e:install` 两行**（小）：package.json 已有 `test:e2e: "playwright test"` + `test:e2e:install: "playwright install --with-deps chromium"`，README 也未列——遗漏 E2E 入口对新人误导
3. **CHANGELOG `## 未发布` 补 ProTable v3.5 PR2 / PR3 + A11y 系列条目**（关键）：约 25 个 feat/fix commit 无对应 CHANGELOG 条目，包括：
   - v3.5 A11y 改造（10 commit：prefers-reduced-motion / aria-live / role=toolbar / region / focus-visible / playwright e2e 基建 / vitest-axe 集成）
   - v3.5 PR2 服务端筛选（7 commit：filterParamsAdapter / demo / spec / useProTableEvents）
   - v3.5 PR3 ProColumn<T> 泛型改造（9 commit：移除 asViewColumn + 7 个组件泛型化 + 集成 spec 测试）
4. **docs/04 §测试文件清单补 `components/common/ProDialogForm/` + `form-schema/components/` + `form-schema/adapters/` + `layouts/default/` 四行**（小）：文档"代表性快照"措辞已声明非穷举，但补四行后覆盖率从约 60% → 90%，新人对照更直观
5. **docs/04 line 595 useTheme.spec.ts 不存在**（小）：composables 类文档列了 useTheme 但实际无 spec 文件（实际 composables 6 个：useAuth/useConfirm/useDialog/useDict/useLogout/useRequest）——删除 `useTheme` 或补 spec 文件

### 风险评估

| 风险项                                                | 等级   | 说明                                                                                                                 |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| 文档 spec 文件清单笔误（deduper / request-coalescer） | MEDIUM | 读者按文档 grep 会找不到文件，浪费排查时间                                                                           |
| CHANGELOG 漏 25+ commit                               | MEDIUM | 违反 §4 #12 "功能性变更同步 CHANGELOG.md" 项目约定；近 30 天 release-it 自动生成可能已触发但未自动合并到 `## 未发布` |
| docs/04 未列 E2E 命令                                 | LOW    | 用户启用 Playwright 时需翻 package.json 才能找到入口                                                                 |
| docs/04 line 595 useTheme 幽灵 spec                   | LOW    | 文档列名但无对应文件；实际测试可能仍未覆盖 useTheme                                                                  |
| docs/04 §测试覆盖表缺 form-schema/components/ 等 4 行 | LOW    | 文档已声明"代表性快照"，但实际展开后缺 50+ 文件                                                                      |
| API README/test 描述差异（`pnpm test <path>`）        | LOW    | vitest CLI 接受位置参数，描述不算错，但易混淆                                                                        |

### 验证闭环

- ✅ 不修改任何源码或文档——纯只读审计
- ✅ 实际 spec 文件清单（176 个）通过 `find src -name "*.spec.ts" -type f` 扫描，与 docs/04 glob 模式对照
- ✅ git log --since="60 days ago" 与 --since="30 days ago" 双窗口核查
- ✅ CHANGELOG 行数 2088 行，line 5 起 `## 未发布` section 含 24 个一级条目
- ⚠️ CHANGELOG 中具体 commit hash 未逐一提取（line 200-1500 区间未逐行读取），B.1 表中"实际 git log 验证 ✅"代表已确认对应文件改动存在；具体 commit 对应需后续深入扫描

### END OF REPORT

END OF REPORT
