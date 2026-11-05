<script setup lang="ts">
/**
 * ProTable v3.1 自动高度 demo —— autoHeight + 工具栏全屏（布局能力复合）
 *
 * 演示能力：
 * - autoHeight：表格区撑满视口剩余高度（视口高 - 根容器 top - 搜索区 - 工具栏 -
 *   分页器 - 固定余量），窗口缩放 / 容器尺寸变化自动重算，下限钳制 100px
 * - 与 virtualized 互斥：virtualized 自带高度管理，同开时 autoHeight 忽略 + console.warn
 * - 工具栏全屏（v3.1 内置）：与刷新按钮紧贴成组（组内边框合并），CSS fixed 铺满
 *   （z-index 1500 低于 el-dialog 2000+），Esc 或再次点击退出
 * - 全屏内 el-dialog 联动：演示 z-index 层级（dialog 默认 2000+ > 全屏 1500），
 *   全屏状态下打开 dialog 不会被遮挡；与 ProDialog 区分（项目内业务封装的命令式弹窗）
 *
 * 验证步骤：
 * 1. 缩小浏览器窗口高度 → 表体出现纵向滚动条、分页器始终可见不滚出视口
 * 2. 拖回窗口 → 表体高度跟随伸缩
 * 3. 点工具栏全屏按钮 → 表格铺满视口、按钮高亮；Esc 退出
 * 4. 全屏状态下点下方"打开 el-dialog"按钮 → dialog 渲染在最上层不被遮挡
 *
 * 路由：自动注册为 /demo/pro-table-auto-height
 */
import { ElButton, ElDialog } from 'element-plus'
import { ProTable, type ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { autoHeightItems, autoHeightConfigItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-auto-height')

const columns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70, sortable: true },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
  { prop: 'createdAt', label: '创建时间', width: 170, formatter: 'dateTime' },
]

const autoHeightCode = `<!-- 表格区撑满视口剩余高度：视口高 - 根容器 top - 搜索区 - 工具栏 - 分页器 - 固定余量 -->
<!-- 窗口缩放 / 容器尺寸变化（ResizeObserver）自动重算；下限钳制 100px -->
<ProTable :columns="columns" :request-api="requestApi" auto-height />

<!-- 与 virtualized 同开属配置冲突：virtualized 自带高度管理，autoHeight 被忽略并 console.warn -->`

const fullscreenCode = `<!-- 工具栏内置全屏按钮：点击切换 CSS fixed 全屏（z-index 1500，低于 el-dialog 2000+） -->
<!-- Esc 或再次点击退出；全屏内打开 el-dialog 不被遮挡：dialog 默认 z-index 2000+ > 全屏层 1500 -->`

/* ───────────── 全屏内 el-dialog 联动验证 ───────────── */

/** dialog 可见性 —— ref 控制 v-model，避免在 ProTable 模板内绑复杂状态 */
const dialogVisible = ref(false)

const tocItems = [
  { id: 'demo-autoheight', label: 'autoHeight 演示' },
  { id: 'demo-fullscreen', label: '工具栏全屏 + el-dialog 联动' },
  { id: 'api-autoheight', label: 'autoHeight Prop' },
  { id: 'api-autoheight-config', label: 'AutoHeightConfig' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableAutoHeight 自动高度 + 全屏"
    source="src/components/ProTable/composables/useAutoHeight.ts"
    :introductions="[
      'autoHeight 让表格区撑满视口剩余高度（表头固定 + 表体滚动 + 分页器常驻）。',
      '工具栏全屏按钮与刷新按钮紧贴成组，复合在本页一起验证布局能力。',
    ]"
  >
    <section id="demo-autoheight" :class="bem.b()">
      <DemoField label="autoHeight（缩小窗口验证）" :code="autoHeightCode">
        <p :class="bem.e('hint')">
          验证：① 缩小浏览器窗口高度 → 表体出现纵向滚动条、分页器始终可见 ② 拖回窗口 →
          表体高度跟随伸缩 ③ 与 virtualized 同开会 console.warn（互斥，本页未同开）
        </p>
        <ProTable
          :columns="columns"
          :request-api="projectRequestApi"
          table-key="demo-v31-autoheight"
          row-key="id"
          auto-height
        />
      </DemoField>

      <DemoField
        id="demo-fullscreen"
        label="工具栏全屏 + el-dialog 联动（z-index 1500 < 2000+）"
        :code="fullscreenCode"
      >
        <p :class="bem.e('hint')">
          验证：① 点击工具栏全屏按钮 → 表格 fixed 铺满视口、按钮高亮 ② Esc 或再次点击退出 ③
          全屏状态下点下方"打开 el-dialog"按钮 → dialog 显示在最上层（z-index 2000+ > 全屏层
          1500，dialog 蒙层 + body 完整可见）
        </p>
        <!-- ProTable 启用 autoHeight + 工具栏内置全屏按钮 -->
        <ProTable
          :columns="columns"
          :request-api="projectRequestApi"
          table-key="demo-v31-fullscreen"
          row-key="id"
          auto-height
          :page-size="5"
        />
        <!--
            全屏层 z-index 验证：用项目外的 ElDialog（element-plus 原生）演示 z-index 优先级。
            位置在 ProTable 之外（demo 区域），而非 ProTable 内部插槽 —— 验证"全屏后弹窗
            不被遮挡"是组件库层级问题，与 ProTable 内部结构无关。

            验证步骤（任选其一即可）：
            - 全屏态 → 点下方按钮 → dialog 在最上层（dialog z-index 2000+ > 全屏 1500）
            - 非全屏态 → 点下方按钮 → dialog 在全屏之上依然成立（控制对照）
          -->
        <div :class="bem.e('dialog-trigger')">
          <ElButton type="primary" plain @click="dialogVisible = true">
            打开 el-dialog（验证全屏内不被遮挡）
          </ElButton>
          <ElDialog
            v-model="dialogVisible"
            title="全屏内打开 el-dialog"
            width="520"
            align-center
            append-to-body
          >
            <p :class="bem.e('dialog-text')">此 dialog 应渲染在 ProTable 全屏层之上。</p>
            <p :class="bem.e('dialog-text')">
              element-plus ElDialog 默认 z-index 2000+，ProTable 全屏 z-index 1500 —— 层级关系保证
              dialog 永远在最上层。
            </p>
            <p :class="bem.e('dialog-text')">
              <strong>验证手法：</strong>
              先点工具栏「⛶ 全屏」按钮（表格 fixed 铺满）→ 再点下方按钮 → 观察 dialog
              蒙层是否覆盖全屏表格 + dialog body 是否可见。
            </p>
            <template #footer>
              <ElButton @click="dialogVisible = false">关闭</ElButton>
            </template>
          </ElDialog>
        </div>
      </DemoField>
    </section>

    <ApiTable title="autoHeight Prop" :items="autoHeightItems" anchor="api-autoheight" />
    <ApiTable
      title="AutoHeightConfig 字段"
      :items="autoHeightConfigItems"
      anchor="api-autoheight-config"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-auto-height {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  /* 全屏内 el-dialog 联动按钮 —— ProTable 之外的 demo 区域，与 ProTable 间隔 12px */
  &__dialog-trigger {
    margin-top: 12px;
  }

  &__dialog-text {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
