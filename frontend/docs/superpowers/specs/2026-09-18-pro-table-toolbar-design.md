# ProTable 工具栏 / 批量操作条 / CSV 导入导出设计

> 版本：v1.0.0 | 日期：2026-09-18 | 分支：`feature/engine-optimization` | 状态：已批准（用户确认「按你推荐」）
> 前置：2026-09-18 双视角审查（设计师 + 产品经理）结论——当前仅有裸 `tableHeader`/`toolButton` slot，无作用域数据、无批量条、无权限/危险操作语义通道

---

## 1. 背景与目标

### 1.1 缺口基线（2026-09-18 审查结论）

- 真实业务列表页标配「新增 / 批量 / 导入 / 导出」按钮，当前只有无作用域的 `tableHeader` slot 可塞——`selectedRows` 需 ref 回读，批量禁用态每个页面重写一遍
- 无批量操作条（Ant Design Pro / vben 惯例：选中后浮出「已选 N 项 + 批量操作 + 清除」）
- 权限（`v-auth`）、危险操作二次确认（`useConfirm`）、主按钮唯一性约束无语义通道，页面间风格必然漂移
- 导入导出连工具函数都不在（2026-09-17 会话曾实现 SelectionBar/importExcel/exportExcel，未提交已丢失，本次按本设计重做）

### 1.2 迭代目标

| #  | 目标                                                        | 价值维度     |
|----|-------------------------------------------------------------|--------------|
| G1 | `tableHeader`/`toolButton` slot 作用域增强（下发选中/loading） | 消灭样板代码 |
| G2 | 配置式 `toolbar` API（权限/危险确认/折叠收纳组件代管）        | 业务方 DX    |
| G3 | 内置 SelectionBar 批量操作条（+ slot 完全接管通道）           | 交互一致性   |
| G4 | 零依赖 CSV 导入导出纯函数 utils                               | 不引第三方包 |

### 1.3 非目标（本迭代明确不做）

- `.xlsx` 格式（引入 xlsx 依赖未验证且违反零依赖原则，后续有真实需求再立项）
- 服务端异步导出（大文件导出走后端任务，前端只做触发——属业务层，不进组件）
- 导入的模板下载/错误明细回显 UI（业务强相关，utils 只负责解析成行数据）
- 折叠阈值自适应容器宽度（固定 `maxVisibleActions`，后续有真实痛点再迭代）

---

## 2. 关键设计决策

| #  | 决策点 | 拍板结论 | 备选与拒绝理由 |
|----|--------|----------|----------------|
| D1 | slot 与配置关系 | 并存——slot 内容渲染在配置按钮**前**，100% 向后兼容 | 配置替代 slot：存量业务写法全 break |
| D2 | `perm` 形态 | `string \| string[]`，内部归一为 `hasPerm([...])`（AND 语义，与 `v-auth` 一致） |  ANY 语义另开 `permAny`：真实需求未出现，YAGNI |
| D3 | 折叠策略 | `maxVisibleActions`（默认 3）按数组顺序截断，超出收进 ElDropdown「更多」；primary 也在计数内（业务自己排序） | primary 永不折叠：实现复杂且业务可控性更差 |
| D4 | 主按钮唯一性 | 多个 `type:'primary'` 时 `console.warn`（不阻断） | 强制覆盖为首个 primary：静默变更业务意图，更糟 |
| D5 | SelectionBar 显示条件 | `selectedCount > 0` 即显示（多选/单选统一，业务可用 `hidden` 控制） | 仅多选列显示：radio 场景也要批量条的真实需求存在（单选审核流） |
| D6 | 批量条位置 | TableHeader 下方独立浮出条（vben/AntD Pro 惯例），**非**表格内嵌 | 内嵌表头：挤占工具栏空间，与密度切换联动怪异 |
| D7 | CSV 导入导出形态 | 零依赖纯函数（BOM + RFC4180 引号转义）；utils 只产出行数据，上传/校验/错误明细归业务 | 组件内建导入导出：强依赖后端模板/校验规则，props 必然膨胀 |
| D8 | autoHeight 联动 | SelectionBar BEM 根类注入 `useAutoHeight.selectors`（新增可选 key），消除浮出时 ~40px 高度偏差 | 忽略偏差：autoHeight 启用页批量条出现即底部溢出，不可接受 |

---

## 3. 详细设计

### 3.1 类型（`types/index.ts` 新增）

```ts
/** Toolbar 点击上下文 —— 配置回调与 slot 作用域共用同一份数据 @group ProTable 类型 */
export interface ToolbarCtx<T extends object = Record<string, unknown>> {
  /** 当前选中行（row-key 去重后快照） */
  selectedRows: T[]
  /** 选中数量（等价 selectedRows.length，模板里少一层访问） */
  selectedCount: number
  /** 表格请求进行中（批量操作防重入用） */
  loading: boolean
  /** 触发表格刷新（批量操作完成后调用） */
  refresh: () => Promise<void>
}

/** ToolbarAction 二次确认配置 —— 字符串为 content 简写 @group ProTable 类型 */
export type ToolbarConfirm = string | ({ title?: string } & Pick<UseConfirmOptions, 'danger' | 'confirmButtonText'>)

/** 工具栏/批量条 action 配置 —— 组件代管权限/危险确认/折叠收纳 @group ProTable 类型 */
export interface ToolbarAction<T extends object = Record<string, unknown>> {
  /** 按钮文本 */
  label: string
  /** EP 按钮语义色：danger 用于批量删除等危险操作（默认 'default'） */
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  /** 左侧图标（EP 图标组件） */
  icon?: Component
  /** 权限码（string 或 AND 数组），无权限整块不渲染 */
  perm?: string | string[]
  /** 二次确认：字符串 = 确认正文（自动套 useConfirm）；建议危险操作必配 */
  confirm?: ToolbarConfirm
  /** 禁用：布尔或按上下文计算（如 selectedCount === 0 禁用批量删除） */
  disabled?: boolean | ((ctx: ToolbarCtx<T>) => boolean)
  /** 隐藏：布尔或按上下文计算（优先级高于 disabled，整块不渲染） */
  hidden?: boolean | ((ctx: ToolbarCtx<T>) => boolean)
  /** 外部传入的 loading（异步操作防重入；不传则点击态由业务自行管理） */
  loading?: boolean
  /** 点击回调；配 confirm 时先弹确认（确定后执行） */
  onClick: (ctx: ToolbarCtx<T>) => void | Promise<void>
  /** 子操作：与父同列展示，超出 maxVisibleActions 时随父折叠进「更多」 */
  children?: ToolbarAction<T>[]
}
```

`ProTableProps` 新增 3 个 prop（均纯增量、可选）：

```ts
/** TableHeader 左区配置式按钮组（slot 内容渲染在其前） */
toolbar?: ToolbarAction<T>[]
/** SelectionBar 批量操作配置（与 #selectionBar slot 二选一，slot 优先） */
selectionBarActions?: ToolbarAction<T>[]
/** toolbar/selectionBarActions 直出上限，超出折叠 dropdown（默认 3） */
maxVisibleActions?: number
```

### 3.2 组件树

```
ProTable.vue（编排层，+35 行内）
├── TableHeader.vue
│   └── __left: <slot #tableHeader="ctx"> + <ToolbarRenderer :actions :ctx />
├── SelectionBar.vue（v-if selectedCount > 0）
│   ├── 左："已选 N 项" + 清除（emit clear）
│   └── 右：<slot #selectionBar="ctx"> 或 <ToolbarRenderer :actions="selectionBarActions" :ctx />
├── useAutoHeight.selectors 新增可选 key：selectionBar（BEM 根类注入）
```

`ToolbarRenderer.vue`（新组件，<150 行）渲染管线：

```
actions[]
  → ① perm 过滤（useAuth().hasPerm，无权限剔除）
  → ② hidden 计算（布尔或 ctx 函数）
  → ③ primary 重复 warn（>1 个时 console.warn）
  → ④ 截断：前 maxVisible 直出 ElButton，剩余 + children 收进 ElDropdown「更多」
  → ⑤ 点击：disabled(ctx) 判定 → confirm? useConfirm : 直通 → onClick(ctx)
```

### 3.3 数据流（零新状态源）

```
useTable.selectedRows / loading / refresh（已有）
  → ProTable.vue 聚合 selectedCtx = computed<ToolbarCtx>({
      selectedRows, selectedCount: selectedRows.length, loading, refresh
    })
  → TableHeader（toolbar props + #tableHeader 作用域）
  → SelectionBar（selectionBarActions props + #selectionBar 作用域 { ...ctx, clearSelection }）
```

### 3.4 CSV utils（`utils/`，零依赖）

```ts
/** 导出：BOM + RFC4180 转义（字段含 , " \n 时加引号、引号 doubling），Blob 下载 */
export function exportCsv(rows, columns: { prop, label }[], filename?): void
/** 导入：File → 按行解析 → 表头列名映射 prop → Record[]（引号转义反转、首尾空行剔除） */
export function importCsv(file: File, columns: { prop, label }[]): Promise<Record<string, unknown>[]>
```

### 3.5 测试计划（新增 4 个 spec）

| spec 文件 | 覆盖点 |
|-----------|--------|
| `ToolbarRenderer.spec.ts` | perm 过滤 / hidden 布尔+函数 / disabled 布尔+函数 / confirm 调用链（mock useConfirm）/ 折叠截断边界（恰好=maxVisible、children 折叠）/ primary 重复 warn |
| `SelectionBar.spec.ts` | count 渲染 / 清除 emit / slot 接管优先于配置 / 空 actions 不渲染右区 |
| `exportExcel.spec.ts` | BOM 前缀 / 引号转义 / 逗号换行字段 / 空表头 filename 默认 |
| `importExcel.spec.ts` | 引号反转义 / 列名→prop 映射 / 空行剔除 / 表头缺列容错 |

### 3.6 文件清单

新增 11 / 修改 8，详见任务 #1-#9 执行记录。回退方式：`git checkout -- <修改文件>` + 按清单删除新增文件。

---

## 4. 风险与对策

| 风险 | 对策 |
|------|------|
| `ProTable.vue` 行数增长（720 → ~755） | 仅聚合 computed + 模板挂载，不新增逻辑；编排层拆分为后续独立重构议题 |
| `useAuth`/`useConfirm` 在 `components/ProTable` 下的可用性 | 两者均在 AutoImport 注入列表（CLAUDE.md §1.6），script setup 直接用；ToolbarRenderer/SelectionBar 同层可用，已验证 |
| SelectionBar 出现/消失引起布局跳动 | fade+slide-down CSS 动画（transform/opacity，compositor 友好）；autoHeight selectors 联动（D8） |
| jsdom 下 ResizeObserver/CSV 下载行为差异 | utils 纯函数可测；下载用 `URL.createObjectURL` mock 断言调用参数而非真实下载 |
