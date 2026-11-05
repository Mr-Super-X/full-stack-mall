/**
 * 单元格内容解析 —— element-plus / vxe-table 两引擎分支共用的渲染逻辑（v2.1 P1 自 ProTable.vue 抽取）
 *
 * 角色：渲染适配层。优先级：col.render（自定义 VNode）> col.formatter（函数或内置预设 key，
 * v3.1 接线补齐）> col.enum（ElTag 字典）> 原始字段值。
 * ElementTableBody / VxeTableBody 复用本函数，保证两引擎单元格渲染一致。
 *
 * @see [`../../ProTable.vue`](../../ProTable.vue) 编排层 —— 能力状态提供方
 * @group ProTable adapters
 */
import { h } from 'vue' // vue 底层 API（CLAUDE.md §1.6.1）
import { ElTag } from 'element-plus' // 第三方 UI 库组件（unplugin-vue-components 只管模板，TS 代码中需显式 import）

import type { ProColumn } from '../types'
import { resolveFormatter } from './cell-format'

/**
 * 解析单元格渲染内容
 *
 * 泛型 T 与 ProColumn<T> 对齐；行字段读取经 Record 局部转换（T extends object 无索引签名），
 * render 回调直接拿到 T（泛型化的核心收益，见 types/index.ts ProColumn 接口注释）。
 *
 * @param col 列定义（render / formatter / enum / prop 四个渲染来源）
 * @param row 行数据
 * @param index 行索引（透传 render 回调）
 * @returns VNode（render / formatter boolTag / enum 分支）或原始字段值（走文本插值分支）
 */
export function resolveCellContent<T extends object = Record<string, unknown>>(
  col: ProColumn<T>,
  row: T,
  index: number
): unknown {
  if (col.render) return col.render({ row, column: col, $index: index })
  const record = row as Record<string, unknown>
  const cellValue = record[col.prop]
  // v3.1：formatter 分支（函数或预设 key）—— 优先级 render > formatter > enum > raw，
  // 与 ElementTableV2Body 的虚拟滚动分支渲染链对齐
  const formatterFn = resolveFormatter(col.formatter)
  if (formatterFn) return formatterFn(record, col as ProColumn, cellValue, index)
  if (col.enum) {
    const entry = col.enum.find((e) => e.value === cellValue)
    if (entry) {
      return h(ElTag, { type: entry.tagType ?? 'info' }, () => entry.label)
    }
  }
  return cellValue
}
