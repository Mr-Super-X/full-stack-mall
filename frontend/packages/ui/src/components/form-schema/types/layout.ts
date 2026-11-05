/**
 * 栅格布局类型 —— element-plus el-row / el-col 配置
 *
 * 设计职责：把"24 栅格响应式布局"抽象为可声明的 schema 片段，避免业务写 <el-row>/<el-col> 嵌套。
 *
 * 字段族：
 * - RowConfig / ColConfig：栅格行 / 列配置（含 5 档响应式断点）
 * - ResponsiveColConfig：单断点 Col 配置
 * - SchemaNodeLayout：4 字段布局命名空间，被 SchemaNode extends 组合
 *
 * 响应式机制：element-plus el-col 内部支持传 responsive 对象自动按 viewport 选，
 * el-row 则需业务触发重渲染（el-row 不监听 resize）——XForm 通过 use-current-breakpoint
 * 桥接此能力。
 *
 * 命名空间索引：完整 9 命名空间字段对照表见 ../types.ts
 * @see ../composables/wrap-with-elcol.ts 栅格包装实现
 * @see ../composables/use-current-breakpoint.ts 响应式断点检测
 * @see ./directive.ts FormItemConfig formItem 字段配套
 */

/** Col 响应式断点(同 ColConfig 子字段) —— 单档配置（xs/sm/md/lg/xl 任一档） */
export interface ResponsiveColConfig {
  span?: number
  offset?: number
  push?: number
  pull?: number
}

/** 栅格行（el-row） —— 透传给 element-plus ElRow 组件 */
export interface RowConfig {
  gutter?: number
  type?: 'flex'
  align?: string
  justify?: string
  /**
   * Row 响应式 —— element-plus 标准 5 档
   * - xs: < 768px(手机)
   * - sm: ≥ 768px(平板)
   * - md: ≥ 992px(小屏)
   * - lg: ≥ 1200px(桌面)
   * - xl: ≥ 1920px(大屏)
   * 每个断点可独立设置 gutter / type / align / justify
   * 注:element-plus el-row 不自动监听 viewport resize —— 运行时响应式联动
   * 需 XForm 内部 useResizeObserver 触发 schema 重渲染(留 P2 阶段)
   */
  responsive?: {
    xs?: Pick<RowConfig, 'gutter' | 'type' | 'align' | 'justify'>
    sm?: Pick<RowConfig, 'gutter' | 'type' | 'align' | 'justify'>
    md?: Pick<RowConfig, 'gutter' | 'type' | 'align' | 'justify'>
    lg?: Pick<RowConfig, 'gutter' | 'type' | 'align' | 'justify'>
    xl?: Pick<RowConfig, 'gutter' | 'type' | 'align' | 'justify'>
  }
}
/** 栅格列（el-col） —— 透传给 element-plus ElCol 组件 */
export interface ColConfig {
  span?: number
  offset?: number
  push?: number
  pull?: number
  /**
   * Col 响应式 —— element-plus 标准 5 档
   * 每个断点可独立设置 span / offset / push / pull
   * 渲染时透传给 el-col(传对象时 el-col 自动按 viewport 选)
   */
  responsive?: {
    xs?: ResponsiveColConfig
    sm?: ResponsiveColConfig
    md?: ResponsiveColConfig
    lg?: ResponsiveColConfig
    xl?: ResponsiveColConfig
  }
}

/**
 * SchemaNode 命名空间 —— 布局（4 字段）
 *
 * 字段：row / column / col / formItem —— el-row/el-col 栅格配置 + 是否包 el-form-item。
 * 职责：把响应式栅格布局从模板层（业务手写 <el-row>）下沉到 schema 层（声明式）。
 *
 * 不变量：SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价。
 */
import type { FormItemConfig } from './directive'

/**
 * SchemaNodeLayout —— 布局（row / column / col / formItem）
 *
 * @group 布局
 */
export interface SchemaNodeLayout {
  /**
   * el-row 栅格行配置（gutter / type / align / justify / responsive）
   * 透传 element-plus ElRow；responsive 按当前 viewport 自动拍平（mobile-first）
   * @group 布局
   */
  row?: RowConfig
  /**
   * 每行栅格数（auto-spans: 24/column 计算各列 span）
   * 数组节点不生效；与 col.span 二选一
   * @group 布局
   */
  column?: number
  /**
   * el-col 栅格列配置（span / offset / push / pull / responsive）
   * - true：自动用 24/column 计算 span
   * - false / undefined：不包 el-col（节点直出）
   * - ColConfig：详细配置（span + offset + responsive）
   * @group 布局
   */
  col?: boolean | ColConfig
  /**
   * 是否包 el-form-item（label + prop + rules 注册到 el-form）
   * - true：自动包（默认 name 字段自动包）
   * - false：明确不包（如 Card 视觉容器、纯展示节点）
   * - FormItemConfig：详细配置（指定 component / props / slots / rules 等覆盖默认值）
   * @group 渲染属性
   */
  formItem?: boolean | FormItemConfig
}
