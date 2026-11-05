<script setup lang="ts">
/**
 * ProTable v3.0.1 虚拟滚动 demo（升级：el-table-v2 真虚拟化）
 *
 * 演示能力：
 * - 10 万行 × 10 列（含 ID + Department 左固定列），首屏 < 1s，滚动 avgFPS ≥ 100
 * - 列设置：勾选/重排（响应式更新 el-table-v2 columns）
 * - 排序：score / level 服务端排序
 * - 强隔离策略演示：开启虚拟化时其他能力被忽略
 *
 * 验证步骤：
 * 1. 页面加载 → 表格容器固定 500px 高度，滚动流畅
 * 2. 列设置 → 隐藏 remark 列 → 表格立即刷新
 * 3. 列设置 → 重排 columns → 表格列序变化
 * 4. 排序 → 点击「评分」/「等级」表头 → 数据按该列升降序（服务端排序）
 * 5. 密度 → 切换 紧凑/默认/宽松 → 行高即时变化（32/48/64）
 * 6. 搜索 → 姓名搜索框输入关键字 → 表格只显示匹配行；重置 → 恢复全量
 * 7. console 演示：当 virtualized + enableSummary 命中时输出 warn
 */
import { ElTag } from 'element-plus'
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { bigDataRequestApi, type BigRow } from '@mock/pro-table/big-data'
import {
  virtualScrollConfigItems,
  virtualScrollColumnItems,
  virtualScrollLimitsItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-virtual-scroll')

/** 10 列定义：ID + Department 左固定，其余自适应；name 列挂搜索（对应 mock 的 name 参数） */
const columns: ProColumn<BigRow>[] = [
  { prop: 'id', label: 'ID', width: 80, fixed: 'left', sortable: 'custom' },
  {
    prop: 'name',
    label: '姓名',
    minWidth: 160,
    sortable: 'custom',
    search: { el: 'input', defaultValue: '', span: 6 },
  },
  { prop: 'email', label: '邮箱', minWidth: 220 },
  { prop: 'department', label: '部门', width: 120, fixed: 'left' },
  { prop: 'status', label: '状态', width: 100 },
  {
    prop: 'score',
    label: '评分',
    width: 100,
    sortable: 'custom',
    tableProps: { align: 'right' as const },
  },
  { prop: 'city', label: '城市', width: 100 },
  { prop: 'joinDate', label: '入职日期', width: 120 },
  {
    prop: 'level',
    label: '等级',
    width: 80,
    sortable: 'custom',
    tableProps: { align: 'right' as const },
  },
  { prop: 'remark', label: '备注', minWidth: 200 },
]

/** 代码片段 */
const basicCode = `<template>
  <!-- 启用 virtualized 即切换到 el-table-v2 真虚拟化引擎 -->
  <!-- :pagination="false" 关闭分页（虚拟化场景：单次返回全量） -->
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :pagination="false"
    :virtualized="{ rowHeight: 48, height: 500, width: 'auto' }"
  />
</template>`

/** v3.0.2 新增能力演示：formatter 字段（M4）+ 具名插槽透传（C1） */
const formatterColumns: ProColumn<BigRow>[] = [
  { prop: 'id', label: 'ID', width: 80, fixed: 'left' },
  { prop: 'name', label: '姓名', width: 160 },
  // M4 演示：formatter 千分位格式化（数字加千分位 + 前缀）
  {
    prop: 'score',
    label: '评分（formatter）',
    width: 160,
    // 返回 string | VNode，此处用纯字符串演示轻量场景
    formatter: (row) => `★ ${Number(row.score).toLocaleString('en-US')}`,
  },
  // C1 演示：具名插槽透传（v1 `<template #prop="scope">` 写法在 v2 引擎下也生效）
  // 这里用插槽渲染自定义 ElTag，比 enum 配置更灵活（任意 JSX/h() 都可）
  {
    prop: 'status',
    label: '状态（具名插槽）',
    width: 140,
  },
  {
    prop: 'department',
    label: '部门',
    width: 120,
    fixed: 'left',
    // 验证 enum 优先级低于 formatter/插槽：同时声明 enum + formatter 时 formatter 生效
    enum: [
      { value: 'active', label: '在职', tagType: 'success' },
      { value: 'inactive', label: '离职', tagType: 'info' },
    ],
  },
]

/** formatter + 插槽演示的代码片段（用于 DemoField.code 渲染）
 *
 * 注意：代码片段中避免使用 <template> 字面量字符串（破坏 Vue SFC parser），
 * 用 [slot:status] 标识符代替具名插槽展示。 */
const formatterCode = `<!-- ProTable 模板部分 -->
<ProTable
  :columns="formatterColumns"
  :request-api="requestApi"
  :pagination="false"
  :virtualized="{ rowHeight: 48, height: 400 }"
>
  <!-- C1 修复：v1 [slot:prop="scope"] 写法在 v2 引擎下也能用 -->
  [slot:status="{ row }"]
    <ElTag :type="row.status === 'active' ? 'success' : 'info'" size="small">
      {{ row.status === 'active' ? '在职' : '离职' }}
    </ElTag>
  [/slot]
</ProTable>

<!-- columns 定义：score 列用 formatter 千分位（M4 修复） -->
const formatterColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  {
    prop: 'score',
    label: '评分',
    // formatter 返回 string | VNode；优先级 render > slot > formatter > enum > 默认
    formatter: (row) => '★ ' + Number(row.score).toLocaleString('en-US'),
  },
  // status 列不传 formatter/enum，由 [slot:status] 插槽接管
  { prop: 'status', label: '状态' },
]`

/** v3.0.2 H2 演示：virtualConfig.height 数字 > 0 时固定表格高度，父容器 resize 不影响 */
const fixedHeightColumns: ProColumn<BigRow>[] = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 160 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'score', label: '评分', width: 100 },
]

/** H2 高度优先级演示代码片段 */
const fixedHeightCode = `<!-- H2 修复：virtualConfig.height 数字 > 0 时固定表格高度 -->
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :pagination="false"
  :virtualized="{ rowHeight: 48, height: 300 }"
/>

<!-- 说明：
  • virtualConfig.height: 300 表示用户期望表格固定 300px
  • 即使父容器 ResizeObserver 测量到不同高度（如视口过小），配置 300 优先
  • 未配置 height 时走「实测 fallback」路径（v3.0.1 行为不变） -->`

/** 强隔离策略代码片段（用于 DemoField.code 渲染） */
const limitsCode = `<!-- 同时启用 virtualized + enableRowEdit + enableSummary -->
<ProTable
  :columns="columns"
  :request-api="api"
  :virtualized="true"
  :enable-row-edit="true"
  :enable-summary="true"
/>

<!-- console 输出：
[ProTable] virtualized + tableEngine="element-plus" ...
[ProTable] virtualized 模式下以下能力被忽略: enableRowEdit, enableSummary -->`

const tocItems = [
  { id: 'demo-virtual-scroll', label: '能力演示' },
  { id: 'demo-virtual-scroll-formatter', label: 'formatter + 插槽（新）' },
  { id: 'demo-virtual-scroll-fixed-height', label: '容器尺寸固定（新）' },
  { id: 'demo-virtual-scroll-limits', label: '强隔离策略' },
  { id: 'api-virtual-scroll-config', label: 'virtualized 配置' },
  { id: 'api-virtual-scroll-column', label: '列字段（新）' },
  { id: 'api-virtual-scroll-limits', label: '已知限制' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableVirtualScroll 虚拟滚动（el-table-v2）"
    source="src/components/ProTable/composables/useVirtualScroll.ts"
    :introductions="[
      'v3.0.1 升级：从假虚拟化（CSS overflow）切换到 el-table-v2 真虚拟化引擎，支持 10 万行 × 10 列流畅渲染。',
      '强隔离策略：启用 virtualized 时其他能力（行内编辑/树形/汇总/合并/拖拽）一律 warn + 忽略，vxe-table 引擎自动回落 element-plus。',
      '列设置 / 排序 / 搜索 / 密度切换在虚拟化分支保留可用。',
      '性能目标：首屏渲染 < 1s，滚动 avgFPS ≥ 100。',
    ]"
  >
    <section id="demo-virtual-scroll" :class="bem.b()">
      <DemoField label="基本用法（10 万行 × 10 列含固定列）" :code="basicCode">
        <ProTable
          ref="tableRef"
          :columns="columns"
          :request-api="bigDataRequestApi"
          table-key="demo-pro-table-virtual-scroll"
          row-key="id"
          :pagination="false"
          :virtualized="{ rowHeight: 48, height: 500, width: 'auto' }"
        />
      </DemoField>
    </section>

    <section id="demo-virtual-scroll-formatter" :class="bem.b()">
      <DemoField label="v3.0.2 新增：formatter 字段 + 具名插槽透传" :code="formatterCode">
        <p style="margin: 0 0 8px; color: var(--el-text-color-secondary); font-size: 13px">
          •
          <strong>score 列</strong>
          ：用
          <code>formatter</code>
          千分位格式化（轻量场景，无需完整 VNode）
          <br />
          •
          <strong>status 列</strong>
          ：用
          <code>&lt;template #status&gt;</code>
          具名插槽透传（C1 修复：v1/v2 引擎写法对齐）
          <br />
          • 优先级链：
          <code>render</code>
          &gt;
          <code>具名插槽</code>
          &gt;
          <code>formatter</code>
          &gt;
          <code>enum</code>
          &gt; 默认文本
        </p>
        <ProTable
          :columns="formatterColumns"
          :request-api="bigDataRequestApi"
          table-key="demo-pro-table-virtual-scroll-formatter"
          row-key="id"
          :pagination="false"
          :virtualized="{ rowHeight: 48, height: 400, width: 'auto' }"
        >
          <template #status="{ row }">
            <ElTag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '在职' : '离职' }}
            </ElTag>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <section id="demo-virtual-scroll-fixed-height" :class="bem.b()">
      <DemoField
        label="v3.0.2 H2 修复：virtualConfig.height 数字固定表格高度"
        :code="fixedHeightCode"
      >
        <p style="margin: 0 0 8px; color: var(--el-text-color-secondary); font-size: 13px">
          •
          <code>virtualConfig.height: 300</code>
          表示用户期望表格固定 300px
          <br />
          • 即便父容器 ResizeObserver 测量到不同高度（如视口过小/0），配置 300 优先
          <br />
          • 未配置
          <code>height</code>
          时走「实测 fallback」路径（v3.0.1 行为不变）
        </p>
        <ProTable
          :columns="fixedHeightColumns"
          :request-api="bigDataRequestApi"
          table-key="demo-pro-table-virtual-scroll-fixed-height"
          row-key="id"
          :pagination="false"
          :virtualized="{ rowHeight: 48, height: 300 }"
        />
      </DemoField>
    </section>

    <section id="demo-virtual-scroll-limits" :class="bem.b()">
      <DemoField label="强隔离策略：开启虚拟化时其他能力被忽略" :code="limitsCode">
        <ul style="line-height: 1.8; padding-left: 20px">
          <li>
            <strong>enableRowEdit</strong>
            （行内编辑）：行索引漂移破坏 edit state，禁用
          </li>
          <li>
            <strong>enableTree</strong>
            （树形数据）：el-table-v2 无 tree-props，禁用
          </li>
          <li>
            <strong>enableSummary</strong>
            （汇总行）：el-table-v2 无 show-summary，禁用
          </li>
          <li>
            <strong>enableCellSpan</strong>
            （单元格合并）：el-table-v2 无 span-method，禁用
          </li>
          <li>
            <strong>enableRowDrag</strong>
            （行拖拽）：Sortable.js 找不到 tbody，禁用
          </li>
          <li>
            <strong>tableEngine="vxe-table"</strong>
            ：虚拟化仅 element-plus 引擎支持，自动回落
          </li>
        </ul>
      </DemoField>
    </section>

    <ApiTable
      title="virtualized 配置"
      :items="virtualScrollConfigItems"
      anchor="api-virtual-scroll-config"
    />
    <ApiTable
      title="v3.0.2 新增：列字段"
      :items="virtualScrollColumnItems"
      anchor="api-virtual-scroll-column"
    />
    <ApiTable
      title="已知限制"
      :items="virtualScrollLimitsItems"
      anchor="api-virtual-scroll-limits"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-virtual-scroll {
  // 此 demo 不需要额外样式
}
</style>
