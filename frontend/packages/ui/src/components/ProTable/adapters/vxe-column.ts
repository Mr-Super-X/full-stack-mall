/**
 * ProColumn → VxeColumn 列映射适配层（v2.1 P2）
 *
 * 角色：把 element-plus 心智的 ProColumn 翻译为 vxe-table v4 列 props。
 * 两引擎列 API 差异：prop→field / label→title / selection→checkbox / index→seq；
 * 服务端排序（sortable='custom'）映射为列 sortable + 表级 remote sort-config
 * （VxeTableBody 用 {@link hasCustomSort} 决定是否开启 remote）。
 *
 * @see [`../../ProTable.vue`](../../ProTable.vue) 编排层 —— VxeTableBody 的调用方
 * @group ProTable adapters
 */
import type { ProColumn } from '../types'

/**
 * enum 列（渲染 ElTag，white-space:nowrap 固有宽度内容）的兜底列宽。
 * 取值依据：3 字中文 tag 实测 ~55px（14px 字号 + el-tag 水平内边距）+
 * 单元格水平 padding 16px + 余量。vxe 自动列宽只按剩余空间分配、不测量内容宽度，
 * 窄容器下无宽度声明的 enum 列会被压到 tag 宽度以下，tag 溢出单元格被表格容器裁剪
 * （el-table 自动布局按内容撑开列，无此问题）——故映射时补 minWidth 兜底。
 */
const ENUM_TAG_MIN_WIDTH = 80

/**
 * 翻译 ProColumn 为 VxeColumn props
 *
 * 合并策略：vxeProps 为「补充」不覆盖派生值 —— ProColumn 显式声明的语义
 * （field/title/type/sortable/width/minWidth/fixed）优先，vxeProps 仅填充
 * 派生未覆盖的透传项（如 showOverflow/resizable 等 vxe 专有配置）。
 *
 * @param col ProTable 列定义（泛型 T 缺省 Record，与 ProColumn 默认一致）
 * @returns VxeColumn props 对象（Record 收口：vxe 类型链依赖未安装的 vxe-pc-ui，不做精确类型）
 */
export function toVxeColumnProps<T extends object = Record<string, unknown>>(
  col: ProColumn<T>
): Record<string, unknown> {
  const derived: Record<string, unknown> = {
    field: col.prop,
    title: col.label,
  }
  // 特殊列类型翻译（operation 是普通业务列，无 vxe 特殊类型对应）
  // v3.1：radio 单选列 vxe-table 有内置类型（type==='radio'，运行时代码 isRadioType 分支实证），直接映射
  if (col.type === 'selection') derived.type = 'checkbox'
  else if (col.type === 'radio') derived.type = 'radio'
  else if (col.type === 'index') derived.type = 'seq'
  else if (col.type === 'expand') derived.type = 'expand'
  // sortable：true（客户端）与 'custom'（服务端）在 vxe 列级同为 true，
  // 服务端语义由表级 sort-config.remote 表达（hasCustomSort 判定）
  if (col.sortable !== undefined) derived.sortable = true
  if (col.width !== undefined) derived.width = col.width
  if (col.minWidth !== undefined) derived.minWidth = col.minWidth
  // enum 列 ElTag 兜底列宽：用户显式 width/minWidth（含 vxeProps 里的声明）优先；
  // 自定义 render 列内容宽度不可知，不兜底
  const vxeProps = col.vxeProps ?? {}
  if (
    col.enum &&
    !col.render &&
    col.width === undefined &&
    col.minWidth === undefined &&
    vxeProps.minWidth === undefined
  ) {
    derived.minWidth = ENUM_TAG_MIN_WIDTH
  }
  if (col.fixed !== undefined) derived.fixed = col.fixed
  // v3.5 hotfix-4：treeNode 派生 —— 当 ProColumn.tree 声明时把该列标记为 vxe 树形节点列
  // （vxe-column tree-node 字段名是连字符格式，Vue 模板 v-bind 不接受连字符键
  //  → 由 toVxeColumnProps 集中翻译比在 VxeTableBody 模板里硬编码 'tree-node' 更稳健）
  if (col.tree !== undefined) derived.treeNode = true
  // 先铺 vxeProps 再覆盖派生值：实现「补充不覆盖」策略（undefined 派生键已被上面的守卫跳过）
  return { ...vxeProps, ...definedEntries(derived) }
}

/**
 * 是否存在服务端排序列 —— VxeTableBody 据此决定是否给 VxeTable 开 `sort-config.remote`
 *
 * @param columns 全部可见列
 * @returns 任一列 sortable === 'custom' 时 true
 */
export function hasCustomSort(columns: ProColumn[]): boolean {
  return columns.some((c) => c.sortable === 'custom')
}

/**
 * v3.1：是否存在跨页保持多选列 —— VxeTableBody 据此决定是否给 VxeTable 开
 * `checkbox-config.reserve`（vxe checkboxOpts.reserve 运行时代码实证）
 *
 * @param columns 全部可见列
 * @returns 任一 selection 列 reserveSelection 为 true 时 true
 */
export function hasReserveSelection(columns: ProColumn[]): boolean {
  return columns.some((c) => c.type === 'selection' && Boolean(c.reserveSelection))
}

/** 剔除 undefined 值后返回新对象（exactOptionalPropertyTypes 兼容，与 ProTable.vue filterUndefined 同语义） */
function definedEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
