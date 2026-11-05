<script setup lang="ts">
/**
 * ProTable v3.1 内置格式化器 demo —— formatter 预设 + vxe 引擎跨引擎一致性
 *
 * 演示能力：
 * - 内置 formatter 预设：dateTime / date / time / amount / percent / boolTag
 *   字符串 key 直接写在列定义上，非法值（非数字金额 / 非法日期）原样字符串化容错
 * - 跨引擎一致性：同一份 columns 在 element-plus / vxe-table 引擎下渲染行为一致
 *   （cell-render 适配层统一解析；vxe 动态加载）
 *
 * 验证步骤：
 * 1. 前 8 列按各自预设格式化（金额千分位、进度 ×100%、布尔绿/灰标签）
 * 2. 「非法日期容错」列显示原样字符串 not-a-date（dayjs isValid 守卫，不出现 Invalid Date）
 * 3. 下方 vxe 引擎表格：金额 / 时间渲染与 el 引擎一致
 *
 * 路由：自动注册为 /demo/pro-table-formatter
 */
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { formatterColumnItems, formatterPresetItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-formatter')

const formatterColumns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 110 },
  { prop: 'createdAt', label: 'dateTime', width: 165, formatter: 'dateTime' },
  { prop: 'shipDate', label: 'date', width: 115, formatter: 'date' },
  { prop: 'remindAt', label: 'time', width: 105, formatter: 'time' },
  { prop: 'amount', label: 'amount', width: 130, formatter: 'amount' },
  { prop: 'progress', label: 'percent', width: 110, formatter: 'percent' },
  { prop: 'done', label: 'boolTag', width: 105, formatter: 'boolTag' },
  { prop: 'invalidDate', label: '非法日期容错', width: 130, formatter: 'dateTime' },
]

const vxeColumns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 130, formatter: 'amount' },
  { prop: 'createdAt', label: '创建时间', width: 170, formatter: 'dateTime' },
]

const formatterCode = `const columns: ProColumn[] = [
  { prop: 'createdAt', label: '创建时间', formatter: 'dateTime' }, // 2026-09-16 14:30:00
  { prop: 'amount', label: '金额', formatter: 'amount' },         // 千分位 + 2 位小数
  { prop: 'progress', label: '进度', formatter: 'percent' },      // 0.1567 → 15.67%
  { prop: 'done', label: '完成', formatter: 'boolTag' },          // 绿色「是」/ 灰色「否」
  // 非法值（如 'not-a-date' / 'abc'）原样字符串化显示，不吞错也不拖垮表格
]`

const vxeCode = `<!-- 同一份 columns：formatter 走统一渲染适配层，双引擎行为一致 -->
<!-- vxe 引擎首次 mount 时动态加载 JS/CSS（chunk 不进首屏） -->
<ProTable table-engine="vxe-table" :columns="columns" :request-api="requestApi" />`

const tocItems = [
  { id: 'demo-formatter', label: '能力演示' },
  { id: 'demo-formatter-vxe', label: 'vxe 引擎一致性' },
  { id: 'api-formatter-column', label: 'ProColumn.formatter 字段' },
  { id: 'api-formatter-preset', label: '内置格式化器预设' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableFormatter 内置格式化器"
    source="src/components/ProTable/adapters/cell-format.ts"
    :introductions="[
      'formatter 预设把高频格式化（时间 / 金额千分位 / 百分比 / 布尔标签）收敛为字符串 key。',
      '下方同时验证 vxe-table 引擎下同一列定义的渲染一致性。',
    ]"
  >
    <section id="demo-formatter" :class="bem.b()">
      <DemoField label="内置 formatter 预设（6 预设 + 非法值容错）" :code="formatterCode">
        <p :class="bem.e('hint')">
          验证：① 前 8 列按各自预设格式化（金额千分位、进度 ×100%、布尔绿/灰标签）②
          「非法日期容错」列显示原样字符串
          <code>not-a-date</code>
          （dayjs isValid 守卫，不出现 Invalid Date）
        </p>
        <ProTable
          :columns="formatterColumns"
          :request-api="projectRequestApi"
          table-key="demo-v31-formatter"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField id="demo-formatter-vxe" label="vxe-table 引擎一致性" :code="vxeCode">
        <p :class="bem.e('hint')">
          验证：金额 / 创建时间列渲染与上方 el 引擎一致（formatter 经统一 cell-render
          适配层解析）；首次切换动态加载 vxe JS/CSS
        </p>
        <ProTable
          :columns="vxeColumns"
          :request-api="projectRequestApi"
          table-key="demo-v31-vxe"
          row-key="id"
          table-engine="vxe-table"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable
      title="ProColumn.formatter 字段"
      :items="formatterColumnItems"
      anchor="api-formatter-column"
    />
    <ApiTable
      title="内置格式化器预设（v3.1）"
      :items="formatterPresetItems"
      anchor="api-formatter-preset"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-formatter {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}
</style>
