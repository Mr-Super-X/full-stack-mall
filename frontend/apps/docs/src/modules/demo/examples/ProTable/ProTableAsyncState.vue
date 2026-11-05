<script setup lang="ts">
/**
 * ProTable 三态实战 demo —— loading / empty / error 显式处理
 *
 * 演示能力：
 * - loading：request-api 内 setTimeout 模拟慢响应，ProTable 内置 v-loading 覆盖
 * - empty：返回 list:[] + total:0，ProTable 内置 ElEmpty 占位（图标 + 文案 + 重置按钮）
 * - error：request-api throw Error，ProTable 内置错误提示 + 通过 expose.refresh() retry
 *
 * 为什么不在 19 个 ProTable demo 内塞：
 * 实际项目里每个表格都自带异步数据，loading/empty/error 才是常态——
 * 上层不显式处理就会出「表格永远白屏」「失败时无任何反馈」。
 * 该 demo 把 useRequest / AsyncState 三态契约具象化，便于对照学习。
 *
 * 验证步骤：
 * 1. 点「正常」→ 5 行 mock 数据展示
 * 2. 点「loading」→ 表格显示 v-loading 圈 2.5s 后展示数据
 * 3. 点「空数据」→ 表格渲染 ElEmpty 占位（图标 + 文案 + 重置按钮）
 * 4. 点「出错」→ 表格显示错误占位，点「手动重试」调用 refresh() 恢复
 *
 * 路由：自动注册为 /demo/pro-table-async-state
 */
import { ElButton, ElMessage } from 'element-plus'
import type {
  ProColumn,
  ProTableExpose,
  ProTableResponse,
} from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-pro-table-async-state')

/** 4 种场景的枚举 —— UI 按钮 + 模拟 request-api 分支 */
type Scenario = 'normal' | 'loading' | 'empty' | 'error'
const scenario = ref<Scenario>('normal')
const tableRef = ref<ProTableExpose | null>(null)

interface MockRow {
  id: number
  title: string
  amount: number
  done: boolean
}

const columns: ProColumn<MockRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 130, formatter: 'amount' },
  { prop: 'done', label: '完成', width: 90, formatter: 'boolTag' },
]

/**
 * 根据当前 scenario 返回不同结果。
 * - normal/loading：返回 5 行数据
 * - loading：额外 setTimeout 让 v-loading 圈可被肉眼看到
 * - empty：返回空数组
 * - error：抛错触发 ProTable 错误态
 *
 * 返回值必须严格匹配 ProTableResponse<T> 平铺结构：{ data: T[], total, pageNum, pageSize }。
 * 这里的 params 是 ProTable 注入的搜索/分页参数（实际场景可读 pageNum/pageSize 做服务端分页）。
 */
async function mockRequestApi(params: Record<string, unknown>): Promise<ProTableResponse<MockRow>> {
  const pageNum = Number(params.pageNum ?? 1)
  const pageSize = Number(params.pageSize ?? 5)

  if (scenario.value === 'loading') {
    await new Promise<void>((r) => setTimeout(r, 2500))
  } else {
    await new Promise<void>((r) => setTimeout(r, 200))
  }

  if (scenario.value === 'empty') {
    return { data: [], total: 0, pageNum, pageSize }
  }
  if (scenario.value === 'error') {
    throw new Error('模拟服务端 500：mock failed')
  }

  const allRows: MockRow[] = [
    { id: 1, title: '订单系统重构', amount: 128000, done: true },
    { id: 2, title: '供应链中台', amount: 86000, done: false },
    { id: 3, title: '数据分析平台', amount: 245000, done: true },
    { id: 4, title: '移动端 H5', amount: 32000, done: false },
    { id: 5, title: '权限中心', amount: 68000, done: true },
  ]
  return { data: allRows, total: allRows.length, pageNum, pageSize }
}

/**
 * 切换场景并立即触发 refresh()。
 * 不调用 refresh() 则需等待用户手动搜索/翻页才生效，演示不闭环。
 */
function switchScenario(next: Scenario): void {
  scenario.value = next
  ElMessage.info(`已切换到「${SCENARIO_LABEL[next]}」`)
  void tableRef.value?.refresh()
}

function handleRetry(): void {
  scenario.value = 'normal'
  void tableRef.value?.refresh()
}

const SCENARIO_LABEL: Record<Scenario, string> = {
  normal: '正常',
  loading: '慢响应',
  empty: '空数据',
  error: '服务端失败',
}

const scenarioCode = `// 三态切换 = 控制 request-api 函数返回值/抛错
type Scenario = 'normal' | 'loading' | 'empty' | 'error'
const scenario = ref<Scenario>('normal')
const tableRef = ref<ProTableExpose | null>(null)

// 返回值严格匹配 ProTableResponse<T> 平铺结构：{ data: T[], total, pageNum, pageSize }
async function mockRequestApi(
  params: Record<string, unknown>
): Promise<ProTableResponse<MockRow>> {
  if (scenario.value === 'loading') await sleep(2500) // 让 v-loading 可被肉眼看到
  if (scenario.value === 'empty')    return { data: [], total: 0, pageNum: 1, pageSize: 5 }
  if (scenario.value === 'error')    throw new Error('mock 500')
  return { data: [...5 行 mock...], total: 5, pageNum: 1, pageSize: 5 }
}

// 切换后必须 refresh()，否则要等用户翻页/搜索才生效
function switchScenario(next: Scenario) {
  scenario.value = next
  void tableRef.value?.refresh()
}

// 重试：暴露的 refresh() 等价于「重新执行当前搜索条件」
function handleRetry() {
  scenario.value = 'normal'
  void tableRef.value?.refresh()
}`

const tocItems = [
  { id: 'demo-scenario-switcher', label: '四场景切换面板' },
  { id: 'api-pro-table-expose-refresh', label: 'refresh() 重试语义' },
]

useDocToc(tocItems)

const refreshApiItems = [
  {
    name: 'refresh',
    type: '() => Promise<void>',
    description: '重新执行当前搜索条件（搜索参数不变）；可用于外部 retry 触发',
  },
  {
    name: 'reset',
    type: '() => Promise<void>',
    description: '重置搜索参数到 defaultValue + 清空分页 + 刷新',
  },
  {
    name: 'getSearchParams',
    type: '() => Record<string, unknown>',
    description: '当前搜索参数（响应式 read-only snapshot）',
  },
]
</script>

<template>
  <DemoFrame
    title="ProTableAsyncState 三态实战（loading / empty / error）"
    source="src/components/ProTable"
    :introductions="[
      '三态 = 异步数据的常态：loading（请求中）、empty（无数据）、error（请求失败）。',
      'ProTable 内置三态 UI（v-loading / ElEmpty / 错误占位），request-api 控制分支即可。',
      '错误态可点「手动重试」调用 expose.refresh() 重新执行当前搜索条件。',
    ]"
  >
    <section id="demo-scenario-switcher" :class="bem.b()">
      <DemoField label="四场景切换面板" :code="scenarioCode">
        <p :class="bem.e('hint')">
          验证：① 点「正常」→ 5 行 mock 数据展示 ② 点「慢响应」→ 表格 v-loading 圈 2.5s ③
          点「空数据」→ ElEmpty 占位 ④ 点「服务端失败」→ 错误占位 + 「手动重试」按钮调
          <code>refresh()</code>
        </p>
        <div :class="bem.e('toolbar')">
          <ElButton
            v-for="key in ['normal', 'loading', 'empty', 'error'] as const"
            :key="key"
            size="small"
            :type="scenario === key ? 'primary' : 'default'"
            @click="switchScenario(key)"
          >
            {{ SCENARIO_LABEL[key] }}
          </ElButton>
          <span :class="bem.e('scenario-label')">当前：{{ SCENARIO_LABEL[scenario] }}</span>
        </div>
        <ProTable
          ref="tableRef"
          :columns="columns"
          :request-api="mockRequestApi"
          table-key="demo-async-state"
          row-key="id"
          :page-size="5"
          :show-retry-button="true"
          @retry="handleRetry"
        />
      </DemoField>
    </section>

    <ApiTable
      title="ProTableExpose 重试相关 API"
      :items="refreshApiItems"
      anchor="api-pro-table-expose-refresh"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-async-state {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);

    code {
      padding: 1px 6px;
      margin: 0 2px;
      font-size: 12px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
    }
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  &__scenario-label {
    margin-left: auto;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
