/**
 * 行拖拽引擎适配层（v3.5 PR1-B Task 4）
 *
 * 背景：v2.0 行拖拽只对 element-plus 引擎生效（VxeTableBody 不接收 rowDrag prop，
 * ProTable.vue 显式排除 vxe-table 引擎）。v3.5 PR1-B 让 vxe 引擎也支持行拖拽。
 *
 * 两引擎的 DOM 结构差异：
 * - el-table 行 DOM：`.el-table__body-wrapper tbody tr`
 * - vxe-table 行 DOM：`.vxe-table--body-wrapper .vxe-body--row`
 *
 * 两引擎都使用 sortablejs（v3.5 PR1-B Task 5 在 vxe 行挂 sortablejs），
 * 共用 useRowDrag 核心逻辑（onMove / onEnd / restoreDomRow / 索引映射）。
 * RowDragAdapter 把「从引擎 DOM 拿到 tbody + 行 rowKey」这两件事封装到一处，
 * 让 useRowDrag 不必关心引擎差异。
 *
 * @see [`../../composables/useRowDrag`](../../composables/useRowDrag.ts) —— 引擎无关核心
 * @group ProTable adapters
 */

/**
 * 行拖拽引擎适配器接口 —— 封装「如何从引擎 DOM 拿到 tbody 与行 rowKey」
 *
 * @group ProTable adapters
 */
export interface RowDragAdapter {
  /**
   * 获取当前可拖拽 tbody DOM 元素（useRowDrag 自持挂载生命周期会按需调用）
   *
   * 引擎实现：
   * - el: querySelector('.el-table__body-wrapper tbody')
   * - vxe: querySelector('.vxe-table--body-wrapper .vxe-table--body tbody')
   *        或 .vxe-body--row 容器（vxe v4 不同版本 DOM 结构有差异，按需适配）
   */
  getTbody(): HTMLElement | null

  /**
   * 从行 DOM 元素提取 rowKey —— 视图行索引 → rowKey 的反向映射
   *
   * sortablejs 拖拽回调只给 DOM 元素与索引，业务 rowKey 必须从 DOM 取：
   * - el-table: row.dataset['rowKey'] 或 rowKeyOf(data-row-key)
   * - vxe-table: row.querySelector('.vxe-cell--key') 或自定义 data 属性
   *
   * 返回 null 时 useRowDrag 走 console.warn + 跳过本次排序（同 v2.0 树形映射失败语义）
   */
  extractRowKey(rowEl: HTMLElement): string | number | null

  /**
   * 可选：从行 DOM 元素提取层级（用于 crossLevelDrag 拦截检查）
   *
   * 仅在树形模式下 useRowDrag 需要；平铺模式可不实现（默认返回 null 不拦截）
   * - el-table: row.dataset['level']（ElementTableBody.vue 已埋点）
   * - vxe-table: row.dataset['level']（VxeTableBody 待 PR1-B 同步埋点）
   */
  getRowLevel?(rowEl: HTMLElement): string | number | null
}

/**
 * 元素 + 行 rowKey 字段元数据 —— ElementTableBody 行模板 `:data-row-key="${rowKeyOf(row)}"` 写入。
 *
 * @group ProTable adapters
 */
export const EL_TABLE_ROW_KEY_ATTR = 'data-row-key'

/**
 * el-table 行层级元数据 —— ElementTableBody 行模板 `:data-level="${row._level ?? ''}"` 写入。
 *
 * @group ProTable adapters
 */
export const EL_TABLE_ROW_LEVEL_ATTR = 'data-level'

/**
 * el-table tbody 选择器
 *
 * @group ProTable adapters
 */
export const EL_TABLE_TBODY_SELECTOR = '.el-table__body-wrapper tbody'

/**
 * vxe-table tbody 选择器（vxe-table v4 DOM 结构）
 *
 * vxe-table v4 行容器实际选择器：
 * - 表体行：`.vxe-table--body-wrapper .vxe-body--row`
 * - tbody 节点：`.vxe-table--body-wrapper tbody`
 *
 * sortablejs 拖拽的容器是 tbody（直接 appendChild/insertBefore 子节点是 <tr>）。
 *
 * @group ProTable adapters
 */
export const VXE_TABLE_TBODY_SELECTOR = '.vxe-table--body-wrapper tbody'

/**
 * element-plus 引擎行拖拽适配器工厂（v3.5 PR1-B Task 4）
 *
 * @param rowKey 业务行 key 字段名（默认 'id'）
 * @returns 满足 RowDragAdapter 接口的 el-table 适配器
 * @group ProTable adapters
 */
export function createElementPlusRowDragAdapter(rowKey = 'id'): RowDragAdapter {
  return {
    getTbody(): HTMLElement | null {
      // ElementTableBody 模板根 div 下挂 .el-table__body-wrapper tbody
      // useRowDrag 调用时已拿到 ElementTableBody ref，统一走 rootEl 搜索
      return document.querySelector(EL_TABLE_TBODY_SELECTOR) as HTMLElement | null
    },
    extractRowKey(rowEl): string | number | null {
      // ElementTableBody 已写入 :data-row-key="${rowKeyOf(row)}"；缺省退化为 row 索引
      const v = rowEl.getAttribute(EL_TABLE_ROW_KEY_ATTR)
      if (v === null || v === '') return null
      // rowKey 为数字字段时尝试还原（如 '1' → 1），保持与 useTable.data rowKey 类型一致
      if (rowKey === 'id' && /^\d+$/.test(v)) return Number(v)
      return v
    },
    getRowLevel(rowEl): string | number | null {
      const v = rowEl.getAttribute(EL_TABLE_ROW_LEVEL_ATTR)
      if (v === null || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : v
    },
  }
}

/**
 * vxe-table 引擎行拖拽适配器工厂（v3.5 PR1-B Task 5）
 *
 * vxe-table v4 行 DOM 结构与 el-table 差异：
 * - vxe 行 tr 不直接挂在 tbody 下，而是 .vxe-table--body-wrapper > .vxe-body--row 包裹
 * - 真实 tbody 仍存在（`.vxe-table--body-wrapper tbody`），sortablejs 挂 tbody 即可
 * - 行 rowKey 走 row-config.keyField 配置，业务侧 vxe-table 不渲染 data-row-key 属性
 *
 * 实现要点：
 * - getTbody 走 .vxe-table--body-wrapper tbody 选择器
 * - extractRowKey 必须从「行对应数据」反查：vxe-table DOM 行不带 rowKey 属性，
 *   通过 data-row-id / rowKey 数据回查；最简实现是「按视图索引 + props.rows 回查」，
 *   本工厂接收 getRowsByIndex 让调用方提供（避免 adapter 直接耦合 props.rows）
 * - getRowLevel 同理：tree 模式下需要行 _level 字段反查
 *
 * @param options getRowsByIndex: 视图行索引 → rows 顶层索引的解析器；
 *                getLevelByViewIndex: 视图行索引 → 行 _level（可选，tree 模式用）
 * @returns 满足 RowDragAdapter 接口的 vxe-table 适配器
 * @group ProTable adapters
 */
export function createVxeRowDragAdapter(options: {
  getRowsByIndex: () => Record<string, unknown>[]
  getLevelByViewIndex?: () => (string | number | null)[]
  rowKey?: string
}): RowDragAdapter {
  const rowKey = options.rowKey ?? 'id'
  return {
    getTbody(): HTMLElement | null {
      return document.querySelector(VXE_TABLE_TBODY_SELECTOR) as HTMLElement | null
    },
    /**
     * vxe-table 行 DOM 不携带 rowKey 属性，必须从 props.rows 索引回查。
     * sortablejs 的 onEnd 给视图行索引（oldIndex/newIndex），与 data 顶层索引可能不一致
     * （树形模式扁平后），由调用方 options.getRowsByIndex 提供映射。
     *
     * 实现策略：把 rowEl 视为「视图索引即 DOM 位置」—— sortablejs 在 viewRows 内排序，
     * 视图索引 = DOM 子元素位置 = data 数组索引（vxe 平铺模式无子树）。
     */
    extractRowKey(rowEl): string | number | null {
      const rows = options.getRowsByIndex()
      // 找 rowEl 在 tbody 中的位置索引（不依赖 dataset，回查 props.rows）
      const tbody = rowEl.parentElement
      if (!tbody) return null
      const children = Array.from(tbody.children)
      const viewIndex = children.indexOf(rowEl)
      if (viewIndex < 0 || viewIndex >= rows.length) return null
      const row = rows[viewIndex] as Record<string, unknown>
      const key = row[rowKey]
      return (key as string | number) ?? null
    },
    getRowLevel(rowEl): string | number | null {
      if (!options.getLevelByViewIndex) return null
      const tbody = rowEl.parentElement
      if (!tbody) return null
      const viewIndex = Array.from(tbody.children).indexOf(rowEl)
      if (viewIndex < 0) return null
      const levels = options.getLevelByViewIndex()
      return levels[viewIndex] ?? null
    },
  }
}
