# prefer-wrapped-component ESLint 规则设计稿

> 2026-11-12 | 状态：已获用户批准（「你把2、3、4步做了」覆盖第 3 步方案原文），随批次一并实现。

## 1. 背景与问题

全栈项目以本仓库为前端底座（`full-stack/frontend`），AI 代理做"admin 加页面"类需求时
不消费 `packages/ui` 既有封装，退回 Element Plus 原始组件重复实现（裸拼 `el-table`、
手写 `ElMessageBox.confirm`）。现有机械防线只有 AGENTS.md「业务代码强制封装」的
`no-restricted-imports` 两条（useRouter / axios），"该用封装却用原始组件"的语义违规
零成本。docs/50-页面开发组件选型速查.md（同批次）已建正面清单，本设计稿补齐
"漂移可见"的机械提醒层。

## 2. 方案

| 项 | 决策 |
| --- | --- |
| 规则名 | `local/prefer-wrapped-component` |
| 级别 | **warn**（不阻断构建 / CI；合理场景须能通过） |
| 实现 | `scripts/eslint-rules/prefer-wrapped-component.mjs`，纯 ESM 自包含（对齐 package-contract.mjs 形态），node:test + RuleTester 单测 |
| 注册 | `eslint.config.mjs`：plugins 合并进 `app/package-contract` block 的 `local.rules`（flat config 同名 plugin 不可跨 block 重复定义），新 block `app/prefer-wrapped-component` 置 warn |

### 检测面（刻意收窄，KISS）

| 代码形态 | 提示改用 | 理由 |
| --- | --- | --- |
| 模板 `<el-table>` / `<ElTable>` | `<ProTable>`（docs/29） | 列表页最高频重复实现点 |
| 模板 `<el-form>` / `<ElForm>` | `<XForm>`（docs/24） | 表单页最高频重复实现点 |
| 模板 `<el-dialog>` / `<ElDialog>` | `useDialog()` / `<ProDialog>`（docs/27） | 弹窗状态往返手写是典型重复劳动 |
| JS/TS `ElMessageBox.confirm / alert / prompt` | `useConfirm()`（docs/32） | 二次确认统一封装（取消语义差异见 CLAUDE.md §1.5） |

不检测 `el-pagination` / `el-form-item`：前者几乎总伴随裸 `el-table` 出现（已被覆盖），
后者是前者的子件（重复报噪声）。后续如需扩面，走独立评审。

### 豁免路径（与 docs/50 §3 一一对应）

- `apps/docs/src/modules/demo/**` —— 教学 demo 有意对照原始写法
- `packages/ui/**` —— 封装内部实现本身基于原始组件
- `**/*.spec.*` / `**/test-utils/**` —— 测试桩与测试工具
- `apps/*/src/layouts/**` 不在检测 files 内（与 business-wrap-rule 的 files 对齐：仅 `apps/*/src/modules/**` + `apps/*/src/components/**`）

### 为什么 warn 不是 error

对齐仓库「治理零人工税」立场：error 会误伤合理场景（demo 对照、封装内部、
临时原型），warn 提供可见性 + review 抓手而不制造阻塞税。存量 admin 5 个视图的
原始组件实现会报 warn——**这是预期行为**（让存量漂移可见，渐进改造另行立项）。

## 3. 测试方案

`scripts/eslint-rules/prefer-wrapped-component.spec.mjs`：
RuleTester（node:test），vue 模板用例经 .pnpm 存储定位 vue-eslint-parser 绝对路径
加载（对齐 package-contract.spec.mjs 的 TS parser 加载模式）。

- valid：4 个豁免路径 × 违规写法（路径豁免优先）；合法写法（`<ProTable>`、
  `useConfirm()`、无违规模板）；demo 目录内 `<el-table>`
- invalid：4 类检测面 × kebab/Pascal 大小写（JS 面 × 3 个方法名），断言 messageId

运行：`node --test scripts/eslint-rules/prefer-wrapped-component.spec.mjs`（根
`test:eslint-rules` 已随本批次扩为 `node --test "scripts/eslint-rules/*.spec.mjs"`
目录 glob——经 AskUserQuestion 获用户批准；Windows 下 `node --test <dir>` 目录参数
实测 MODULE_NOT_FOUND，glob 形式为可靠替代）。

## 4. 联动登记

- docs/50 §1/§3/§5 已引用本规则名与豁免清单（同批次落地）
- CHANGELOG.md「未发布」区补条目
- AGENTS.md「业务代码强制封装」节不改（warn 规则是提醒层，强制层仍是原有 error 两条）
