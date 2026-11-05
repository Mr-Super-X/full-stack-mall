/**
 * useColumns —— 列解析 / 枚举 / 列设置持久化（spec §六数据流 / §九 #8 / 附录 A #5/#6）
 *
 * 职责：
 * - allColumns：原始列（含隐藏列，列设置抽屉渲染用）
 * - sortedColumns：按用户拖拽顺序 + 排除 hidden 的列（表格渲染用）
 * - searchColumns：带 search 配置的列（搜索区用）
 * - 列设置持久化（Local `${tableKey}:columns`，未传 tableKey 不持久化；附录 A #5）
 * - resetToDefault 恢复默认（附录 A #6 "恢复默认"按钮）
 *
 * @see [`@/utils/storage`](../../utils/storage.ts) Local 工具
 * @group ProTable composables
 */
import { ref, computed, type Ref } from 'vue'
import { Local } from '@vv/shared' // plan critical review #5：Local 不在 auto-import 列表
import { isValidPersistedSetting } from './_utils/validatePersisted' // v3.1.4 review：持久化形状 fail-safe 守卫
import type { ProColumn, ProTableProps } from '../types'

export interface UseColumnsOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
}

export interface UseColumnsReturn<T extends object = Record<string, unknown>> {
  allColumns: Ref<ProColumn<T>[]>
  sortedColumns: Ref<ProColumn<T>[]>
  searchColumns: ProColumn<T>[]
  visibleKeys: Ref<string[]>
  fixedKeys: Ref<string[]>
  colSettingVisible: Ref<boolean>
  toggleVisible: (prop: string) => void
  toggleFixed: (prop: string, fixed: 'left' | 'right' | undefined) => void
  setColumnOrder: (order: string[]) => void
  setVisibleKeys: (keys: string[]) => void
  setFixedKeys: (keys: string[]) => void
  resetToDefault: () => void
}

/**
 * 持久化结构 —— v3.1.4 review 抽为 export，被 _utils/validatePersisted 消费。
 * 字段全部 optional（向前兼容旧版本快照）。
 */
export interface PersistedSetting {
  order?: string[]
  visible?: Record<string, boolean>
  fixed?: Record<string, 'left' | 'right'>
}

/**
 * 克隆单个列的 hidden 字段，统一处理 boolean / Ref<boolean> / undefined 三态
 *
 * - 外部 boolean → `ref(初始值)`，toggle 读写副本字段，外部对象不受影响
 * - 外部 Ref<boolean> → computed 包装：get 在本地未写入时读外部（保持外部程序化联调），
 *   set 写本地副本 ref —— 用户经列设置面板的手动操作优先于外部值
 *
 * v3.0 M1 抽取：cloneColumns 内联 20 行 → 拆为子函数便于单测和复用
 *
 * @see cloneColumns 调用方
 */
function cloneColumnHidden<T extends object>(col: ProColumn<T>): ProColumn<T> {
  const copy: ProColumn<T> = { ...col }
  const h = col.hidden
  if (h === undefined) return copy
  if (typeof h === 'boolean') {
    copy.hidden = ref(h)
    return copy
  }
  const external = h as Ref<boolean>
  const local = ref<boolean | null>(null)
  copy.hidden = computed({
    get: () => local.value ?? Boolean(external.value),
    set: (v: boolean) => {
      local.value = v
    },
  })
  return copy
}

/**
 * 列对象白名单拷贝（M2：props 保护）—— 浅拷贝一层数据字段，杜绝 toggleVisible/toggleFixed
 * 原地改写调用方列对象；函数/数组引用（render/headerRender/enum/search/tableProps）保留共享，不 deep clone。
 *
 * v3.0 M1 抽取：hidden 处理逻辑下沉到 cloneColumnHidden 子函数
 * v3.0 5c：children 嵌套列递归 clone（独立处理每一层 hidden）
 */
function cloneColumns<T extends object>(cols: ProColumn<T>[]): ProColumn<T>[] {
  return cols.map((col) => {
    const copy = cloneColumnHidden(col)
    if (col.children?.length) {
      copy.children = cloneColumns(col.children)
    }
    return copy
  })
}

/**
 * v3.0 5c：扁平化嵌套列 —— 把 ProColumn<T>[].children 拍平为 ProColumn<T>[]，
 * 用于持久化（子列与父列共享同一 storage key；R1 决策）。
 */
function _flattenColumns<T extends object>(cols: ProColumn<T>[]): ProColumn<T>[] {
  const out: ProColumn<T>[] = []
  for (const col of cols) {
    if (col.children?.length) {
      out.push(..._flattenColumns(col.children))
    } else {
      out.push(col)
    }
  }
  return out
}

export function useColumns<T extends object = Record<string, unknown>>(
  options: UseColumnsOptions<T>
): UseColumnsReturn<T> {
  const { props } = options
  const tableKey = props.tableKey
  const storageKey = tableKey ? `${tableKey}:columns` : ''

  // 加载持久化（v3.1.4 review：fail-safe 形状校验，避免篡改 localStorage 注入
  // 非数组 order / 非 boolean visible 让下游 Object.fromEntries 抛错）
  // safeParse 由 Local 提供；spec §九 #8
  const raw: unknown = storageKey ? Local.get(storageKey) : null
  const persisted: PersistedSetting | null =
    raw && isValidPersistedSetting(raw) ? (raw as PersistedSetting) : null

  const allColumns = ref<ProColumn<T>[]>(cloneColumns(props.columns))
  // v3.0 C2 修复辅助：记录"静态 hidden 列 prop 集合"，用于 persist / 回填时识别
  // 动态 Ref<boolean> 列。Vue reactive 代理会自动解包 ref/computed 属性
  // （allColumns.value[i].hidden 访问时已是 boolean primitive，无法用 typeof 区分
  // 原始类型），故必须在 setup 时基于原始 props.columns 记录。
  const staticHiddenProps = new Set<string>(
    props.columns
      .filter((c) => c.hidden === undefined || typeof c.hidden === 'boolean')
      .map((c) => c.prop)
  )
  // v2.2-M1 回填：persisted.fixed 写入列副本（原实现只恢复 order，固定列刷新后丢失）。
  // 未收录的列必须显式取消固定：persisted.fixed 不含某列 = 用户曾取消固定，
  // 缺 else 分支会让 props 初始 fixed 在刷新后回移（审查发现 #2）
  if (persisted?.fixed) {
    for (const col of allColumns.value) {
      const f = persisted.fixed[col.prop]
      if (f) {
        col.fixed = f
      } else {
        delete (col as { fixed?: 'left' | 'right' }).fixed
      }
    }
  }
  // v2.2-M1 回填：persisted.visible 恢复抽屉勾选态（键缺失默认可见，兼容新增列）
  // v3.0 C2 修复：动态列（hidden 为 Ref<boolean>）始终包含在 visibleKeys，
  // 其可见性由外部 Ref/isHidden 决定；仅静态 boolean hidden 列按 persisted 过滤
  const visibleKeys = ref<string[]>(
    persisted?.visible
      ? props.columns
          .filter((c) => {
            // 动态列（hidden 为 Ref<boolean>）：始终包含，不受持久化影响
            if (!staticHiddenProps.has(c.prop)) return true
            // 静态列：按 persisted.visible 决定（键缺失或 true = 可见）
            return persisted.visible?.[c.prop] !== false
          })
          .map((c) => c.prop)
      : props.columns.map((c) => c.prop)
  )
  const fixedKeys = ref<string[]>(
    persisted?.fixed
      ? Object.keys(persisted.fixed)
      : props.columns.filter((c) => c.fixed).map((c) => c.prop)
  )
  const colSettingVisible = ref(false) // 附录 A #8：默认关闭

  /**
   * 列顺序（含隐藏列）—— 拖拽排序的响应式数据源。
   * 不能用 setup 时的一次性 persisted.order 快照：快照非响应式，
   * 拖拽更新 allColumns 后 sortedColumns 仍按旧快照排序，表格列序不更新（历史 bug）。
   */
  const columnOrder = ref<string[]>(persisted?.order ?? props.columns.map((c) => c.prop))

  /** 是否隐藏（支持 boolean 与 Ref<boolean>） */
  function isHidden(col: ProColumn<T>): boolean {
    if (typeof col.hidden === 'boolean') return col.hidden
    if (col.hidden && typeof col.hidden === 'object' && 'value' in col.hidden) {
      return Boolean((col.hidden as Ref<boolean>).value)
    }
    return false
  }

  const sortedColumns = computed(() => {
    const order = columnOrder.value
    const arr: ProColumn<T>[] = [...allColumns.value]
    arr.sort((a, b) => {
      const ia = order.indexOf(a.prop)
      const ib = order.indexOf(b.prop)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    // 过滤逻辑：col.hidden = true 隐藏 + 不在 visibleKeys 中也隐藏
    return arr.filter((c) => !isHidden(c) && visibleKeys.value.includes(c.prop))
  })

  /**
   * searchColumns —— 带 search 配置的列（搜索区用）。
   * 用 `let` + return 对象 getter 暴露（而非 const 快照）：
   * resetToDefault 会重建 allColumns（cloneColumns 新克隆），getter 保证消费方
   * 始终读到与 allColumns 同源的列对象，避免「同一数据两个真相」（review R11）。
   */
  let searchColumns: ProColumn<T>[] = allColumns.value.filter((c) => Boolean(c.search))

  /** 持久化当前列设置 */
  function persist(): void {
    if (!storageKey) return
    const setting: PersistedSetting = {
      // 保存完整列顺序（含隐藏列）：抽屉渲染 allColumns（含隐藏列），
      // 若只存可见列顺序，隐藏列重新显示后会漂移到最后
      order: columnOrder.value,
      // v3.0 C2 修复：仅静态 hidden 列（undefined/boolean）参与持久化，
      // 动态 Ref<boolean> 列不写 — 避免外部 Ref 动态隐藏后被写回 visible=true
      // 与 hidden=true 矛盾（回填循环）。过滤基于 staticHiddenProps（按 prop 查找），
      // 不依赖运行时 typeof 判断（reactive 已自动解包 ref/computed）
      visible: Object.fromEntries(
        allColumns.value
          .filter((c) => staticHiddenProps.has(c.prop))
          .map((c) => [c.prop, !isHidden(c) && visibleKeys.value.includes(c.prop)])
      ),
      fixed: Object.fromEntries(
        allColumns.value.filter((c) => c.fixed).map((c) => [c.prop, c.fixed ?? 'left'])
      ),
    }
    Local.set(storageKey, setting)
  }

  function toggleVisible(prop: string): void {
    const col = allColumns.value.find((c) => c.prop === prop)
    if (!col) return
    // allColumns 是 deep ref（元素经 reactive 代理）：读 col.hidden 时 ref 会被自动解包成
    // primitive，拿不到 Ref 本体；因此统一赋「新 ref 实例」走属性替换（reactive 对
    // 「旧值 ref + 新值 ref」走替换，不写真值），避免误写外部传入的 readonly computed 副本。
    // cast 原因：Ref<ProColumn[]> 的 .value 经 UnwrapRef 把 hidden 的 Ref<boolean> 解成 boolean
    // 且 exactOptionalPropertyTypes 排除 undefined，与运行时「reactive 存 ref 本体」不符；
    // 还原为 ProColumn 类型后按公开声明赋值
    ;(col as ProColumn<T>).hidden = ref(!isHidden(col))
    persist()
  }

  function toggleFixed(prop: string, fixed: 'left' | 'right' | undefined): void {
    const col = allColumns.value.find((c) => c.prop === prop)
    if (!col) return
    if (fixed) {
      col.fixed = fixed
    } else {
      delete (col as { fixed?: 'left' | 'right' }).fixed
    }
    persist()
  }

  /**
   * 应用列拖拽后的完整顺序（ColSetting sortablejs onEnd 产出，col.prop 数组）
   * - 同步 columnOrder（sortedColumns 的排序依据）与 allColumns（抽屉渲染依据）
   * - order 中未包含的列（如后追加的新列）按原相对顺序排到最后
   */
  function setColumnOrder(order: string[]): void {
    columnOrder.value = [...order]
    const rank = new Map(order.map((prop, index) => [prop, index]))
    allColumns.value = [...allColumns.value].sort((a, b) => {
      const ia = rank.get(a.prop) ?? Number.MAX_SAFE_INTEGER
      const ib = rank.get(b.prop) ?? Number.MAX_SAFE_INTEGER
      return ia - ib
    })
    persist()
  }

  function setVisibleKeys(keys: string[]): void {
    visibleKeys.value = keys
    persist()
  }

  function setFixedKeys(keys: string[]): void {
    fixedKeys.value = keys
    persist()
  }

  /**
   * 恢复默认：清 Local 存储 + 重置 allColumns + visibleKeys + 列顺序（附录 A #6）
   *
   * 存储清除与内存重置解耦：ColSetting 抽屉的「恢复默认」按钮无条件渲染（未传
   * tableKey 时 storageKey 为空串），早期实现整体 return 导致无持久化场景下
   * 按钮形同虚设 —— 内存状态重置与是否有存储 key 无关。
   */
  function resetToDefault(): void {
    if (storageKey) Local.remove(storageKey)
    // v3.0 C1 修复：cloneColumns 已正确处理 boolean / Ref<boolean> / undefined 三态，
    // 无需再 manual ref(false) 覆盖（后者会破坏外部 Ref 响应性）。
    // 直接调用 cloneColumns 重建 allColumns，让所有列重新走 computed 包装逻辑
    allColumns.value = cloneColumns(props.columns)
    searchColumns = allColumns.value.filter((c) => Boolean(c.search)) // 与 allColumns 同步重建（review R11）
    visibleKeys.value = props.columns.map((c) => c.prop) // 重置可见列（含 hidden=false + Ref<boolean>）
    columnOrder.value = props.columns.map((c) => c.prop) // 同步重置列顺序，否则恢复默认后顺序仍是拖拽后的
    fixedKeys.value = props.columns.filter((c) => c.fixed).map((c) => c.prop) // 同步重置固定列（v2.2-M1 审查发现 #3）
  }

  return {
    allColumns,
    sortedColumns,
    get searchColumns(): ProColumn<T>[] {
      return searchColumns
    },
    visibleKeys,
    fixedKeys,
    colSettingVisible,
    toggleVisible,
    toggleFixed,
    setColumnOrder,
    setVisibleKeys,
    setFixedKeys,
    resetToDefault,
  }
}
