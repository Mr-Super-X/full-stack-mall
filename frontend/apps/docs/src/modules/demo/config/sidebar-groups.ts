/**
 * demo 页左侧 sidebar 的分组与中文名映射
 *
 * 新增 demo 组件（examples/ 下）时：只需在 CN_NAMES 补一条中文名，
 * 分组按 getSidebarGroup 的前缀规则自动归类，无需改 DocLayout。
 */

/** 分组定义：按顺序匹配，第一个命中的生效；最后一组（空前缀）为兜底组 */
export interface SidebarGroupConfig {
  /** 组标题 */
  title: string
  /** 组件名前缀（空字符串 = 匹配所有） */
  prefix: string
}

export const SIDEBAR_GROUPS: readonly SidebarGroupConfig[] = [
  { title: 'ProTable 表格组件', prefix: 'ProTable' },
  { title: 'XForm 表单引擎', prefix: 'XForm' },
  { title: 'ProDialog 弹窗组件', prefix: 'ProDialog' },
  { title: 'BaseChart 图表组件', prefix: 'BaseChart' },
  { title: '自定义指令', prefix: 'Directive' },
  { title: '网络基建 API', prefix: 'Api' },
  { title: '通用组件', prefix: '' },
]

/** 组件名 → 简短中文名（sidebar 显示为「组件名 中文名」） */
export const CN_NAMES: Record<string, string> = {
  // ProTable 表格组件（v2.0）
  ProTableOverview: '用法总览',
  ProTableRowEdit: '行内编辑',
  ProTableSummary: '客户端汇总行',
  ProTableVirtualScroll: '虚拟滚动',
  ProTableGroupedHeader: '列分组',
  ProTableTree: '树形数据',
  ProTableCellSpan: '单元格合并',
  ProTableRowDrag: '行拖拽排序',
  ProTableServerSort: '服务端排序',
  ProTableServerFilter: '服务端筛选',
  ProTableEngineCompare: 'vxe-table引擎对比',
  ProTableStyleOverride: '样式定制',
  ProTableExpand: '表格内嵌',
  // ProTable v3.1 能力验证（拆分为聚焦 demo，原复合页 ProTableV31Features 已移除）
  ProTableFormatter: '内置格式化器',
  ProTableRowSelect: '单选/跨页多选',
  ProTableAutoHeight: '自动高度/全屏',
  ProTableStatePersist: '状态保持恢复',
  ProTableOperation: '操作收纳/表头 Tooltip',
  ProTableColumnResize: '列宽拖拽',
  ProTableAsyncState: '三态实战（loading/empty/error）',
  // ProTable SearchForm 架构升级（默认折叠 / 高级弹窗 / 联动 / 防抖 / 响应式）
  ProTableSearchAdvanced: '表单高级筛选',
  // ProTable 工具栏 / 批量操作条 / CSV 导入导出（2026-09-18）
  ProTableHeaderActions: '工具栏与批量操作',
  ProTableImportExport: 'CSV 导入导出',
  // ProTable 审计缺口补齐（2026-10-19，audit 批 B1/B2/D 修复场景验证入口）
  ProTableVxeRowSelect: 'vxe 引擎行选择',
  ProTableSearchFilter: '搜索+列头筛选组合',
  // XForm 表单引擎
  XFormOverview: '用法总览',
  XFormArray: '数组节点',
  XFormArrayApi: '数组节点 API',
  XFormArrayCrossField: '数组行内跨字段校验',
  XFormAsyncAutocomplete: 'Autocomplete 异步搜索',
  XFormArrayDraggable: '数组行拖拽排序',
  XFormAsyncOptions: '异步选项',
  XFormAsyncOptionsError: '异步选项·错误处理',
  XFormAsyncValidator: '异步校验',
  XFormBase: '基础用法',
  XFormBeforeChange: '字段值拦截·3 层',
  XFormBuilder: '链式构建器',
  XFormCrossField: '跨字段校验',
  XFormCrossFieldReverse: '反向跨字段',
  XFormCustomComponent: '自定义组件注册',
  XFormCustomFormItem: '自定义 form-item',
  XFormDetailFill: '详情数据回填',
  XFormDirty: '脏状态追踪',
  XFormDirectives: '节点指令与全局配置',
  XFormDisabled: '禁用状态',
  XFormErrorToastSlot: 'toast 容器 slot',
  XFormEvents: '字段事件与值拦截',
  XFormExpression: '动态脚本表达式',
  XFormExpressionSandbox: '表达式沙箱与白名单',
  XFormFieldPermission: '字段权限',
  XFormFieldPermissionResolver: '字段权限解析器',
  XFormGrid: '栅格布局',
  XFormInvalidComponent: '无效组件校验',
  XFormLargeSchema: '大 schema 性能',
  XFormLabelLayout: 'label 布局',
  XFormMinimumDemo: '最小示例',
  XFormModelWarn: 'model 缺失警告',
  XFormNested: '复杂布局',
  XFormNestedArray: '嵌套数组节点',
  XFormOrderCreate: '订单创建业务示例',
  XFormPersist: '草稿持久化',
  XFormPersistSchemaVersion: '草稿持久化',
  XFormPropsAdvanced: 'XFormProps 高级配置',
  XFormReaction: '反应式联动',
  XFormReactionAdvanced: '反应式联动·进阶总览',
  XFormReactionCalcField: '反应式联动·计算字段',
  XFormReactionCascadeClear: '反应式联动·级联清空',
  XFormReactionReactiveProps: '反应式联动·反应式 props',
  XFormReactionArrayRow: '反应式联动·数组行内嵌',
  XFormReactionDeps: '反应式联动·deps 动机',
  XFormReactionStrategy: '反应式联动·调度策略',
  XFormRenderRecovery: '字段渲染失败降级',
  XFormGlobalDisabled: '全局禁用',
  XFormGlobalReadonly: '全局只读',
  XFormI18n: 'label 函数式 i18n',
  XFormIgnore: '节点忽略',
  XFormValidationDebounce: '跨字段校验防抖',
  XFormResponsive: '响应式布局',
  XFormSchemaIndex: '索引快照',
  XFormScrollToError: '错误自动滚动',
  XFormServerError: '服务端错误',
  XFormSlots: '插槽系统',
  XFormStyleOverride: '样式覆盖',
  XFormTabsSteps: 'Tabs/Steps 容器',
  XFormUpload: '文件上传',
  XFormValidateDetail: 'validateDetail 详细返回',
  XFormValidateField: '逐字段校验',
  XFormZod: 'zod 校验',
  // ProDialog 弹窗组件
  ProDialogOverview: '声明式弹窗',
  ProDialogResizable: '可拖拉调整宽高',
  ProDialogUseDialog: '命令式弹窗',
  ProDialogFormOverview: '弹窗表单用法',
  // BaseChart 图表组件
  BaseChartOverview: '用法总览',
  BaseChartSaleFunnel: '销售转化漏斗',
  BaseChartRealTime: '实时监控',
  BaseChartInDialog: '嵌入 ProDialog',
  BaseChartDashboard: '多图表仪表盘',
  // 自定义指令
  DirectiveOverview: '指令总览',
  DirectiveCopy: '文本复制',
  DirectiveDraggable: '弹窗拖拽',
  DirectiveAuth: '权限（推荐）',
  DirectivePermission: '权限（兼容）',
  DirectiveInputDebounce: '输入防抖',
  DirectiveButtonDebounce: '按钮防抖',
  // 网络基建 API
  ApiConcurrent: '并发请求调度（分片上传）',
  ApiRetry: '请求重试（指数退避）',
  ApiMerge: '请求合并（时间窗去重）',
  ApiUpload: '分片上传（大文件全流程）',
  // 通用组件
  AsyncState: '异步状态容器',
  ErrorBoundary: '错误边界',
  Dict: '字典组件（DictSelect / DictTag）',
  RichTextEditor: '富文本编辑器',
  IconUsage: '图标体系（静态/动态/本地集合）',
}

/** 返回组件名所属分组标题（未命中任何前缀时归入兜底组） */
export function getSidebarGroup(componentName: string): string {
  for (const group of SIDEBAR_GROUPS) {
    if (group.prefix === '' || componentName.startsWith(group.prefix)) return group.title
  }
  return SIDEBAR_GROUPS[SIDEBAR_GROUPS.length - 1]!.title
}

/** 组装 sidebar 显示名：组件名 + 空格 + 中文名（无映射时仅组件名） */
export function getSidebarLabel(componentName: string): string {
  const cn = CN_NAMES[componentName]
  return cn ? `${componentName} ${cn}` : componentName
}
