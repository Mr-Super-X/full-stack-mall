/**
 * ProTable 类型集中定义（spec §4 文件清单 / §7 props 透传 / §八 defineExpose 的类型源头）。
 *
 * 所有类型通过 `src/components/ProTable/index.ts` barrel re-export 暴露给业务方。
 * JSDoc 单属性只允许一段（§5.1 陷阱 #2），barrel 用 `export { type X }`（陷阱 #3），
 * JSDoc 必须紧贴 export（陷阱 #4），@group 不能代替业务描述（陷阱 #5）。
 *
 * @group ProTable 类型
 */
import type { Component, ComponentPublicInstance, Ref, VNode } from 'vue'

// ⚠️ 本文件刻意不 import '@/composables/useConfirm'：实验证明（2026-09-18）该 import type
// 会触发 vue-tsc --build 下 ProDialog.vue 全局 auto-import 声明丢失（TS2304 ×15），
// 链路 types → useConfirm → useDialog → ProDialog.vue。ToolbarConfirm 字段内联声明，
// 结构类型与 UseConfirmOptions 子集等价（useConfirm(action.confirm) 编译通过）。

// ProTable 契约类型（ProTableResponse / ProTableRequestApi）自 2026-10-23 起下沉
// @vv/shared 单源（packages/shared/src/types/pro-table.ts）——mock 数据源与组件双方
// 都依赖 shared，符合 config→mock→shared→ui 单向铁律；此处 import + re-export 使
// 本文件既有引用（ProTableProps.requestApi / responseAdapter）与存量消费方零改动
import type { ProTableRequestApi, ProTableResponse } from '@vv/shared'

export type { ProTableRequestApi, ProTableResponse }

/** 行内编辑配置 —— 列粒度控制哪些字段可编辑 @group ProTable 类型 */
export interface ColumnEditConfig {
  el: 'input' | 'select' | 'input-number' | string
  props?: Record<string, unknown>
  rules?: Record<string, unknown> | Record<string, unknown>[]
  editable?: boolean | Ref<boolean>
  /**
   * v3.0 5d：编辑值触发时机（默认 'input' 实时同步；'blur' 与 ProTable trigger='blur' 对齐）
   *
   * - 'input'（默认）：input 事件即时同步（高频但响应快）
   * - 'blur'（推荐）：blur 事件同步，符合表单语义、避免高频同步风暴
   */
  updateEvent?: 'input' | 'blur'
}

/** 树形数据配置 —— 列粒度标识「该列展示树形缩进 + 展开/折叠」 @group ProTable 类型 */
export interface ColumnTreeConfig {
  indentSize?: number
  expandSlot?: string
}

/** 单元格合并配置 —— 列粒度声明「该列参与合并」 @group ProTable 类型 */
export interface ColumnSpanConfig {
  direction: 'row' | 'column' | 'both'
  judge?: (rowA: Record<string, unknown>, rowB: Record<string, unknown>) => boolean
}

/** 行编辑顶层配置 @group ProTable 类型 */
export interface RowEditConfig {
  onSave?: (
    row: Record<string, unknown>,
    changes: Record<string, unknown>
  ) => boolean | Promise<boolean>
  onSaved?: (row: Record<string, unknown>) => void
  onSaveError?: (row: Record<string, unknown>, error: unknown) => void
}

/** 树形数据顶层配置 @group ProTable 类型 */
export interface TreeConfig {
  loadChildren?: (row: Record<string, unknown>) => Promise<Record<string, unknown>[]>
  childrenKey?: string
  defaultExpandDepth?: number
  rowKey?: string
  loadDebounce?: number
  /** v2.0 与编辑共存时，编辑仅作用于叶子节点；true 时禁用编辑按钮 */
  exclusive?: boolean
}

/** 单元格合并顶层配置 @group ProTable 类型 */
export interface CellSpanConfig {
  maxMergeSpan?: number
  /** v2.0 列级合并方向（与 ColumnSpanConfig.direction 同义，作用于全局） */
  direction?: 'row' | 'column' | 'both'
}

/** 行拖拽排序顶层配置 @group ProTable 类型 */
export interface RowDragConfig {
  handle?: string | '__all__'
  onSortChange?: (newOrder: Record<string, unknown>[]) => boolean | Promise<boolean>
}

/** 单列聚合类型 —— v3.0 新增（useSummary 客户端聚合） @group ProTable 类型 */
export type SummaryAggregate = 'sum' | 'avg' | 'count' | 'max' | 'min'

/** 单列聚合配置 —— 声明该列如何聚合 @group ProTable 类型 */
export interface ColumnSummaryConfig {
  /** 聚合函数类型 */
  aggregate: SummaryAggregate
  /** 自定义格式化（默认：保留 2 位小数 + 千分位） */
  formatter?: (value: number, rows: Record<string, unknown>[]) => string
  /** 标签前缀（默认："合计"） */
  label?: string
}

/** 表格汇总行顶层配置 —— v3.0 新增 @group ProTable 类型 */
export interface SummaryConfig {
  /** 哪些列参与汇总（按 prop 声明，未声明列不显示汇总值） */
  columns?: Record<string, ColumnSummaryConfig>
  /** 整行 label（如"合计"、"本页汇总"，默认"合计"） */
  label?: string
}

/** 虚拟滚动配置 —— v3.0 新增（useVirtualScroll 能力） @group ProTable 类型 */
export interface VirtualScrollConfig {
  /** 行高（像素，默认 48） */
  rowHeight?: number
  /** 预渲染行数（默认 10） */
  overscan?: number
  /** v3.0.1 新增：容器高度 px（默认 500） */
  height?: number
  /** v3.0.1 新增：容器宽度 — 'auto' | px 数字（el-table-v2 不支持百分比，默认 'auto'） */
  width?: number | 'auto'
}

/** 搜索项 el 控件类型 —— 决定 SearchForm 渲染哪种 element-plus 控件 @group ProTable 类型 */
export type SearchElType =
  'input' | 'select' | 'date-picker' | 'tree-select' | 'cascader' | 'input-number'

/**
 * 搜索项层级（v3.2 新增）—— 用 const 对象 + 类型替代纯字符串字面量联合，
 * 避免模板中拼错（'advence' 等）+ IDE 自动补全
 * - SearchLevel.Basic（默认）：主表单展示，受折叠态约束
 * - SearchLevel.Advanced：收纳进「高级筛选」弹窗 + 角标显示已选数量
 *
 * 设计动机：电商订单筛选 / 多维度财务报表等场景常含 5-30 个查询条件，
 * 平铺会导致表格高度被大幅挤压。层级分离让用户能按需展开。
 */
export const SearchLevel = {
  Basic: 'basic',
  Advanced: 'advanced',
} as const
export type SearchLevel = (typeof SearchLevel)[keyof typeof SearchLevel]

/**
 * 行 key 字段名缺省值 —— 编排层 / 能力层（useTableCapabilities）/ 渲染层（ElementTableBody）/
 * 树形层（useTreeData）的 'id' 默认值单一来源。调整默认行键只改这一处。
 *
 * @group ProTable 类型
 */
export const DEFAULT_ROW_KEY = 'id'

/**
 * SearchForm 布局档位（v3.4 新增）—— 业务方可强制指定搜索区布局，替代纯字段数自动判定。
 *
 * 真实业务中字段数与页面空间不一定匹配（宽屏想平铺 6 字段 / searchDisplay 联动使字段数
 * 动态变化引起档位抖动），故把判定权下放：'auto'（默认）保持字段数自动判定，
 * 显式档位锁定布局行为。存在 search.level='advanced' 字段时无论配置为何都走 'drawer'
 * （advanced 字段必须可达，优先级高于强制档位）。
 *
 * @group ProTable 类型
 */
export type SearchLayoutMode = 'auto' | 'flat' | 'collapse' | 'flat-large' | 'drawer'

/** 表格引擎枚举 —— spec 决策 4：首次 mount 锁定，运行时 prop 修改无效；'vxe-table' v2.0 未实现（回退 element-plus，v2.1 支持） @group ProTable 类型 */
export type TableEngine = 'element-plus' | 'vxe-table'

/** 表格密度三档 —— 附录 A #7 默认 'default' @group ProTable 类型 */
export type TableDensity = 'compact' | 'default' | 'loose'

/**
 * 排序状态 —— 组件向外暴露 / emit 的形态；null 表示未排序（表头第三击清除）。
 *
 * 泛型 T = 行数据类型（M2 服务端排序），prop 联合 string 与 ProColumn.prop 同理由。
 *
 * @group ProTable 类型
 */
export interface SortState<T extends object = Record<string, unknown>> {
  /** 排序列字段名（IDE 优先补全 T 的键；联合 string 放行特殊列） */
  prop: Extract<keyof T, string> | string
  /** 升序 / 降序 */
  order: 'ascending' | 'descending'
}

/**
 * el-table sort-change 事件负载（order 为 null = 第三击清除排序；prop 对齐 element-plus 声明可为 null）。
 *
 * @group ProTable 类型
 */
export interface SortChangeEvent {
  prop: string | null
  order: 'ascending' | 'descending' | null
}

/**
 * 列筛选项单值类型 —— el-table column.filteredValue 元素联合（v3.5 PR2）。
 *
 * 设计动机：后端筛选参数常含多种基础类型（订单状态 = string、金额范围 = number、
 * 是否禁用 = boolean），统一 union 后由业务方在 filterParamsAdapter 内自定义序列化
 * （如 boolean→'1'/'0'、数字→字符串拼接）。
 *
 * @group ProTable 类型
 */
export type FilterValue = string | number | boolean

/**
 * 列筛选项映射 —— 与 el-table filter-change 事件负载形态对齐（v3.5 PR2）。
 *
 * - key = 列 prop（与 ProColumn.prop 同源）
 * - value = 该列当前生效的筛选项数组（多选语义；空数组 = 该列无筛选）
 *
 * 与 sortParamsAdapter 对称：sortParamsAdapter 接收单条 SortState，本类型接收全表
 * 筛选快照（el-table 一次 filter-change 事件携带所有列的最新筛选）。
 *
 * @group ProTable 类型
 */
export type FilterValuesMap = Record<string, FilterValue[]>

/**
 * 筛选参数适配器 —— 业务方把全表筛选快照序列化为后端期望的请求参数形态（v3.5 PR2）。
 *
 * 与 sortParamsAdapter 对称：sortParamsAdapter 把 SortState 序列化为单条记录参数；
 * 本适配器把 FilterValuesMap 序列化为可并入 requestApi params 的 Record。
 *
 * 不传时走 el-table 客户端筛选默认值（filterState 仅用于 UI 记忆，不入请求）。
 *
 * 典型场景：
 * - 5-30 个查询条件的中后台业务（电商订单筛选、多维度财务报表）
 * - 后端约定 { status: ['paid', 'shipped'], dateRange: ['2026-01-01', '2026-12-31'] }
 *
 * @group ProTable 类型
 */
export type FilterParamsAdapter = (filters: FilterValuesMap) => Record<string, unknown>

/**
 * 枚举项（与 element-plus el-option / ProTable enum 渲染对齐）。
 *
 * @group ProTable 类型
 */
export interface EnumProps {
  /** 显示文本 */
  label: string
  /** 值（用于回填 searchParams 与表格 cell 显示） */
  value: string | number | boolean
  /** ElTag 类型（enum 渲染时使用） */
  tagType?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /** 是否禁用（搜索下拉场景） */
  disabled?: boolean
}

/**
 * 搜索项配置 —— 描述一个 search 控件的渲染与默认值。
 *
 * v3.2 review 扩展（应对中后台多查询条件场景）：
 * - `level` 字段将搜索项分为「基础」/「高级」两层
 * - `debounce` 字段支持字段级防抖自动搜索
 * - 配合 SearchForm 的 searchDisplay prop + 高级筛选弹窗，5-30 个查询条件都能优雅展示
 *
 * @group ProTable 类型
 */
export interface SearchConfig {
  /** 渲染哪种 element-plus 控件 */
  el: SearchElType
  /** 透传给 element-plus 控件的 props（type / placeholder / clearable 等） */
  props?: Record<string, unknown>
  /** 初始默认值（reset 时恢复，附录 A #1） */
  defaultValue?: unknown
  /** 排序权重（升序；缺省按 columns 数组顺序） */
  order?: number
  /** el-col 占位（默认 6，4 列布局） */
  span?: number
  /** 自定义搜索插槽名（spec §7 `search-[prop]`） */
  slot?: string
  /**
   * v3.2 新增：字段层级
   * - 'basic'（默认）：主表单展示，受默认折叠逻辑约束（折叠态显示前 n×2 行）
   * - 'advanced'：收纳进「高级筛选」弹窗，主表单不展示，避免 5+ 查询条件挤压表格可视区
   *
   * 设计动机：电商订单筛选 / 多维度财务报表等场景常含 5-30 个查询条件，
   * 平铺会导致表格高度被大幅挤压。层级分离让用户能按需展开。
   * 推荐使用 `SearchLevel.Basic` / `SearchLevel.Advanced` 常量（见 types 顶部）
   */
  level?: SearchLevel
  /**
   * v3.2 新增：input 类控件防抖延迟（毫秒）
   * - 0 / undefined：保持 H2 修复行为（输入与请求解耦，仅回车 / 按钮触发）
   * - > 0：输入时自动触发防抖搜索（如 300ms 间隔），适用于实时筛选场景（订单状态切换等）
   *
   * 注意：仅在 `el === 'input'` 等可输入控件上有意义；select / date-picker 的 change
   * 事件天然低频，不需防抖。组件内部按 el 类型自动判断是否启用。
   */
  debounce?: number
  /**
   * v3.2 升级：触发时机
   * - 'change'（默认）：值变化即自动触发搜索（适合 select / date-picker 等低频控件）
   * - 'enter'：仅回车触发（适合 input 大文本输入场景，避免高频请求）
   *
   * 与 `debounce` 字段互斥：
   * - 配了 `searchTrigger` 就用此设置（推荐用法）
   * - 配了 `debounce`（旧 API）则按防抖逻辑处理（向后兼容）
   * - 都不配：input 走 H2 默认（回车/按钮），其他走 change
   */
  searchTrigger?: 'change' | 'enter'
  /**
   * v3.2 升级：值变化钩子
   *
   * 用途：字段 A 变化时清空字段 B（如「订单状态」从「已支付」改为「未支付」时
   * 自动清空「支付时间」字段，避免脏数据发给后端）。
   *
   * @example
   * ```ts
   * {
   *   prop: 'orderStatus',
   *   search: {
   *     el: 'select',
   *     onChange: (newVal, oldVal, params) => {
   *       // status 变化时清空 paymentTime（脏数据清理）
   *       if (newVal === 'unpaid') params.paymentTime = undefined
   *     }
   *   }
   * }
   * ```
   */
  onChange?: (newVal: unknown, oldVal: unknown, params: Record<string, unknown>) => void
  /**
   * v3.2 升级：select 字典懒加载
   * - false（默认）：表格初始化时全量加载（适合 ≤ 50 条的小字典）
   * - true：聚焦 / 打开下拉时才加载（适合 > 50 条的大字典，如地区、商品分类）
   *
   * 注：业务方需在 lazy load 钩子里调用 `Local.set()` 更新选项（EP Select 不支持内置 lazy）
   */
  lazyEnum?: boolean
  /**
   * v3.2 升级：per-field 折叠控制
   * - undefined（默认）：跟随全局 collapsed 状态
   * - true：无论全局如何，永远在主表单展示
   * - false：永远收纳到高级筛选（即使 level=basic）
   *
   * 用途：核心查询字段（如订单号）始终展示，辅助字段（如备注）跟随全局折叠
   */
  collapsed?: boolean
}

/**
 * 内置单元格格式化器预设 key —— v3.1 新增。
 *
 * 解决高频格式化场景（时间 / 金额千分位 / 百分比等）业务方重复实现的问题：
 * `formatter: 'dateTime'` 一键生效，等价于手写 dayjs 格式化函数。
 * 非法输入（非数字金额、非法日期）一律原样返回，不做吞错处理。
 *
 * @group ProTable 类型
 */
export type ColumnFormatterPreset = 'dateTime' | 'date' | 'time' | 'amount' | 'percent' | 'boolTag'

/**
 * 单元格格式化器 —— 自定义函数或内置预设 key（v3.1：formatter 从纯函数放宽为 函数 | 预设）。
 *
 * 函数形态与 v1 el-table formatter 对齐（row / column / cellValue / index 四参）；
 * 预设形态见 {@link ColumnFormatterPreset}。优先级：render > 具名插槽 > formatter > enum > 原始值。
 *
 * @group ProTable 类型
 */
export type ColumnFormatter<T extends object = Record<string, unknown>> =
  | ((row: T, column: ProColumn<T>, cellValue: unknown, index: number) => string | VNode)
  | ColumnFormatterPreset

/**
 * 自动高度配置 —— v3.1 新增（useAutoHeight 能力）。
 *
 * 表格区自动撑满视口剩余高度：表头固定 + 底部分页器固定，中间表体随窗口伸缩滚动。
 * 传 `true` 用默认值；对象形态可微调测量余量。
 *
 * @group ProTable 类型
 */
export interface AutoHeightConfig {
  /**
   * 附加减去的余量（像素，默认 24）—— 用于页面底部留白 / 父容器 padding 等
   * 测量无法感知的占位；正值让表格更矮，负值让表格更高
   */
  offset?: number
}

/**
 * ProTable 列定义 —— 同时驱动表格列与搜索项（spec §1 配置驱动）。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 * render/headerRender 用「方法语法」声明：TS 对方法参数做双变（bivariance）检查，
 * 使 ProColumn<T> 可赋值给 ProColumn（默认 Record）——下游子组件与能力层消费方
 * 无需泛型化（§5.1 JSDoc 陷阱 #2：单属性一段注释）。
 * ⚠️ 行类型建议用 type 别名而非 interface：interface 无隐式索引签名，
 * 赋值到默认 T 位置（Record<string, unknown>）可能报 TS #15300 相关错误。
 *
 * @group ProTable 类型
 */
export interface ProColumn<T extends object = Record<string, unknown>> {
  /** 字段名（v-for key + table column prop + search 表单 key）—— IDE 优先补全 T 的键；联合 string 放行 'operation' 等特殊列（决策 D1） */
  prop: Extract<keyof T, string> | string
  /** 显示文本（表头 + 表单 label） */
  label: string
  /** 特殊列类型（index 序号 / selection 多选 / radio 单选 / expand 展开 / operation 操作） */
  type?: 'index' | 'selection' | 'radio' | 'expand' | 'operation'
  width?: number | string
  minWidth?: number | string
  /** 固定列（left/right；false 由列设置抽屉控制） */
  fixed?: 'left' | 'right'
  /** 是否可排序 —— true 客户端排序（el-table 原生行为）；'custom' 服务端排序（M2：sort-change → 请求参数） */
  sortable?: boolean | 'custom'
  /** 是否隐藏（支持 Ref 响应式，列设置抽屉切换） */
  hidden?: boolean | Ref<boolean>
  /** 搜索配置（缺省则该列不参与搜索区） */
  search?: SearchConfig
  /** 字典映射（自动渲染 ElTag） */
  enum?: EnumProps[]
  /** 自定义表头渲染（返回 VNode；支持 h() 与 JSX）—— 方法语法（bivariance），见接口级注释 */
  headerRender?(scope: { column: ProColumn<T>; $index: number }): VNode
  /** 自定义单元格渲染（返回 VNode；不传则按 formatter/enum/字段值渲染）—— 方法语法（bivariance），见接口级注释 */
  render?(scope: { row: T; column: ProColumn<T>; $index: number }): VNode
  /**
   * 单元格格式化（v3.1 放宽）—— 支持自定义函数与内置预设 key（'dateTime' / 'amount' 等，
   * 见 ColumnFormatterPreset）。返回 string | VNode；优先级低于 render 与具名插槽。
   * 注：v3.0.1 引入本字段时 el/vxe 引擎分支未接线（仅虚拟滚动分支生效），v3.1 补齐三引擎。
   */
  formatter?: ColumnFormatter<T>
  /**
   * 多选跨页保持选中 —— v3.1 新增（仅 type='selection' 列生效，需配合 row-key）。
   * 一等字段替代 tableProps: { reserveSelection: true } 手写透传；
   * el 引擎透传 el-table-column reserve-selection，vxe 引擎映射 checkbox-config.reserve
   */
  reserveSelection?: boolean
  /** 透传给 ElTableColumn 的 props */
  tableProps?: Record<string, unknown>
  /** 透传给 VxeColumn 的 props（仅 vxe-table 引擎生效；补充不覆盖映射派生值 field/title/sortable 等） */
  vxeProps?: Record<string, unknown>
  /** 行内编辑配置（不声明 = 该列只读） */
  edit?: ColumnEditConfig
  /** 树形列声明（仅一列生效，默认第一列） */
  tree?: ColumnTreeConfig
  /** 单元格合并配置（不声明 = 该列不参与合并） */
  span?: ColumnSpanConfig
  /** 该列是否参与行拖拽（默认 false 不参与） */
  draggable?: boolean
  /**
   * 子列（用于多级表头分组；v3.0 5c 新增）
   * - 含 children 的父列渲染为多级表头
   * - 持久化按扁平化 prop 维度处理（R1 决策）
   */
  children?: ProColumn<T>[]
}

/**
 * Toolbar 点击上下文 —— toolbar/selectionBarActions 配置回调与 #tableHeader/#toolButton/#selectionBar
 * slot 作用域共用同一份数据。ProTable 编排层从 useTable 聚合（selectedRows/loading/refresh 单一来源），
 * 业务方在配置或 slot 里直接消费，无须 ref 回读。
 *
 * 泛型 T = 行数据类型（与 ProColumn/ProTableProps 同理由，默认 Record 向后兼容）。
 *
 * @group ProTable 类型
 */
export interface ToolbarCtx<T extends object = Record<string, unknown>> {
  /** 当前选中行快照（row-key 去重后；跨页 reserve-selection 时含其他页选中行） */
  selectedRows: T[]
  /** 选中数量 —— 等价 selectedRows.length，模板里少一层属性访问 */
  selectedCount: number
  /** 表格请求进行中 —— 批量操作防重入（如禁止重复提交） */
  loading: boolean
  /** 触发表格刷新（保持当前搜索/分页条件）—— 批量操作成功后调用 */
  refresh: () => Promise<void>
}

/**
 * ToolbarAction 二次确认配置 —— 字符串为确认正文简写（自动套 useConfirm）；
 * 对象形态可追加标题/危险样式/确认按钮文案。
 *
 * 字段与 UseConfirmOptions 对应子集保持同名同型（结构类型等价），
 * ToolbarRenderer 直接整体传入 useConfirm。
 *
 * @group ProTable 类型
 */
export type ToolbarConfirm =
  | string
  | {
      /** 确认正文（仅纯文本；HTML 形态请用 slot 自行调 useConfirm） */
      content: string
      /** 弹窗标题（缺省「系统提示」） */
      title?: string
      /** 危险操作（确认按钮转红 + 警告图标），等价 useConfirm 的 danger 预设 */
      danger?: boolean
      /** 确认按钮文案（如「删除」） */
      confirmButtonText?: string
    }

/**
 * 工具栏/批量条 action 配置 —— 组件代管权限/危险确认/折叠收纳（2026-09-18 toolbar 设计 D1-D4）。
 *
 * 渲染管线（ToolbarRenderer）：perm 过滤 → hidden 计算 → primary 重复 warn →
 * 按 maxVisibleActions 截断（超出收进「更多」dropdown）→ 点击时 confirm 包装 → onClick(ctx)。
 * 泛型 T = 行数据类型（回调 ctx 里 selectedRows 精确到 T）。
 *
 * @group ProTable 类型
 */
export interface ToolbarAction<T extends object = Record<string, unknown>> {
  /**
   * 按钮文本 —— 同时是 v-for 渲染 key（同 toolbar / 同 selectionBarActions 组内须唯一，
   * 否则增删 actions 时 key 错位导致按钮复用错乱；children 拍平后与父级同序列，亦须唯一）
   */
  label: string
  /** EP 按钮语义色（默认 'default'）；'danger' 用于批量删除等危险操作，建议必配 confirm */
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  /** 左侧图标（element-plus 图标组件，需业务方显式 import） */
  icon?: Component
  /** 权限码（string 或 AND 数组，语义同 v-auth 指令）—— 无权限整块不渲染 */
  perm?: string | string[]
  /** 二次确认：字符串 = 确认正文；建议危险操作（删除/审核）必配，取消 resolve false 不执行 onClick */
  confirm?: ToolbarConfirm
  /** 禁用：布尔或按上下文计算（如 `({ selectedCount }) => selectedCount === 0` 禁用批量删除） */
  disabled?: boolean | ((ctx: ToolbarCtx<T>) => boolean)
  /** 隐藏：布尔或按上下文计算；优先级高于 disabled（hidden 时整块不渲染，disabled 仍占位） */
  hidden?: boolean | ((ctx: ToolbarCtx<T>) => boolean)
  /** 外部 loading（异步操作防重入），不传则点击态由业务自行管理 */
  loading?: boolean
  /** 点击回调；配 confirm 时先弹确认（仅确定后执行），返回 Promise 期间按钮 loading */
  onClick: (ctx: ToolbarCtx<T>) => void | Promise<void>
  /** 子操作：与父同级参与折叠计数，超出 maxVisibleActions 时随父收进「更多」 */
  children?: ToolbarAction<T>[]
}

/**
 * ProTable 组件 props —— 公开 API 的类型契约（spec §4 / §7）。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 *
 * @group ProTable 类型
 */
export interface ProTableProps<T extends object = Record<string, unknown>> {
  /** 列定义（同时驱动表格列与搜索项） */
  columns: ProColumn<T>[]
  /** 数据请求方法（必填） */
  requestApi: ProTableRequestApi<T>
  /**
   * 固定查询参数（随表单值一同序列化发送，附录 A #10 序列化规则）。
   * 与搜索字段同名时作为该字段的初始值（覆盖 defaultValue），reset 后恢复该值。
   */
  initParam?: Record<string, unknown>
  /**
   * 数据预处理（在 useTable 拿到 result 之后）—— 方法语法（bivariance），
   * 与 render 同理由：保证 ProTableProps<T> 在下游非泛型消费时可赋值
   */
  dataCallback?(data: T[]): T[]
  /** 请求错误回调（useRequest.onError 已自动捕获错误） */
  requestError?: (error: unknown) => void
  /** 是否显示分页（true / false / 透传 props） */
  pagination?: boolean | Record<string, unknown>
  /**
   * 排序参数序列化适配（决策 D2）—— 缺省用内置约定 { orderByColumn, isAsc }；
   * 后端约定不同时用它改键名/形态（如 (state) => ({ sortBy: state.prop, sortOrder: state.order })）
   */
  sortParamsAdapter?: (state: SortState<T>) => Record<string, unknown>
  /**
   * v3.5 PR2 新增：筛选参数序列化适配 —— 与 sortParamsAdapter 对称。
   * 缺省走 el-table 客户端筛选（filterState 仅 UI 记忆，不入请求）；
   * 传了之后 filter-change 事件触发时调用本适配器，把全表筛选序列化为后端约定形态并入 requestApi。
   *
   * 典型场景：5-30 个查询条件的中后台业务（电商订单筛选 / 多维度财务报表），
   * 后端期望 { status: ['paid'], dateRange: ['2026-01-01', '2026-12-31'] } 等约定键名。
   *
   * @see FilterParamsAdapter
   */
  filterParamsAdapter?: FilterParamsAdapter
  /**
   * 响应结构适配器（决策 D5 fail-fast）—— 兼容非 { data, total, pageNum, pageSize } 约定的后端。
   * requestApi 可原样返回后端结构（类型侧 cast 一次），由本回调映射为 ProTableResponse<T>；
   * 映射结果结构非法（data 非数组 / total 非数字）时 console.error + 抛错（经 useRequest 错误通道进入 error 态）。
   */
  responseAdapter?: (raw: unknown) => ProTableResponse<T>
  /** 表格引擎（spec 决策 4：首次 mount 前设置，运行时修改需 reload） */
  tableEngine?: TableEngine
  /** 用于 localStorage 缓存列设置的 key（未传则不持久化，附录 A #5） */
  tableKey?: string
  /** 行 key 字段名（多选必填） */
  rowKey?: string
  /** 初始每页大小（默认 10） */
  pageSize?: number
  /** 搜索项默认显示行数（默认 3 行；超出可展开） */
  searchRows?: number
  /** 默认密度（附录 A #7 默认 'default'） */
  density?: TableDensity
  /** 行内编辑（v2.0） */
  enableRowEdit?: boolean | RowEditConfig
  /** 树形数据（v2.0） */
  enableTree?: boolean | TreeConfig
  /** 单元格合并（v2.0） */
  enableCellSpan?: boolean | CellSpanConfig
  /** 行拖拽排序（v2.0） */
  enableRowDrag?: boolean | RowDragConfig
  /** 客户端汇总行（v3.0 新增） */
  enableSummary?: boolean | SummaryConfig
  /** 虚拟滚动（v3.0 新增） */
  virtualized?: boolean | VirtualScrollConfig
  /**
   * 自动高度（v3.1 新增）—— 表格区自动撑满视口剩余高度，表头/分页器固定，表体滚动。
   * 传 true 用默认配置；virtualized 启用时本配置被忽略（v2 引擎自带高度管理）
   */
  autoHeight?: boolean | AutoHeightConfig
  /**
   * 状态保持（v3.1 新增）—— 路由切换返回时恢复搜索参数 / 页码 / 每页大小 / 排序状态。
   * 依赖 tableKey 作为 localStorage key（未传 tableKey 时忽略）；浏览器刷新（F5）不恢复，
   * 恢复时机判定见 composables/useStatePersist.ts
   */
  statePersist?: boolean
  /**
   * 列宽拖拽：true 时表头列边框可拖动调宽（默认 false）。
   * el 引擎显式绑 el-table-column resizable（ep 默认 true，须显式 false 才能默认关闭）；
   * vxe 引擎映射列级 resizable（vxe 默认 false，语义天然契合）。
   * virtualized（TableV2）分支不支持 —— TableV2 列宽受控（onColumnResize 需回写列宽配置），留待后续
   */
  columnResize?: boolean
  /**
   * v3.2 新增：搜索字段联动显隐
   *
   * 接收当前 searchParams，返回 { [prop]: boolean } 控制每个字段是否显示。
   * - 未返回 / 返回 true → 显示（参与搜索）
   * - 返回 false → 隐藏（不进入主表单，也不进入高级筛选弹窗）
   *
   * 典型场景：
   * - 订单状态下拉选「已退款」时显示「退款原因」
   * - 选择「高级筛选」时显示「金额范围」字段
   * - 状态为「禁用」时禁用「启用时间」字段（需配合 disabled prop，目前仅控制显隐）
   *
   * 注意：函数应保持纯函数性（无副作用），内部会按 reactive 自动追踪依赖
   */
  searchDisplay?: (params: Record<string, unknown>) => Record<string, boolean>
  /**
   * v3.4 新增：搜索区布局档位 —— 强制指定 basic 字段呈现方式，替代纯字段数自动判定。
   * - 'auto'（默认）：按 basic 字段数自动判定（≤3 flat / 4-8 collapse / >8 flat-large）
   * - 'flat' / 'flat-large'：全部平铺（无展开/收起按钮）
   * - 'collapse'：强制折叠（始终显示展开/收起按钮，折叠时仅前 3 个）
   * - 'drawer'：强制高级筛选抽屉形态
   *
   * 典型场景：searchDisplay 联动使字段数动态变化时锁定档位避免布局抖动；
   * 宽屏页面强制平铺更多字段。注意：存在 search.level='advanced' 字段时
   * 无论本配置为何都走 drawer 档（advanced 字段必须可达）。
   */
  searchLayout?: SearchLayoutMode
  /**
   * v3.2 升级：是否显示「已选条件」回显区（tag 形式）
   * - true（默认）：搜索区与表格之间显示当前生效的查询条件 tag，支持单个/全部清除
   * - false：关闭回显区（适用于简洁页面）
   *
   * 设计动机：用户筛选后往往忘记自己设置了什么条件，tag 回显 + 一键清除能
   * 显著降低误操作（看到 tag 才意识到「哦原来我按了已支付」）。
   */
  showSelectedTags?: boolean
  /**
   * v3.2 升级：是否持久化「展开/收起」状态到 localStorage
   * - false（默认）：状态仅内存保留，刷新后回到默认折叠
   * - true：通过 localStorage[`${tableKey}:search-expanded`] 记忆展开状态
   *
   * 需要 tableKey 已设置（未设置则忽略）
   */
  expandedStatePersist?: boolean
  /**
   * TableHeader 左区配置式按钮组（2026-09-18 toolbar 设计）—— 新增/导入/导出等主操作的标准通道。
   * 组件代管：权限过滤（perm）、二次确认（confirm）、超出折叠（maxVisibleActions）、主按钮唯一 warn。
   * 与 #tableHeader slot 并存：slot 内容渲染在配置按钮之前，向后兼容。
   */
  toolbar?: ToolbarAction<T>[]
  /**
   * SelectionBar 批量操作配置（2026-09-18 toolbar 设计）—— 选中行 > 0 时表格上方浮出批量条。
   * 与 #selectionBar slot 二选一：slot 提供时完全接管（slot 优先），本配置忽略。
   */
  selectionBarActions?: ToolbarAction<T>[]
  /** toolbar/selectionBarActions 直出按钮上限（默认 3），超出部分折叠进「更多」下拉 */
  maxVisibleActions?: number
}

/**
 * ProTable 实例对外暴露的 API（spec §八）—— 父组件通过 ref 调用。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 *
 * @group ProTable 类型
 */
export interface ProTableExpose<T extends object = Record<string, unknown>> {
  /** 重新执行当前搜索条件（搜索参数不变） */
  refresh: () => Promise<void>
  /**
   * 重置搜索参数到 defaultValue + 清空分页 + 刷新
   * 默认行为：保留多选选中行（附录 A #1；调用方需清可调 clearSelection）
   */
  reset: () => Promise<void>
  /** 当前多选选中的行（按 row-key 去重） */
  getSelectedRows: () => T[]
  /** 清空所有选中 */
  clearSelection: () => void
  /** 当前搜索参数（响应式 read-only snapshot） */
  getSearchParams: () => Record<string, unknown>
  /**
   * 程序化修改搜索参数（修改后自动触发搜索 + 回到第 1 页，附录 A #9）
   * 默认行为：保留多选选中行（附录 A #3）
   */
  setSearchParams: (params: Record<string, unknown>) => Promise<void>
  /**
   * element-plus 表格实例（v2.1 决策 6）。vxe-table 引擎下为 null（vxe 实例暂不对外暴露）；
   * vxe 引擎加载失败会运行时回退 element-plus，回退完成后恒有值。
   * 使用 ComponentPublicInstance 而非 InstanceType<typeof ElTable>，
   * 原因：el-table 是 functional 组件定义，InstanceType 不适用。
   * 父组件如需直接调用 el-table 方法，可通过类型断言访问具体方法。
   */
  element: Ref<ComponentPublicInstance | null>
  /** 当前激活的引擎（首次挂载锁定；vxe 引擎加载失败时运行时回退 element-plus 除外） */
  engine: TableEngine
  /** 当前排序状态（null = 未排序；M2 服务端排序） */
  getSortState: () => SortState<T> | null
  /**
   * v3.5 PR2 新增：当前全表筛选快照（与 el-table filter-change 事件负载同形态）。
   *
   * 父组件可在 setFilter 后读取该值同步 URL / 上报埋点；空对象 = 无筛选（所有列无筛选值）。
   * v3.5 PR2 实施后为 required，未启用 filterParamsAdapter 时编排层 expose 占位实现返回空对象。
   *
   * @see FilterValuesMap
   */
  getFilterState?: () => FilterValuesMap
  // 行内编辑（v2.0 —— Task 7 实施后改为 required）
  startEdit?: (rowKey: string | number) => void
  cancelEdit?: (rowKey?: string | number) => void
  saveEdit?: (rowKey?: string | number) => Promise<boolean>

  // 树形（v2.0 —— Task 7 实施后改为 required）
  expandNode?: (rowKey: string | number, expanded?: boolean) => void
  collapseNode?: (rowKey: string | number) => void
  refreshChildren?: (rowKey: string | number) => Promise<void>

  // 行拖拽（v2.0 —— Task 7 实施后改为 required）
  setRowOrder?: (newOrder: T[]) => void
}
