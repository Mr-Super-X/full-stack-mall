<script setup lang="ts">
/**
 * ProTable 行内编辑 demo（spec §五.1 / §八.3）
 *
 * 演示能力：
 * - 双击姓名进入编辑（useRowEdit.el = 'input' + rules）
 * - 部门下拉编辑（el: 'select' + props.options）
 * - 工资数字编辑（el: 'input-number' + precision + min）
 * - edit.updateEvent 双模式对比：姓名列 'input' 实时同步 vs 工资/备注列 'blur' 失焦同步
 * - 异步校验：工资 > 5w 拒绝 + 字段级红字错误
 * - 多行同时编辑：工具栏「保存全部」「取消全部」
 *
 * 验证步骤：
 * 1. 双击「张三」姓名 → 出现输入框
 * 2. 改为「张三丰」→ 数据实时变化（input 模式）
 * 3. 双击工资改 88888 → 编辑中数据不生效，失焦后才同步（blur 模式）→ 保存 → 红字「工资超限」
 * 4. 双击姓名 + 双击部门 → 两个字段同时进入编辑
 */
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { employeeRequestApi } from '@mock/pro-table/employee'
import {
  rowEditPropsItems,
  rowEditColumnItems,
  rowEditExposeItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-row-edit')

/* ───────────── 列定义 ───────────── */

const columns: ProColumn[] = [
  {
    prop: 'name',
    label: '姓名（input 实时同步）',
    edit: {
      el: 'input',
      rules: { required: true, message: '姓名必填' },
      // updateEvent 双模式对比（原 ProTableEditCellVModel demo 能力并入）：
      // 'input'（默认）输入即时同步；'blur' 失焦才同步（见下方工资列）
      updateEvent: 'input',
    },
  },
  {
    prop: 'dept',
    label: '部门',
    edit: {
      el: 'select',
      props: {
        options: [
          { label: '研发部', value: '研发部' },
          { label: '市场部', value: '市场部' },
          { label: '人事部', value: '人事部' },
        ],
      },
    },
  },
  {
    prop: 'salary',
    label: '工资（blur 失焦同步）',
    edit: {
      el: 'input-number',
      props: { precision: 2, min: 0 },
      // 数字输入高频 change，blur 同步避免增量刷新风暴
      updateEvent: 'blur',
    },
  },
  { prop: 'hiredAt', label: '入职日期' },
]

/* ───────────── 编辑配置 ───────────── */

const config = ref({
  trigger: 'dblclick' as const,
  onSave: async (row: Record<string, unknown>, _changes: Record<string, unknown>) => {
    if ((row['salary'] as number) > 50000) throw new Error('工资超限（>5w）')
    return true
  },
})

// 泛型 SFC 的 typeof ProTable 不是构造器，InstanceType 不适用 —— 直接用 defineExpose 暴露的契约类型
const tableRef = ref<ProTableExpose>()

async function handleSaveAll(): Promise<void> {
  await tableRef.value?.saveEdit?.()
}

function handleCancelAll(): void {
  tableRef.value?.cancelEdit?.()
}

/* ───────────── 目录导航 ───────────── */

const tocItems = [
  { id: 'demo-row-edit', label: '能力演示' },
  { id: 'api-row-edit', label: 'enableRowEdit 配置' },
  { id: 'api-row-edit-column', label: 'ProColumn.edit 字段' },
  { id: 'api-row-edit-expose', label: 'Expose API' },
]

useDocToc(tocItems)

/* ───────────── 代码片段 ───────────── */

const basicCode = `<template>
  <ProTable
    ref="tableRef"
    :columns="columns"
    :request-api="requestApi"
    :enable-row-edit="config"
    row-key="id"
  />
</template>

<script setup lang="ts">
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'

const columns: ProColumn[] = [
  // updateEvent: 'input'（默认）实时同步；'blur' 失焦同步（数字输入建议 blur 防高频刷新）
  { prop: 'name', label: '姓名', edit: { el: 'input', updateEvent: 'input', rules: { required: true } } },
  { prop: 'salary', label: '工资', edit: { el: 'input-number', updateEvent: 'blur', props: { min: 0 } } },
]

const config = {
  onSave: async (row) => {
    if (row.salary > 50000) throw new Error('工资超限')
    return true
  }
}

const tableRef = ref()

async function saveAll() {
  await tableRef.value?.saveEdit()  // 调用 Expose API
}
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableRowEdit 行内编辑"
    source="src/components/ProTable/composables/useRowEdit.ts"
    :introductions="[
      '基于 useRowEdit composable 实现的行级编辑状态机：双击进入 / 多行并行 / 异步校验 / 草稿独立。',
      '下方演示：双击姓名（input 实时同步）+ 下拉部门 + 数字工资（blur 失焦同步，双模式对比）+ 异步校验（工资超限）。',
      '配套 ProColumn.edit 字段声明哪些列可编辑（含 updateEvent 同步时机），ProTableExpose 提供 saveEdit/cancelEdit/startEdit API。',
    ]"
  >
    <!-- 演示区 -->
    <section id="demo-row-edit" :class="bem.b()">
      <DemoField label="基本用法" :code="basicCode">
        <ProTable
          ref="tableRef"
          :columns="columns"
          :request-api="employeeRequestApi"
          :enable-row-edit="config"
          row-key="id"
        />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="handleSaveAll">保存全部</el-button>
          <el-button @click="handleCancelAll">取消全部</el-button>
        </div>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="enableRowEdit 配置" :items="rowEditPropsItems" anchor="api-row-edit" />
    <ApiTable
      title="ProColumn.edit 字段"
      :items="rowEditColumnItems"
      anchor="api-row-edit-column"
    />
    <ApiTable
      title="Expose API（saveEdit/cancelEdit/startEdit）"
      :items="rowEditExposeItems"
      anchor="api-row-edit-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-row-edit {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
