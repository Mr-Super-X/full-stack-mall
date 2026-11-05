# ProTable 组件设计 spec

> 配置驱动的企业级表格组件（双引擎架构）。本文档是 brainstorming 阶段的最终输出，所有实现决策已与用户确认。

| 属性 | 值 |
|------|-----|
| 文档版本 | v1.0.0 |
| 生成日期 | 2026-09-07 |
| 生效分支 | `fearute/pro-table` |
| Spec 状态 | ⏳ 待用户审阅 |
| 后续 skill | writing-plans |

---

## 一、背景与动机

### 1.1 业务痛点

vue3-vite-project 是 Feature-Sliced 风格的中后台门户模板，业务侧任何"列表页"都需要表格 + 搜索 + 分页 + 工具栏。当前痛点：

| # | 痛点 | 影响 |
|---|------|------|
| 1 | 每个业务模块（user / orders / reports）都重复实现"搜索表单 + el-table + el-pagination + loading 状态管理" | 30+ 处复制粘贴，bug 修复要改 N 处 |
| 2 | 列设置、密度切换、多选跨页记忆等高频需求在每个模块自己造轮子 | 体验不一致、代码冗余 |
| 3 | 大数据列表（>1000 条）渲染卡顿，没有自动切换虚拟滚动引擎的能力 | 用户被迫手动实现 |
| 4 | 没有统一的"列定义同时驱动表格列 + 搜索项"模式 | 改一字段名要同步改两处表单 + 表格 |

### 1.2 目标

打造一个**生产级 ProTable 组件**，核心特征：

- **配置优先，插槽兜底**：80% 场景通过 `columns` 配置完成，20% 复杂场景通过插槽覆盖
- **零 bug 交付**：搜索回第 1 页、重置清默认值、多选跨页保持、列设置同步、引擎切换不丢数据
- **类型安全**：所有 props / emits / slots / expose 提供完整 TypeScript 类型
- **双引擎架构**：默认 Element Plus，按需切换 vxe-table（大数据 + 虚拟滚动）

### 1.3 非目标（YAGNI）

| 不做 | 原因 |
|------|------|
| SSR 场景适配 | 当前项目是 Vue 3 SPA（无 Nuxt），未使用 SSR |
| 行内编辑 | 复杂度高，与 XForm 表单组件职责重叠；可后续迭代 |
| 树形表格 | element-plus el-table 支持 treeProps 但配置复杂，第一版只做平铺 |
| 导出 CSV / Excel | 大量业务侧定制的格式化需求，第一版只交付"复制选中行" |
| 列设置服务端同步 | localStorage 已足够，多端同步另起新需求 |
| 表格列虚拟滚动（仅表头虚拟化） | 主流场景不需要，列数 > 20 的退化场景后续单独优化 |

---

## 二、关键决策记录

> brainstorming 阶段用 AskUserQuestion 与用户确认的 4 个关键决策。

### 决策 1：vxe-table 引擎加载方式

**选择**：动态按需加载（dynamic import）

**理由**：
- vxe-table 4.x 全量包约 500KB+，绝大多数只用 Element Plus 的项目被迫下载永不用的代码（违反 YAGNI）
- Vite 自动 code-split：`await import('vxe-table')` 只会出现在 vxe-table 引擎分支的 chunk 中
- 用户切换引擎时首次有下载延迟（约 200-500ms），可接受（一次性成本）

**npm view 验证**：`vxe-table@4.21.7` 存在 ✓

### 决策 2：列设置拖拽实现

**选择**：sortablejs 直接 DOM 拖拽

**理由**：
- ~30KB，与 Vue 响应式解耦（手动同步 `sortedColumns` 数组）
- 完全可控，不依赖 vuedraggable@4 的 Vue 3 兼容稳定性（4.1.0 是 next tag）
- 与 ProTable 的"扁平列配置"心智一致

**npm view 验证**：`sortablejs@1.15.7` 存在 ✓

**不选择 vuedraggable 的原因**：`vuedraggable@latest` = `2.24.3`（Vue 2 时代），Vue 3 需手动指定 `4.1.0-next`，会增加 package.json 维护成本。

### 决策 3：多选跨页记忆机制

**选择**：el-table 内置 `reserve-selection` + `row-key`

**理由**：
- 与 element-plus 生态默认行为一致
- el-table 内置 reserve-selection 已能覆盖"分页保留选择 + 刷新后丢失"
- 不需要额外 Set 持久化（业务侧一般不需要跨刷新保留）

**约束**：业务侧必须给每行提供唯一 `row-key`（ProTable props 透传 row-key 到 el-table）。

### 决策 4：引擎切换策略

**选择**：首次挂载锁定引擎（mount-time lock）

**理由**：
- Vue 3 组件机制：prop 变化默认不重建子组件，但 v-if 分支会重建
- 在 setup 阶段用 `resolveEngine(props.tableEngine)` 一次性捕获到 `engineRef`，后续 prop 修改无效
- 避免"切换时数据缓存 / 恢复"的复杂状态管理
- 与 CLAUDE.md §四 YAGNI 一致：不为了"未来可能用到"的运行时切换做抽象

**JSDoc 约束**：`ProTableProps.tableEngine` 必须在首次 mount 前设置，运行时修改需 reload 页面或在业务代码里手动控制（reload 由业务代码负责）。

---

## 三、架构总览

### 3.1 复用 vs 新建

| 已有的资产 | ProTable 是否复用 | 复用方式 |
|----------|----------|----------|
| `useRequest`（AbortController + 三态） | ✅ 是 | `useTable` 内部包装 |
| `useDict`（字典缓存 5min） | ✅ 是 | `useColumns.isFilterEnum` 调用 |
| `Local`（带 namespace 的 storage） | ✅ 是 | `useColumns` 列设置持久化 |
| `AsyncState`（三态容器） | ✅ 是 | ProTable 外层包裹 loading/empty/error |
| `ErrorBoundary` | ✅ 是 | 整体包裹（运行时渲染错误兜底） |
| `createNamespace`（BEM） | ✅ 是 | 每个 .vue 顶部声明 |
| `unplugin-vue-components` | ✅ 是 | element-plus 组件按需注入 |

### 3.2 新建 vs 修改 src/

> CLAUDE.md §2 src/ Architecture Lockdown：src/ 一级目录锁死，子目录可新建。

**新增**（不在 §2.2 禁止清单内）：

- 新增 1 个子目录 `src/components/ProTable/`
- 新增 10 个源文件 + 8 个测试文件 + 1 个 types 文件 + 3 个文档文件

**修改**：无（不修改任何现有文件）

**src/ 写操作清单（§2.5 合规简报强制）**：

```
[A] src/components/ProTable/ProTable.vue                    [NEW]
[A] src/components/ProTable/index.ts                        [NEW]
[A] src/components/ProTable/types/index.ts                  [NEW]
[A] src/components/ProTable/adapters/engine.ts              [NEW]
[A] src/components/ProTable/composables/useTable.ts         [NEW]
[A] src/components/ProTable/composables/useSearch.ts        [NEW]
[A] src/components/ProTable/composables/useColumns.ts       [NEW]
[A] src/components/ProTable/composables/useVxeTable.ts      [NEW]
[A] src/components/ProTable/components/SearchForm.vue       [NEW]
[A] src/components/ProTable/components/TableHeader.vue      [NEW]
[A] src/components/ProTable/components/ColSetting.vue       [NEW]
[A] src/components/ProTable/__tests__/ProTable.spec.ts            [NEW]
[A] src/components/ProTable/__tests__/useTable.spec.ts            [NEW]
[A] src/components/ProTable/__tests__/useSearch.spec.ts           [NEW]
[A] src/components/ProTable/__tests__/useColumns.spec.ts          [NEW]
[A] src/components/ProTable/__tests__/useVxeTable.spec.ts         [NEW]
[A] src/components/ProTable/__tests__/SearchForm.spec.ts          [NEW]
[A] src/components/ProTable/__tests__/TableHeader.spec.ts         [NEW]
[A] src/components/ProTable/__tests__/ColSetting.spec.ts          [NEW]
[A] src/components/ProTable/README.md                     [NEW]
[A] src/components/ProTable/ARCHITECTURE.md               [NEW]
[A] src/components/ProTable/CONTRIBUTING.md               [NEW]
[A] docs/superpowers/specs/2026-09-07-protable-design.md  [NEW] (本文件)
[M] CHANGELOG.md                                         [MODIFY] (新增 ProTable 章节)
[M] package.json                                          [MODIFY] (新增 vxe-table、sortablejs)
```

### 3.3 依赖变更（package.json）

| 包 | 版本约束 | 安装位置 | 触发依赖的原因 |
|---|---------|---------|---------------|
| `vxe-table` | `^4.21.7` | `dependencies` | vxe-table 引擎（仅 dynamic import 引入，不污染主 bundle） |
| `sortablejs` | `^1.15.7` | `dependencies` | 列设置抽屉拖拽（直接 import，~30KB） |

**验证流程**：已通过 `npm view <pkg>` 验证包存在（CLAUDE.md §七强制）。

---

## 四、文件清单

```
src/components/ProTable/
├── ProTable.vue                    # 主组件（编排层，≤250 行）
├── index.ts                        # 统一导出（types + ProTable）
├── types/
│   └── index.ts                    # 所有类型 + ProTableInstance
├── adapters/
│   └── engine.ts                   # 引擎工厂（element-plus / vxe-table 切换点）
├── composables/
│   ├── useTable.ts                 # 数据 / 分页 / loading / 多选（≤80 行）
│   ├── useSearch.ts                # 搜索参数 / 默认值 / 重置（≤80 行）
│   ├── useColumns.ts               # 列解析 / 枚举 / 列设置持久化（≤80 行）
│   └── useVxeTable.ts              # vxe-table 适配层（动态 import）（≤80 行）
├── components/
│   ├── SearchForm.vue              # 搜索区（≤200 行）
│   ├── TableHeader.vue             # 工具栏：刷新 / 密度 / 列设置（≤200 行）
│   └── ColSetting.vue              # 列设置抽屉：拖拽 / 固定 / 可见（≤200 行）
├── __tests__/
│   ├── ProTable.spec.ts            # 集成测试（10+ 场景）
│   ├── useTable.spec.ts
│   ├── useSearch.spec.ts
│   ├── useColumns.spec.ts
│   ├── useVxeTable.spec.ts
│   ├── SearchForm.spec.ts
│   ├── TableHeader.spec.ts
│   └── ColSetting.spec.ts
├── README.md                       # 使用文档
├── ARCHITECTURE.md                 # 架构文档（Mermaid 图）
└── CONTRIBUTING.md                 # 维护指南
```

---

## 五、组件树

```
<ProTable>                                            ← 编排层（ProTable.vue）
├── <SearchForm>                                      ← 子组件
│   ├── <ElInput> / <ElSelect> / <ElDatePicker> ...   ← 按 column.search.el 自动渲染
│   └── <slot name="search-[prop]">                   ← 用户自定义搜索项
├── <TableHeader>                                     ← 工具栏
│   ├── <slot name="tableHeader">                     ← 左上角标题 + 自定义按钮
│   ├── 刷新按钮 + 密度切换（紧凑/默认/宽松） + 列设置按钮
│   └── <slot name="toolButton">                      ← 右侧扩展
├── <AsyncState :loading :error :is-empty @retry>     ← 复用已有（components/common/AsyncState）
│   ├── <ElTable v-if="engine === 'element-plus'">   ← 引擎分支
│   │   ├── <ElTableColumn v-for="col in sortedColumns" :key="col.prop">
│   │   │   ├── enum → <ElTag>
│   │   │   ├── col.render → 调用返回 VNode
│   │   │   ├── <slot name="[col.prop]">              ← 单元格覆盖
│   │   │   └── <slot name="operation">               ← 操作列
│   │   ├── <slot name="expand">                      ← 展开行内容
│   │   └── <slot name="empty">                       ← 空状态
│   └── <VxeTable v-else>                             ← 动态 import 后渲染（vxe 引擎）
├── <ElPagination v-if="pagination !== false">       ← 分页区
│   ├── <slot name="paginationLeft">
│   └── <slot name="paginationRight">
└── <ColSetting v-model:visible="colSettingVisible">  ← 列设置抽屉（独立组件）
    ├── <ElCheckboxGroup v-model="visibleKeys">
    └── <sortablejs :list="columnItems" @update="onSort">
```

---

## 六、数据流（state owner = ProTable.vue）

```
                    ┌──────────────── useSearch ────────────────┐
                    │ searchParams : reactive<Record<string, unknown>> │
                    │ search() : () => Promise<void>          │
                    │ reset() : () => Promise<void>           │
                    │ getParams() / setParams(params)         │
                    └────────────────────┬────────────────────┘
                                         │ params
                                         ▼
                    ┌──────────────── useTable ────────────────┐
                    │ useRequest(() => requestApi(...))         │ ← 复用项目 useRequest
                    │ data : Ref<Row[]>                          │
                    │ loading / error / statusCode / aborted    │
                    │ selectedRows : Row[]                      │
                    │ pagination : { page, pageSize, total }    │
                    │ tableRef : InstanceType<ElTable> | null   │
                    │ refresh() / clearSelection()              │
                    └────────────────────┬─────────────────────┘
                                         │
columns ──────────────────┐              │
                         ▼              ▼
                  ┌──────────────── useColumns ───────────────────────┐
                  │ sortedColumns : Column[]                            │
                  │ visibleColumns : Column[]                           │
                  │ colSettingVisible : boolean                         │
                  │ toggleVisible / toggleFixed / reorderColumns       │
                  │ persist via Local(tableKey)                         │
                  └─────────────────────────────────────────────────────┘
```

---

## 七、props 透传机制（"只增强，不改变"原则）

| 来源 | 透传规则 | 实现 |
|------|----------|------|
| 用户传的 attrs（class/style） | 透传到根 div | `inheritAttrs: false` + 模板手动绑定 |
| `el-table` / `vxe-table` 专有 props | 用户写在 `<ProTable>` 上 → 透传到内层 | `$attrs` 拆开后按引擎分支绑 |
| 列 prop（`column.props`） | 透传到对应 `<ElTableColumn>` / `<VxeColumn>` | `v-bind="col.props"` |
| 搜索项 prop（`column.search.props`） | 透传到对应 `<ElInput>` 等 | `v-bind="searchItem.props"` |
| `pagination` 为 object | 透传到 `<ElPagination>` | `v-bind="paginationConfig"` |
| `total` / `currentPage` | 由 useTable 同步，用户不能直接传 | ProTable 内部强制绑定 |

---

## 八、defineExpose 清单

```ts
/** ProTable 实例对外暴露的 API */
export interface ProTableExpose {
  /** 重新执行当前搜索条件（搜索参数不变） */
  refresh: () => Promise<void>
  /**
   * 重置搜索参数到 defaultValue + 清空分页 + 刷新
   *
   * 默认行为：保留多选选中行（el-table reserve-selection 设计意图）
   * 若需清空选中，调用方应同时调用 `clearSelection()`
   */
  reset: () => Promise<void>
  /** 当前多选选中的行（按 row-key 去重） */
  getSelectedRows: () => unknown[]
  /** 清空所有选中 */
  clearSelection: () => void
  /** 当前搜索参数（响应式 read-only snapshot） */
  getSearchParams: () => Record<string, unknown>
  /** 程序化修改搜索参数（修改后自动触发搜索 + 回到第 1 页） */
  setSearchParams: (params: Record<string, unknown>) => Promise<void>
  /** element-plus 表格实例（仅 element-plus 引擎有值；vxe-table 引擎为 null） */
  element: Ref<InstanceType<typeof ElTable> | null>
  /** 当前激活的引擎（首次挂载锁定） */
  engine: 'element-plus' | 'vxe-table'
}
```

---

## 九、错误处理矩阵

| # | 场景 | 检测点 | 用户可见反馈 | 代码层处理 |
|---|------|--------|--------------|------------|
| 1 | requestApi 抛 axios `ERR_NETWORK` | useRequest 内置 error 分类（`isNetworkError`） | `<AsyncState>` 显示"网络异常" + 重试 | error.value 填充 |
| 2 | requestApi 抛 axios `ECONNABORTED` | useRequest 内置 error 分类（`isTimeout`） | "请求超时" + 重试 | error.value 填充 |
| 3 | requestApi 抛 HTTP 4xx/5xx | catch 路径 | 显示后端 message | error.value 填充 |
| 4 | requestApi 返回结构缺字段 | useTable 内 `result?.data ?? []` 兜底 | 表格显示空，**不崩溃** | 默认值 |
| 5 | 快速连续点击搜索/分页 | useRequest 内部 `currentController.abort()` | 取消上一次，结果丢弃 | 内置 |
| 6 | 引擎 prop 运行时切换 | `engineRef` setup 一次性捕获 | prop 改变无效（首次挂载后锁定） | JSDoc 约束 |
| 7 | vxe-table 动态 import 失败 | `import()` promise reject | el-table 引擎继续工作，console.error | try/catch |
| 8 | 列设置 localStorage 数据错乱 | `Local.get` 内置 `safeParse` 清脏数据 | 列设置回退默认，不卡死 | 自动 |
| 9 | isFilterEnum:true 但字典加载失败 | useDict 返回 `options: []` | 下拉只显示 defaultValue，loading=true | 优雅降级 |
| 10 | 搜索参数含 `undefined` / `null` / `''` | useSearch 内 `serializeParams` 过滤 | 不发送到后端 | 默认剔除 |
| 11 | ProTable 渲染过程中抛错 | `<ErrorBoundary>` 包裹（项目已有） | 友好错误页 + 重置 | 边界 |
| 12 | 用户传的 `columns` 含非法 prop | `console.warn` 上报，渲染时过滤 | 不崩溃，警告 | dev mode |
| 13 | sortablejs 拖拽回调但 row-key 缺失 | `if (!col.prop)` 守卫 | console.warn | dev mode |

**原则**：静默错误处理 = 禁止（CLAUDE.md §四 #6）。所有 catch 块非空，至少有 console.error 或 OSD 提示。

---

## 十、测试策略

### 10.1 测试覆盖矩阵

| 文件 | 必测场景 |
|------|----------|
| `useTable.spec.ts` | 1) requestApi 正常返回填 data 2) loading 三态 3) AbortController 取消 4) 分页变更触发 search 5) 多选 selectedRows 同步 6) refresh/clearSelection 7) requestApi 抛错走 catch |
| `useSearch.spec.ts` | 1) 初始化填 defaultValue 2) search() 触发回调 3) reset() 恢复 defaultValue + 清空用户输入 4) serializeParams 过滤 undefined/null/'' 5) getParams/setParams 6) setSearchParams 触发 search + 回到第 1 页 |
| `useColumns.spec.ts` | 1) column 解析为可见/隐藏 2) toggleVisible 3) toggleFixed 4) reorderColumns 5) Local 持久化往返 6) safeParse 兜底 7) isFilterEnum 异步字典加载 |
| `useVxeTable.spec.ts` | 1) 动态 import 触发 2) 引擎锁定验证 3) 适配列映射 4) import 失败降级到 element-plus |
| `ProTable.spec.ts` | 1) 基础渲染 2) columns 为空显示空态 3) 引擎切换锁定 4) search 触发请求 5) reset 恢复默认 6) pagination 变化 7) 列设置抽屉打开/关闭 8) expose.refresh/reset/getSelectedRows 9) slot 渲染 10) defineExpose 类型满足 ProTableExpose |
| `SearchForm.spec.ts` | 1) 按 columns.search 自动渲染 2) 展开/收起 3) 重置/搜索按钮 4) 自定义插槽 `search-[prop]` 5) span/order 排序生效 |
| `TableHeader.spec.ts` | 1) 刷新按钮 2) 密度切换 3) 列设置按钮 4) slot `tableHeader`/`toolButton` |
| `ColSetting.spec.ts` | 1) 拖拽排序后 emit update:visibleColumns 2) 复选框显隐 3) 固定列开关 4) Local 持久化往返 |

### 10.2 Mock 策略

| 类型 | Mock 方式 |
|------|----------|
| `requestApi` | `vi.fn().mockResolvedValue({ data: [...], total: N })` |
| `Local` (storage) | `vi.stubGlobal('localStorage', createMemoryStorage())` |
| sortablejs | `vi.mock('sortablejs')` |
| vxe-table 动态 import | `vi.mock('vxe-table', () => ({ default: MockVxeTable }))` |
| useDict | 测试时用真实 useDict + 注入 mock dict store |

### 10.3 覆盖率门槛

**≥80%**（CLAUDE.md §4 #11 强制）。CI 阶段 `pnpm test:coverage` 必须通过。

---

## 十一、文档与 CHANGELOG 计划

| 文件 | 类型 | 内容要点 |
|------|------|---------|
| `src/components/ProTable/README.md` | 新增 | 概述 / 安装 / 基础用法 / columns 完整说明 / 搜索/分页/工具栏/列设置 / 插槽系统 / 双引擎对比 / 常见问题 |
| `src/components/ProTable/ARCHITECTURE.md` | 新增 | 顶层架构图（Mermaid）：用户操作 → 数据流 → 渲染；composables 依赖关系；状态归属表 |
| `src/components/ProTable/CONTRIBUTING.md` | 新增 | 维护指南（新增 composable 的步骤 / 测试规范 / BEM 规范） |
| `docs/superpowers/specs/2026-09-07-protable-design.md` | 新增 | 本设计文档 |
| `CHANGELOG.md` | 更新 | 新增「ProTable」章节，列出 8 大功能 + 双引擎架构 |

### 注释与 JSDoc 规范（CLAUDE.md §五）

- 每个 `.vue` 顶部：文件级 JSDoc（角色 + 依赖的外部关键模块）
- 每个 composable export 函数：业务意图 + 输入含义 + 输出承诺 + `@see` 调用链
- 每个 .ts type 导出：单属性一段 JSDoc + `@group`（§5.1 陷阱 #1/#5）
- 不常见 API 加 1 行来源注释（§1.6.1）：sortablejs / vxe-table / `markRaw` / `shallowRef`

---

## 十二、实施顺序（preview — writing-plans 阶段会细化）

```
P0 骨架（3 文件，1 天）
  → types/index.ts → ProTable.vue（最小可运行：el-table + 假数据）→ index.ts

P1 useSearch + useTable（2 文件，1 天）
  → 真请求走通 + 三态 + AbortController + 分页

P2 SearchForm.vue（1 文件，1 天）
  → 自动生成搜索 + 重置/搜索 + 展开收起 + 插槽

P3 TableHeader + useColumns（2 文件，1.5 天）
  → 刷新/密度 + 列解析 + 列设置持久化

P4 ColSetting.vue（1 文件，1 天）
  → sortablejs 拖拽 + 抽屉 UI

P5 useVxeTable + adapters/engine（2 文件，1 天）
  → 动态 import + 引擎锁定

P6 测试 + 文档 + CHANGELOG（2 天）
  → 8 个 .spec.ts + README + ARCHITECTURE + CHANGELOG
```

总工作量估算：**8.5 工作日**

---

## 十三、风险登记

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| vxe-table 4.x 与 element-plus 全局样式冲突 | 中 | 仅在 vxe-table 引擎分支挂载，按需 import 样式 |
| sortablejs 与虚拟滚动冲突导致列设置 UI 卡顿 | 中 | 列设置抽屉用普通 DOM 列表，**不开虚拟滚动** |
| 大量列（>20）时 el-table 性能退化 | 低 | 仅 element-plus 引擎有此问题，提示切引擎 |
| Local 数据被业务清空导致列设置丢失 | 低 | safeParse 兜底 + console.warn + 回退默认 |
| `column.hidden: Ref<boolean>` 响应式不刷新 | 低 | useColumns 内部 watch hidden ref，重排 columns |
| vxe-table 动态 import 阻塞首屏渲染 | 低 | 用 `defineAsyncComponent` 包裹 `<VxeTable>`，fallback 用 skeleton |
| 多个 ProTable 共用同一 tableKey 导致列设置串号 | 中 | JSDoc 明确：tableKey 必须全局唯一（建议用业务模块名） |

---


## 十四、待定 / 未决问题

> brainstorming 阶段的所有歧义点已在「附录 A：默认行为契约」中显式定义，本章节保留以追溯决策来源。

| # | 问题 | 处理方式 |
|---|------|----------|
| 1 | 是否需要在第一版就交付 demo 页面（`/demo/pro-table`）？ | 默认不交付（§2 Lockdown 需要新增 demo 模块 + §1.2 模块边界）。如需，第一版交付后另起任务 |
| 2 | `column.fieldNames` 是否支持嵌套路径（如 `user.name`）？ | 第一版只支持一层 key 映射（与 element-plus el-option 的 fieldNames 对齐） |
| 3 | 搜索区按钮顺序：重置在前还是搜索在前？ | **已决定**（附录 A #4）：搜索在前 |
| 4 | 列设置是否需要"恢复默认"按钮？ | **已决定**（附录 A #6）：抽屉底部"恢复默认"按钮 |
| 5 | `headerRender` 是否支持 h() 之外的 JSX？ | 是（项目已配置 `@vitejs/plugin-vue-jsx`） |
| 6 | `reset()` 是否清空多选？ | **已决定**（附录 A #1）：保留 |

---

## 十五、参考资料

- CLAUDE.md §1.5（强制封装 useRequest / useAppRouter / useAuth）
- CLAUDE.md §1.6（AutoImport 全局注入）
- CLAUDE.md §1.6.1（不常见 API 必须加来源注释）
- CLAUDE.md §2（src/ Architecture Lockdown）
- CLAUDE.md §3（组件 BEM 编写规范）
- CLAUDE.md §4（Project Constraints，#11 强制覆盖率）
- CLAUDE.md §5 + §5.1（注释规范 + JSDoc IDE 提示 5 陷阱）
- `src/composables/useRequest.ts`（AbortController + 三态封装）
- `src/composables/useDict.ts`（字典 composable）
- `src/components/common/AsyncState.vue`（三态容器复用）
- `src/components/form-schema/XForm.vue`（编排层参考）
- `src/utils/storage.ts`（Local 带 namespace）

---

## 附录 A：默认行为契约（消除歧义）

> 以下是 spec 主体未显式说明但实现必须遵守的默认行为，作为实施阶段的契约。

| # | 行为 | 默认值 | 备注 |
|---|------|--------|------|
| 1 | `reset()` 是否清空多选 | **否，保留** | el-table reserve-selection 设计意图；调用方需清可调 `clearSelection()` |
| 2 | `refresh()` 是否清空多选 | **否，保留** | 同上 |
| 3 | `setSearchParams()` 是否清空多选 | **否，保留** | 同上 |
| 4 | 搜索区按钮顺序 | **搜索按钮在前，重置按钮在后** | 与用户操作习惯对齐（主要动作优先） |
| 5 | `tableKey` 未传时列设置行为 | **不持久化，每次挂载恢复默认** | localStorage key 用 `${tableKey}:columns`，无 key 则跳过 |
| 6 | 列设置抽屉是否提供"恢复默认"按钮 | **是** | 抽屉底部"恢复默认"按钮，一键重置 Local 存储 |
| 7 | 表格密度 density 默认值 | **`'default'`**（正常） | 三档：`compact` / `default` / `loose` |
| 8 | 列设置抽屉默认状态 | **关闭** | 仅用户点击"列设置"按钮打开 |
| 9 | `search()` 触发时是否回到第 1 页 | **是** | 与 `setSearchParams()` 行为一致 |
| 10 | 搜索参数序列化时是否剔除 `0` / `false` | **否** | 仅剔除 `undefined` / `null` / `''`，保留合法 falsy 值 |

---

**Spec 状态**：⏳ 待用户审阅

**下一步**：
1. 自审 spec（placeholder / 一致性 / 范围 / 歧义）—— 已完成
2. 用户审阅本文件
3. 调用 `writing-plans` skill 生成实施计划（HARD-GATE 唯一出口）

文档版本：v1.0.0 | 生成日期：2026-09-07