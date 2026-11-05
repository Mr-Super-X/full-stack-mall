/**
 * 树形数据引擎适配层（v3.5 PR1-B）
 *
 * 背景：v2.0 树形能力只对 element-plus 引擎生效（ProTable.vue 显式排除 vxe-table 引擎，
 * VxeTableBody 不接收 treeData prop）。v3.5 PR1-B 让 vxe 引擎也支持树形 + 行拖拽，
 * 两条引擎管线要在「同一个 useTreeData 状态」上呈现差异化的树行为（el-table 用
 * treeProps + 自定义 toggle 按钮，vxe-table 用 tree-config + 内置 setTreeExpand API）。
 *
 * 抽 TreeAdapter 接口把引擎差异收敛到一处：
 * - getTreeConfig：返回该引擎需要的表级配置（el: treeProps；vxe: treeConfig）
 * - onExpand / onCollapse：通知引擎把指定行标记为展开/收起（vxe 调 setTreeExpand；el noop）
 * - hasChildren：行是否含子节点（vxe tree-config.hasChildren 字段需要按原始行判定）
 * - getExpandedKeys / syncExpanded：增量 / 全量同步展开状态到引擎
 *
 * 约束：
 * - 适配器不持有 normalize/flatData 等核心状态——那是 useTreeData 的职责
 * - 适配器只描述「引擎如何在自身 UI 上反映树的展开/折叠」——纯引擎胶水
 *
 * @see [`../../composables/useTreeData`](../../composables/useTreeData.ts) —— 状态核心
 * @group ProTable adapters
 */

/**
 * 树形数据引擎适配器接口 —— 把「展开/收起」映射到引擎原生 API
 * @group ProTable adapters
 */
export interface TreeAdapter {
  /** 引擎表级配置（el: { treeProps }；vxe: { treeConfig }） */
  getTreeConfig(): Record<string, unknown>
  /** 通知引擎展开指定行（vxe 调 setTreeExpand；el noop） */
  onExpand(rowKey: string | number, row?: Record<string, unknown>): void
  /** 通知引擎收起指定行（vxe 调 setTreeExpand；el noop） */
  onCollapse(rowKey: string | number, row?: Record<string, unknown>): void
  /** 当前引擎侧已展开 keys（vxe 通过内部 Map 跟踪；el 返回空数组由 useTreeData 自身 Set 主导） */
  getExpandedKeys(): Array<string | number>
  /** 全量同步展开状态到引擎（vxe reset / 初次挂载时调用，el noop） */
  syncExpanded(
    keys: Array<string | number>,
    rowsByKey: Map<string | number, Record<string, unknown>>
  ): void
  /** 检测行是否含子节点（vxe tree-config.hasChildren 字段约定） */
  hasChildren(row: Record<string, unknown>): boolean
  /** 检测行是否处于加载中（vxe 行 + loading 图标联动；el noop） */
  isLoading?(rowKey: string | number): boolean
}

/**
 * 树字段占位常量 —— 指向不存在的字段避免 el-table 默认 tree-props 重复渲染（v2.2 修复）。
 * el-table 与 vxe-table 共用同一占位符：业务 rows 是「平铺 data + children 字段」，
 * 我们用 flatData 平铺 + 占位符让两引擎都按纯平铺渲染。
 */
const TREE_PLACEHOLDER = '__pro_table_flat__'

/**
 * element-plus 引擎树适配器 —— el-table 用 treeProps + flatData 重算驱动视图，
 * 引擎侧无独立展开状态，onExpand/onCollapse/syncExpanded 全部 noop。
 *
 * @group ProTable adapters
 */
export function createElementPlusTreeAdapter(): TreeAdapter {
  return {
    getTreeConfig(): Record<string, unknown> {
      // el-table 接收 treeProps 字段；指向不存在的 __pro_table_flat__ 防止
      // el-table 识别真实 children 字段把平铺行重复渲染成嵌套（v2.2 fix）
      return { treeProps: { children: TREE_PLACEHOLDER, hasChildren: TREE_PLACEHOLDER } }
    },
    onExpand(): void {
      /* el-table 不需要主动通知：flatData 重算 + :data 引用变化自动重渲染 */
    },
    onCollapse(): void {
      /* 同上：el-table 跟着 flatData 重算 */
    },
    getExpandedKeys(): Array<string | number> {
      // el-table 不维护引擎侧展开状态：返回空数组由 useTreeData 内部 Set 主导
      return []
    },
    syncExpanded(): void {
      /* el-table 无引擎侧状态需要同步 */
    },
    hasChildren(row: Record<string, unknown>): boolean {
      // el-table 平铺渲染：有 _hasChildren 标记即为有子节点（_hasChildren 由 useTreeData.normalize 注入）
      return Boolean(row['_hasChildren'])
    },
  }
}

/**
 * vxe-table 引擎树适配器工厂（v3.5 PR1-B Task 2）—— 接收 vxe-table 实例 ref，
 * 通过 vxe-table 的 setTreeExpand API 同步展开状态。
 *
 * 设计要点：
 * - vxe-table 在 :tree-config 启用后会维护自身展开 Map；必须在 useTreeData 状态变化时
 *   调用 setTreeExpand(row, expanded) 否则 UI 与 useTreeData 状态不一致
 * - getTreeConfig 返回 vxe-table v4 的 tree-config 协议（children/hasChildren 字段约定
 *   同 el 占位符，避免双引擎渲染数据不同形）
 * - 适配器只关心引擎胶水：normalize/flatData/expanded Set 仍归 useTreeData
 *
 * @param getVxeTable 获取当前 vxe-table 实例的访问器（动态组件实例在 onMounted 后才有值）
 * @group ProTable adapters
 */
export function createVxeTreeAdapter(
  getVxeTable: () => {
    setTreeExpand?: (row: Record<string, unknown>, expanded: boolean) => void
    /**
     * v3.5 hotfix-6：按 :data 树重新索引 fullAllDataRowIdData（清空后重建）。
     * 仅 vxe-table lazy=true 走 loadTreeChildren 会触发该重建；我们用 useTreeData
     * 自管懒加载时需手动调一次，否则子节点 rowRest.level=undefined → body.ts:527
     * 退化为 {} → className 'row--level-undefined' + treeNodeStyle:none
     */
    cacheRowMap?: (isReset: boolean) => void
  } | null
): TreeAdapter {
  return {
    getTreeConfig(): Record<string, unknown> {
      // vxe-table v4.21.7 tree-config 协议：children 字段已废弃，统一改用 childrenField
      // （vxe-table 4.21.7 文档：https://vxetable.cn/v4/#/table/api ；旧 children 仍兼容但控制台告警）
      // 与 el-table 的 treeProps.children 字段名不同——el-table 不动，只改 vxe 分支
      // （useTreeData 已经把 children 字段重定向到 __pro_table_flat__ 让两引擎都不重复渲染）
      return {
        treeConfig: {
          // v3.5 hotfix-5：childrenField 从 TREE_PLACEHOLDER 改为真实字段名 'children'
          // 因为 ProTable.vue:685 vxe 引擎 :rows 改回 tableRows（原始嵌套数据），
          // vxe-table 需要 childrenField 指向真实 children 字段递归渲染子节点
          // （原占位符让 vxe-table 找不到 children 字段 → 树形不渲染）
          childrenField: 'children',
          // hasChildren 指向 useTreeData.normalize 注入的 _hasChildren 字段（业务数据自带）；
          // v3.5 hotfix-4 修复：原值 TREE_PLACEHOLDER 让 vxe-table 找不到行内 _hasChildren 标记，
          // 判定全部为叶子节点 → 不渲染箭头图标，无法展开
          hasChildren: '_hasChildren',
          expandAll: false,
          accordion: false,
          // trigger 改回 'default'（箭头点击），与 vxe-table v4 默认一致；
          // 原 'cell' 让 vxe 不渲染展开箭头（v3.5 hotfix-4 修复）
          trigger: 'default',
          // v3.5 hotfix-9：indent 置 0 —— 双引擎树列 UI 统一由 slot 内联缩进呈现
          // （_level * col.tree.indentSize，见 ElementTableBody/VxeTableBody 树形分支），
          // vxe 内置 padding-left 不叠加；同时隐藏内置 .vxe-cell--tree-btn（其在 slot
          // 内容之前渲染、顺序不可控），展开钮统一走 .pro-table-tree-toggle（与 el 同标记）
          indent: 0,
        },
      }
    },
    onExpand(rowKey, row): void {
      const vxe = getVxeTable()
      // vxe-table 的 setTreeExpand 接收行对象而非 key；row 可能为 undefined（useTreeData
      // 触发 onExpand 时未传 row 上下文），此时按 rowKey 退化 noop——下一次 normalize 会全量回灌
      if (vxe?.setTreeExpand && row) vxe.setTreeExpand(row, true)
    },
    onCollapse(rowKey, row): void {
      const vxe = getVxeTable()
      if (vxe?.setTreeExpand && row) vxe.setTreeExpand(row, false)
    },
    getExpandedKeys(): Array<string | number> {
      // vxe-table 内部维护展开 Map；外部调用方在 vxe 引擎下应读 useTreeData.expandedKeys
      // 本适配器不重复维护，避免双源真相——返回空数组即告知「去 useTreeData 拿」
      return []
    },
    syncExpanded(keys, rowsByKey): void {
      const vxe = getVxeTable()
      if (!vxe?.setTreeExpand) return
      // v3.5 hotfix-10：双边同步 —— 遍历 rowsByKey 全量行（而非仅 keys），
      // 不在 keys 里的行显式 setTreeExpand(row, false)。
      // 原实现只遍历 keys 发 true（单边同步）：用户收起时 useTreeData 已从 expandedKeys
      // 删除该 key，vxe-table 内部展开 Map 收不到 false 指令 → 视图保持展开（收起无效）。
      // el 引擎无此缺陷（flatData 重算后子行直接从数据消失），故仅 vxe 适配器需要 false 路径。
      // vxe 侧若因程序化 setTreeExpand 回吐 toggle-tree-expand 事件，
      // VxeTableBody.handleToggleTreeExpand 的「状态一致则 noop」守卫阻断循环。
      const expandedSet = new Set(keys)
      for (const [key, row] of rowsByKey) {
        vxe.setTreeExpand(row, expandedSet.has(key))
      }
      // v3.5 hotfix-6：setTreeExpand 不会自动重建 vxe-table 内部 fullAllDataRowIdData——
      // vxe lazy=true 才走 loadTreeChildren（重建索引），我们用 useTreeData 自管懒加载
      // 时子节点 row.children 已就位但 vxe 索引里没它们 → body.ts:527 rowRest.level=undefined
      // → className 'row--level-undefined' + cellStyle.paddingLeft 无缩进。
      // 手动 cacheRowMap(true) 按当前 :data 树（含嵌套 children）重跑 XEUtils.eachTree
      // 重建 fullAllDataRowIdData，子节点拿到正确 level → 渲染 row--level-N + 缩进 paddingLeft。
      // 复杂度 O(n) 树全扫，可接受；watch expandedKeys 触发频次仅展开/折叠/搜索/初始化
      vxe.cacheRowMap?.(true)
    },
    hasChildren(row: Record<string, unknown>): boolean {
      // vxe-table 平铺渲染（与 el 同源 useTreeData.normalize 输出）：有 _hasChildren 即为有子节点
      return Boolean(row['_hasChildren'])
    },
  }
}
