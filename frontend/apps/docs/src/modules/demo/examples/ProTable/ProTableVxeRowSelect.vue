<script setup lang="ts">
/**
 * ProTable vxe 引擎行选择 demo（B1 修复场景的浏览器验证入口）
 *
 * 与 ProTableRowSelect（el 引擎）的关键差异：
 * - table-engine="vxe-table"：radio/selection 列由 vxe-table 内置列类型渲染
 * - B1 修复点（docs/audit/2026-10-15-engine-audit-summary.md 批 B1）：
 *   修复前 vxe 引擎 clearSelection 只清本地镜像不清 UI（tableRef 恒 null），
 *   修复后 VxeTableBody expose clearSelection()（clearCheckboxRow/clearRadioRow 清 UI + 清镜像），
 *   ProTable expose 双通道并调；reserve-selection 跨页镜像经 getCheckboxRecords +
 *   getCheckboxReserveRecords 合并回同步（2026-10-19 实测修正：单 API 仅当前页）
 * - radio 跨页保持：el 引擎由统一选中区受控驱动天然保持；vxe 需 radio-config.reserve
 *   （2026-10-19 实测暴露未接线时翻页丢选中，已对齐接线）
 *
 * 三个表的行为差异（先看对照表再验证，避免把「设计行为」当 bug）：
 * | 表 | 翻页行为 |
 * | radio 单选 | ✅ 保持（选中收敛统一选中区，radio-config.reserve 恢复 UI） |
 * | selection 多选（本页） | ❌ 翻页清选区（与 el 引擎非 reserve-selection 一致，设计行为） |
 * | selection + reserveSelection | ✅ 跨页累计保持（v3.1 一等字段，跨页勾选） |
 *
 * 验证步骤：
 * 1. radio：点单选圆点选中一行 → 翻到第 2 页再翻回 → 选中保持 ✓ → 「读取 radio 选中」提示单行
 * 2. selection：勾选 2 行 → 「读取勾选」2 行 → 「清除选中」checkbox 全部清空（B1：UI+镜像双清）
 * 3. reserveSelection 跨页：第 1 页勾 2 行 → 翻第 2 页勾 1 行 → 「读取跨页勾选」累计 3 行 →
 *    翻回第 1 页勾选保留 → 「清除选中」全部清空
 *
 * 路由：自动注册为 /demo/pro-table-vxe-row-select
 */
import { ElButton, ElMessage } from 'element-plus'
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  radioColumnItems,
  reserveSelectionColumnItems,
  vxeSelectionItems,
} from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-vxe-row-select')

const vxeRadioColumns: ProColumn<ProjectRow>[] = [
  { prop: '__radio', label: '', type: 'radio', width: 50 },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 150 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
]

const vxeSelectionColumns: ProColumn<ProjectRow>[] = [
  { prop: '__selection', label: '', type: 'selection', width: 45 },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 150 },
  { prop: 'progress', label: '进度', width: 130, formatter: 'percent' },
]

const vxeReserveColumns: ProColumn<ProjectRow>[] = [
  { prop: '__selection', label: '', type: 'selection', width: 45, reserveSelection: true },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 150 },
  { prop: 'progress', label: '进度', width: 130, formatter: 'percent' },
]

const radioRef = ref<ProTableExpose | null>(null)
const selectionRef = ref<ProTableExpose | null>(null)
const reserveRef = ref<ProTableExpose | null>(null)

function describe(rows: Record<string, unknown>[]): string {
  return rows.map((r) => (r as ProjectRow).title).join('、')
}

function handleGetRadio(): void {
  const rows = radioRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('请先选中一行（vxe radio 单选列）')
    return
  }
  ElMessage.success(`vxe radio 选中：${describe(rows)}（共 ${rows.length} 行）`)
}

function handleGetSelection(): void {
  const rows = selectionRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('当前未勾选任何行')
    return
  }
  ElMessage.success(`vxe 勾选：${describe(rows)}（共 ${rows.length} 行）`)
}

function handleGetReserve(): void {
  const rows = reserveRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('当前未勾选任何行')
    return
  }
  ElMessage.success(`vxe 跨页累计勾选 ${rows.length} 行：${describe(rows)}`)
}

/** B1 修复点：vxe 引擎 clearSelection 同时清 UI 勾选与本地镜像（双通道） */
function handleClear(target: { clearSelection: () => void } | null, label: string): void {
  target?.clearSelection()
  ElMessage.info(`已调 ${label} clearSelection()（UI 勾选 + 镜像双清）`)
}

const radioCode = `// vxe 引擎 radio 单选列：table-engine 切换后列类型由 vxe-table 内置渲染
<ProTable table-engine="vxe-table" :columns="[
  { prop: '__radio', label: '', type: 'radio', width: 50 },
  // ...
]" row-key="id" :request-api="api" />

proTableRef.value?.clearSelection() // B1：UI + 镜像双清`

const selectionCode = `// vxe 引擎 selection 多选列（本页勾选）
<ProTable table-engine="vxe-table" :columns="[
  { prop: '__selection', label: '', type: 'selection', width: 45 },
  // ...
]" row-key="id" :request-api="api" />`

const reserveCode = `// vxe 引擎 reserveSelection 跨页多选（v3.1 一等字段）
<ProTable table-engine="vxe-table" :columns="[
  { prop: '__selection', label: '', type: 'selection', width: 45, reserveSelection: true },
  // ...
]" row-key="id" :request-api="api" />

// B1：reserve 跨页镜像 = getCheckboxRecords（当前页）+ getCheckboxReserveRecords（跨页保留）合并回同步`

// 三表行为对照的代码展示（behaviorCode 为对照表本身，无需代码——占位说明）
const behaviorCode = `// 三种行选择的翻页行为差异是「列类型 + 配置」决定的：
{ type: 'radio' }                              // 单选：翻页保持（统一选中区 + radio-config.reserve）
{ type: 'selection' }                          // 多选本页：翻页清选区（设计行为，对齐 el 引擎）
{ type: 'selection', reserveSelection: true }  // 多选跨页：翻页累计保持（v3.1 一等字段）`

const tocItems = [
  { id: 'demo-behavior-map', label: '翻页行为对照表' },
  { id: 'demo-vxe-radio', label: '① radio 单选（翻页保持）' },
  { id: 'demo-vxe-selection', label: '② selection 多选（翻页清选区）' },
  { id: 'demo-vxe-reserve', label: '③ reserveSelection 跨页累计' },
  { id: 'api-vxe-selection', label: 'vxe 引擎 clearSelection 双通道' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableVxeRowSelect vxe 引擎行选择（radio / selection / 跨页多选）"
    source="src/components/ProTable/components/VxeTableBody.vue"
    :introductions="[
      'table-engine=\'vxe-table\'：radio/selection 列由 vxe-table 内置列类型渲染，选中收敛统一选中区。',
      'B1 修复点：clearSelection 同时清 vxe UI 勾选（clearCheckboxRow/clearRadioRow）与本地镜像。',
      'reserveSelection 跨页：翻页勾选保留，读取时经 getCheckboxRecords() 回同步全量镜像。',
    ]"
  >
    <section :class="bem.b()">
      <!-- 三表行为对照：先明确预期，再逐个验证 -->
      <DemoField id="demo-behavior-map" label="三种行选择的翻页行为对照" :code="behaviorCode">
        <table :class="bem.e('compare')">
          <thead>
            <tr>
              <th>表</th>
              <th>列类型</th>
              <th>翻页后选区</th>
              <th>机制</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>① radio 单选</td>
              <td><code>type: 'radio'</code></td>
              <td>✅ 保持</td>
              <td>选中收敛统一选中区；vxe 经 radio-config.reserve 按 keyField 恢复 UI</td>
            </tr>
            <tr>
              <td>② selection 多选</td>
              <td><code>type: 'selection'</code></td>
              <td>❌ 清空（设计行为）</td>
              <td>与 el 引擎非 reserve 一致：翻页清选区，防跨页误批量操作</td>
            </tr>
            <tr>
              <td>③ selection + reserveSelection</td>
              <td><code>type: 'selection', reserveSelection: true</code></td>
              <td>✅ 跨页累计</td>
              <td>v3.1 一等字段 → vxe checkbox-config.reserve，跨页累计勾选</td>
            </tr>
          </tbody>
        </table>
        <p :class="bem.e('hint')">
          注意：② 翻页清空选区是
          <strong>设计行为</strong>
          （与 el 引擎一致），不是 bug。需要跨页保持请用 ③ 的 reserveSelection。
        </p>
      </DemoField>

      <DemoField id="demo-vxe-radio" label="① vxe radio 单选列（翻页保持）" :code="radioCode">
        <p :class="bem.e('hint')">
          验证：① 点单选圆点选中一行 ②
          <strong>翻到第 2 页再翻回</strong>
          → 圆点仍在（跨页保持）③ 「读取 radio 选中」提示单行 ④
          「清除选中」后圆点消失（B1：UI+镜像双清）
        </p>
        <div :class="bem.e('actions')">
          <ElButton type="primary" size="small" @click="handleGetRadio">读取 radio 选中</ElButton>
          <ElButton size="small" @click="handleClear(radioRef, 'radio')">清除选中</ElButton>
        </div>
        <ProTable
          ref="radioRef"
          table-engine="vxe-table"
          :columns="vxeRadioColumns"
          :request-api="projectRequestApi"
          table-key="demo-vxe-radio"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-vxe-selection"
        label="② vxe selection 多选（本页，翻页清选区）"
        :code="selectionCode"
      >
        <p :class="bem.e('hint')">
          验证：勾选 2 行 → 「读取勾选」提示 2 行 → 「清除选中」后 checkbox 全部清空。
          翻页会清空选区（设计行为，见上方对照表）——跨页保持请用下方 reserveSelection 表。
        </p>
        <div :class="bem.e('actions')">
          <ElButton type="primary" size="small" @click="handleGetSelection">读取勾选</ElButton>
          <ElButton size="small" @click="handleClear(selectionRef, 'selection')">清除选中</ElButton>
        </div>
        <ProTable
          ref="selectionRef"
          table-engine="vxe-table"
          :columns="vxeSelectionColumns"
          :request-api="projectRequestApi"
          table-key="demo-vxe-selection"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-vxe-reserve"
        label="③ vxe reserveSelection 跨页多选（B1 核心验证）"
        :code="reserveCode"
      >
        <p :class="bem.e('hint')">
          验证：第 1 页勾 2 行 → 翻第 2 页勾 1 行 → 「读取跨页勾选」累计 3 行 → 翻回第 1
          页勾选保留（镜像回同步）→ 「清除选中」全部清空
        </p>
        <div :class="bem.e('actions')">
          <ElButton type="primary" size="small" @click="handleGetReserve">读取跨页勾选</ElButton>
          <ElButton size="small" @click="handleClear(reserveRef, 'reserve')">清除选中</ElButton>
        </div>
        <ProTable
          ref="reserveRef"
          table-engine="vxe-table"
          :columns="vxeReserveColumns"
          :request-api="projectRequestApi"
          table-key="demo-vxe-reserve"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable
      title="radio 单选列字段（v3.1）"
      :items="radioColumnItems"
      anchor="api-radio-column"
    />
    <ApiTable
      title="reserveSelection 字段（v3.1）"
      :items="reserveSelectionColumnItems"
      anchor="api-reserve-selection"
    />
    <ApiTable
      title="vxe 引擎 clearSelection 双通道（B1）"
      :items="vxeSelectionItems"
      anchor="api-vxe-selection"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-vxe-row-select {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  // 三表行为对照表
  &__compare {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 12px;

    th,
    td {
      padding: 8px 12px;
      border: 1px solid var(--el-border-color-lighter);
      text-align: left;
      line-height: 1.6;
    }

    th {
      background: var(--el-fill-color-lighter);
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    code {
      font-family: var(--el-font-family-monospace, monospace);
      font-size: 12px;
      background: var(--el-fill-color);
      padding: 1px 5px;
      border-radius: 3px;
    }
  }
}
</style>
