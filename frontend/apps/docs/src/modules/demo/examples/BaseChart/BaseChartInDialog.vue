<script setup lang="ts">
/**
 * BaseChart · 嵌入 ProDialog 演示页
 *
 * 企业常见用途：详情弹窗里看图表、审批弹窗里展示历史趋势、报告预览弹窗。
 *
 * 演示要点：
 * 1. BaseChart 作为 ProDialog 默认 slot 内容：跟随弹窗生命周期挂载 / 卸载
 * 2. 弹窗拉伸（拖拽边缘 / 全屏切换）：BaseChart 内部 ResizeObserver 自动响应
 * 3. 弹窗关闭 → BaseChart 卸载 → onBeforeUnmount 三步清理触发 dispose
 * 4. 反复打开 / 关闭弹窗：DevTools 内存应回到基线（dispose 链路打通）
 */
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-base-chart-in-dialog')

const dialogVisible = ref(false)

const chartOption = {
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
  xAxis: {
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '销售额',
      type: 'line',
      smooth: true,
      data: [820, 932, 1090, 1300, 1450, 1630, 1820],
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: '#67c23a' },
    },
  ],
}

const eventLog = ref<string[]>([])
function logEvent(name: 'open' | 'close'): void {
  eventLog.value = [...eventLog.value, `${new Date().toLocaleTimeString()} → ${name}`].slice(-5)
}

const SNIPPET = `<ProDialog v-model="visible" title="详情" width="640px" draggable>
  <BaseChart :option="chartOption" />
  <!-- 弹窗关闭时 BaseChart 卸载 → onBeforeUnmount 触发 dispose -->
</ProDialog>`

const tocItems = [{ id: 'demo-in-dialog', label: 'BaseChart 嵌入 ProDialog' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="BaseChart · 嵌入 ProDialog"
    source="src/components/common/BaseChart.vue"
    :introductions="[
      '企业常见：详情弹窗看图表、审批弹窗展示历史趋势、报告预览。',
      'BaseChart 嵌入 ProDialog 时，弹窗拉伸 / 全屏切换 → ResizeObserver 自动 resize；弹窗关闭 → BaseChart 卸载 → dispose 清理。',
      'ProDialog 通过 props.draggable 启用拖拽（v-draggable 指令实现，含边界钳制，详见 src/components/common/ProDialog/ProDialog.vue:63 + draggable.ts）。',
      '验证重点：拖拽弹窗右边缘 → 图表跟随放大；反复打开 / 关闭 → DevTools 内存不单调上涨。',
    ]"
  >
    <section id="demo-in-dialog">
      <DemoField :code="SNIPPET" label="① 在 ProDialog 中嵌入 BaseChart">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="dialogVisible = true">打开弹窗</el-button>
          <el-button @click="eventLog = []">清空日志</el-button>
        </div>
        <div :class="bem.e('log')">
          <div :class="bem.e('log-label')">事件记录（最多 5 条）：</div>
          <template v-if="eventLog.length">
            <div v-for="(line, i) in eventLog" :key="i">{{ line }}</div>
          </template>
          <span v-else :class="bem.e('log-empty')">暂无事件，打开弹窗试试</span>
        </div>

        <ProDialog
          v-model="dialogVisible"
          title="销售趋势详情"
          width="640px"
          draggable
          @open="logEvent('open')"
          @close="logEvent('close')"
        >
          <div :class="bem.e('chart-wrap')">
            <BaseChart :option="chartOption" />
          </div>
          <p :class="bem.e('note')">
            在弹窗内拖拽右边缘或点头部全屏按钮 → 图表跟随放大。 关闭弹窗后 BaseChart 卸载，触发
            onBeforeUnmount 三步清理（dispose + disconnect + 清防抖定时器）。
          </p>
        </ProDialog>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-base-chart-in-dialog {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  &__log {
    padding: 8px 12px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.8;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    margin-bottom: 12px;
  }
  &__log-label {
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }
  &__log-empty {
    color: var(--el-text-color-placeholder);
  }
  &__chart-wrap {
    width: 100%;
    height: 360px;
  }
  &__note {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
}
</style>
