/**
 * 异步选项类型 —— Select/Cascader/TreeSelect/Autocomplete 内置远程数据能力
 *
 * 设计职责：把"远程数据源 + 依赖触发 + 数据变换"三件套抽象为声明式配置，
 * 业务无需手写 watch deps → fetch → transform → 写入 options 的副作用链。
 *
 * 字段族：
 * - AsyncOptionsConfig：远程数据源配置（source / immediate / deps / transform / onError）
 * - SchemaNodeData：1 字段数据加载命名空间，被 SchemaNode extends 组合
 *
 * 执行链路：节点 mount → useAsyncOptions 调用 source → transform 标准化 →
 * 写入内部 options ref + watch deps → 依赖变化时重新调用。
 *
 * 命名空间索引：完整 9 命名空间字段对照表见 ../types.ts
 * @see ../composables/use-async-options.ts 异步选项 composable 实现
 */

/** 异步选项配置：为 Select/Cascader/TreeSelect/Autocomplete 等提供内置远程数据能力 */
export interface AsyncOptionsConfig<T = unknown> {
  /** 数据源函数，返回原始数据数组（支持 Promise）；Autocomplete 场景可接收可选 query 参数 */
  source: (query?: string) => Promise<T[]> | T[]
  /** 是否在节点创建时立即请求（默认 true） */
  immediate?: boolean
  /** 依赖字段路径（lodash 路径），任一依赖变化时重新请求 */
  deps?: string | string[]
  /** 数据转换：把 source 返回的原始数组转为组件需要的 { label, value } 数组 */
  transform?: (raw: T[]) => Array<{ label: string; value: unknown }>
  /** 请求出错时回调（默认仅写入内部 error 状态） */
  onError?: (err: unknown) => void
}

/**
 * SchemaNode 命名空间 —— 数据加载（1 字段）
 *
 * 字段：asyncOptions —— Select/Cascader/TreeSelect/Autocomplete 等的远程数据源。
 * 职责：把"远程数据 + 依赖触发"从命令式副作用（onMounted + watch）提升为声明式配置。
 *
 * 不变量：SchemaNode extends 全部 9 个命名空间，TS 接口展平后类型形状与 P2-1 重构前完全等价。
 */
export interface SchemaNodeData {
  /**
   * 异步选项数据源（Select/Cascader/TreeSelect/Autocomplete）
   * @group 数据加载
   */
  asyncOptions?: AsyncOptionsConfig
}
