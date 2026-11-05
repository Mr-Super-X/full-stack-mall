/**
 * ProTable 各 demo 私有 API 表格数据集合（spec §八.5）
 *
 * 命名约定：xxxItems（如 rowEditItems / treeItems / cellSpanItems / rowDragItems）
 * 字段约定：name / type / required / default / description
 *
 * @group Demo API
 */

export interface ApiItem {
  name: string
  type: string
  required?: boolean
  default?: string
  description: string
}

/* ───────────── 行内编辑 demo（ProTableRowEdit） ───────────── */

export const rowEditPropsItems: ApiItem[] = [
  {
    name: 'enableRowEdit',
    type: 'boolean | RowEditConfig',
    required: false,
    default: 'false',
    description: '启用行内编辑能力。传 boolean 启用默认配置；传对象启用细粒度配置。',
  },
  {
    name: 'trigger',
    type: "'dblclick' | 'manual'",
    required: false,
    default: "'dblclick'",
    description: '编辑触发方式：dblclick 双击进入 / manual 仅 API 触发。',
  },
  {
    name: 'onSave',
    type: '(row, changes) => boolean | Promise<boolean>',
    required: false,
    description: '保存钩子：返回 false 阻止保存，reject 视为保存失败（保留 editing + 错误态）。',
  },
  {
    name: 'onSaved',
    type: '(row) => void',
    required: false,
    description: '保存成功回调。',
  },
  {
    name: 'onSaveError',
    type: '(row, error) => void',
    required: false,
    description: '保存失败回调（async onSave reject 触发）。',
  },
]

export const rowEditColumnItems: ApiItem[] = [
  {
    name: 'edit.el',
    type: "'input' | 'select' | 'input-number' | string",
    required: false,
    description: '编辑控件类型；自定义组件名可通过 XForm-style 注册。',
  },
  {
    name: 'edit.props',
    type: 'Record<string, unknown>',
    required: false,
    description: '透传给编辑控件的 props（如 precision / options）。',
  },
  {
    name: 'edit.rules',
    type: 'Record | Record[]',
    required: false,
    description: '字段级校验规则（async-validator 协议）。',
  },
  {
    name: 'edit.editable',
    type: 'boolean | Ref<boolean>',
    required: false,
    description: '该字段是否可编辑（响应式 Ref 支持按行状态切换）。',
  },
  {
    name: 'edit.updateEvent',
    type: "'input' | 'blur'",
    required: false,
    default: "'input'",
    description:
      '编辑值同步时机（原 ProTableEditCellVModel demo 并入本表）：input 即时同步（高频），blur 失焦同步（数字输入建议 blur 防刷新风暴）。',
  },
]

export const rowEditExposeItems: ApiItem[] = [
  {
    name: 'startEdit(rowKey)',
    type: 'fn',
    description: '进入编辑态（manual trigger 下手动调用）。',
  },
  { name: 'cancelEdit(rowKey?)', type: 'fn', description: '取消编辑；不传 rowKey 取消所有。' },
  {
    name: 'saveEdit(rowKey?)',
    type: 'fn',
    description: '保存编辑；不传 rowKey 保存所有。返回 Promise<boolean>。',
  },
]

/* ───────────── 树形数据 demo（ProTableTree） ───────────── */

export const treeConfigItems: ApiItem[] = [
  {
    name: 'loadChildren',
    type: '(row) => Promise<Record[]>',
    required: false,
    description: '懒加载方法；不传 = 一次性返回 children。',
  },
  {
    name: 'childrenKey',
    type: 'string',
    required: false,
    default: "'children'",
    description: '子节点字段名。',
  },
  {
    name: 'defaultExpandDepth',
    type: 'number',
    required: false,
    default: '1',
    description: '默认展开深度。',
  },
  {
    name: 'rowKey',
    type: 'string',
    required: false,
    default: "'id'",
    description: '树形节点唯一 id 字段。',
  },
  {
    name: 'loadDebounce',
    type: 'number',
    required: false,
    default: '200',
    description: '懒加载防抖（ms），防止快速点击触发多次请求。',
  },
  {
    name: 'showLine',
    type: 'boolean',
    required: false,
    default: 'false',
    description: '是否显示连接线。',
  },
]

export const treeExposeItems: ApiItem[] = [
  { name: 'expandNode(rowKey, expanded?)', type: 'fn', description: '展开/折叠指定节点。' },
  { name: 'collapseNode(rowKey)', type: 'fn', description: '折叠指定节点。' },
  {
    name: 'refreshChildren(rowKey)',
    type: 'fn',
    description: '刷新节点子节点（重新触发 lazy load）。',
  },
]

/* ───────────── 单元格合并 demo（ProTableCellSpan） ───────────── */

export const cellSpanColumnItems: ApiItem[] = [
  {
    name: 'span.direction',
    type: "'row' | 'column' | 'both'",
    required: false,
    description: '合并方向。row=同列相邻合并 / column=跨列合并 / both=两者。',
  },
  {
    name: 'span.judge',
    type: '(a, b) => boolean',
    required: false,
    description: '自定义合并判定函数；不传按相邻值相等自动合并。',
  },
]

export const cellSpanConfigItems: ApiItem[] = [
  {
    name: 'maxMergeSpan',
    type: 'number',
    required: false,
    default: '10',
    description: '同列相邻合并上限（防单列合并成 1 行的 UX 灾难）。',
  },
  {
    name: 'spanHeader',
    type: 'boolean',
    required: false,
    default: 'false',
    description: '列表头是否参与合并。',
  },
]

/* ───────────── 行拖拽 demo（ProTableRowDrag） ───────────── */

export const rowDragColumnItems: ApiItem[] = [
  {
    name: 'draggable',
    type: 'boolean',
    required: false,
    default: 'false',
    description: '该列是否参与行拖拽（拖拽手柄列）。',
  },
]

export const rowDragConfigItems: ApiItem[] = [
  {
    name: 'handle',
    type: "string | '__all__'",
    required: false,
    default: "'first-col'",
    description: "拖拽手柄列 prop；'__all__' = 整行可拖。",
  },
  {
    name: 'onSortChange',
    type: '(newOrder) => boolean | Promise<boolean>',
    required: false,
    description: '排序变化回调：返回 false 回滚，返回 Promise 等待异步确认。',
  },
]

export const rowDragExposeItems: ApiItem[] = [
  {
    name: 'setRowOrder(newOrder)',
    type: 'fn',
    description: '程序化设置行顺序（拖拽后的新顺序）。',
  },
]

/* ───────────── 服务端排序 demo（ProTableServerSort） ───────────── */

export const sortColumnItems: ApiItem[] = [
  {
    name: 'sortable',
    type: "boolean | 'custom'",
    required: false,
    default: 'false',
    description:
      "true 客户端排序（el-table 原生）；'custom' 服务端排序（点击表头把排序参数发给后端）。",
  },
]

export const sortPropsItems: ApiItem[] = [
  {
    name: 'sortParamsAdapter',
    type: '(state: SortState) => Record<string, unknown>',
    required: false,
    description: '排序参数序列化适配；缺省 { orderByColumn, isAsc }。',
  },
]

export const sortExposeItems: ApiItem[] = [
  {
    name: 'getSortState()',
    type: 'SortState | null',
    description: '当前排序状态；组件同时向外 emit sort-change 事件。',
  },
]

/* ───────────── 引擎对比 demo（ProTableEngineCompare，v2.1） ───────────── */

export const enginePropsItems: ApiItem[] = [
  {
    name: 'tableEngine',
    type: "'element-plus' | 'vxe-table'",
    required: false,
    default: "'element-plus'",
    description:
      '渲染引擎：vxe-table 首次 mount 时动态加载（JS + CSS 按需注入，chunk 不进首屏）；加载失败自动回退 element-plus。',
  },
]

export const engineColumnItems: ApiItem[] = [
  {
    name: 'vxeProps',
    type: 'Record<string, unknown>',
    required: false,
    description:
      '透传 VxeColumn props（仅 vxe 引擎生效）；定位为补充不覆盖——与 ProTable 派生字段（field/title/sortable 等）冲突时以派生值为准。',
  },
]

export const engineMatrixItems: ApiItem[] = [
  {
    name: '多选 selection',
    type: '✅ 支持',
    description: 'checkbox-change / checkbox-all 合并为 selection-change。',
  },
  {
    name: '服务端排序',
    type: '✅ 支持',
    description: "sortable: 'custom' 走同一 sortParamsAdapter 协议。",
  },
  {
    name: '行内编辑',
    type: '✅ 支持',
    description: 'cell-dblclick 协议与 el-table 单参数对象签名兼容。',
  },
  {
    name: '单元格合并',
    type: '✅ 支持',
    description: 'span-method / cellClassName 直绑 vxe-table。',
  },
  {
    name: '树形数据',
    type: '✅ 支持',
    description:
      'v3.5 PR1-B 起与 el 引擎对等：通过 createVxeTreeAdapter 把 useTreeData 状态映射到 vxe-table tree-config + 监听 toggle-tree-expand 回流。',
  },
  {
    name: '行拖拽排序',
    type: '✅ 支持',
    description:
      'v3.5 PR1-B 起与 el 引擎对等：sortablejs 挂 .vxe-table--body-wrapper tbody；vxeTreeAdapter + vxeRowDragAdapter 提供引擎胶水；与树形同时启用会触发 console.warn 提示 sortablejs 与 vxe tree-node 行结构冲突。',
  },
]

/* ───────────── v3.0 客户端汇总行 demo（ProTableSummary） ───────────── */

export const summaryConfigItems: ApiItem[] = [
  {
    name: 'enableSummary',
    type: 'boolean | SummaryConfig',
    required: false,
    default: 'false',
    description: '启用客户端汇总行；传 boolean 启用默认配置，传对象启用细粒度配置。',
  },
  {
    name: 'position',
    type: "'bottom' | 'top'",
    required: false,
    default: "'bottom'",
    description: '汇总行位置（v3.0 当前仅实现 bottom，top 预留）。',
  },
  {
    name: 'columns',
    type: 'Record<prop, ColumnSummaryConfig>',
    required: true,
    description: '按列 prop 声明聚合配置；未声明的列在汇总行不显示值。',
  },
  {
    name: 'label',
    type: 'string',
    required: false,
    default: "'合计'",
    description: '汇总行第一列显示的标签文本。',
  },
]

export const summaryColumnItems: ApiItem[] = [
  {
    name: 'aggregate',
    type: "'sum' | 'avg' | 'count' | 'max' | 'min'",
    required: true,
    description: '聚合函数类型。',
  },
  {
    name: 'formatter',
    type: '(value, rows) => string',
    required: false,
    description: '自定义格式化（如金额前缀 ¥）；默认保留 2 位小数 + 千分位。',
  },
  {
    name: 'label',
    type: 'string',
    required: false,
    description: '该列汇总值的标签前缀（默认继承 config.label）。',
  },
]

/* ───────────── v3.0 虚拟滚动 demo（ProTableVirtualScroll） ───────────── */

export const virtualScrollConfigItems: ApiItem[] = [
  {
    name: 'virtualized',
    type: 'boolean | VirtualScrollConfig',
    required: false,
    default: 'false',
    description: '启用虚拟滚动；传 boolean 启用默认 48px 行高，传对象启用细粒度配置。',
  },
  {
    name: 'rowHeight',
    type: 'number',
    required: false,
    default: '48',
    description: '行高（像素），用于 el-table-v2 / vxe scroll-y 配置。',
  },
  {
    name: 'overscan',
    type: 'number',
    required: false,
    default: '10',
    description: '预渲染行数（视区外多渲染的缓冲行数）。',
  },
  {
    name: 'height',
    type: 'number',
    required: false,
    default: '500',
    description:
      'v3.0.2 新增：容器高度 px 数字（H2 修复）。该值 > 0 时优先于父容器实测值，避免容器异常覆盖用户预期。',
  },
  {
    name: 'width',
    type: "number | 'auto'",
    required: false,
    default: "'auto'",
    description: 'v3.0.1 新增：容器宽度 px 数字或 auto。',
  },
]

export const virtualScrollColumnItems: ApiItem[] = [
  {
    name: 'formatter',
    type: '(row, column, cellValue, $index) => string | VNode',
    required: false,
    description:
      'v3.0.2 新增（M4）：轻量格式化函数。优先级 render > 插槽 > formatter > enum > 默认文本。',
  },
]

export const virtualScrollLimitsItems: ApiItem[] = [
  {
    name: 'enableRowEdit + virtualized',
    type: '互斥',
    description:
      '虚拟行索引 ≠ 真实数据索引会破坏行内编辑 key 映射；启用虚拟滚动时 enableRowEdit 自动失效（启动 warn）。',
  },
  {
    name: 'enableTree + virtualized',
    type: '暂未集成',
    description: 'v3.0 虚拟滚动主要服务平铺场景；树形模式集成留待 v3.0.1。',
  },
]

/* ───────────── v3.0 列分组 demo（ProTableGroupedHeader） ───────────── */

export const groupedHeaderColumnItems: ApiItem[] = [
  {
    name: 'children',
    type: 'ProColumn[]',
    required: false,
    description: '子列数组；声明后该列渲染为多级表头父列。',
  },
  {
    name: 'groupKey',
    type: 'string',
    required: false,
    description: '分组 ID（v3.0 预留字段，持久化按 prop 维度处理）。',
  },
]

export const groupedHeaderKnownLimitsItems: ApiItem[] = [
  {
    name: '完整多级表头',
    type: '⚠️ v3.0.1 待修复',
    description:
      'Element Plus 2.14 el-table-column 嵌套递归在 Vue 3.5 + unplugin-vue-components 组合下未生效（实测只产生 1 行 thead）。v3.0 采用务实方案：父列作单级 + 子列 cellClassName 视觉分组；v3.0.1 评估 h() 函数式渲染。',
  },
]

/* ───────────── v3.1 内置格式化器 demo（ProTableFormatter） ───────────── */

export const formatterColumnItems: ApiItem[] = [
  {
    name: 'formatter',
    type: 'ColumnFormatter | ColumnFormatterPreset',
    required: false,
    description:
      'v3.1 放宽：单元格格式化函数或内置预设 key。优先级 render > 具名插槽 > formatter > enum > 原始值。',
  },
]

export const formatterPresetItems: ApiItem[] = [
  {
    name: 'dateTime',
    type: '预设 key',
    description: 'dayjs 格式化为 YYYY-MM-DD HH:mm:ss；非法值原样字符串化（不出现 Invalid Date）。',
  },
  {
    name: 'date',
    type: '预设 key',
    description: 'dayjs 格式化为 YYYY-MM-DD。',
  },
  {
    name: 'time',
    type: '预设 key',
    description: 'dayjs 格式化为 HH:mm:ss。',
  },
  {
    name: 'amount',
    type: '预设 key',
    description: '千分位 + 2 位小数（zh-CN locale）；非数字原样返回。',
  },
  {
    name: 'percent',
    type: '预设 key',
    description: '数值 ×100% + 2 位小数（0.1567 → 15.67%）。',
  },
  {
    name: 'boolTag',
    type: '预设 key',
    description: 'true → ElTag success「是」/ false → ElTag info「否」/ 其他值 → 原样。',
  },
]

/* ───────────── v3.1 自动高度 demo（ProTableAutoHeight） ───────────── */

export const autoHeightItems: ApiItem[] = [
  {
    name: 'autoHeight',
    type: 'boolean | AutoHeightConfig',
    required: false,
    default: 'false',
    description:
      'v3.1 新增：表格区自动撑满视口剩余高度（表头固定 + 表体滚动 + 分页器常驻）。传 boolean 用默认配置；传对象启用细粒度配置。virtualized 启用时本配置被忽略并 console.warn（v2 引擎自带高度管理）。',
  },
]

export const autoHeightConfigItems: ApiItem[] = [
  {
    name: 'offset',
    type: 'number',
    required: false,
    default: '24',
    description:
      '附加减去的余量（像素）。测量无法感知的占位（页面底部留白 / 父容器 padding）；正值让表格更矮，负值让表格更高。',
  },
]

/* ───────────── v3.1 状态保持 demo（ProTableStatePersist） ───────────── */

export const statePersistItems: ApiItem[] = [
  {
    name: 'statePersist',
    type: 'boolean',
    required: false,
    default: 'false',
    description:
      'v3.1 新增：路由级持久化开关。需配合 tableKey（未传则 no-op）。恢复时机判定：localStorage 存快照 + sessionStorage alive 标记——beforeunload 清除 alive，F5 刷新视为新会话不恢复；路由跳走 alive 保留，返回时恢复搜索/分页/排序。',
  },
]

export const statePersistStorageItems: ApiItem[] = [
  {
    name: '${tableKey}:state',
    type: 'localStorage',
    description:
      '状态快照。结构：{ version:1, searchParams, page, pageSize, sortState }。version 字段预留未来迁移分派。',
  },
  {
    name: '${tableKey}:state-alive',
    type: 'sessionStorage',
    description:
      '组件存活标记。mount 后写 1；beforeunload 清空（区分路由跳走 vs F5 刷新）。按标签页隔离——新标签页打开同页不恢复。',
  },
]

/* ───────────── v3.1 列宽拖拽 demo（ProTableColumnResize） ───────────── */

export const columnResizeItems: ApiItem[] = [
  {
    name: 'columnResize',
    type: 'boolean',
    required: false,
    default: 'false',
    description:
      'v3.1 新增：列宽拖拽开关。开启后表头列边框可拖动调宽。el 引擎显式绑 el-table-column resizable（ep 默认 true，须显式 false 才能默认关闭）+ 联动表级 border（ep 列宽拖拽硬依赖 border 作为拖拽手柄命中区）；vxe 引擎映射列级 resizable（vxe 默认 false，语义天然契合）。virtualized（TableV2）分支不支持——列宽受控（onColumnResize 需回写列宽配置），留待后续。',
  },
]

export const columnResizeColumnItems: ApiItem[] = [
  {
    name: 'tableProps.resizable',
    type: 'boolean',
    required: false,
    description:
      '列级覆盖组件级 columnResize：单列 resizable 显式优先（el 引擎）。列设 false → 该列不可拖，其他列按组件级配置。',
  },
]

/* ───────────── v3.1 行选择 demo（ProTableRowSelect） ───────────── */

export const radioColumnItems: ApiItem[] = [
  {
    name: 'type',
    type: "'radio'",
    required: false,
    description:
      'v3.1 新增：单选列类型（el 引擎自绘 ElRadio / vxe 引擎内置 radio 列）。选中收敛统一选中区（selectedRows 单元素），getSelectedRows() 返回单行数组。',
  },
]

export const reserveSelectionColumnItems: ApiItem[] = [
  {
    name: 'reserveSelection',
    type: 'boolean',
    required: false,
    default: 'false',
    description:
      'v3.1 新增：多选跨页保持（一等字段，替代 tableProps: { reserveSelection: true } 手写透传）。el 引擎透传 el-table-column reserve-selection，vxe 引擎映射 checkbox-config.reserve。需配合 row-key。',
  },
]

// ProTableVxeRowSelect —— vxe 引擎 clearSelection 双通道（B1 修复点）
export const vxeSelectionItems: ApiItem[] = [
  {
    name: 'clearSelection()',
    type: '() => void',
    required: false,
    description:
      'B1 修复点：vxe 引擎同时清 UI 勾选（VxeTableBody expose → clearCheckboxRow / clearRadioRow）与本地镜像。修复前 tableRef 恒 null 只清镜像不清 UI。',
  },
  {
    name: 'reserve 镜像回同步',
    type: 'getCheckboxRecords()',
    required: false,
    description:
      'vxe 恢复跨页勾选不派发事件，rows watch 在 reserve 分支 nextTick 后经 getCheckboxRecords() 回同步全量镜像——翻页后 getSelectedRows() 仍完整。',
  },
  {
    name: 'table-engine',
    type: "'vxe-table'",
    required: false,
    description:
      '引擎切换：vxe-table 走 VxeTableBody 渲染，radio/selection 列由 vxe 内置列类型接管，选中仍收敛 ProTable 统一选中区。',
  },
]

/* ───────────── v3.1 操作列 demo（ProTableOperation） ───────────── */

export const operationColumnItems: ApiItem[] = [
  {
    name: 'type',
    type: "'operation'",
    required: false,
    description:
      "操作列类型。内容完全由 #operation 插槽接管（el/vxe 引擎均透传），表头渲染 + 列宽规则照常生效。常固定右侧（fixed:'right'）以适应横向滚动场景。",
  },
]

export const headerRenderItems: ApiItem[] = [
  {
    name: 'headerRender',
    type: '(scope: { column, $index }) => VNode',
    required: false,
    description:
      '自定义表头渲染函数。返回 VNode（支持 h() 与 JSX）。v3.1 接线后 el/vxe 引擎均生效。常见用法：表头 + 问号图标 + ElTooltip 气泡说明业务口径。',
  },
]

/* ───────────── v3.1 样式覆盖 demo（ProTableStyleOverride） ───────────── */

export const styleOverrideItems: ApiItem[] = [
  {
    name: 'BEM 命名空间',
    type: 'vv- 前缀',
    description:
      '所有 .vue 单文件组件遵循 CLAUDE.md §3 BEM 规范：createNamespace(\'kebab-case\') + 模板用 bem.b()/bem.e() 拼装 + <style lang="scss"> 用 .#{$BEM_PREFIX}-kebab-case 根选择器。命名空间隔离由 BEM 接管，不写 scoped。',
  },
  {
    name: '穿透第三方组件',
    type: '后代选择器',
    description:
      '非 scoped 样式下 :deep() / ::v-deep / :v-deep 不会被编译，会作为伪类原样输出到浏览器被丢弃。覆盖 element-plus 组件样式必须直接写后代选择器（如 .vv-pro-table .el-input__inner { ... }）。',
  },
  {
    name: '设计令牌',
    type: 'CSS 变量',
    description:
      '优先使用 element-plus 暴露的 CSS 变量（--el-color-primary、--el-text-color-regular、--el-bg-color 等）而非硬编码颜色，保证 dark mode 联动 + 主题一致性。',
  },
  {
    name: 'row-class-name',
    type: 'tableProps',
    description:
      '行级自定义 class：tableProps: { rowClassName: (args) => string }。可叠加状态色（成功/警告/禁用）或 zebra 斑马纹。',
  },
  {
    name: 'cell-class-name',
    type: 'tableProps',
    description:
      '单元格级自定义 class：tableProps: { cellClassName: (args) => string }。可叠加对齐方式、字体样式、徽章标记。',
  },
]

/* ───────────── v3.1 表格内嵌 demo（ProTableExpand） ───────────── */

export const expandColumnItems: ApiItem[] = [
  {
    name: 'type',
    type: "'expand'",
    required: false,
    description:
      '展开行类型。内容完全由 #expand 插槽接管（el 引擎透传 el-table #expand 行内容；vxe 引擎透传 expanded-content）。点击行首展开图标展开/折叠。常用于主表 + 详情内嵌展示。',
  },
]

export const expandSlotItems: ApiItem[] = [
  {
    name: '#expand',
    type: 'slot',
    description:
      '作用域插槽。scope 包含 { row, $index }，el 引擎额外暴露 column / store（参考 el-table 文档）。',
  },
  {
    name: 'ProTable 内嵌',
    type: 'expand 内容',
    description:
      '展开行内可放置任意内容（卡片 / 表单 / 嵌套 ProTable）。展开行高度自适应内容，无固定上限。',
  },
]

/* ───────────── 工具栏 / 批量操作条 demo（ProTableHeaderActions，2026-09-18） ───────────── */

export const toolbarActionItems: ApiItem[] = [
  {
    name: 'label',
    type: 'string',
    required: true,
    description: '按钮文本。',
  },
  {
    name: 'type',
    type: "'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'",
    required: false,
    default: "'default'",
    description:
      'EP 按钮语义色；danger 用于批量删除等危险操作。多个 primary 时控制台 warn（主操作应唯一）。',
  },
  {
    name: 'icon',
    type: 'Component',
    required: false,
    description: '左侧图标（element-plus 图标组件，业务显式 import）。',
  },
  {
    name: 'perm',
    type: 'string | string[]',
    required: false,
    description: '权限码（AND 语义，同 v-auth）；无权限整块不渲染。',
  },
  {
    name: 'confirm',
    type: 'string | { content; title?; danger?; confirmButtonText? }',
    required: false,
    description: '二次确认（自动套 useConfirm，取消不执行 onClick）；建议危险操作必配。',
  },
  {
    name: 'disabled / hidden',
    type: 'boolean | ((ctx: ToolbarCtx) => boolean)',
    required: false,
    description:
      '禁用（占位灰置）/ 隐藏（整块不渲染）；函数形态实时消费 ctx（如 selectedCount 联动）。',
  },
  {
    name: 'onClick',
    type: '(ctx: ToolbarCtx) => void | Promise<void>',
    required: true,
    description:
      '点击回调；Promise 未结算期间按钮自动 loading 防重入。ctx = { selectedRows, selectedCount, loading, refresh }。',
  },
  {
    name: 'children',
    type: 'ToolbarAction[]',
    required: false,
    description: '子操作：拍平参与折叠计数，超出 maxVisibleActions 随父收进「更多」下拉。',
  },
]

export const toolbarPropsItems: ApiItem[] = [
  {
    name: 'toolbar',
    type: 'ToolbarAction[]',
    required: false,
    description: 'TableHeader 左区配置式按钮组；与 #tableHeader slot 并存（slot 在前，向后兼容）。',
  },
  {
    name: 'selectionBarActions',
    type: 'ToolbarAction[]',
    required: false,
    description: '批量条配置（选中行 > 0 浮出）；与 #selectionBar slot 二选一，slot 优先。',
  },
  {
    name: 'maxVisibleActions',
    type: 'number',
    required: false,
    default: '3',
    description: 'toolbar / selectionBarActions 直出上限，超出折叠「更多」下拉。',
  },
  {
    name: '#tableHeader / #toolButton',
    type: 'slot（作用域增强）',
    required: false,
    description:
      '2026-09-18 起作用域下发 ToolbarCtx { selectedRows, selectedCount, loading, refresh }；不带 scope 的旧用法不受影响。',
  },
  {
    name: '#selectionBar',
    type: 'slot',
    required: false,
    description: '完全接管批量条右侧；作用域 = ToolbarCtx + clearSelection。',
  },
]

/* ───────────── CSV 导入导出 demo（ProTableImportExport，2026-09-18） ───────────── */

export const csvColumnItems: ApiItem[] = [
  {
    name: 'prop',
    type: 'string',
    required: true,
    description: '行数据字段名（导入时为输出 key）。',
  },
  {
    name: 'label',
    type: 'string',
    required: true,
    description: 'CSV 表头列名（导入时按此匹配表头；未声明的表头列自动忽略）。',
  },
  {
    name: 'value',
    type: '(row) => string | number',
    required: false,
    description: '自定义取值（缺省 row[prop]）：金额格式化 / 枚举翻译 / 字段拼接。导出时生效。',
  },
  {
    name: 'filename / bom',
    type: 'string / boolean',
    required: false,
    default: 'export-YYYYMMDD-HHmmss.csv / true',
    description: '导出文件名 / 是否写 UTF-8 BOM（Excel 打开中文不乱码的前提）。',
  },
]

/* ───────────── 服务端筛选 demo（ProTableServerFilter，v3.5 PR2） ───────────── */

export const filterPropsItems: ApiItem[] = [
  {
    name: 'filterParamsAdapter',
    type: '(filters: FilterValuesMap) => Record<string, unknown>',
    required: false,
    description:
      'v3.5 PR2 新增：把全表筛选快照序列化为后端期望的请求参数形态。缺省走 el-table 客户端筛选默认值（filterState 仅 UI 记忆，不入请求）。',
  },
]

export const filterColumnItems: ApiItem[] = [
  {
    name: 'column.filters',
    type: 'Array<{ text: string; value: string | number }>',
    required: false,
    description:
      'v3.5 PR2：列头筛选下拉选项配置（element-plus 原生协议）。业务方在 ProColumn.tableProps.filters 声明筛选项；el-table 自动渲染下拉面板。',
  },
]

export const filterExposeItems: ApiItem[] = [
  {
    name: 'getFilterState',
    type: '() => FilterValuesMap',
    required: true,
    description:
      '当前全表筛选快照（与 el-table filter-change 事件负载同形态），供 URL 同步 / 埋点上报使用。',
  },
  {
    name: 'filter-change 事件',
    type: '(payload: FilterValuesMap) => void',
    required: false,
    description:
      '筛选变化时 emit，payload 为当前全表筛选快照。父组件可监听做 UI 联动 / 埋点 / 上报。',
  },
]
