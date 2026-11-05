<script setup lang="ts">
/**
 * ProTable 操作列 demo —— 高频按钮直出 + 低频按钮 ElDropdown 收纳 + 表头 Tooltip
 *
 * 演示能力：
 * - 操作列（type:'operation'）：内容完全由 #operation 插槽接管（el/vxe 引擎均透传），
 *   真实业务按钮众多时——高频操作（编辑/详情）直出，低频操作（复制/导出/停用）
 *   收进 ElDropdown（trigger:'click' 防悬停误触）
 * - 表头 Tooltip（headerRender）：headerRender 接管 el-table-column #header（双引擎接线），
 *   ElTooltip 函数式默认插槽挂问号图标，说明列含义（业务口径/单位等）
 *
 * 验证步骤：
 * 1. 「编辑」「详情」直出按钮点击 → ElMessage 提示对应操作
 * 2. 点「更多」→ 下拉展开「复制 / 导出 / 停用」→ 点击提示对应命令
 * 3. 悬停「项目」「金额」表头的问号图标 → 弹出说明气泡
 *
 * 路由：自动注册为 /demo/pro-table-operation
 */
import { h } from 'vue' // h 不在 AutoImport 注入列表（见 src/types/auto-imports.d.ts），显式引入
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMessage,
  ElTooltip,
} from 'element-plus'
import { ArrowDown, QuestionFilled } from '@element-plus/icons-vue'
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { operationColumnItems, headerRenderItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-operation')

const operationColumns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
  // fixed:'right'：操作列惯例固定右侧（横向滚动时常驻可见）
  { prop: 'operation', label: '操作', type: 'operation', width: 150, fixed: 'right' },
]

/** 表头 Tooltip 列：headerRender 生成「label + 问号图标」表头，气泡说明业务口径 */
const tooltipColumns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    prop: 'title',
    label: '项目',
    minWidth: 140,
    headerRender: () =>
      h('span', { class: bem.e('header-tip') }, [
        '项目',
        h(ElTooltip, { content: '项目全称，与合同台账编号一一对应' }, () =>
          h(QuestionFilled, { class: bem.e('tip-icon') })
        ),
      ]),
  },
  {
    prop: 'amount',
    label: '金额',
    width: 140,
    formatter: 'amount',
    headerRender: () =>
      h('span', { class: bem.e('header-tip') }, [
        '金额',
        h(ElTooltip, { content: '单位：人民币元，含税' }, () =>
          h(QuestionFilled, { class: bem.e('tip-icon') })
        ),
      ]),
  },
  { prop: 'createdAt', label: '创建时间', width: 170, formatter: 'dateTime' },
]

function handleOp(op: string, row: unknown): void {
  ElMessage.success(`${op}：${(row as ProjectRow).title}`)
}

const operationCode = `<ProTable :columns="columns" :request-api="requestApi">
  <!-- type:'operation' 列：内容完全由 #operation 插槽接管（双引擎均透传） -->
  <template #operation="{ row }">
    <ElButton link type="primary" size="small">编辑</ElButton>
    <ElButton link type="primary" size="small">详情</ElButton>
    <!-- 低频操作收纳进 ElDropdown（trigger:'click' 防悬停误触） -->
    <ElDropdown trigger="click" @command="(cmd) => handleOp(cmd, row)">
      <ElButton link type="primary" size="small">更多</ElButton>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem command="复制">复制</ElDropdownItem>
          <ElDropdownItem command="导出">导出</ElDropdownItem>
          <ElDropdownItem command="停用" divided>停用</ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </template>
</ProTable>`

const tooltipCode = `// headerRender 自定义表头（el/vxe 引擎均已接线），ElTooltip 函数式默认插槽
{
  prop: 'amount',
  label: '金额',
  formatter: 'amount',
  headerRender: () =>
    h('span', { class: 'header-tip' }, [
      '金额',
      h(ElTooltip, { content: '单位：人民币元，含税' }, () => h(QuestionFilled)),
    ]),
}`

const tocItems = [
  { id: 'demo-operation-dropdown', label: '操作列下拉收纳' },
  { id: 'demo-header-tooltip', label: '表头 Tooltip' },
  { id: 'api-operation-column', label: 'operation 列字段' },
  { id: 'api-header-render', label: 'headerRender 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableOperation 操作列（下拉收纳 + 表头 Tooltip）"
    source="src/components/ProTable/components/ElementTableBody.vue"
    :introductions="[
      '操作按钮众多时的收纳模式：type:\'operation\' 列 + #operation 插槽内 ElDropdown 折叠低频操作。',
      '表头 Tooltip：headerRender 自定义表头（双引擎接线），问号图标气泡说明列业务口径。',
    ]"
  >
    <section :class="bem.b()">
      <DemoField
        id="demo-operation-dropdown"
        label="操作列下拉收纳（高频直出 + 低频折叠）"
        :code="operationCode"
      >
        <p :class="bem.e('hint')">
          验证：① 「编辑/详情」直出按钮点击弹提示 ② 点「更多」展开下拉（复制/导出/停用） ③ 操作列
          fixed:'right' 横向滚动时固定在右侧
        </p>
        <ProTable
          :columns="operationColumns"
          :request-api="projectRequestApi"
          table-key="demo-operation"
          row-key="id"
          :page-size="5"
        >
          <template #operation="{ row }">
            <div :class="bem.e('ops')">
              <ElButton link type="primary" size="small" @click="handleOp('编辑', row)">
                编辑
              </ElButton>
              <ElButton link type="primary" size="small" @click="handleOp('详情', row)">
                详情
              </ElButton>
              <ElDropdown trigger="click" @command="(cmd: string) => handleOp(cmd, row)">
                <ElButton link type="primary" size="small">
                  更多
                  <ElIcon><ArrowDown /></ElIcon>
                </ElButton>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem command="复制">复制</ElDropdownItem>
                    <ElDropdownItem command="导出">导出</ElDropdownItem>
                    <ElDropdownItem command="停用" divided>停用</ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </template>
        </ProTable>
      </DemoField>

      <DemoField
        id="demo-header-tooltip"
        label="表头 Tooltip（headerRender + ElTooltip）"
        :code="tooltipCode"
      >
        <p :class="bem.e('hint')">验证：悬停「项目」「金额」表头的问号图标 → 弹出说明气泡</p>
        <ProTable
          :columns="tooltipColumns"
          :request-api="projectRequestApi"
          table-key="demo-header-tooltip"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable
      title="operation 列字段（v3.1）"
      :items="operationColumnItems"
      anchor="api-operation-column"
    />
    <ApiTable title="headerRender 字段" :items="headerRenderItems" anchor="api-header-render" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-operation {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__ops {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* 表头 Tooltip 渲染在 el-table 表头内（非本组件 DOM 子树），
     BEM 类名经全局（非 scoped）样式命中 */
  &__header-tip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__tip-icon {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    cursor: help;
  }
}
</style>
