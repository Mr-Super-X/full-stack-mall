/**
 * 搜索控件注册表（v3.1.4 review 新增）
 *
 * 项目角色：把 SearchForm.vue 中 6 段 v-if / v-else-if 控件分支抽成数据驱动的注册表，
 * 解决「下楼梯式 if-else 链 + 后期扩展每加一个控件要改 5 处」的问题。
 *
 * v3.1.4 review 触发：用户反馈 SearchForm 模板编排难扩展。每新增一个搜索控件类型需要：
 *   1) 模板加一段 v-else-if
 *   2) 模板加 `@clear="handleSearch"` 监听
 *   3) 模板加 `@update:model-value` 监听
 *   4) inputPlaceholder / selectPlaceholder 函数加分支
 *   5) 可能的 children 渲染分支（select 有 ElOption 子节点）
 * 重构后新增控件：仅在 SEARCH_CONTROL_MAP 加 1 条配置即可。
 *
 * 设计原则：
 * - 数据驱动：每个控件的配置是纯数据对象（component + 行为标记），不持有渲染逻辑
 * - 类型安全：用 `as const` + Record<SearchElType, ...> 让 TS 推断精确
 * - 行为可扩展：`placeholderPrefix` 替代 inputPlaceholder/selectPlaceholder 函数分支
 * - 单一真相源：清空行为 / 选项子节点等所有控件共性行为在此声明，模板不再 hardcode
 *
 * @see [`../../components/SearchForm.vue`](../../components/SearchForm.vue) 唯一消费方
 * @group ProTable 工具
 */
import {
  ElInput,
  ElSelect,
  ElDatePicker,
  ElTreeSelect,
  ElCascader,
  ElInputNumber,
} from 'element-plus' // element-plus 按需注入
import type { Component } from 'vue' // 类型导入
import type { SearchElType } from '../../types' // SearchElType = 'input' | 'select' | 'date-picker' | 'tree-select' | 'cascader' | 'input-number'

/**
 * 单个搜索控件的配置 —— 纯数据，不持有渲染逻辑。
 *
 * - component: 该控件的 Element Plus 组件
 * - clearable: 是否默认开启 clearable（X 图标）
 * - placeholderPrefix: placeholder 前缀（'请输入' / '请选择' / undefined 用 props 透传）
 * - hasOptions: 是否有 enum 选项子节点（ElSelect → ElOption 列表）
 */
export interface SearchControlConfig {
  /** Element Plus 控件组件 */
  component: Component
  /** 默认开启清空图标（X）；空则不渲染 clear 按钮 */
  clearable: boolean
  /**
   * placeholder 前缀：'请输入' + label / '请选择' + label / undefined（用 props 透传）
   * 替代原 inputPlaceholder / selectPlaceholder 两个分支函数
   */
  placeholderPrefix?: '请输入' | '请选择'
  /** 是否渲染 ElOption 列表子节点（仅 ElSelect 需要） */
  hasOptions?: boolean
}

/**
 * 控件注册表：SearchElType → SearchControlConfig
 *
 * 单一来源：新增控件只需在这里加 1 条。模板用 `<component :is="config.component" />` 渲染。
 */
export const SEARCH_CONTROL_MAP: Readonly<Record<SearchElType, SearchControlConfig>> = {
  input: {
    component: ElInput,
    clearable: true,
    placeholderPrefix: '请输入',
  },
  select: {
    component: ElSelect,
    clearable: true,
    placeholderPrefix: '请选择',
    hasOptions: true,
  },
  'date-picker': {
    component: ElDatePicker,
    clearable: true,
    // date-picker 默认 placeholder 走 EP 内部（中文），无 prefix
  },
  'tree-select': {
    component: ElTreeSelect,
    clearable: true,
  },
  cascader: {
    component: ElCascader,
    clearable: true,
  },
  'input-number': {
    component: ElInputNumber,
    // ElInputNumber 无 clearable prop，无 placeholder prefix
    clearable: false,
  },
} as const
