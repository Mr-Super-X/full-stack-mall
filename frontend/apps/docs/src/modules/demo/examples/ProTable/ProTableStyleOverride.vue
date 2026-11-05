<script setup lang="tsx">
/**
 * ProTable 样式定制 demo —— 用户提出的真实痛点 #1
 *
 * 演示 6 个业务高频样式定制场景 + 1 个可覆盖钩子清单：
 * ① 行条件样式：VIP 行蓝色左边条 / 清仓行黄色左边条 / 停售行半透明
 * ② 单元格条件样式：高客单（>=10000）金色背景 / 缺货（stock=0）红字 / 最近 3 天绿色
 * ③ 列对齐 + 数字格式化：金额右对齐 + 千分位（toLocaleString）
 * ④ 自定义表头：headerRender + el-tooltip + icon 提示
 * ⑤ 固定列组合：左侧固定名称 + 右侧固定操作（同时启用）
 * ⑥ 主题色覆盖：通过 CSS 变量驱动 el-color-primary（演示如何「换肤」）
 * ⑦ 可覆盖钩子清单：按「选择器稳定性三档」列出可覆写 EP CSS 变量（高/中/低）
 *
 * 场景 ①②③④⑤ 在同一张大 ProTable 中一并演示（避免 5 个独立 ProTable 5 倍 mock 数据），
 * 详见 tocItems 注释 + section 拆分。
 *
 * 技术要点：
 * - 行条件样式不走 rowClassName 透传（ProTable 未暴露该接口），改用「在 render VNode 上
 *   注入 className + CSS :has() 反向命中整行」——0 侵入、纯声明式扩展
 * - 列对齐 / sortable 通过 ProColumn.tableProps 透传 ElTableColumn props
 * - 主题覆盖通过 BEM 嵌套 .vv-pro-table 选择器 + CSS 变量
 */
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import { styleOverrideRequestApi, type StyleOverrideProduct } from '@mock/pro-table/style-override'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { styleOverrideItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-style-override')

/* ───────────── 工具函数 ───────────── */

const STATUS_TYPE_MAP = {
  在售: 'success',
  停售: 'info',
  清仓: 'warning',
} as const

/** 千分位格式化（zh-CN 习惯） */
function formatPrice(n: number): string {
  return n.toLocaleString('zh-CN')
}

const isHighPrice = (n: number): boolean => n >= 10000
const isOutOfStock = (n: number): boolean => n === 0

/** ISO → 简短的「MM-DD」 */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

/** 「距今 3 天内」标记为最近更新 */
function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 1000 * 60 * 60 * 24 * 3
}

/* ───────────── 列定义（涵盖 6 个场景） ───────────── */

const columns: ProColumn[] = [
  // ⑤ 固定列 - 左侧固定商品名称 + ④ 自定义表头 + ① VIP 行锚点
  {
    prop: 'name',
    label: '商品名称',
    minWidth: 180,
    fixed: 'left',
    search: { el: 'input', defaultValue: '' },
    /** ① VIP 行锚点：isVip=true 时在商品名后追加 VIP 徽标
     *  —— 外层 CSS :has(.vip-badge) 反向命中整行 → 蓝色左边条 + 淡蓝背景 */
    render: ({ row }) => {
      const name = String(row.name)
      if (row.isVip) {
        return (
          <span>
            {name}
            <span class={bem.e('vip-badge')}>VIP</span>
          </span>
        )
      }
      return <span>{name}</span>
    },
    /** ④ headerRender：表头嵌入 icon + tooltip 提示 */
    headerRender: () => (
      <el-tooltip content="输入商品名关键字模糊搜索" placement="top">
        <span class={bem.e('header-info')}>
          商品名称
          <el-icon style={{ marginLeft: '4px', color: 'var(--el-color-primary)' }}>
            <InfoFilled />
          </el-icon>
        </span>
      </el-tooltip>
    ),
  },
  // ② 单元格 enum + 居中对齐（演示 tableProps.align）
  {
    prop: 'category',
    label: '分类',
    width: 110,
    tableProps: { align: 'center' },
    enum: [
      { label: '手机数码', value: '手机数码', tagType: 'primary' },
      { label: '电脑办公', value: '电脑办公', tagType: 'success' },
      { label: '智能穿戴', value: '智能穿戴', tagType: 'warning' },
      { label: '智能家居', value: '智能家居', tagType: 'info' },
      { label: '影音娱乐', value: '影音娱乐', tagType: 'danger' },
    ],
  },
  // ② 单元格条件样式：库存 = 0 红字「缺货」
  {
    prop: 'stock',
    label: '库存',
    width: 110,
    tableProps: { align: 'right', sortable: true },
    render: ({ row }) => {
      const stock = Number(row.stock)
      if (isOutOfStock(stock)) {
        return <span class={bem.e('out-of-stock')}>{stock}（缺货）</span>
      }
      return <span>{stock}</span>
    },
  },
  // ② 单元格条件样式：高客单金色背景 + 千分位
  {
    prop: 'price',
    label: '价格（元）',
    width: 140,
    tableProps: { align: 'right', sortable: true },
    render: ({ row }) => {
      const price = Number(row.price)
      const formatted = formatPrice(price)
      if (isHighPrice(price)) {
        return <span class={bem.e('high-price')}>¥ {formatted}</span>
      }
      return <span>¥ {formatted}</span>
    },
  },
  // ① 行条件样式锚点（VIP / 清仓 / 停售）+ ② 单元格条件样式（status tag）
  // 关键技巧：通过 ElTag 的 class prop 注入 cell-tag-* 标记，外层 CSS :has() 反向命中整行
  {
    prop: 'status',
    label: '状态',
    width: 110,
    tableProps: { align: 'center' },
    render: ({ row }) => {
      const status = String(row.status)
      const type = STATUS_TYPE_MAP[status as keyof typeof STATUS_TYPE_MAP] ?? 'info'
      const cls =
        status === '停售'
          ? bem.e('tag-stopped')
          : status === '清仓'
            ? bem.e('tag-clearance')
            : bem.e('tag-on')
      return (
        <el-tag type={type} class={cls} size="small">
          {status}
        </el-tag>
      )
    },
  },
  // ② 「最近 3 天」绿色标记
  {
    prop: 'updatedAt',
    label: '更新时间',
    width: 160,
    render: ({ row }) => {
      const text = formatTime(String(row.updatedAt))
      if (isRecent(String(row.updatedAt))) {
        return <span class={bem.e('recent')}>{text}（最近更新）</span>
      }
      return <span>{text}</span>
    },
  },
  // ⑤ 固定列 - 右侧操作
  {
    prop: 'operation',
    label: '操作',
    type: 'operation',
    width: 180,
    fixed: 'right',
    render: ({ row }) => (
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
        <el-button link type="primary" size="small" onClick={() => handleView(row)}>
          查看
        </el-button>
        <el-button link type="warning" size="small" onClick={() => handleEdit(row)}>
          编辑
        </el-button>
        <el-button link type="danger" size="small" onClick={() => handleDelete(row)}>
          下架
        </el-button>
      </div>
    ),
  },
]

/* ───────────── 事件处理 ───────────── */

function handleView(row: Record<string, unknown>): void {
  ElMessage.info(`查看 ${(row as unknown as StyleOverrideProduct).name}`)
}
function handleEdit(row: Record<string, unknown>): void {
  ElMessage.warning(`编辑 ${(row as unknown as StyleOverrideProduct).name}`)
}
function handleDelete(row: Record<string, unknown>): void {
  ElMessage.error(`下架 ${(row as unknown as StyleOverrideProduct).name}`)
}

/* ───────────── 密度切换：3 个 ProTable 并排展示 ───────────── */

const densityList = [
  { key: 'compact', label: 'compact（紧凑）', desc: '行高 32px · 密集数据浏览' },
  { key: 'default', label: 'default（默认）', desc: '行高 48px · 推荐场景' },
  { key: 'loose', label: 'loose（宽松）', desc: '行高 64px · 大屏 / 触屏' },
] as const

/* ───────────── Expose API 验证（外部按钮触发 refresh） ───────────── */

const ref0 = ref<ProTableExpose | null>(null)
async function refreshAll(): Promise<void> {
  await ref0.value?.refresh()
  ElMessage.success('已手动 refresh')
}

/* ───────────── TOC 锚点 ───────────── */

// tocItems 说明：
// ①②③④⑤ 五个场景（行条件样式 / 单元格条件样式 / 列对齐+格式化 / 自定义表头 / 固定列）
// 在同一张大 ProTable 中一并演示（避免 5 个独立 ProTable 5 倍 mock 数据），
// 故 tocItems 只保留一条 demo-row-cell-styling 锚点，序号 ②③④ 在 label 内合并说明。
// 如需每场景独立表格，参见 ProTableEngineCompare（v3.5 PR1-B 重构的并行演示模式）。
const tocItems = [
  { id: 'demo-row-cell-styling', label: '① ② ③ ④ ⑤ 一表演示' },
  { id: 'demo-density-compare', label: '⑤ 密度切换对比' },
  { id: 'demo-theme-override', label: '⑥ 主题色覆盖' },
  { id: 'hook-cheatsheet', label: '可覆盖钩子清单' },
]

useDocToc(tocItems)

/* ───────────── 代码片段 ───────────── */

const basicCode = `<script setup lang="ts">
import { h } from 'vue'
import { ElTag } from 'element-plus'
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'

const columns: ProColumn[] = [
  { prop: 'name', label: '商品名称', fixed: 'left' },
  {
    prop: 'status',
    label: '状态',
    render: ({ row }) =>
      // 关键：ElTag 的 class prop 注入 cell-tag-stopped / cell-tag-clearance
      // 外层 CSS .el-table__body tr:has(.cell-tag-stopped) { ... } 反向命中整行
      h(ElTag, { type: 'info', class: 'cell-tag-stopped' }, () => row.status),
  },
]
<\/script>`

const themeCode = `/* BEM 嵌套覆盖 el-color-primary，无需 :deep（CLAUDE.md §3 禁止） */
.#{$BEM_PREFIX}-pro-table {
  --el-color-primary: #f56c6c;  /* 把主题色从蓝换成红 */
  --el-color-primary-light-3: #fab6b6;
  --el-color-primary-light-5: #fbc4c4;
  --el-color-primary-light-7: #fdd2d2;
  --el-color-primary-light-8: #fdd9d9;
  --el-color-primary-light-9: #fee5e5;
  --el-color-primary-dark-2: #c45656;
}`

const densityCode = `<ProTable density="compact" :columns="columns" :request-api="api" />
<ProTable density="default"  :columns="columns" :request-api="api" />
<ProTable density="loose"    :columns="columns" :request-api="api" />`
</script>

<template>
  <DemoFrame
    title="ProTableStyleOverride 样式定制"
    source="src/modules/demo/examples/ProTable/ProTableStyleOverride.vue"
    :introductions="[
      '业务方接 ProTable 后最常问的问题——怎么高亮某些行、怎么让金额右对齐、怎么换主题色。',
      '本 demo 覆盖 6 个高频样式定制场景：行/单元格条件样式、列对齐、自定义表头、固定列组合、密度切换、主题色覆盖。',
      '技术要点：行条件样式不走 rowClassName 透传（ProTable 未暴露），改用「在 render VNode 上注入 className + CSS :has() 反向命中整行」，0 侵入、纯声明式扩展。',
      '完整可覆盖 CSS 钩子清单见下方 #hook-cheatsheet 章节（按选择器稳定性高/中/低分档）。',
    ]"
  >
    <!-- 场景 ①②③④⑤：行/单元格条件样式 + 列对齐 + 数字格式化 + 自定义表头 + 固定列组合（一表演示） -->
    <section :id="tocItems[0]!.id" :class="bem.b()">
      <DemoField
        label="① ② ③ ④ ⑤ 一表演示：行条件样式 + 单元格条件样式 + 列对齐+数字格式化 + 自定义表头 + 固定列"
        :code="basicCode"
      >
        <p :class="bem.e('hint')">
          观察点：
          <strong>行</strong>
          —— VIP/清仓商品左边条、停售商品半透明；
          <strong>单元格</strong>
          —— 高客单金色背景、缺货红字、最近更新绿色；
          <strong>对齐</strong>
          —— 库存/价格右对齐、状态/分类居中；
          <strong>表头</strong>
          —— 名称列嵌入 info icon + tooltip；
          <strong>固定列</strong>
          —— 左右同时固定（横向滚动时名称/操作不消失）
        </p>
        <el-button type="primary" @click="refreshAll">手动 refresh 验证 Expose</el-button>
        <ProTable
          ref="ref0"
          :columns="columns"
          :request-api="styleOverrideRequestApi"
          table-key="demo-pro-table-style-override"
          row-key="id"
          :page-size="6"
        />
      </DemoField>
    </section>

    <!-- 场景 ⑤：密度切换对比（3 个 ProTable 紧邻展示差异） -->
    <section :id="tocItems[1]!.id" :class="bem.b()">
      <DemoField
        label="⑤ 密度切换对比：compact / default / loose 三档同列定义并排"
        :code="densityCode"
      >
        <div :class="bem.e('density-grid')">
          <div v-for="d in densityList" :key="d.key" :class="bem.e('density-pane')">
            <h4 :class="bem.e('density-title')">
              {{ d.label }}
              <small :class="bem.e('density-desc')">{{ d.desc }}</small>
            </h4>
            <ProTable
              :columns="columns.slice(0, 5)"
              :request-api="styleOverrideRequestApi"
              :table-key="`demo-pro-table-style-override-density-${d.key}`"
              row-key="id"
              :density="d.key"
              :page-size="4"
            />
          </div>
        </div>
      </DemoField>
    </section>

    <!-- 场景 ⑥：主题色覆盖（演示独立的作用域样式切换） -->
    <section :id="tocItems[2]!.id" :class="bem.b()">
      <DemoField label="⑥ 主题色覆盖：通过 CSS 变量驱动 el-color-primary" :code="themeCode">
        <p :class="bem.e('hint')">
          下方面包屑选择器内的 ProTable 主题色从蓝色切换为红色 —— 通过 BEM 嵌套
          <code>.#{$BEM_PREFIX}-pro-table</code>
          选择器改写 CSS 变量，无需
          <code>:deep()</code>
          （CLAUDE.md §3 禁止）。
        </p>
        <div :class="bem.e('theme-scope')">
          <ProTable
            :columns="columns.slice(0, 5)"
            :request-api="styleOverrideRequestApi"
            table-key="demo-pro-table-style-override-red"
            row-key="id"
            :page-size="5"
          />
        </div>
      </DemoField>
    </section>

    <!-- 可覆盖钩子清单（对齐 XFormStyleOverride 结构：选择器 / 作用域 / 稳定 / 适用场景） -->
    <section id="hook-cheatsheet" :class="bem.b()">
      <h2 :class="bem.e('cheatsheet-title')">可覆盖钩子清单</h2>
      <p :class="bem.e('cheatsheet-hint')">
        选择器按稳定性分三档：
        <strong>高</strong>
        = 项目自有（ProTable BEM 类名），不随第三方变动；
        <strong>中</strong>
        = Element Plus 类（el-table / el-pagination），升级 element-plus 大版本可能变动；
        <strong>低</strong>
        = Element Plus CSS 变量（--el-color-* / --el-text-*），理论上稳定但版本间可能微调。
      </p>
      <div :class="bem.e('cheatsheet-wrap')">
        <table :class="bem.e('cheatsheet-table')">
          <thead>
            <tr>
              <th>选择器 / 变量</th>
              <th>作用域</th>
              <th>稳定</th>
              <th>适用场景</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>.vv-pro-table</code></td>
              <td>ProTable 根节点</td>
              <td>高</td>
              <td>表格整体品牌化（通过 ProTable 父级 :class 锁作用域）</td>
            </tr>
            <tr>
              <td><code>.vv-pro-table__header / __body / __footer</code></td>
              <td>表头 / 表体 / 表脚容器</td>
              <td>高</td>
              <td>局部区域背景色 / 边框 / 圆角</td>
            </tr>
            <tr>
              <td><code>.vv-pro-table__toolbar / __title / __toolbar-buttons</code></td>
              <td>工具栏（标题 + 操作按钮）</td>
              <td>高</td>
              <td>工具栏对齐 / 按钮组样式</td>
            </tr>
            <tr>
              <td>
                <code>.vv-pro-table__vip-badge / __high-price / __out-of-stock / __recent</code>
              </td>
              <td>单元格条件样式标记</td>
              <td>高</td>
              <td>业务方自渲染 VNode 时注入 cell-* 标记，CSS :has() 反向命中整行</td>
            </tr>
            <tr>
              <td><code>.el-table / .el-table__inner-wrapper</code></td>
              <td>el-table 根 + 内部容器</td>
              <td>中</td>
              <td>表格整体边框 / 圆角（element-plus 升级风险）</td>
            </tr>
            <tr>
              <td><code>.el-table__header-wrapper / __header</code></td>
              <td>表头容器 + th 单元格</td>
              <td>中</td>
              <td>表头背景 / 高度 / 边框 / 字体加粗</td>
            </tr>
            <tr>
              <td><code>.el-table__body-wrapper / tr / td</code></td>
              <td>表体容器 / 行 / 单元格</td>
              <td>中</td>
              <td>行高 / 单元格 padding / 边框 / 斑马纹</td>
            </tr>
            <tr>
              <td><code>.el-table__row--striped</code></td>
              <td>斑马纹行</td>
              <td>中</td>
              <td>奇偶行差异化背景</td>
            </tr>
            <tr>
              <td><code>.el-table__row:hover / .el-table__row--current</code></td>
              <td>hover / 高亮行</td>
              <td>中</td>
              <td>交互态背景色</td>
            </tr>
            <tr>
              <td><code>.el-table__fixed / __fixed-left / __fixed-right</code></td>
              <td>固定列容器</td>
              <td>中</td>
              <td>固定列阴影 / 背景（避免与滚动内容重叠）</td>
            </tr>
            <tr>
              <td><code>.el-table__column-filter-trigger</code></td>
              <td>列筛选触发器</td>
              <td>中</td>
              <td>列筛选图标染色 / 尺寸</td>
            </tr>
            <tr>
              <td><code>.el-table__sort-icon / .sort-caret</code></td>
              <td>排序箭头</td>
              <td>中</td>
              <td>排序状态颜色 / 箭头大小</td>
            </tr>
            <tr>
              <td>
                <code>
                  .el-pagination / .el-pagination__total / __sizes / __prev / __next / __pager /
                  __jump
                </code>
              </td>
              <td>分页器 7 区块</td>
              <td>中</td>
              <td>分页器对齐 / 按钮颜色 / 输入框尺寸</td>
            </tr>
            <tr>
              <td><code>.el-empty / .el-empty__description</code></td>
              <td>空状态容器</td>
              <td>中</td>
              <td>空状态图标 / 文案 / 居中布局</td>
            </tr>
            <tr>
              <td><code>.el-loading-mask / .el-loading-spinner</code></td>
              <td>loading 遮罩</td>
              <td>中</td>
              <td>loading 背景透明度 / spinner 颜色</td>
            </tr>
            <tr>
              <td><code>--el-color-primary / light-3/5/7/8/9 / dark-2</code></td>
              <td>主色 + 浅色阶</td>
              <td>低</td>
              <td>品牌色全局覆盖（6 个色阶），影响所有 el-table / 分页器 / 按钮</td>
            </tr>
            <tr>
              <td><code>--el-color-success / warning / danger / info</code></td>
              <td>语义色</td>
              <td>低</td>
              <td>行 / 单元格条件样式的语义色（成功 / 警告 / 错误 / 中性）</td>
            </tr>
            <tr>
              <td>
                <code>--el-text-color-primary / regular / secondary / placeholder / disabled</code>
              </td>
              <td>文字层级色</td>
              <td>低</td>
              <td>文字层级、对比度、placeholder 提示色</td>
            </tr>
            <tr>
              <td>
                <code>--el-border-color / --el-border-color-light / --el-border-color-lighter</code>
              </td>
              <td>边框色</td>
              <td>低</td>
              <td>表格 / 单元格边框深浅</td>
            </tr>
            <tr>
              <td>
                <code>
                  --el-fill-color / --el-fill-color-light / --el-fill-color-lighter /
                  --el-fill-color-blank
                </code>
              </td>
              <td>背景填充色</td>
              <td>低</td>
              <td>行 hover / 表头 / 斑马纹背景</td>
            </tr>
            <tr>
              <td><code>--el-border-radius-base / small / round</code></td>
              <td>圆角基调</td>
              <td>低</td>
              <td>表格 / 单元格 / 控件圆角</td>
            </tr>
            <tr>
              <td>
                <code>
                  --el-font-size-extra-large / large / medium / base / small / extra-small
                </code>
              </td>
              <td>字号档位</td>
              <td>低</td>
              <td>表头 / 单元格 / 注释文字大小</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ApiTable
      title="样式定制技巧（v3.1）"
      :items="styleOverrideItems"
      anchor="api-style-override"
    />
  </DemoFrame>
</template>

<style lang="scss">
/* ───────────── ① 行条件样式（CSS :has() 反向命中） ───────────── */

/* VIP 行（status='在售' 但 isVip=true）：通过 status='在售' 标识行 + 第一列渲染 VIP 徽标 */
.#{$BEM_PREFIX}-demo-pro-table-style-override
  .#{$BEM_PREFIX}-pro-table
  .el-table__body
  tr:has(.#{$BEM_PREFIX}-demo-pro-table-style-override__vip-badge) {
  background: var(--el-color-primary-light-9);
}
.#{$BEM_PREFIX}-demo-pro-table-style-override
  .#{$BEM_PREFIX}-pro-table
  .el-table__body
  tr:has(.#{$BEM_PREFIX}-demo-pro-table-style-override__vip-badge)
  > td:first-child {
  border-left: 4px solid var(--el-color-primary);
}

/* 清仓行（status='清仓'）：黄色左边条 + 整行淡黄背景 */
.#{$BEM_PREFIX}-demo-pro-table-style-override
  .#{$BEM_PREFIX}-pro-table
  .el-table__body
  tr:has(.#{$BEM_PREFIX}-demo-pro-table-style-override__tag-clearance) {
  background: var(--el-color-warning-light-9);
}
.#{$BEM_PREFIX}-demo-pro-table-style-override
  .#{$BEM_PREFIX}-pro-table
  .el-table__body
  tr:has(.#{$BEM_PREFIX}-demo-pro-table-style-override__tag-clearance)
  > td:first-child {
  border-left: 4px solid var(--el-color-warning);
}

/* 停售行：半透明 + 灰色 */
.#{$BEM_PREFIX}-demo-pro-table-style-override
  .#{$BEM_PREFIX}-pro-table
  .el-table__body
  tr:has(.#{$BEM_PREFIX}-demo-pro-table-style-override__tag-stopped) {
  opacity: 0.55;
}

/* ───────────── ② 单元格条件样式 ───────────── */

.#{$BEM_PREFIX}-demo-pro-table-style-override__out-of-stock {
  color: var(--el-color-danger);
  font-weight: 600;
}

.#{$BEM_PREFIX}-demo-pro-table-style-override__high-price {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
  font-weight: 600;
}

.#{$BEM_PREFIX}-demo-pro-table-style-override__recent {
  color: var(--el-color-success);
  font-weight: 500;
}

.#{$BEM_PREFIX}-demo-pro-table-style-override__vip-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

/* ───────────── ③ 自定义表头（icon + tooltip） ───────────── */

.#{$BEM_PREFIX}-demo-pro-table-style-override__header-info {
  display: inline-flex;
  align-items: center;
}

/* ───────────── ⑥ 主题色覆盖作用域 ───────────── */

/* 把红色主题作用域内的 primary 色改为红色系 */
.#{$BEM_PREFIX}-demo-pro-table-style-override__theme-scope {
  .#{$BEM_PREFIX}-pro-table {
    --el-color-primary: #f56c6c;
    --el-color-primary-light-3: #fab6b6;
    --el-color-primary-light-5: #fbc4c4;
    --el-color-primary-light-7: #fdd2d2;
    --el-color-primary-light-8: #fdd9d9;
    --el-color-primary-light-9: #fee5e5;
    --el-color-primary-dark-2: #c45656;
  }
}

/* ───────────── 通用 ───────────── */

.#{$BEM_PREFIX}-demo-pro-table-style-override {
  padding: 16px;

  &__hint {
    margin: 0 0 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);

    strong {
      color: var(--el-color-primary);
      margin: 0 4px;
    }

    code {
      padding: 1px 6px;
      background: var(--el-fill-color);
      border-radius: 3px;
      font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
      font-size: 12px;
    }
  }

  &__theme-scope {
    padding: 16px;
    border: 1px dashed var(--el-color-info-light-7);
    border-radius: 6px;
  }

  &__density-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;

    @media (max-width: 1400px) {
      grid-template-columns: 1fr;
    }
  }

  &__density-pane {
    min-width: 0;
  }

  /* ───────────── 钩子清单表（对齐 XFormStyleOverride） ───────────── */

  &__cheatsheet-title {
    margin-top: 32px;
    margin-bottom: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__cheatsheet-hint {
    margin-bottom: 16px;
    padding: 10px 14px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.7;

    strong {
      color: var(--el-color-primary);
      margin: 0 4px;
    }
  }

  &__cheatsheet-wrap {
    overflow-x: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  &__cheatsheet-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-lighter);
      vertical-align: top;
    }

    thead th {
      background: var(--el-fill-color-light);
      font-weight: 600;
      color: var(--el-text-color-regular);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    code {
      padding: 1px 6px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
      font-size: 12px;
      color: #c7254e;
    }
  }

  &__density-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);

    small {
      margin-left: 8px;
      font-weight: 400;
      color: var(--el-text-color-secondary);
    }
  }

  &__actions {
    margin: 12px 0;
    display: flex;
    gap: 8px;
  }
}
</style>
