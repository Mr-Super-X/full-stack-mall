<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * ProTable —— 配置驱动的表格组件（spec §4 文件清单 / §五组件树 / §六数据流）
 *
 * 编排层角色：持有 8 个 composables 的解构输出，把状态透传给子组件
 * SearchForm / TableHeader / ElTable / ElPagination / ColSetting。
 * 业务编排收敛到 composables/*.ts（CLAUDE.md §一 #11 Hook 拆分）。
 *
 * v3.1.2 review 优化（仅编排层小修，行为不变）：
 * - 移除反模式 `void nextTick` 占位 import（line 340）
 * - `searchColumnsTyped` 改 const（useColumns 一次性生成，非响应式）
 * - `summaryMethod` 拆为 `summaryRows` computed + 模板 inline 闭包（避免闭包引用变化触发子组件 prop 重新挂载）
 * - `hasTableMounted` + `initialLoading` 边界修正（空数据首屏不再卡在骨架屏）
 * - 抽 `DEFAULT_ROW_KEY` 常量统一 'id' 字面量
 * - autoHeight 与 virtualized 同开时强制置空 props.autoHeight（避免 ElementTableV2Body 收到双重 max-height）
 * - emit 类型对齐 useProTableEvents，去掉 ProTable.vue 中的适配闭包
 *
 * @group ProTable 组件
 */
import { computed, ref, watch, nextTick, onUnmounted, type Ref } from 'vue' // v3.1.2 review 移除 nextTick 反模式占位；nextTick 为 review R5 reset 路径等待 page watcher flush 真实需要
import 'element-plus/dist/index.css' // 与 form-schema/XForm.vue 对齐：直接引入全量 CSS
import './styles/element-protable-overwrite.scss' // ProTable 特定的样式覆盖
import './styles/_a11y.scss' // v3.5 PR1-A：A11y 全局样式（focus-visible / prefers-reduced-motion / sr-only）
import { ElPagination, ElEmpty, ElConfigProvider } from 'element-plus' // element-plus 按需注入
import AsyncState from '../common/AsyncState.vue' // 项目内 default import（unplugin-vue-components 自动注册全局组件）
import SearchForm from './components/SearchForm.vue'
import SelectedTags from './components/SelectedTags.vue' // v3.2 升级：已选条件回显
import TableHeader from './components/TableHeader.vue'
import SelectionBar from './components/SelectionBar.vue' // 2026-09-18：批量操作浮出条
import ColSetting from './components/ColSetting.vue'
import ElementTableBody from './components/ElementTableBody.vue'
import ElementTableV2Body from './components/ElementTableV2Body.vue' // v3.0.1：el-table-v2 真虚拟化引擎分支
import VxeTableBody from './components/VxeTableBody.vue' // v2.1 P3：vxe-table 引擎分支
import { useSearch } from './composables/useSearch'
import { useColumns } from './composables/useColumns'
import { useTable } from './composables/useTable'
import { useTableCapabilities } from './composables/useTableCapabilities'
import { useTableEngineDom } from './composables/useTableEngineDom'
import { useEngineFallback } from './composables/useEngineFallback' // v3.0.3：引擎回退状态抽离
import { useFullscreen } from './composables/useFullscreen' // v3.1：全屏切换
import { useAutoHeight } from './composables/useAutoHeight' // v3.1：表格区自适应视口高度
import { useStatePersist } from './composables/useStatePersist' // v3.1：搜索/分页/排序路由级持久化
import { useProTableEvents } from './composables/useProTableEvents' // v3.1.1 review：事件桥接编排层抽离
import { useVirtualScroll } from './composables/useVirtualScroll' // v3.1.3 review：编排层接管 virtualized + vxe-table 引擎回退
import { resolveEngine } from './adapters/engine'
import { DEFAULT_ROW_KEY } from './types' // 行 key 缺省值单一来源（review R7，原局部常量上移 types）
import type {
  ProColumn,
  ProTableExpose,
  ProTableProps,
  SortState,
  TableEngine,
  ToolbarAction,
  ToolbarCtx,
} from './types'

/* ───────────── BEM 命名空间（v3.1.4 review：提前到 useAutoHeight 之前） ───────────── */

/**
 * v3.1.4 review：编排层在 useAutoHeight 之前就创建好 SearchForm/TableHeader 的
 * BEM 命名空间 —— 给 useAutoHeight.selectors 注入 BEM 字符串用。
 * 单一来源：编排层用 `bem.b()` 生成 BEM 字符串，与子组件内 `createNamespace('pro-table-search')`
 * 同名同前缀，$BEM_PREFIX / 子组件块名改了 → 全链路同步，不会静默失效。
 */
const bem = createNamespace('pro-table')
const searchFormBem = createNamespace('pro-table-search')
const tableHeaderBem = createNamespace('pro-table-header')
const selectedTagsBem = createNamespace('pro-table-selected-tags') // v3.2：autoHeight 高度扣除注入用
const selectionBarBem = createNamespace('pro-table-selection-bar') // 2026-09-18：autoHeight selectors 注入用

/**
 * 单例空对象 —— 给 paginationProps 在 prop 为 false 时复用，避免每次重渲创建新对象。
 * 提前到所有 computed 之前声明，避免原版"先使用后声明"的视觉逆序（v3.1.2 review）。
 */
const EMPTY_PAGINATION_PROPS = Object.freeze({}) as Readonly<Record<string, unknown>>

/* ───────────── 局部工具 ───────────── */

/**
 * v3.5 PR3：移除 `asViewColumn` / `asViewColumns` cast 抹除函数（v3.1.2 review 引入）。
 *
 * 移除动机：6 个 ProTable 子组件统一加 `<script setup generic="T">` 后，
 * cast 把 ProColumn<T> 投影成 ProColumn 是冗余且丢失类型——
 * 子组件的 T 默认 Record<string, unknown>，与 cast 后的 ProColumn 等价，
 * 但保留 cast 会强制消费方在 ProTable → 子组件链上丢失 generic 透传。
 *
 * 移除后：ProTable 模板直接传 `columns.searchColumns` 等 ProColumn<T>[] 给子组件，
 * 编译期 T 透传到 SearchForm/TableHeader/ColSetting/Body 三引擎，无需任何 cast。
 */

const props = withDefaults(defineProps<ProTableProps<T>>(), {
  tableEngine: 'element-plus',
  pagination: true,
  pageSize: 10,
  searchRows: 3,
  density: 'default',
  initParam: () => ({}),
  columnResize: false,
  // v3.2 回归修复：Boolean prop 未声明默认值时被 Vue 强转为 false（boolean casting），
  // 原 `v-if="props.showSelectedTags !== false"` 恒 false 导致 SelectedTags 永不挂载。
  // 显式声明默认 true 让「未传 = 开启」的文档契约在运行时成立。
  showSelectedTags: true,
  // v3.5 PR2：filterParamsAdapter 不显式默认（function 类型 withDefaults 不支持）；
  // undefined 即走 el-table 客户端筛选默认值，与 sortParamsAdapter 对称。
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  /** 服务端排序变化（仅 sortable='custom' 列触发；payload 为 null 表示清除排序） */
  (e: 'sort-change', payload: SortState<T> | null): void
  /** v3.5 PR2：服务端筛选变化（payload 为当前全表筛选快照；空对象 = 全部列无筛选） */
  (e: 'filter-change', payload: Record<string, (string | number | boolean)[]>): void
  /** 引擎回退事件。vxe-table 加载失败时触发,父组件可联动监控/提示用户 */
  (e: 'engine-fallback', reason: string): void
}>()
/**
 * ProTable 对外事件契约（v3.5 PR2 起完整披露）。
 *
 * `filter-change` 与 `engine-fallback` 在 v3.5 PR2 之前仅在 element-plus 引擎下触发；
 * PR2 起 vxe-table 引擎同样 emit，保证消费方写法不依赖引擎选择。
 *
 * @see [`docs/29-ProTable使用指南.md §1.4 Events`](../../docs/29-ProTable使用指南.md) 完整事件表 + payload 类型
 * @see [`docs/29-ProTable使用指南.md §3.5`](../../docs/29-ProTable使用指南.md) filterParamsAdapter 服务端筛选示例
 * @trigger sort-change → `useTable` 内 sortParamsAdapter 拼装请求参数
 * @trigger filter-change → 消费方可用 filterParamsAdapter 自定义请求参数
 * @trigger engine-fallback → 监控上报 / 用户提示
 */

/* ───────────── v3.1 状态保持（read 必须在 useSearch/useTable 之前，见 composable 注释） ───────────── */

const statePersist = useStatePersist({
  tableKey: props.tableKey,
  enabled: props.statePersist ?? false,
})
/** 路由返回场景的快照；新会话（F5 刷新/未启用）为 null */
const persistedSnapshot = statePersist.read()

/**
 * v3.1.2 review：autoHeight 与 virtualized 同开时，编排层直接置空 autoHeightEnabled。
 * 原实现仅 console.warn 不阻断，遗留状态不一致风险：virtualized 分支生效时，
 * useAutoHeight 返回的 maxHeight 仍可能为非 null（取决于 watch 触发顺序），会让
 * ElementTableV2Body 同时收到 max-height 与自身高度管理，造成渲染异常。
 */
const autoHeightEnabled = props.autoHeight && !props.virtualized ? props.autoHeight : undefined
if (props.autoHeight && props.virtualized) {
  console.warn(
    '[ProTable] autoHeight 与 virtualized 同时启用：virtualized 自带高度管理，autoHeight 已忽略'
  )
}

/* ───────────── 编排层：用 4 个 composables 接管所有状态 ───────────── */

/**
 * 引擎 ref —— spec 决策 4：setup 阶段一次性捕获，运行时修改 prop 无效（锁定语义）。
 *
 * v3.0.3：vxe 加载失败回退由 useEngineFallback 接管，effectiveEngine 才是当前生效引擎。
 */
const engineRef: Ref<TableEngine> = resolveEngine(props.tableEngine)

const { handleEngineFallback, effectiveEngine } = useEngineFallback({
  initialEngine: engineRef,
  onFallback: (reason) => emit('engine-fallback', reason),
})

// v3.5 PR3：withDefaults + exactOptionalPropertyTypes 下 props 类型与 ProTableProps<T> 不严格等价
// （LooseRequired 包装），composable 入口需显式 cast 收敛；模板直接透传 typed columns
// 这是 v3.1.2 review 引入的边界处理，cast 是必要的（composable 不读 Loosened 类型）。
const propsForComposables = props as unknown as ProTableProps<T>

const columns = useColumns({ props: propsForComposables })

const search = useSearch({
  props: propsForComposables,
  fetchHook: async (opts) => {
    // reset 且 page≠1 时仅 setPage(1) —— page watch 会触发请求，再手动 refresh 会双发
    if (opts?.reset) {
      // v3.5 PR2：reset 路径同步清空筛选状态（仅清 state 不触发请求，由下方 setPage/refresh 接管一次）
      table.resetFilter()
      // A3（docs/audit/2026-10-15-engine-audit-summary）：vxe 引擎列头筛选 UI 清理 ——
      // el 引擎由 useTable.resetFilter 内经 tableRef 调官方 clearFilter()；
      // vxe 引擎 tableRef 为 null，走 VxeTableBody expose 通道（清 localFilterMap + vxe 内部状态）；
      // el 模式下 proTableVxe 为 null，结构化可选调用自然短路
      proTableVxe.value?.clearFilter?.()
      // 观察项闭环：reset 补发 filter-change（payload = 清空后的全表快照，恒 {}）——
      // 与 setFilter 路径事件契约一致（§3.5「payload 恒为全表快照」）；父级靠本事件做
      // URL 同步 / 埋点的消费方不再滞留 reset 前的旧筛选条件
      emit('filter-change', table.getFilterState())
      if (table.page.value !== 1) {
        table.setPage(1)
        // review R5：setPage 触发的刷新由 page watcher 异步发起，原实现直接 return 导致
        // reset()/setSearchParams() 的 Promise 在数据尚未刷新完成时就 resolve。
        // nextTick 等 watcher flush（pre 优先于 render，nextTick resolution 前必已执行），
        // 其间 watcher 内 void refresh() 已登记 pendingRefresh；再 await 它保证数据到位。
        await nextTick()
        await table.waitForRefresh()
        return
      }
    }
    await table.refresh()
  },
})
// v3.1：恢复快照搜索参数（updateParams 纯写不触发请求）
if (persistedSnapshot) search.updateParams(persistedSnapshot.searchParams)
const table = useTable({
  props: propsForComposables,
  columns,
  getSearchParams: () => search.searchParams.value,
  // v3.1：快照注入 page/pageSize/sortState 初值（exactOptionalPropertyTypes 下条件展开）
  ...(persistedSnapshot && { initialState: persistedSnapshot }),
})
// v3.1：挂载写回监听（搜索/分页/排序变化 → localStorage 快照 + session alive 标记）
statePersist.attach({
  searchParams: search.searchParams,
  page: table.page,
  pageSize: table.pageSize,
  sortState: table.sortState,
  // D(#9)：列头筛选状态随路由级持久化（路由返回后筛选条件不丢）
  filterState: table.filterState,
})

/* ───────────── v3.1：根容器 ref + 全屏 + 自动高度 ───────────── */

/** 根容器 DOM ref —— fullscreen class 绑定与 autoHeight 测量的共同挂载点 */
const rootEl = ref<HTMLElement | null>(null)

/** 全屏切换状态 —— CSS fixed 方案（is-fullscreen class 由模板绑定），Esc 退出在 composable 内 */
const { isFullscreen, toggleFullscreen } = useFullscreen()

/**
 * 自动高度 —— v3.1.2 review：autoHeightEnabled 已在编排层剔除 virtualized 冲突，
 * 此处直接传入；offset 取 autoHeightEnabled 对象形态（false/undefined 时为 0）。
 *
 * v3.1.4 review：BEM 选择器由编排层注入（替代 useAutoHeight 原硬编码 .vv-pro-table-search/-header）。
 * 编排层用 SearchForm/TableHeader 各自的 `bem.b()` 产出对应 BEM 根类名传入，
 * 避免 composable 隐式依赖 $BEM_PREFIX 默认值 'vv'（CLAUDE.md §3.2 规则 3）。
 */
const { maxHeight: autoHeightMax } = useAutoHeight({
  enabled: Boolean(autoHeightEnabled),
  rootEl,
  offset: typeof autoHeightEnabled === 'object' ? (autoHeightEnabled.offset ?? 0) : 0,
  // BEM 字符串由编排层统一生成，与子组件块名/BEM 前缀单一来源同步
  selectors: {
    search: searchFormBem.b(),
    header: tableHeaderBem.b(),
    // v3.2 已选条件回显区：2026-09-18 review 修复高度漏算（同开时表格溢出视口）
    selectedTags: selectedTagsBem.b(),
    // pagination 选填：保留 element-plus 默认 '.el-pagination'
    // 2026-09-18（设计 D8）：SelectionBar v-if 挂载/卸载时经 ResizeObserver 联动重测
    selectionBar: selectionBarBem.b(),
  },
})

/** ElementTableBody 实例 ref —— 提前到 useTableEngineDom 之前声明，供 composable 接收。
 * v3.5 PR3：ElementTableBody 加 `<script setup generic="T">` 后，`InstanceType<typeof ElementTableBody>`
 * 不再适用（generic 组件无静态构造类型），改用结构化类型与 useTableEngineDom / watch elTable 字段对齐。 */
const proTableEl = ref<{ $el?: HTMLElement; elTable?: ComponentPublicInstance | null } | null>(null)

/** v2.1 vxe 引擎分支实例 ref —— 密度切换触发 vxe 行高重算 + useTableEngineDom vxe tbody 查询
 * v3.5 PR3：VxeTableBody 加 generic<T> 后 InstanceType 不适用，改用结构化类型保留递归数实例。 */
const proTableVxe = ref<{
  recalculate?: () => Promise<unknown>
  getTbody?: () => HTMLElement | null
  /** A3：reset 清列头筛选 UI 通道（清 vxe 内部筛选状态 + 本地 localFilterMap 快照） */
  clearFilter?: () => void
  /** B1：清 vxe 选区 UI 勾选（多选 + 单选）+ 引擎侧本地选区镜像 */
  clearSelection?: () => void
} | null>(null)

/** tbody DOM 访问点 —— 经 useTableEngineDom composable 收敛；v3.5 PR1-B 起支持 el + vxe 双引擎路由 */
const { getTbody } = useTableEngineDom({
  proTableEl,
  proTableVxe,
  effectiveEngine,
})

/* ───────────── v3.1.3 review：virtualized + vxe-table 引擎回退接管 ───────────── */

/**
 * 编排层按 props.virtualized 条件创建 useVirtualScroll —— 原 useTableCapabilities
 * 内部创建但与 useEngineFallback 解耦，导致 useVirtualScroll 必须自己 mutate engine.value
 * 反向数据流。改为编排层条件创建 + 通过 options 注入 useTableCapabilities + 处理 engineConflict。
 *
 * 未启用时为 null：useVirtualEngine / useVxeEngine computed 按 null 短路，
 * 避免 Boolean(virtualScroll?.enabled) 误判（Ref 对象 Boolean() 永远为 true）。
 */
const virtualScroll = props.virtualized
  ? useVirtualScroll({
      // v3.5 PR3：useVirtualScroll 不读泛型，仅用 props.tableEngine/props.virtualized/props.enableRowEdit，
      // cast 到默认 Record 视角避免泛型传递的 index signature 报错（与 useTableCapabilities.ts 同边界）
      props: propsForComposables as unknown as ProTableProps,
      engine: engineRef,
      enableRowEdit: Boolean(props.enableRowEdit),
    })
  : null
// virtualized + vxe-table 冲突：useVirtualScroll 不再 mutate engine.value，
// 改为标记 engineConflict 由编排层 useEngineFallback 统一接管（行为等价 + 数据流单向）
if (virtualScroll?.engineConflict.value === 'vxe-table-incompatible') {
  handleEngineFallback('virtualized 启用时强制回退 element-plus 引擎（vxe-table 不兼容）')
}

/* ───────────── v2.0 四类能力编排（已抽到 useTableCapabilities.ts） ───────────── */

const { rowEdit, treeData, cellSpan, rowDrag, summary, extendedExpose } = useTableCapabilities({
  props: propsForComposables,
  columns,
  table,
  engine: engineRef,
  getTbody,
  // v3.1.3 review：编排层注入 virtualScroll（由 useTableCapabilities 透传，避免重复实例化）
  virtualScroll,
})

/**
 * v3.5 hotfix-9：引擎 tbody 就绪（el 同步挂载 / vxe 异步加载后发 body-ready 事件）——
 * 挂载行拖拽。事件驱动替代原 useRowDrag 内 setTimeout 盲轮询（vxe 引擎加载耗时不确定，
 * 定时重试要么过早要么浪费；就绪事件精确且只挂一次）
 */
function handleTableBodyReady(): void {
  rowDrag?.reattach()
}

/** v2.0 树形：data 变化时 normalize + 扁平化（flatData computed 随 expanded 自动重算） */
const hasTableMounted = ref(false)
/**
 * v3.1.2 review：data !== null（含 []）即标记 mounted。
 * 原条件 `data.length > 0` 在首屏空数据（data 已是 [] 而非 null）时永不标记，
 * 导致 initialLoading 永远为 true，骨架屏不消失。
 *
 * 合并 treeData.normalize 与 hasTableMounted 为单一监听点，避免同一数据源双 watcher。
 */
watch(
  () => table.data.value,
  (data) => {
    if (data !== null) {
      treeData?.normalize(data as never)
      hasTableMounted.value = true
    }
  },
  { immediate: true }
)

/**
 * ElementTableBody 暴露的 ElTable 实例同步进 useTable.tableRef
 * 捕获 watch 返回的 stop，onUnmounted 调用避免组件卸载后
 * 引用已销毁 ElementTableBody 实例导致无意义赋值。
 */
const stopProTableElWatcher = watch(
  proTableEl,
  (inst) => {
    table.tableRef.value = inst?.elTable ?? null
  },
  { flush: 'post' }
)
onUnmounted(() => {
  stopProTableElWatcher()
})

/* ───────────── v3.1.1 review：事件桥接抽到 useProTableEvents ───────────── */

/**
 * v3.1.2 review：emit 类型已对齐 defineEmits 的 sort-change 签名，
 * 直接传 emit 函数，去掉原 ProTable.vue 中的适配闭包。
 */
const events = useProTableEvents<T>({
  table,
  columns,
  search,
  treeData,
  // 2026-09-18 review：双击编辑收编——两引擎 body 只转发 cell-dblclick，由桥接层调 _start
  rowEdit: rowEdit ?? null,
  engine: {
    effectiveEngine,
    proTableVxe,
  },
  emit,
})

/**
 * v3.1：radio 列当前选中行 rowKey（selectedRows[0] 解析）—— 驱动 el-radio 勾选态；undefined = 未选中。
 * v3.1.2 review：默认值走 DEFAULT_ROW_KEY 常量（与 useTable.setSelectedRows 同一来源）。
 */
const selectedRowKey = computed<string | number | undefined>(() => {
  const first = table.selectedRows.value[0] as Record<string, unknown> | undefined
  if (!first) return undefined
  const key = props.rowKey ?? DEFAULT_ROW_KEY
  return (first[key] as string | number | undefined) ?? undefined
})

/**
 * 2026-09-18 toolbar 设计：聚合 ToolbarCtx —— selectedRows/loading/refresh 单一来源（useTable），
 * toolbar 配置 / selectionBarActions 配置 / tableHeader·toolButton·selectionBar slot 作用域共用。
 */
const toolbarCtx = computed<ToolbarCtx<T>>(() => ({
  selectedRows: table.selectedRows.value,
  selectedCount: table.selectedRows.value.length,
  loading: table.loading.value,
  refresh: table.refresh,
}))

/**
 * v3.0.3 → v3.1.4 review：表格数据 Record 视角投影 —— 直接读 useTable 暴露的
 * `rows` computed，消除原「(table.data.value ?? []) as Record<string, unknown>[]」
 * 在编排层重复 cast。引用稳定：data 不变时所有引擎分支共享同一数组。
 */
const tableRows = computed<Record<string, unknown>[]>(() => table.rows.value)

/**
 * v3.0.3：分页 props —— 收敛模板 cast `(props.pagination as Record<string, unknown>) ?? {}`。
 * 引用稳定（pagination 为 false 或缺省时返回顶部单例 EMPTY_PAGINATION_PROPS）。
 */
const paginationProps = computed<Record<string, unknown>>(() => {
  const p = props.pagination
  if (p && typeof p === 'object') return p as Record<string, unknown>
  return EMPTY_PAGINATION_PROPS as Record<string, unknown>
})

// 单例 EMPTY_PAGINATION_PROPS 已在文件顶部声明（v3.1.2 review）

/**
 * 是否空数据(给 AsyncState 三态用) —— 用 tableRows 替代 (table.data.value?.length ?? 0) === 0
 * 注意：与 initialLoading 配合，loading=true 时不进入 empty 态（避免骨架屏闪烁）
 */
const isEmptyData = computed(
  () => !table.loading.value && !table.error.value && tableRows.value.length === 0
)

/**
 * 首次加载中（skeleton 态）；后续刷新为 false，保持表格挂载（避免 reserve-selection / 展开行状态丢失）。
 * v3.1.2 review：边界修正——loading=true 且"未拿到 data（null）"展示骨架屏；
 * loading=true 但"已拿到 data（即便 []）"切走 skeleton 进入空数据态，避免首屏空数据卡骨架屏。
 */
const initialLoading = computed(
  () => table.loading.value && (table.data.value === null || !hasTableMounted.value)
)

/* ───────────── 列 cast 收敛（泛型 T → 非泛型 ProColumn，给子组件） ───────────── */

/**
 * v3.5 PR3：去掉 NonGeneric 后缀 —— cast 已移除，类型自然透传到子组件 generic<T>。
 *
 * - searchColumnsTyped：searchColumns 在 useColumns setup 时一次性生成（filter 静态结果），
 *   无响应性收益，包 computed 是误导；改为普通常量。
 * - allColumnsTyped / sortedColumnsTyped：依赖响应式 Ref（visibleKeys/columnOrder），
 *   必须保留 computed。
 */
const searchColumnsTyped: ProColumn<T>[] = columns.searchColumns
const allColumnsTyped = computed<ProColumn<T>[]>(() => columns.allColumns.value)
const sortedColumnsTyped = computed<ProColumn<T>[]>(() => columns.sortedColumns.value)

/* ─────────── v3.2 升级：SelectedTags 数据 + 清除条件 handler ─────────── */

/**
 * 构建 select 枚举值翻译 Map（纯函数，便于单测）
 * - key = col.prop
 * - value = { [rawValue]: label }
 *
 * 用途：SelectedTags 显示「订单状态: 已支付」而不是「订单状态: paid」
 */
function buildSearchEnumMaps(searchCols: ProColumn<T>[]): Record<string, Record<string, string>> {
  const maps: Record<string, Record<string, string>> = {}
  for (const col of searchCols) {
    if (col.search?.el === 'select' && col.enum) {
      const m: Record<string, string> = {}
      for (const opt of col.enum) {
        m[String(opt.value)] = opt.label
      }
      maps[col.prop] = m
    }
  }
  return maps
}

/**
 * v3.5 PR3：select 枚举值翻译 Map。
 * 入参直接传 ProColumn<T>[]（cast 已移除，类型自然透传），无需 asViewColumns 投影。
 */
const searchEnumMaps = buildSearchEnumMaps(searchColumnsTyped)

/**
 * v3.2 升级：清除单个搜索条件（SelectedTags × 按钮触发）
 * 还原字段为 defaultValue + 重新搜索
 */
function handleClearOneCondition(prop: string): void {
  // 1. 找到对应 column 拿到 defaultValue
  const col = columns.searchColumns.find((c) => c.prop === prop)
  const defaultValue = col?.search?.defaultValue ?? null
  // 2. 通过 useSearch.updateParams 写入（不触发请求）
  search.updateParams({ [prop]: defaultValue })
  // 3. 触发搜索
  void search.search()
}

/**
 * v3.2 升级：清除全部搜索条件（清除全部按钮触发）
 * 遍历所有 search columns 还原 defaultValue
 */
function handleClearAllConditions(): void {
  const updates: Record<string, unknown> = {}
  for (const col of columns.searchColumns) {
    if (col.search) {
      updates[col.prop] = col.search.defaultValue ?? null
    }
  }
  search.updateParams(updates)
  void search.search()
}

/** v3.0 5a：汇总行参数 —— el-table 内置 show-summary + summary-method 机制。 */
const showSummary = computed(() => Boolean(summary))
/**
 * 包装 useSummary.summaryRows 为 el-table summary-method 协议函数。
 * 闭包捕获 summaryRows 引用（响应式追踪 data 变化自动重算）。
 */
const summaryMethod = computed<(() => string[]) | undefined>(() => {
  if (!summary) return undefined
  return (): string[] => summary.summaryRows.value
})

/** v3.0.3：引擎模式枚举 —— 单一 computed 替代 `useVirtualEngine` + `useVxeEngine` 两个布尔。
 *
 * 注意：必须读 `enabled.value` 而非 `enabled`（后者是 Ref 对象，Boolean() 永远为 true）。
 * virtualScroll 为 null 时短路返回 false。
 */
const useVirtualEngine = computed(
  () => effectiveEngine.value === 'element-plus' && Boolean(virtualScroll?.enabled.value)
)
const useVxeEngine = computed(() => effectiveEngine.value === 'vxe-table')

/* ───────────── defineExpose（spec §八） ───────────── */

defineExpose({
  refresh: () => table.refresh(),
  reset: () => search.reset(),
  getSelectedRows: () => table.getSelectedRows(),
  clearSelection: () => {
    table.clearSelection()
    // B1（docs/audit/2026-10-15 #2）：vxe 引擎 UI 勾选清理 —— el 引擎由 useTable 内经
    // tableRef 调官方 clearSelection()；vxe 引擎 tableRef 为 null，走 VxeTableBody expose
    // 通道（clearCheckboxRow/clearRadioRow + 引擎侧本地镜像）；el 模式下 proTableVxe 为
    // null 自然短路（同 A3 clearFilter 双通道模式）
    proTableVxe.value?.clearSelection?.()
  },
  getSearchParams: () => search.getParams(),
  setSearchParams: (params: Record<string, unknown>) => search.setSearchParams(params),
  element: table.tableRef,
  // getter：vxe 加载失败回退后，调用方读到的是当前引擎而非初始快照
  get engine(): TableEngine {
    return effectiveEngine.value
  },
  getSortState: () => table.getSortState(),
  /** v3.5 PR2：当前全表筛选快照 —— 父级可读取做 URL 同步 / 埋点 / 上报 */
  getFilterState: () => table.getFilterState(),
  ...extendedExpose,
} satisfies ProTableExpose<T>)
</script>

<template>
  <ElConfigProvider>
    <div
      ref="rootEl"
      v-bind="$attrs"
      :class="[bem.b(), bem.is('tree', !!treeData), bem.is('fullscreen', isFullscreen)]"
      :data-density="table.density.value"
      role="grid"
      :aria-label="isFullscreen ? '数据表格（全屏）' : '数据表格'"
      :aria-rowcount="table.total.value + 1"
      :aria-busy="table.loading.value"
    >
      <SearchForm
        v-if="columns.searchColumns.length > 0"
        :columns="searchColumnsTyped"
        :search-params="search.searchParams.value"
        :search-rows="props.searchRows"
        v-bind="{
          ...(props.tableKey ? { tableKey: props.tableKey } : {}),
          ...(props.searchDisplay ? { searchDisplay: props.searchDisplay } : {}),
          ...(props.expandedStatePersist ? { expandedStatePersist: true } : {}),
          // v3.4：布局档位下放业务方（auto 缺省不传，保持 SearchForm 默认行为）
          ...(props.searchLayout ? { searchLayout: props.searchLayout } : {}),
        }"
        @search="search.search"
        @reset="search.reset"
        @update:search-params="events.updateSearchParams"
        @clear-condition="handleClearOneCondition"
        @clear-all-conditions="handleClearAllConditions"
      />
      <!--
        v3.2 升级：已选条件回显区（tag 形式）
        - 默认开启（showSelectedTags 未指定时为 true）
        - 单个 ×：清该字段 + 重新搜索
        - 清除全部：清所有字段 + 重新搜索
        - enumMaps：把 select 枚举值翻译为 label（避免显示数字 ID）
      -->
      <SelectedTags
        v-if="props.showSelectedTags && columns.searchColumns.length > 0"
        :columns="searchColumnsTyped as ProColumn<Record<string, unknown>>[]"
        :search-params="search.searchParams.value"
        :enum-maps="searchEnumMaps"
        @clear-one="handleClearOneCondition"
        @clear-all="handleClearAllConditions"
      />
      <TableHeader
        :columns="allColumnsTyped"
        :visible-columns="sortedColumnsTyped"
        :density="table.density.value"
        :col-setting-visible="columns.colSettingVisible.value"
        :fullscreen="isFullscreen"
        :toolbar="(props.toolbar ?? []) as ToolbarAction<T>[]"
        :toolbar-ctx="toolbarCtx"
        :max-visible-actions="props.maxVisibleActions"
        @refresh="table.refresh"
        @update:density="events.handleDensityChange"
        @update:col-setting-visible="events.handleColSettingUpdate"
        @toggle-fullscreen="toggleFullscreen"
      >
        <!-- 2026-09-18：slot 作用域透传 ToolbarCtx（旧用法不带 scope 不受影响，向后兼容） -->
        <template #tableHeader="scope">
          <slot name="tableHeader" v-bind="scope" />
        </template>
        <template #toolButton="scope">
          <slot name="toolButton" v-bind="scope" />
        </template>
      </TableHeader>
      <!--
        2026-09-18 批量操作浮出条（设计 D5/D6）：选中行 > 0 时挂载于表格上方。
        #selectionBar slot 优先于 selectionBarActions 配置（SelectionBar 内部判定接管）；
        清除经 useTable.clearSelection（同步清 el-table UI 勾选态）。
      -->
      <SelectionBar
        v-if="table.selectedRows.value.length > 0"
        :ctx="toolbarCtx"
        :actions="(props.selectionBarActions ?? []) as ToolbarAction<T>[]"
        :max-visible="props.maxVisibleActions"
        @clear="table.clearSelection"
      >
        <template v-if="$slots.selectionBar" #default="scope">
          <slot name="selectionBar" v-bind="scope" />
        </template>
      </SelectionBar>
      <AsyncState
        :loading="initialLoading"
        :error="table.error.value"
        :is-empty="isEmptyData"
        @retry="table.refresh"
      >
        <!-- v3.0.1：virtualized 优先于 engine，命中时挂载 v2 引擎分支 -->
        <ElementTableV2Body
          v-if="useVirtualEngine"
          :rows="tableRows as T[]"
          :loading="table.loading.value && hasTableMounted"
          :columns="sortedColumnsTyped"
          :row-key="props.rowKey"
          :virtual-config="virtualScroll?.config.value ?? {}"
          :density="table.density.value"
          :slots="$slots as never"
          @sort-change="events.handleSortChange"
        />
        <ElementTableBody
          v-else-if="effectiveEngine === 'element-plus'"
          ref="proTableEl"
          :rows="(treeData ? treeData.flatData.value : tableRows) as T[]"
          :loading="table.loading.value && hasTableMounted"
          :columns="sortedColumnsTyped"
          :row-key="props.rowKey"
          :row-edit="rowEdit"
          :tree-data="treeData"
          :cell-span="cellSpan"
          :show-summary="showSummary"
          :summary-method="summaryMethod"
          :selected-row-key="selectedRowKey"
          :max-height="autoHeightMax"
          :density="table.density.value"
          :column-resize="props.columnResize"
          @selection-change="events.handleSelectionChange"
          @radio-select="events.handleRadioSelect"
          @expand-toggle="events.handleExpandToggle"
          @cell-dblclick="events.handleCellDblclick"
          @sort-change="events.handleSortChange"
          @filter-change="events.handleFilterChange"
          @body-ready="handleTableBodyReady"
        >
          <!-- 透传业务插槽（col.prop 命名插槽等），保持 v1 插槽契约不变 -->
          <template v-for="(_, name) in $slots" :key="name" #[name]="scope">
            <slot :name="name" v-bind="scope" />
          </template>
        </ElementTableBody>
        <!-- v3.5 PR1-B：vxe-table 引擎分支（树形/拖拽接线与 el 对等；加载失败由 engine-fallback 回退）
             v3.5 hotfix-5：vxe 引擎 :rows 改回 tableRows（原始嵌套数据），原因——
             vxe-table 用 tree-config.childrenField='children'（hotfix-5 同步改）递归渲染嵌套数据；
             el 引擎走 treeData.flatData 平铺 + treeProps 占位符。两引擎数据源不同
             （el 平铺+vxe 占位 / vxe 嵌套+真实字段名），syncExpanded 双向同步使用。 -->
        <VxeTableBody
          v-else-if="useVxeEngine"
          ref="proTableVxe"
          :rows="tableRows as T[]"
          :loading="table.loading.value && hasTableMounted"
          :columns="sortedColumnsTyped as ProColumn<Record<string, unknown>>[]"
          :row-key="props.rowKey"
          :row-edit="rowEdit"
          :cell-span="cellSpan"
          :tree-data="treeData"
          :row-drag="rowDrag"
          :max-height="autoHeightMax"
          :density="table.density.value"
          :column-resize="props.columnResize"
          @selection-change="events.handleSelectionChange"
          @radio-select="events.handleRadioSelect"
          @expand-toggle="events.handleExpandToggle"
          @cell-dblclick="events.handleCellDblclick"
          @sort-change="events.handleSortChange"
          @filter-change="events.handleFilterChange"
          @engine-fallback="handleEngineFallback"
          @body-ready="handleTableBodyReady"
        >
          <!-- 透传业务插槽（col.prop 命名插槽等），与 el 分支契约一致 -->
          <template v-for="(_, name) in $slots" :key="name" #[name]="scope">
            <slot :name="name" v-bind="scope" />
          </template>
        </VxeTableBody>
        <template #empty>
          <slot name="empty">
            <ElEmpty description="暂无数据" />
          </slot>
        </template>
      </AsyncState>
      <!-- D（docs/audit/2026-10-15 protable#8）：paginationProps 的 v-bind 须在前 —— 业务 pagination
           props 在后会覆盖内部受控绑定（current-page/page-size/total）导致分页状态失控；
           受控绑定后置优先（v-bind 顺序即合并优先级，后者覆盖前者） -->
      <ElPagination
        v-if="props.pagination !== false"
        v-bind="paginationProps"
        :total="table.total.value"
        :current-page="table.page.value"
        :page-size="table.pageSize.value"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="events.handlePageChange"
        @size-change="events.handleSizeChange"
      >
        <template #default>
          <slot name="paginationLeft" />
        </template>
        <template #append>
          <slot name="paginationRight" />
        </template>
      </ElPagination>
      <!-- 列设置：引擎无关 —— 操作 useColumns 数据层（visibleKeys/columnOrder） -->
      <ColSetting
        v-model:visible="columns.colSettingVisible.value"
        :columns="allColumnsTyped"
        :visible-keys="columns.visibleKeys.value"
        :fixed-keys="columns.fixedKeys.value"
        @update:visible-keys="events.updateVisibleKeys"
        @reorder="events.updateColumnOrder"
        @reset-to-default="columns.resetToDefault"
      />
    </div>
  </ElConfigProvider>
</template>

<style lang="scss">
/* ProTable 根容器：宽度占满即可，内部子组件自带布局 */
.#{$BEM_PREFIX}-pro-table {
  width: 100%;

  /* 内部各区域之间的间距 */
  & > * + * {
    margin-top: 12px;
  }

  /*
   * v3.1 全屏态 —— CSS fixed 遮罩方案（useFullscreen 状态驱动）。
   * z-index 1500：低于 el-dialog 遮罩（2000 起），全屏表格内打开弹窗不被遮挡
   */
  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: var(--z-index-fullscreen);
    padding: 16px;
    background: var(--el-bg-color);
    overflow: auto;
  }

  /* v2.2 树形模式：展开开关走树列内联自定义箭头 */
  &.is-tree {
    .el-table__expand-icon,
    .el-table__expanded-cell {
      display: none;
    }

    /*
     * v3.5 hotfix-9：隐藏 vxe-table 内置展开钮 —— 它在 slot 内容之前渲染，
     * 顺序不可控（与 el 的 [拖拽柄][箭头][文本] 冲突）；展开 UI 统一由树列 slot 内的
     * .pro-table-tree-toggle 呈现（vxe / el 同标记同样式，箭头大小自然对齐）
     */
    .vxe-cell--tree-btn {
      display: none;
    }
  }

  /* 树列内联展开箭头按钮：reset 浏览器默认 button 外观（边框/底色），对齐单元格文本基线 */
  .pro-table-tree-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-right: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--el-text-color-regular);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}
</style>
