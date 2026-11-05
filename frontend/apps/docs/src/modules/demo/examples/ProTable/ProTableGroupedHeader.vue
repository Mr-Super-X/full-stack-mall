<script setup lang="ts">
/**
 * ProTable v3.0 列分组 demo（5c）
 *
 * 演示能力：
 * - 父列 + 子列 视觉分组（cellClassName 区分基础信息/业务信息）
 * - R1 决策：父子扁平化持久化（按 prop 维度统一 storage key）
 * - v3.0 已知限制：完整多级表头（el-table-column 嵌套）待 v3.0.1 修复
 *
 * 验证步骤：
 * 1. 表格显示 9 列：【基础信息】组（父标题列+姓名/邮箱/电话）蓝色左边框，
 *    【业务信息】组（父标题列+部门/入职日期/薪资）绿色左边框，ID 列无边框
 * 2. 列设置抽屉可拖拽、隐藏、刷新持久化（tableKey="demo-pro-table-grouped-header"）
 * 3. 父子列共享 storage key 维度（隐藏父列不影响子列隐藏状态）
 *
 * 样式注意：本文件 <style> 非 scoped（项目 BEM 规范），:deep() 会被浏览器整条
 * 丢弃，分组样式必须直接写后代选择器（修复记录：v3.0.1 验证不通过根因）
 */
import { type ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { groupedEmployeesRequestApi } from '@mock/pro-table/grouped-employees'
import {
  groupedHeaderColumnItems,
  groupedHeaderKnownLimitsItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-grouped-header')

interface Employee {
  id: number
  name: string
  email: string
  phone: string
  department: string
  joinDate: string
  salary: number
}

/**
 * v3.0 列分组务实方案：
 * - 含 children 的父列作"分组标题"列（label 加【】前缀区分）
 * - 子列做 cellClassName 视觉分组（CSS 左侧 border 区分）
 * - 完整 el-table-column 嵌套多级表头留待 v3.0.1
 */
const columns: ProColumn<Employee>[] = [
  { prop: 'id', label: 'ID', width: 80 },
  // 父列 1：基础信息
  {
    prop: 'basic',
    label: '【基础信息】',
    minWidth: 120,
    tableProps: { className: 'grouped-header-basic' } as Record<string, unknown>,
  },
  {
    prop: 'name',
    label: '姓名',
    minWidth: 120,
    tableProps: { className: 'grouped-col-basic' } as Record<string, unknown>,
  },
  {
    prop: 'email',
    label: '邮箱',
    minWidth: 200,
    tableProps: { className: 'grouped-col-basic' } as Record<string, unknown>,
  },
  {
    prop: 'phone',
    label: '电话',
    minWidth: 140,
    tableProps: { className: 'grouped-col-basic' } as Record<string, unknown>,
  },
  // 父列 2：业务信息
  {
    prop: 'business',
    label: '【业务信息】',
    minWidth: 100,
    tableProps: { className: 'grouped-header-business' } as Record<string, unknown>,
  },
  {
    prop: 'department',
    label: '部门',
    minWidth: 100,
    tableProps: { className: 'grouped-col-business' } as Record<string, unknown>,
  },
  {
    prop: 'joinDate',
    label: '入职日期',
    width: 120,
    tableProps: { className: 'grouped-col-business' } as Record<string, unknown>,
  },
  {
    prop: 'salary',
    label: '薪资',
    width: 120,
    tableProps: { align: 'right' as const, className: 'grouped-col-business' } as Record<
      string,
      unknown
    >,
  },
]

/* ───────────── 代码片段 ───────────── */

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    table-key="demo-pro-table-grouped-header"
  />
</template>

<script setup lang="ts">
const columns: ProColumn[] = [
  { prop: 'id', label: 'ID' },
  // 父列：分组标题
  { prop: 'basic', label: '【基础信息】',
    tableProps: { className: 'grouped-header-basic' } },
  // 子列：视觉分组
  { prop: 'name', label: '姓名',
    tableProps: { className: 'grouped-col-basic' } },
  { prop: 'business', label: '【业务信息】',
    tableProps: { className: 'grouped-header-business' } },
  { prop: 'department', label: '部门',
    tableProps: { className: 'grouped-col-business' } },
]
<\/script>`

/* ───────────── 目录导航 ───────────── */

const tocItems = [
  { id: 'demo-grouped-header', label: '能力演示' },
  { id: 'api-grouped-column', label: 'ProColumn.children 字段' },
  { id: 'api-grouped-limits', label: '已知限制' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableGroupedHeader 列分组"
    source="src/components/ProTable/components/GroupedHeader.vue"
    :introductions="[
      '基于 cellClassName 视觉分组的列分组方案（v3.0 务实版）。',
      '下方演示：「【基础信息】」「【业务信息】」两个父标题列 + 子列 CSS 左侧 border 区分。',
      '⚠️ ProColumn.children 字段 API 已规划（见下方 ApiTable），v3.0 暂未实装完整 el-table-column 嵌套多级表头；如需多级表头请走 cellClassName 方案或等待 v3.0.1。',
      'R1 决策：父子扁平化持久化（按 prop 维度统一 storage key），列设置抽屉独立存储父子列。',
    ]"
  >
    <section id="demo-grouped-header" :class="bem.b()">
      <DemoField label="视觉分组" :code="basicCode">
        <ProTable
          :columns="columns"
          :request-api="groupedEmployeesRequestApi"
          table-key="demo-pro-table-grouped-header"
          row-key="id"
        />
      </DemoField>
    </section>

    <ApiTable
      title="ProColumn.children 字段（v3.0 已规划，暂未实装 — 完整多级表头留待 v3.0.1）"
      :items="groupedHeaderColumnItems"
      anchor="api-grouped-column"
    />
    <ApiTable title="已知限制" :items="groupedHeaderKnownLimitsItems" anchor="api-grouped-limits" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-grouped-header {
  // 视觉分组样式：cellClassName 标记的列左侧加 border。
  // 本项目 <style> 非 scoped（BEM 命名空间隔离），:deep() 无编译器接管、会被浏览器
  // 当未知伪类整条丢弃 —— 必须直接写后代选择器（CLAUDE.md §3.3 反模式 #8）
  .grouped-col-basic {
    border-left: 2px solid var(--el-color-primary-light-5);
  }
  .grouped-col-business {
    border-left: 2px solid var(--el-color-success-light-5);
  }
  /*
   * 表头分组底色覆写（无 !important）：
   * 选择器特异性 (0,3,1) > el-table 内置 th 规则 (0,2,1)，
   * 无须 !important（项目规范 §4 #13）。
   */
  .el-table th.grouped-header-basic,
  .el-table th.grouped-header-business {
    background-color: var(--el-fill-color-light);
    font-weight: 600;
  }
  /*
   * 颜色直接用普通 class 即可（element-plus 不覆写 th 默认 color），
   * 选择器 (0,2,0)，靠源码顺序决胜（晚于 EP CSS 注入）。
   */
  .grouped-header-basic {
    color: var(--el-color-primary);
  }
  .grouped-header-business {
    color: var(--el-color-success);
  }
}
</style>
