<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * ElementTableBody —— element-plus 引擎渲染分支（v2.1 P1 自 ProTable.vue 抽取）
 *
 * 展示层角色：承接 ElTable + ElTableColumn 列循环模板（含行编辑 / 树形 / 单元格合并 /
 * 拖拽手柄四个能力分支）。能力实例由编排层（ProTable.vue）以 props 注入，本组件仅做
 * 读取与事件转发，不直接持有 composables（保持展示组件纯粹，v2 设计 §3.3）。
 *
 * 抽取动机：ProTable.vue 超 300 行业务组件上限；且 vxe-table 分支（VxeTableBody）
 * 需要同级的渲染分支插槽位（v2.1 决策 1）。
 *
 * v3.5 PR3：补 generic<T> 透传——rows / columns 都绑 T，消费方传 `ProColumn<User>`
 * 时 IDE 提示贯穿到 ProColumn.render 的 row: T 形参。
 *
 * @see [`../ProTable.vue`](../ProTable.vue) 编排层 —— 唯一调用方
 * @see [`../adapters/cell-render`](../adapters/cell-render.ts) resolveCellContent 共用渲染逻辑
 * @group ProTable 组件
 */
import { ElTable, ElTableColumn, ElRadio } from 'element-plus' // element-plus 按需注入（unplugin-vue-components 只管模板，script 中显式 import）
import type { ComponentPublicInstance } from 'vue' // 类型导入（TS 编译器需要，不参与运行时）
import { DEFAULT_ROW_KEY } from '../types' // 行 key 缺省值单一来源（review R7）
import type { FilterValuesMap, ProColumn, SortChangeEvent, TableDensity } from '../types'
import type { useRowEdit } from '../composables/useRowEdit'
import type { useTreeData } from '../composables/useTreeData'
import type { useCellSpan } from '../composables/useCellSpan'
import { resolveCellContent } from '../adapters/cell-render'
import EditCell from './EditCell.vue'
import CellContent from './CellContent.vue'

const props = defineProps<{
  /** 渲染行（树形模式为扁平化后的 flatData） */
  rows: T[]
  /**
   * 后续刷新 loading（分页/排序/搜索请求期间的遮罩）。
   * 首次加载由编排层 AsyncState skeleton 承担，本组件收到时恒为 false —— 避免双重 loading。
   */
  loading: boolean
  /** 可见列（列设置抽屉排序后的结果） */
  columns: ProColumn<T>[]
  /** 行 key 字段名（缺省 'id'）；显式联合 undefined —— exactOptionalPropertyTypes 下模板绑定可能传 undefined */
  rowKey?: string | undefined
  /** 行编辑能力实例（未启用为 null，v-else-if 分支跳过） */
  rowEdit: ReturnType<typeof useRowEdit> | null
  /** 树形能力实例（未启用为 null，树形缩进分支跳过） */
  treeData: ReturnType<typeof useTreeData> | null
  /** 单元格合并能力实例（未启用为 null，spanMethod 不绑定） */
  cellSpan: ReturnType<typeof useCellSpan> | null
  /** v3.0 5a：是否显示汇总行（undefined = 透传 undefined 给 ElTable，即不显示） */
  showSummary?: boolean | undefined
  /** v3.0 5a：汇总方法（返回按列汇总值数组） */
  summaryMethod?: (() => string[]) | undefined
  /** v3.0 5b：虚拟滚动 tableProps（高度限制 + rowHeight 等） */
  virtualScrollProps?: Record<string, unknown>
  /**
   * v3.1：radio 单选列当前选中行的 rowKey（useTable.selectedRows[0] 经编排层解析；
   * undefined = 未选中）—— 驱动 el-radio 勾选态，跨页保持由 useTable 选中区天然支持
   */
  selectedRowKey?: string | number | undefined
  /**
   * v3.1：自动高度（useAutoHeight 计算结果）—— 非 null 时绑定 ElTable max-height
   * （表头固定 + 表体滚动）；null 不绑定，维持默认全量渲染
   */
  maxHeight?: number | null
  /**
   * v3.1：当前密度档位 —— 透传给 EditCell，编辑态控件尺寸随密度联动
   * （el 引擎行高由 data-density CSS 变量覆盖，编辑控件需要显式 size 映射）
   */
  density?: TableDensity | undefined
  /** 列宽拖拽：true 时表头列边框可拖动（ep resizable 默认 true，必须显式绑 false 才能默认关闭） */
  columnResize?: boolean | undefined
}>()

const bem = createNamespace('pro-table') // kebab-case，与 ProTable.vue 同源：拖拽手柄类名必须与 useRowDrag 选择器一致

const emit = defineEmits<{
  /** 多选变化（行 Record 视角；编排层 cast 收口到 T[]，运行时同一引用） */
  (e: 'selection-change', rows: Record<string, unknown>[]): void
  /** v3.1：单选选中（整行数据透传；编排层 setSelectedRows([row]) 收敛到统一选中区） */
  (e: 'radio-select', row: Record<string, unknown>): void
  /** 双击单元格（rowKey + 行数据；编排层 useProTableEvents 转发给 rowEdit._start） */
  (e: 'cell-dblclick', rowKey: string | number, rowData: Record<string, unknown>): void
  /** 树形展开/折叠（已解析 rowKey；编排层转发给 treeData.toggle） */
  (e: 'expand-toggle', rowKey: string | number): void
  /** 排序变化（原始 el-table 负载；编排层判定 sortable==='custom' 后走 M2 服务端排序） */
  (e: 'sort-change', evt: SortChangeEvent): void
  /**
   * v3.5 PR2：列头筛选变化（el-table @filter-change 原始负载是当前全表筛选快照）。
   * 编排层转发给 useProTableEvents.handleFilterChange（与 sort-change 对称）；
   * 无 filterParamsAdapter 时编排层仅 UI 记忆（el-table 客户端筛选继续生效）
   */
  (e: 'filter-change', filters: FilterValuesMap): void
  /**
   * v3.5 hotfix-9：tbody 渲染就绪（el 同步挂载；vxe 异步加载完成后由 VxeTableBody 发出）——
   * 编排层收到后挂载/重挂载行拖拽（rowDrag.reattach），事件驱动替代 setTimeout 轮询
   */
  (e: 'body-ready'): void
}>()

/** 统一取行 rowKey（props.rowKey 字段，默认 DEFAULT_ROW_KEY）—— 事件桥接与树形模板共用 */
function rowKeyOf(row: unknown): string | number {
  // unknown 入参解耦 T：树形扁平行含 _level/_hasChildren 附加字段，事件行来自 el-table（any）
  return (row as Record<string, unknown>)[props.rowKey ?? DEFAULT_ROW_KEY] as string | number
}

/** 过滤对象中的 undefined 字段（exactOptionalPropertyTypes 兼容） */
function filterUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/* ─────────── ElTable 事件具名 handler（review R8）───────────
 * 模板零内联箭头：与编排层 useProTableEvents 同一标准 ——
 * 稳定 handler 引用让 Vue props diff 判定无变化，跳过 ElTable 不必要更新路径。
 * 事件负载类型显式标注（el-table emit 是 any，这里收敛到本组件 emit 契约）。
 */
function onSelectionChange(rows: Record<string, unknown>[]): void {
  selectionCount.value = rows.length
  emit('selection-change', rows)
}

/**
 * v3.5 PR1-A：A11y 选中变化播报 —— 选中行数变化时 sr-only span 更新，
 * 屏幕阅读器自动朗读「已选 N 项」（aria-live=polite 由 sr-only 工具类承载）。
 */
const selectionCount = ref(0)
const selectionAnnounce = computed(() => {
  const n = selectionCount.value
  if (n === 0) return ''
  return `已选 ${n} 项`
})
function onCellDblclick(row: unknown): void {
  // 2026-09-18 review：原在此直调 rowEdit._start（展示组件越权触发行编辑生命周期，
  // 与文件头「仅做读取与事件转发」声明矛盾；且 vxe 分支无此直调路径，双击编辑在
  // vxe 引擎静默失效）。统一收编为纯事件转发：编排层 useProTableEvents.handleCellDblclick
  // 接收后调 _start（rowData 随行事件带上，v3.0 回填 drafts 语义不变）
  emit('cell-dblclick', rowKeyOf(row), row as Record<string, unknown>)
}
function onExpandChange(row: unknown): void {
  emit('expand-toggle', rowKeyOf(row))
}
function onSortChange(evt: SortChangeEvent): void {
  emit('sort-change', evt)
}

/**
 * v3.5 PR2：列头筛选变化 handler（el-table @filter-change）。
 * el-table 给的 filters 是当前全表筛选快照（{ propA: [v1], propB: [v2] }），
 * 直接透传 — 编排层 useProTableEvents.handleFilterChange 经 table.setFilter 覆盖式更新
 * （不残留 UI 已清除的列）。
 */
function onFilterChange(filters: Record<string, unknown[]>): void {
  // el-table FilterValue 联合 string|number|boolean，与 FilterValuesMap 形态一致直接断言
  emit('filter-change', filters as FilterValuesMap)
}

/**
 * ElTable 实例 ref —— v2.2-M1 起经 defineExpose 转发给编排层，
 * 同步进 useTable.tableRef（对外 element expose + clearSelection 清 UI 勾选态）。
 */
const elTableRef = ref<ComponentPublicInstance | null>(null)

// defineExpose 后父级模板 ref 只能拿到本对象（默认实例属性不再透出），
// 故 $el 用 getter 显式转发 —— ProTable.vue 的 getTbody（行拖拽挂载点查询）依赖它
defineExpose({
  /** el-table 组件实例（编排层同步进 useTable.tableRef） */
  elTable: elTableRef,
  /** 根 DOM（透传 ElTable 根元素） */
  get $el() {
    return elTableRef.value?.$el as HTMLElement | undefined
  },
})

/*
 * v3.5 hotfix-9：el 引擎同步渲染 —— onMounted + nextTick 后 tbody 已存在（数据异步
 * 填充不影响 sortablejs 挂载点），发 body-ready 让编排层挂载行拖拽
 * （与 VxeTableBody 同一事件契约，事件驱动替代 setTimeout 轮询）
 */
onMounted(() => nextTick(() => emit('body-ready')))
</script>

<template>
  <div class="pro-table-body-a11y">
    <!--
      v3.5 PR1-A：A11y 播报区 —— selection-change 时更新文本供屏幕阅读器朗读
      sr-only 工具类在 styles/_a11y.scss 定义（视觉隐藏 + aria-live）
    -->
    <span class="sr-only" aria-live="polite">{{ selectionAnnounce }}</span>
    <ElTable
      ref="elTableRef"
      v-loading="loading"
      :data="rows as Record<string, unknown>[]"
      v-bind="{
        ...(rowKey ? { rowKey } : {}),
        // v3.1 自动高度：非 null 时绑定 max-height（exactOptionalPropertyTypes 下条件展开，
        // 避免显式传 undefined 触发 TS2379）
        ...(maxHeight != null ? { maxHeight } : {}),
        ...(treeData
          ? {
              // v2.2 修复：树形行对象带 children 字段（useTreeData 懒加载赋值），el-table 默认
              // tree-props 会识别该字段把行递归渲染为树节点 —— flatData 平铺行 + 树形嵌套行
              // = 同一行渲染两次（Duplicate keys）。指向不存在的字段，el-table 即按纯平铺渲染
              treeProps: { children: '__pro_table_flat__', hasChildren: '__pro_table_flat__' },
            }
          : {}),
        ...(cellSpan
          ? { spanMethod: cellSpan.spanMethod, cellClassName: cellSpan.cellClassName }
          : {}),
        // v3.0 5a：汇总行（el-table 内置 show-summary + summary-method 机制）
        ...(showSummary && summaryMethod ? { showSummary: true, summaryMethod } : {}),
        // v3.0 5b：虚拟滚动（高度限制 + rowHeight）
        ...(virtualScrollProps ?? {}),
        // column-resize 前置 border：ep 列宽拖拽硬依赖表级 border（table-header/event-helper.mjs
        // handleMouseMove 首行守卫 if (!props.border) return）——边框线是 th 右缘拖拽手柄命中区
        ...(props.columnResize ? { border: true } : {}),
      }"
      @selection-change="onSelectionChange"
      @cell-dblclick="onCellDblclick"
      @expand-change="onExpandChange"
      @sort-change="onSortChange"
      @filter-change="onFilterChange"
    >
      <ElTableColumn
        v-for="col in columns"
        :key="col.prop"
        :column-key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :resizable="props.columnResize"
        v-bind="
          filterUndefined({
            // radio 非 el-table 内置列类型（el-table 仅识别 selection/index/expand）——
            // 透传未知 type 虽走默认列渲染容错，但会让 columnConfig.type 携带脏值，显式过滤
            type: col.type === 'radio' ? undefined : col.type,
            width: col.width,
            minWidth: col.minWidth,
            fixed: col.fixed,
            sortable: col.sortable,
            // v3.1：多选跨页保持一等字段（需 row-key；el-table-column reserve-selection）
            ...(col.reserveSelection ? { reserveSelection: true } : {}),
            ...(col.tableProps ?? {}),
          })
        "
      >
        <!-- 自定义表头渲染（col.headerRender，spec §一 ProColumn.headerRender 字段） -->
        <template v-if="col.headerRender" #header="scope">
          <component :is="col.headerRender({ column: col, $index: scope.$index })" />
        </template>

        <!-- 单元格默认插槽。
           ⚠️ selection 列必须排除：el-table 对 type=selection 的内置 checkbox 渲染（cellForced.renderCell）
           仅在列未提供 default slot 时生效；这里统一提供 slot 会覆盖掉 checkbox，导致行内勾选框不渲染
           （v2.2-M1 demo 验证发现的缺陷） -->
        <template v-if="col.type !== 'selection'" #default="scope">
          <slot :name="col.prop" :row="scope.row" :column="col" :index="scope.$index">
            <!-- v2.0 行拖拽手柄（sortablejs 通过此 handle 选择器绑定） -->
            <span
              v-if="col.draggable"
              class="pro-table-drag-handle"
              :data-col="col.prop"
              :class="bem.e('drag-handle')"
              style="cursor: grab; user-select: none"
            >
              ⋮⋮
            </span>
            <!-- v2.0 树形缩进 + 展开按钮（最高优先级） -->
            <template v-if="col.tree && treeData">
              <span
                :style="{
                  paddingLeft: (scope.row._level ?? 0) * (col.tree.indentSize ?? 24) + 'px',
                }"
              >
                <!-- v2.2 树形展开箭头：内联在树列内（随 _level 缩进体现层级），替代 v2.0 借用 el-table expand 列 icon 的方案 -->
                <button
                  v-if="scope.row._hasChildren"
                  type="button"
                  class="pro-table-tree-toggle"
                  :class="bem.e('tree-toggle')"
                  :aria-expanded="treeData.isExpanded(rowKeyOf(scope.row))"
                  aria-label="展开/折叠"
                  @click="treeData.toggle(rowKeyOf(scope.row))"
                >
                  {{ treeData.isExpanded(rowKeyOf(scope.row)) ? '▾' : '▸' }}
                </button>
                <CellContent :content="resolveCellContent(col, scope.row, scope.$index)" />
              </span>
            </template>
            <!--
            v3.1 radio 单选列 —— el-table 无内置 radio 类型，自绘单选控件。
            选中收敛在 update:modelValue 而非 change：el-radio 的 change 于 nextTick
            派发且携带 props.modelValue 当前值，纯受控（modelValue 单向注入、点击不本地
            更新）下首次点击 change 读到 undefined → 触发 element-plus radioEmits.change
            校验失败的 dev 警告；选中挪到 update:modelValue（setter 同步路径）后，同步
            更新 selectedRowKey → 重渲染 flush 先于 el nextTick，change 携带值已合法。
            modelValue 条件展开：exactOptionalPropertyTypes 下 undefined 显式传入报 TS2379
          -->
            <ElRadio
              v-else-if="col.type === 'radio'"
              v-bind="{
                ...(props.selectedRowKey !== undefined ? { modelValue: props.selectedRowKey } : {}),
                value: rowKeyOf(scope.row),
              }"
              @update:model-value="emit('radio-select', scope.row)"
            />
            <!-- v2.0 编辑控件（编辑态 + 含 edit 配置） -->
            <EditCell
              v-else-if="rowEdit?.isEditing(rowKeyOf(scope.row)) && col.edit"
              :row-key="rowKeyOf(scope.row)"
              :col="col as ProColumn"
              :value="rowEdit.getValue(rowKeyOf(scope.row), col.prop)"
              :density="density"
              @update="(prop, v) => rowEdit?.setValue(rowKeyOf(scope.row), prop, v)"
            />
            <!-- 默认渲染（v1 resolveCell，P1 起走共用 cell-render 适配层） -->
            <CellContent v-else :content="resolveCellContent(col, scope.row, scope.$index)" />
          </slot>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>
