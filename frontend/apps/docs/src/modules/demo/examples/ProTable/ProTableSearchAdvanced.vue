<script setup lang="ts">
/**
 * ProTable SearchForm 高级搜索 demo
 *
 * 演示 5 项架构升级能力（应对中后台 5-30 个查询条件场景）：
 * 1) 默认折叠：主表单默认展示前 3 个字段，其余收纳到「展开」后
 * 2) 高级筛选弹窗：level: 'advanced' 字段进 ElDialog + ElBadge 角标显示已选数量
 * 3) searchDisplay 联动：订单状态 = 已退款/已发货 时联动显示「退款原因」/「发货日期」
 * 4) 字段级防抖：orderNo 配置 debounce: 300，输入即自动搜索（其他字段维持默认行为）
 * 5) 响应式栅格：el-col xs/sm/md/lg 断点 —— 移动 1 列 / 平板 2 列 / 桌面 4-6 列
 *
 * 验证步骤：
 * ① 主表单默认折叠看 orderNo/userName/status/region 4 个字段
 * ② 点「展开」按钮 → 看到全部 4 个 basic 字段（其他 6 个在高级弹窗）
 * ③ 点「高级」按钮 → 看到金额/类目/退款原因/发货日期/评分/备注 6 个字段
 * ④ 在订单号输入「ORD-0001」+ 等 300ms → 自动触发搜索（防抖）
 * ⑤ 订单状态下拉选「已退款」→ 高级弹窗内「退款原因」自动出现
 * ⑥ 选「已发货」→ 「退款原因」消失，「发货日期」出现
 *
 * 路由：自动注册为 /demo/pro-table-search-advanced
 */
import { ElMessage } from 'element-plus'
import type { ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  orderRequestApi,
  advancedSearchColumns,
  advancedSearchDisplay,
  flatModeColumns,
  collapseModeColumns,
  flatLargeModeColumns,
} from './configs/protable-advanced-search-api'

const bem = createNamespace('demo-pro-table-search-advanced')

// 注：ProColumn 类型在 v3.3 demo 重构中已无显式使用（各 columns 由 API 模块导出 + 类型推断），
// 仅保留 ProTable / ProTableExpose —— 表格列直接走各档位对应的 columns 常量。

const proTableRef = ref<ProTableExpose | null>(null)

/** 「重新加载 + 弹反馈」按钮 —— 验证搜索与重置 emit */
function handleReload(): void {
  proTableRef.value?.refresh()
  ElMessage.success('已触发 refresh()')
}

function handleReset(): void {
  proTableRef.value?.reset()
  ElMessage.info('已重置搜索参数到 defaultValue')
}

/** 4 个核心代码片段 —— 展示新 API
 *
 * 注意：template literal 内避免 `<Xxx />` JSX-like 写法，
 * vue-tsc 偶发会把字符串里的 `<Xxx />` 误解析为 JSX（已踩坑）。
 * 改用「注释中写出 JSX 用法」的形式展示。 */
const codeLevel = `// 新增：level 字段控制字段分层
{ prop: 'orderNo', search: { el: 'input' } }                        // 基础：主表单
{ prop: 'amount',  search: { el: 'input', level: 'advanced' } }     // 高级：弹窗`

// 用法（写在 demo 模板里）：
//   <ProTable :columns="columns" />

const codeDebounce = `// 新增：字段级防抖（仅 input 类生效）
{
  prop: 'orderNo',
  search: { el: 'input', debounce: 300 }  // 输入后 300ms 自动触发搜索
}`

const codeDisplay = `// 新增：searchDisplay 联动显隐
function advancedSearchDisplay(params) {
  return {
    refundReason: params.status === 'refunded',  // 已退款才显示
    deliveryDate: params.status === 'shipped',   // 已发货才显示
  }
}

// 用法（写在 demo 模板里）：
//   <ProTable :search-display="advancedSearchDisplay" />`

const codeColumns = `// 完整 columns —— 4 个 basic + 6 个 advanced + 2 个联动
const columns = [
  { prop: 'orderNo',   search: { el: 'input', debounce: 300 } },     // 防抖
  { prop: 'userName',  search: { el: 'input' } },                   // 默认
  { prop: 'status',    enum: [...], search: { el: 'select' } },     // 触发联动
  { prop: 'region',    enum: [...], search: { el: 'select', level: 'basic' } },
  { prop: 'amount',    search: { el: 'input', level: 'advanced' } },
  { prop: 'category',  enum: [...], search: { el: 'select', level: 'advanced' } },
  { prop: 'refundReason', enum: [...], search: { el: 'select', level: 'advanced' } }, // 联动
  { prop: 'deliveryDate', search: { el: 'date-picker', level: 'advanced' } },          // 联动
  { prop: 'rating',    search: { el: 'input-number', level: 'advanced' } },
  { prop: 'remark',    search: { el: 'input', level: 'advanced' } },
]`

const codeFlatColumns = `// v3.3 flat 档 —— 3 个 basic，无 advanced
// 触发条件：basic.length <= 3（且无 advanced 字段）
// 主表单全部平铺，**没有任何按钮**（无展开/收起、无高级筛选）
const columns = [
  { prop: 'orderNo',  search: { el: 'input' } },
  { prop: 'userName', search: { el: 'input' } },
  { prop: 'status',   enum: STATUS_ENUM, search: { el: 'select' } },
]`

const codeCollapseColumns = `// v3.3 collapse 档 —— 6 个 basic，无 advanced
// 触发条件：basic.length > 3 且 <= 8（且无 advanced 字段）
// 默认折叠显示前 3 个，点「展开」按钮显示全部 6 个
const columns = [
  { prop: 'orderNo',  search: { el: 'input' } },
  { prop: 'userName', search: { el: 'input' } },
  { prop: 'status',   enum: STATUS_ENUM, search: { el: 'select' } },
  { prop: 'region',   enum: REGION_ENUM, search: { el: 'select' } },
  { prop: 'amount',   search: { el: 'input' } },
  { prop: 'category', enum: CATEGORY_ENUM, search: { el: 'select' } },
]`

const codeFlatLargeColumns = `// v3.3 flat-large 档 —— 10 个 basic，无 advanced
// 触发条件：basic.length > 8（且无 advanced 字段）
// 全部 10 个字段 inline 平铺，**没有任何按钮**
// （展开 8+ 字段会严重摧毁表格可视高度，故不允许折叠）
const columns = [
  { prop: 'orderNo',       search: { el: 'input' } },
  { prop: 'userName',      search: { el: 'input' } },
  { prop: 'status',        enum: STATUS_ENUM, search: { el: 'select' } },
  { prop: 'region',        enum: REGION_ENUM, search: { el: 'select' } },
  { prop: 'amount',        search: { el: 'input' } },
  { prop: 'category',      enum: CATEGORY_ENUM, search: { el: 'select' } },
  { prop: 'minAmount',     search: { el: 'input-number' } },
  { prop: 'maxAmount',     search: { el: 'input-number' } },
  { prop: 'deliveryDate',  search: { el: 'date-picker' } },
  { prop: 'refundReason',  enum: REFUND_REASON_ENUM, search: { el: 'select' } },
]`

const responsiveCode = `// 模板层响应式栅格（SearchForm 内部已实现）
<ElCol
  v-for="col in mainFormColumns"
  :key="col.prop"
  :xs="24"   // < 480px：整行
  :sm="12"   // 480-768px：半行
  :md="col.search?.span ?? 8"  // 768-1200px
  :lg="col.search?.span ?? 6"  // ≥ 1200px
  :xl="col.search?.span ?? 6"
>
  ...
</ElCol>`

const searchLayoutCode = `// v3.4 searchLayout —— 布局档位下放业务方（缺省 'auto' 按字段数自动判定）
<ProTable :columns="columns" :request-api="api" search-layout="flat" />
// 6 个 basic 字段自动判定本应是 collapse（折叠），强制 flat 后全部平铺、无展开按钮。
// 典型场景：
// - 宽屏页面想平铺更多字段（字段数 ≠ 页面空间需求）
// - searchDisplay 联动使字段数动态变化 → 锁定档位避免按钮时有时无的布局抖动
// 注意：存在 search.level='advanced' 字段时永远走 drawer（advanced 字段必须可达）`

const tocItems = [
  // v3.3 新增：4 档布局矩阵
  { id: 'demo-mode-flat', label: 'flat 档（≤ 3 basic）' },
  { id: 'demo-mode-collapse', label: 'collapse 档（5-8 basic）' },
  { id: 'demo-mode-flat-large', label: 'flat-large 档（> 8 basic）' },
  { id: 'demo-mode-drawer', label: 'drawer 档（存在 advanced）' },
  // v3.2 既有能力（在 drawer 档下展示）
  { id: 'demo-default-collapsed', label: 'drawer 档 · 默认折叠 + 展开按钮' },
  { id: 'demo-advanced-dialog', label: 'drawer 档 · 高级筛选弹窗 + 角标' },
  { id: 'demo-debounce', label: 'drawer 档 · 字段级防抖（输入即搜索）' },
  { id: 'demo-display', label: 'drawer 档 · searchDisplay 联动显隐' },
  { id: 'demo-responsive', label: 'drawer 档 · 响应式栅格' },
  // v3.4 新增：布局档位下放
  { id: 'demo-search-layout', label: 'v3.4 · searchLayout 强制档位' },
  { id: 'api-search-config', label: 'SearchConfig 字段' },
  { id: 'api-protable-props', label: 'ProTable.Props 新字段' },
]

useDocToc(tocItems)

/* API 表格数据 */
const searchConfigItems = [
  {
    name: 'level',
    type: "'basic' | 'advanced'",
    required: false,
    default: "'basic'",
    description: '字段层级。basic 进主表单（受折叠约束），advanced 进「高级筛选」弹窗。',
  },
  {
    name: 'debounce',
    type: 'number',
    required: false,
    default: '0',
    description: 'input 类控件防抖延迟（毫秒）。>0 时输入自动触发搜索。',
  },
  {
    name: 'el',
    type: 'SearchElType',
    required: true,
    description:
      '渲染的 EP 控件类型（input/select/date-picker/tree-select/cascader/input-number）。',
  },
  {
    name: 'enum',
    type: 'EnumProps[]',
    required: false,
    description: 'select 控件的字典项。',
  },
  {
    name: 'span',
    type: 'number',
    required: false,
    default: '6',
    description: 'el-col 占位（响应式断点下的基准 span）。',
  },
  {
    name: 'defaultValue',
    type: 'unknown',
    required: false,
    description: 'reset 时恢复的初始默认值。',
  },
]

const proTablePropsItems = [
  {
    name: 'searchDisplay',
    type: '(params) => Record<string, boolean>',
    required: false,
    description: '搜索字段联动显隐。返回 false 隐藏字段（不进入主表单也不进入弹窗）。',
  },
]
</script>

<template>
  <DemoFrame
    title="ProTableSearchAdvanced 多条件搜索（v3.3 4 档自适应 + v3.2 高级特性）"
    source="src/components/ProTable/components/SearchForm.vue"
    :introductions="[
      'v3.3 重大升级：SearchForm 按 basic 字段数 + advanced 字段数自动选 4 档布局（flat / collapse / flat-large / drawer），对开发者透明。',
      '前 4 个 demo（①-④）演示 4 档矩阵的差异；后 5 个 demo（⑤-⑨）演示 v3.2 在 drawer 档下的进阶能力。',
    ]"
  >
    <section :class="bem.b()">
      <!--
          ─────────── v3.3 新增：4 档布局矩阵 ───────────
          每个 demo 独立 tableKey，互不影响展开状态持久化。
          共享同一份 orderRequestApi mock（50 行订单数据）。
        -->

      <DemoField
        id="demo-mode-flat"
        label="① flat 档：3 个 basic + 无 advanced —— 全部平铺、无任何按钮"
        :code="codeFlatColumns"
      >
        <p :class="bem.e('hint')">
          验证：① 主表单直接显示 orderNo / userName / status 共 3 个字段 ②
          右侧只有「搜索」「重置」两个按钮，**没有「展开/收起」也没有「高级筛选」** ③
          触发条件：basic ≤ 3（且无 advanced 字段）
        </p>
        <ProTable
          :columns="flatModeColumns"
          :request-api="orderRequestApi"
          table-key="demo-mode-flat"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-mode-collapse"
        label="② collapse 档：6 个 basic + 无 advanced —— 展开/收起按钮"
        :code="codeCollapseColumns"
      >
        <p :class="bem.e('hint')">
          验证：① 默认折叠显示前 3 个字段（orderNo / userName / status） ② 点击「展开」按钮显示全部
          6 个字段 ③ 右侧有「展开/收起」按钮，**没有「高级筛选」** ④ 触发条件：basic > 3 且
          {{ '<= 8' }}（且无 advanced 字段）
        </p>
        <ProTable
          :columns="collapseModeColumns"
          :request-api="orderRequestApi"
          table-key="demo-mode-collapse"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-mode-flat-large"
        label="③ flat-large 档：10 个 basic + 无 advanced —— 全部平铺、无折叠按钮"
        :code="codeFlatLargeColumns"
      >
        <p :class="bem.e('hint')">
          验证：① 全部 10 个字段全部 inline 平铺展示（不折叠） ②
          右侧只有「搜索」「重置」，**没有「展开/收起」也没有「高级筛选」** ③ 触发条件：basic >
          8（且无 advanced 字段）—— 因为展开 8+ 字段会严重摧毁表格可视高度
        </p>
        <ProTable
          :columns="flatLargeModeColumns"
          :request-api="orderRequestApi"
          table-key="demo-mode-flat-large"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-mode-drawer"
        label="④ drawer 档：8 basic + 5 advanced —— basic inline 平铺 + 抽屉装 advanced"
        :code="codeColumns"
      >
        <p :class="bem.e('hint')">
          验证：① 主表单展示 8 个 basic 字段全部平铺（不折叠） ②
          右侧有「高级筛选」按钮（**没有「展开/收起」** —— 抽屉与折叠互斥） ③
          点「高级筛选」打开抽屉，里面是 5 个 advanced 字段 ④ 触发条件：任一字段的 search.level ===
          'advanced'
        </p>
        <ProTable
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-mode-drawer"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <!--
          ─────────── v3.2 既有能力（drawer 档下展示）────────────
          以下 5 个 demo 都用 drawer 档，复用 advancedSearchColumns / advancedSearchDisplay。
          共享同一份 13 字段 columns，差异在交互能力（默认折叠 / 抽屉 / 防抖 / 联动 / 响应式）。
        -->
      <DemoField
        id="demo-default-collapsed"
        label="⑤ drawer 档 · 默认折叠 + 展开按钮（主表单只展示前 4 个字段）"
        :code="codeColumns"
      >
        <p :class="bem.e('hint')">
          验证：① drawer 档下，basic 字段默认**全部展开**（不再受折叠约束，因为有抽屉分流高级字段）
          ② 8 个 basic 字段全部展示 ③ 5 个 advanced 字段藏在「高级筛选」抽屉里
        </p>
        <div :class="bem.e('actions')">
          <ElButton size="small" @click="handleReload">重新加载（refresh）</ElButton>
          <ElButton size="small" type="danger" plain @click="handleReset">重置（reset）</ElButton>
        </div>
        <ProTable
          ref="proTableRef"
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-advanced-search"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-advanced-dialog"
        label="⑥ drawer 档 · 高级筛选弹窗 + 已选数量角标"
        :code="codeLevel"
      >
        <p :class="bem.e('hint')">
          验证：① 主表单右上角有「高级」按钮（因为有 6 个 advanced 字段）② 点击后弹窗出现 6 个
          advanced 字段 ③ 在弹窗设置值后，关闭时主表单按钮上「角标」会显示已选数量 ④
          「应用」按钮触发搜索 + 关闭弹窗；「清空」清空所有 advanced；「取消」不丢当前值
        </p>
        <ProTable
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-advanced-advanced"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-debounce"
        label="⑦ drawer 档 · 字段级防抖：orderNo 输入即自动搜索（300ms）"
        :code="codeDebounce"
      >
        <p :class="bem.e('hint')">
          验证：① 在「订单号」输入框连续敲字符（如「O」「OR」「ORD」），观察网络请求（500ms 延迟） ②
          防抖后只有 1 次请求（最后一次停顿 300ms 后触发）③ 而 userName（无
          debounce）输入不触发搜索，需按回车或点搜索按钮
        </p>
        <ProTable
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-advanced-debounce"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-display"
        label="⑧ drawer 档 · searchDisplay 联动显隐：状态 = 已退款时显示「退款原因」"
        :code="codeDisplay"
      >
        <p :class="bem.e('hint')">
          验证：① 默认「订单状态」为空 → 「退款原因」「发货日期」都隐藏（不在主表单也不在弹窗） ②
          选「已退款」 → 弹窗内「退款原因」自动出现 ③ 选「已发货」 →
          「退款原因」消失，「发货日期」出现
        </p>
        <ProTable
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-advanced-display"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-responsive"
        label="⑨ drawer 档 · 响应式栅格：缩放浏览器看效果"
        :code="responsiveCode"
      >
        <p :class="bem.e('hint')">
          验证：① 浏览器窗口 ≥ 1200px（xl）→ 每个字段 1/4 屏宽 ② 768-1200px（md）→ 1/3 屏宽 ③
          480-768px（sm）→ 1/2 屏宽 ④ {{ '< 480px' }}（xs）→ 整行（移动端 1 列） ⑤ 控制台会看到
          el-col 响应式 class（el-col-xs-24 / el-col-sm-12 / el-col-md-8 / el-col-lg-6）
        </p>
        <ProTable
          :columns="advancedSearchColumns"
          :request-api="orderRequestApi"
          :search-display="advancedSearchDisplay"
          table-key="demo-advanced-responsive"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-search-layout"
        label="⑩ v3.4 searchLayout：6 basic 强制 flat 档（自动判定本应是 collapse）"
        :code="searchLayoutCode"
      >
        <p :class="bem.e('hint')">
          验证：① 与 ② 号 demo 同样的 6 个 basic 字段，加 search-layout="flat" 后强制平铺 ②
          右侧**没有「展开/收起」按钮**，6 个字段全部直接可见（对照 ② 号 demo 默认折叠为前 3） ③
          自动判定规则被显式配置覆盖 —— 字段数与页面空间需求不匹配时的下放手段
        </p>
        <ProTable
          :columns="collapseModeColumns"
          :request-api="orderRequestApi"
          table-key="demo-search-layout"
          row-key="id"
          search-layout="flat"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable title="SearchConfig 新增字段" :items="searchConfigItems" anchor="api-search-config" />
    <ApiTable
      title="ProTable.Props 新增字段"
      :items="proTablePropsItems"
      anchor="api-protable-props"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-search-advanced {
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
}
</style>
