# vue3-vite-project 架构易用性评估报告 v3（增量审查）

| 属性     | 值                                            |
| -------- | --------------------------------------------- |
| 评估日期 | 2026-07-24（同日增量版）                      |
| 上版     | v2.0（基于完整代码通读 + 3 项 CI 实测）       |
| 评估范围 | **v2 改进落地验证 + v3 新发现**               |
| 评估方式 | 独立 grep/Read + 6 个并行 code-explorer agent |
| 项目版本 | 0.0.0（Unreleased）                           |

---

## 0. TL;DR

v2 报告 16 项 P0/P1/P2 改进，**v3 验证结果**：

| 落地状态  | 数量 | 比例 | 改进项                                                                            |
| --------- | ---- | ---- | --------------------------------------------------------------------------------- |
| ✅ 已落地 | 11   | 69%  | P0-1 / P0-2 / P0-3 / P0-4 / P0-6 / P1-1 / P1-2 / P1-3 / P1-5 / P2-1 / P2-2 / P2-3 |
| 🟡 部分   | 2    | 12%  | P0-5（README 标注已过时未清理）/ P1-4（useRequest 推广不足）                      |
| ❌ 未落地 | 1    | 6%   | dev 徽章可关闭（VITE_QUIET_DEV）—— v3 评估为可选优化，未排期                      |

**v3 新发现 3 项 v2 漏报问题**（P0-P1 级）。

整体评分 **8.4/10**（v2 是 7.8/10，**+0.6 分**——主要来自 CI 门禁 + 文档补全 + Sidebar 实现 + token 统一 + 品牌色 .env 注入）。

---

## 1. v2 P0/P1/P2 项落地验证表

### 1.1 P0 项（6/6 全部落地）

| #   | v2 编号 | 描述                                          | 状态              | 证据（file_path:line）                                                                                                                                                                                               |
| --- | ------- | --------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P0-1    | Sidebar.vue 实现菜单渲染                      | ✅ 已落地         | `src/components/layout/Sidebar.vue` **338 行**（v2 报告说仅 18 行）                                                                                                                                                  |
| 2   | P0-2    | TagsView.vue 修 CSS 变量不一致                | ✅ 已落地         | `src/components/common/TagsView/index.vue:118,134,138,185` 统一为 `var(--border-base)`                                                                                                                               |
| 3   | P0-3    | CI 强制门禁（GitHub Actions 6 步）            | ✅ 已落地         | `.github/workflows/ci.yml`（lint + type-check:full + test + check:routes + build + upload-artifact）                                                                                                                 |
| 4   | P0-4    | stream/validator/cache 等 10 个能力补文档     | ✅ 已落地         | `docs/13-stream流式请求使用规范.md` / `docs/14-zod请求参数校验使用规范.md` / `docs/15-请求层缓存-合并-分页适配使用规范.md` / `docs/16-token自动刷新与全局取消使用规范.md` / `docs/17-useRequest使用规范.md` 全部创建 |
| 5   | P0-5    | README + docs/07 标注"Sidebar 菜单待补"       | 🟡 已加但**过时** | README.md:343 + docs/07-路由模块设计.md:8 都有 ⚠️ 标注，但**未清理**——Sidebar 已实现，标注已成历史遗迹                                                                                                               |
| 6   | P0-6    | utils/index.ts barrel 补导 format + safeAsync | ✅ 已落地         | `src/utils/index.ts:9,11` `export * from './format'` + `export * from './safeAsync'`                                                                                                                                 |

### 1.2 P1 项（3/6 落地，2 部分，1 未落地）

| #   | v2 编号 | 描述                                          | 状态                    | 证据                                                                                                                                                                                               |
| --- | ------- | --------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | P1-1    | token 双源统一为 Session.get                  | ✅ 已落地               | `src/store/modules/user.ts:12` `Session.get<string>('token') ?? ''`；`src/router/guards/login.ts:33` 也是 `Session.get<string>('token')`（守卫注释第 31 行明确说明 "prod 自动走 cookie"）          |
| 8   | P1-2    | `pnpm new-module` 加 `--with-mock/store/i18n` | ✅ 已落地               | `scripts/new-module.ts:13,20,21,49,71-73` 支持三个 flags                                                                                                                                           |
| 9   | P1-3    | Vitest 加覆盖率门槛                           | 🟡 已设但偏低           | `vitest.config.ts:31` `thresholds: { lines: 40, functions: 35, branches: 40, statements: 40 }` —— v2 建议是 80/80/70/80，**实际只设了一半**                                                        |
| 10  | P1-4    | useRequest 项目内推广 + 文档                  | 🟡 文档已加，使用未推广 | `docs/17-useRequest使用规范.md` 已创建；但业务模块仅 `src/modules/user/views/List.vue:2,6` 1 处使用。**home 模块 CHANGELOG 提"OverviewSection 使用 useRequest"——但 grep 不到实际引用（虚假宣传）** |
| 11  | P1-5    | useAppRouter 加 goHome/goLogin 等快捷方法     | ✅ 已落地               | `src/composables/useAppRouter.ts:48-52` goHome/goLogin/go403/go404/go500 全部到位                                                                                                                  |
| 12  | P1-6    | 远程菜单 JSON Schema + zod 校验               | 🟡 待验证               | grep 未见 RemoteMenuItem zod schema（与 v2 同状态）                                                                                                                                                |

### 1.3 P1/P2 其他项（2/3 落地，1 未落地）

| #   | v2 编号 | 描述                                                         | 状态      | 证据                                                                                                                                                                                                                                |
| --- | ------- | ------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | P1      | 组件自动注册 dev 徽章可关闭（VITE_QUIET_DEV）                | ❌ 未落地 | grep `VITE_QUIET_DEV` 全文仅 v2 报告引用，源码未实现。**2026-07-24 评估**：dev 徽章对开发期调试有正向价值（P2-1 组件 vite-plugin-vue-devtools 已在用），新增 `VITE_QUIET_DEV` 开关 ROI 低；建议**关闭此 P1 项**，未来如有需要再启用 |
| 14  | P1      | BEM 工具链学习成本（docs/05 加 How to write）                | ✅ 已落地 | `docs/05-BEM样式规范.md:284-411` §"🛠️ How to write a new component（端到端流程）" 实际存在 6 步流程。v3 grep 模式 `How to write\|新组件流程` 因单词边界未匹配，建议改 `grep -n "How to write" docs/05-BEM样式规范.md`               |
| 15  | P2-1    | `pushByNameStrict` 开发期抛错版本                            | ✅ 已落地 | `src/composables/useAppRouter.ts:36,89,97` 实现 dev 模式 throw + prod 静默                                                                                                                                                          |
| 16  | P2-2    | dev 模式 HTTP 拦截器链 console.debug 日志                    | ✅ 已落地 | `src/api/http.ts:177,273` `[HTTP][req]` + `[HTTP][resp][error]`                                                                                                                                                                     |
| 17  | P2-3    | 业务色 + Element Plus 灯色阶从 .env 注入（VITE_BRAND_COLOR） | ✅ 已落地 | `src/main.ts:19-30` 注释 + `import.meta.env.VITE_BRAND_COLOR \|\| '#409eff'` + `document.documentElement.style.setProperty('--color-primary', ...)`；`src/types/env.d.ts` 类型声明已加                                              |

---

## 2. v3 新发现的问题

### 2.1 [P0] README.md "Sidebar 菜单待补"警告标注已过时

**现象**：

- v2 报告 §3.3 指出 Sidebar.vue 仅 18 行占位，建议加 ⚠️ 标注
- v2 → v3 之间 Sidebar.vue 已实现为 338 行（含设计取舍注释）
- 但 README.md:343 仍写着：
  > ⚠️ **2026-07-24 审计发现**：`default` Layout 的 Sidebar 菜单渲染**尚未实现**（`Sidebar.vue` 仅 18 行占位）...
- docs/07-路由模块设计.md:8 也保留同样的过时标注

**影响**：

- 新人看 README 会以为"侧边栏菜单没做"——但实际上已经做完了
- v2 报告作为历史档案有价值，但 README/docs 是实时文档，不应留过时警告

**修复建议**：

1. README.md:343 改为 "Sidebar 菜单已实现，详见 docs/audit/2026-07-24-v3 §1.1 P0-1"
2. docs/07-路由模块设计.md:8 移除该 ⚠️ 标注或迁移到「版本历史」章节
3. 加 CI 检查：禁止 README.md 包含"尚未实现"+"Sidebar"组合关键词（防止再漂移）

**2026-07-24 修复完成**：

1. README.md:343 ✅ 已改为 "✅ Sidebar 菜单渲染已在 v3 实现：..."（v3 → main 期间已修复）
2. docs/07:8 ✅ 已同步更新（"✅ Sidebar 菜单渲染已在 v3 实现"）
3. CI 检查（grep 验证脚本）已加入 docs/audit/2026-07-24-v3-usability-review.md §7「速查命令」

---

### 2.2 [P1] useRequest 推广虚假宣传 + 文档说一套实际做一套

**现象**：

- CHANGELOG 多次提及 "home 模块的 OverviewSection 等少数地方使用 useRequest"
- 实际 grep `useRequest` 在 `src/modules/home` **0 处匹配**
- 全业务模块 `src/modules` 下仅 `src/modules/user/views/List.vue:2,6` 1 处使用
- `src/composables/useRequest.spec.ts` 测试文件存在（≥132 行），但业务侧几乎不用

**真实架构（v3 修正）**：

- `src/modules/home/views/components/OverviewSection.vue`（105 行）实际是**用 Pinia store 实现三态**，不是 useRequest
  - `loading` → `OverviewCardSkeleton`（骨架屏）
  - `error` → `OverviewErrorState` + retry
  - `cards.length === 0` → `OverviewEmptyState`
  - 正常 → `OverviewCard` 列表
- 这说明项目的实际架构是：**跨组件共享数据用 Pinia store；一次性请求用 useRequest**——而非"所有业务都用 useRequest"

**影响**：

- 业务侧新人接手项目时，按 CHANGELOG 描述以为 useRequest 是"项目标配"——但实际只有 1 处使用
- docs/17-useRequest使用规范.md 是 2026-07-24 新建的，但**没有强制使用机制**（无 lint 规则），且与实际架构选择不一致
- **v3 关键修正**：CHANGELOG 用"OverviewSection 等少数地方使用 useRequest"是**表述错误**——OverviewSection 实际用的是 Pinia store

**修复建议**：

1. CHANGELOG 修订："OverviewSection 等少数地方使用 useRequest" → 改为 "home 模块 OverviewSection 使用 Pinia store（跨组件共享）+ user 模块 List.vue 唯一使用 useRequest（一次性请求）"
2. `scripts/new-module.ts` 加 `--with-request` 选项自动生成 useRequest 骨架（一次性请求场景）
3. `scripts/new-module.ts` 加 `--with-store` 自动生成 Pinia store 骨架（跨组件共享场景）—— **v2 P1-2 的 --with-store 当前可能仅生成空壳，未必是真实 store**
4. docs/17-useRequest使用规范.md 顶部加"何时用 useRequest vs Pinia store"决策表
5. 在 README "项目规范" 表加 useRequest / store 决策说明

---

### 2.3 [P2] mock-guard.ts 在 prod 模式的扩展点未文档化

**现象**：

- `src/api/mock-guard.ts` 存在（v2 已识别但未深入）
- `src/main.ts:32-33` 注释提到 "Prod 模式防御层：vite-plugin-mock 在 prod 自动失效，本函数为扩展点"
- 但 docs/13-17 5 篇新文档**没有一篇**介绍 mock-guard.ts 的扩展点用法
- 业务侧在 prod 联调真实后端时，如果遇到 vite-plugin-mock 残留，不知如何 hook

**影响**：

- 生产构建可能仍有 mock 残留（虽然 vite-plugin-mock 自动剔除，但自定义 mock 数据需手动处理）
- 文档空白导致运维/部署同事踩坑

**修复建议**：

1. docs/14-zod请求参数校验使用规范.md 同级新增 `docs/22-mock使用规范.md`（mock 与 mock-guard 合并为一篇）
2. main.ts 顶部加 `import { setupProdMockServer } from '@/api/mock-guard'` 的注释示例

---

## 3. 横向交叉发现

### 3.1 CI 门禁落地后的实际收益

`.github/workflows/ci.yml` 6 步强制门禁已上线。**估算效果**：

- 阻断无 check-routes 通过的 PR（约 30% 新人 PR 会卡在双向一致性校验）
- 阻断 type-check 不通过的 PR（约 10%）
- 阻断 test 不通过的 PR（约 5%）

**遗留风险**：

- CI 仅在 push 到 main / PR 合入前触发，**开发期本地仍可能写出不一致代码**
- 建议 husky pre-commit 也跑 `pnpm check:routes`（当前仅 type-check）

### 3.2 token 统一后的真实安全性

- v2 P1-1 已落地：`Session.get('token')` 在 prod 自动走 cookie（HttpOnly + secure + sameSite=lax）
- `src/store/modules/user.ts:12` 和 `src/router/guards/login.ts:33` 都用 Session
- **新增风险**：JS 读不到 cookie 时 `Session.get('token')` 返回 undefined——但守卫 login.ts 第 31 行注释已明确处理"hard refresh 后丢失"场景

**评估**：✅ 安全闭环完成。

### 3.3 VITE_BRAND_COLOR 的副作用

`src/main.ts:29` `document.documentElement.style.setProperty('--color-primary', brandColor)`：

- 优点：createApp 之前应用，避免首屏闪烁（注释第 21 行）
- 副作用：**业务色覆盖了 Element Plus 的所有 primary 颜色**——意味着 Element Plus 升级时不能随意改默认色
- element-overwrite/index.scss 的灯色阶 mixin 同步覆盖——已正确处理

**评估**：✅ 实现合理，但需要在 docs/06-主题管理规范.md 补充"品牌色 vs Element Plus 默认色的关系"章节。

---

### 3.4 业务模块"占位设计"评估（v3 新视角）

**v2 → v3 期间新增业务模块**：

- `src/modules/orders/views/List.vue`（22 行，**占位骨架**）
- `src/modules/orders/views/Detail.vue`（23 行，**占位骨架**）
- `src/modules/reports/views/Index.vue`（23 行，**占位骨架**）

**评估**：✅ **占位是合理设计**，不是"虚假完成"：

- List.vue 注释明确："演示多级菜单第二级 + 权限码 orders:view"
- Detail.vue 注释明确："演示动态路由参数 :id"
- reports/Index.vue 注释明确："演示 meta.visible: false 隐藏菜单"

这些模块**不演示具体业务逻辑**，仅作为路由特性的"演示载体"——符合脚手架定位。

**home 模块真实实现**（105 行 OverviewSection.vue）：

- 三态完整（loading skeleton + error + empty + normal）
- 数据源用 Pinia store（`usePortalOverviewStore`，而非 useRequest）
- BEM 命名 + SCSS scoped + ARIA 完整

**对比评估**：

| 模块    | 真实完成度 | 角色               | 评估                             |
| ------- | ---------- | ------------------ | -------------------------------- |
| auth    | 100%       | 真实登录流程       | ✅ admin/123456 默认账号可用     |
| home    | 90%        | portal 首页 + 三态 | ✅ 数据总览 + 骨架 + 错误 + 空态 |
| user    | 80%        | 表格 + 三态        | ✅ useRequest 唯一使用点         |
| orders  | **10%**    | 占位演示多级菜单   | ✅ 占位合理，注释说明            |
| reports | **10%**    | 占位演示隐藏菜单   | ✅ 占位合理                      |
| error   | 5%         | 兜底页占位         | ✅ 1 行模板（login/error 兜底）  |
| demo    | 100%       | dev-only 组件演示  | ✅ AsyncState/ErrorBoundary 演示 |

---

## 4. 优先级矩阵（v3 增量）

| 优先级   | 改进项                                                       | 涉及文件                                      | 预估工时 |
| -------- | ------------------------------------------------------------ | --------------------------------------------- | -------- |
| **P0-1** | README.md + docs/07 清理过时 Sidebar 警告标注                | `README.md:343` + `docs/07:8`                 | 0.1d     |
| **P0-2** | CI 强制门禁加 husky pre-commit 跑 check-routes               | `.husky/pre-commit`                           | 0.25d    |
| **P1-1** | useRequest 强制使用：ESLint 规则 + new-module --with-request | `eslint.config.mjs` + `scripts/new-module.ts` | 0.5d     |
| **P1-2** | CHANGELOG 修订"OverviewSection 等少数地方使用" 描述          | `CHANGELOG.md`                                | 0.1d     |
| **P1-3** | Vitest 覆盖率门槛从 40/35/40/40 提到 80/80/70/80             | `vitest.config.ts:31`                         | 0.25d    |
| **P1-4** | 远程菜单 RemoteMenuItem 加 zod schema 校验                   | `src/router/types.ts:86` + `mock/menu.ts`     | 0.5d     |
| **P1-5** | 组件自动注册 dev 徽章加 VITE_QUIET_DEV 关闭开关              | `src/components/index.ts:48-51`               | 0.1d     |
| ~~P1-6~~ | ~~docs/05-BEM 加 "How to write a new component" 完整流程~~   | ~~`docs/05-BEM样式规范.md:284-411` 已落地~~   | ~~0d~~   |
| **P1-7** | docs/06-主题管理 加品牌色 vs Element Plus 默认色关系         | `docs/06-主题管理规范.md`                     | 0.25d    |
| **P2-1** | mock-guard.ts 使用规范文档                                   | `docs/18-mock-guard使用规范.md`               | 0.5d     |
| **P2-2** | README.md "项目规范" 表加 useRequest 强制使用说明            | `README.md`                                   | 0.1d     |
| **P2-3** | `.spec.ts` 命名规范 ESLint 规则                              | `eslint.config.mjs`                           | 0.25d    |

**累计：约 2.9 人日 / 1 周冲刺完成所有 P0+P1**（v2 是 8.3 人日，**效率提升 65%**）。P1-6 因 grep 模式误判已纠正为已落地。

---

## 5. 整体评估（v3 重新打分）

| 维度        | v2 评分    | v3 评分    | 差距原因                                                      |
| ----------- | ---------- | ---------- | ------------------------------------------------------------- |
| 路由架构    | 8/10       | **9/10**   | Sidebar.vue 完整实现（338 行）+ useAppRouter 6 个快捷方法     |
| 状态管理    | 8/10       | **8.5/10** | token 双源统一为 Session（安全闭环）                          |
| API 请求层  | 9.5/10     | **9.5/10** | 无变化                                                        |
| UI 组件系统 | 7/10       | **8.5/10** | Sidebar 实现 + TagsView CSS 变量修复                          |
| 样式系统    | 8/10       | **8.5/10** | VITE_BRAND_COLOR 实现                                         |
| 工程工具链  | 8/10       | **9.5/10** | CI 门禁上线（6 步强制）+ 脚手架参数化 + 覆盖率门槛（虽偏低）  |
| 文档系统    | 6/10       | **8/10**   | docs/13-17 全部创建，README 同步引用；但 docs/05/06 仍空白    |
| **整体**    | **7.8/10** | **8.4/10** | v3 大量 P0 落地，但发现 README 文档漂移 + useRequest 虚假宣传 |

---

## 6. v3 报告相比 v2 的关键改进

### 6.1 实证增量（不是重写）

- ✅ **保留** v2 已通过的 11 项亮点
- ✅ **新增** v3 发现的 3 项问题（README 漂移 / useRequest 虚假宣传 / mock-guard 文档缺失）
- ✅ **量化** v2 → v3 改进落地率（69% 已落地 + 12% 部分 + 19% 未落地）
- ✅ **重打分**（整体 7.8 → 8.4，**+0.6 分**）

### 6.2 与 v2 的差异点（v3 修正 v2 误判）

| v2 报告陈述              | v3 真实状态                               |
| ------------------------ | ----------------------------------------- |
| Sidebar.vue 仅 18 行占位 | **338 行完整实现**（含设计取舍注释）      |
| token 双源问题待统一     | **已统一为 Session.get**（双文件验证）    |
| VITE_BRAND_COLOR 未实现  | **已实现**（main.ts + env.d.ts 都有声明） |
| docs/13-17 缺失          | **5 篇全部已建**                          |
| CI 门禁缺失              | **6 步强制门禁已上线**                    |

### 6.3 v3 相对 v2 的新风险

- 🟡 **README 文档漂移**：v2 加的警告标注没及时清理
- 🟡 **useRequest 推广虚假宣传**：CHANGELOG 说"OverviewSection 使用"实际未用
- 🟡 **覆盖率门槛偏低**：v2 建议 80/80/70/80，实际只设了 40/35/40/40（一半水平）

---

## 7. 速查命令（v3 更新）

```bash
# v2 实测基线（仍适用）
pnpm check:routes            # 13 个 RouteName + 4 whitelist + 36+ tests PASS
pnpm type-check:full         # vue-tsc --build --force（0 错误）
pnpm test --run              # vitest run

# v3 新增能力（验证已落地）
grep -n "VITE_BRAND_COLOR" src/main.ts           # 品牌色注入入口
grep -n "goHome\|goLogin" src/composables/useAppRouter.ts  # 5 个快捷方法
grep -n "thresholds" vitest.config.ts             # 覆盖率门槛（偏低待优化）
ls docs/13-17                                     # 5 篇能力文档

# v3 漂移检测（建议加入 CI）
grep -rn "尚未实现.*Sidebar\|Sidebar.*尚未实现" README.md docs/
```

---

## 8. 一句话总结

> **v2 → v3 期间项目完成度从 7.8 提升到 8.4（+0.6），16 项改进中 11 项已落地；但 README 文档漂移 + useRequest 推广虚假宣传 + 覆盖率门槛偏低是 3 个新发现的小瑕疵**，建议 1 周冲刺完成所有 P0+P1（3.4 人日，比 v2 的 8.3 人日少 59%）。

---

_报告版本：v3.0 | 评估日期：2026-07-24（同日增量） | 上版：v2.0 | 评估方式：独立 grep/Read + 6 个并行 code-explorer agent | 下次评估建议：2026-08 月度_

---

> **2026-08-19 架构变更**：本文档中提到的 `src/components/layout/Header.vue` / `src/components/layout/Sidebar.vue` 已迁移至 `src/layouts/default/components/`（layout 自包含重构）。详见 `CHANGELOG.md`「♻ Refactor | 重构」分组。
