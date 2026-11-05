<script setup lang="ts">
/**
 * ProTable 列宽拖拽 demo —— column-resize 开启 / 默认关闭对照
 *
 * 演示能力：
 * - column-resize（默认 false）：开启后表头列边框可拖动调列宽。
 *   el 引擎显式绑 el-table-column resizable（ep 默认 true，必须显式 false 才能默认关闭），
 *   且联动表级 border —— ep 列宽拖拽硬依赖 border（边框线即 th 右缘拖拽手柄命中区，
 *   table-header/event-helper.mjs handleMouseMove 首行守卫 if (!props.border) return）；
 *   vxe 引擎映射列级 resizable（vxe 默认 false，语义天然契合，无需 border）。
 *   virtualized（TableV2）分支不支持（列宽受控，onColumnResize 需回写列宽配置）
 * - 列级 tableProps.resizable 可覆盖组件级 columnResize（列级显式优先）
 *
 * 验证步骤：
 * 1. 上方开启表格：悬停表头列边框 → 光标变 col-resize，拖动调宽
 * 2. 下方默认表格：同样位置悬停 → 无光标、不可拖（默认关闭）
 *
 * 路由：自动注册为 /demo/pro-table-column-resize
 */
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { columnResizeItems, columnResizeColumnItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-column-resize')

const resizeColumns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
  { prop: 'done', label: '完成', width: 105, formatter: 'boolTag' },
  { prop: 'createdAt', label: '创建时间', width: 170, formatter: 'dateTime' },
]

const resizeCode = `<!-- 组件级开启：所有列表头边框可拖动调宽 -->
<ProTable column-resize :columns="columns" :request-api="requestApi" />

<!-- 列级覆盖：单列表头固定不可拖（tableProps 显式优先于组件级 column-resize） -->
{ prop: 'amount', label: '金额', tableProps: { resizable: false } }`

const defaultCode = `<!-- 默认关闭：不传 column-resize，表头边框不可拖 -->
<ProTable :columns="columns" :request-api="requestApi" />`

const tocItems = [
  { id: 'demo-resize-on', label: 'column-resize 开启' },
  { id: 'demo-resize-off', label: '默认关闭对照' },
  { id: 'api-column-resize', label: 'columnResize Prop' },
  { id: 'api-column-resize-column', label: '列级覆盖' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableColumnResize 列宽拖拽"
    source="src/components/ProTable/components/ElementTableBody.vue"
    :introductions="[
      'column-resize（默认 false）：开启后表头列边框可拖动调列宽，el/vxe 引擎语义一致。',
      '列级 tableProps.resizable 可覆盖组件级配置；virtualized（TableV2）分支暂不支持。',
    ]"
  >
    <section :class="bem.b()">
      <DemoField
        id="demo-resize-on"
        label="column-resize 开启（拖表头边框调宽）"
        :code="resizeCode"
      >
        <p :class="bem.e('hint')">
          验证：开启后表格带边框线（ep 列宽拖拽前置 border）→ 悬停任意表头列边框 → 光标变 col-resize
          → 按住拖动调列宽
        </p>
        <ProTable
          :columns="resizeColumns"
          :request-api="projectRequestApi"
          table-key="demo-column-resize-on"
          row-key="id"
          column-resize
          :page-size="5"
        />
      </DemoField>

      <DemoField id="demo-resize-off" label="默认关闭（对照）" :code="defaultCode">
        <p :class="bem.e('hint')">
          验证：同样位置悬停表头列边框 → 无光标、不可拖（column-resize 默认 false， el 引擎 ep
          resizable 默认 true，由 ProTable 显式关闭）
        </p>
        <ProTable
          :columns="resizeColumns"
          :request-api="projectRequestApi"
          table-key="demo-column-resize-off"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable title="columnResize Prop" :items="columnResizeItems" anchor="api-column-resize" />
    <ApiTable
      title="列级覆盖（tableProps.resizable）"
      :items="columnResizeColumnItems"
      anchor="api-column-resize-column"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-column-resize {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}
</style>
