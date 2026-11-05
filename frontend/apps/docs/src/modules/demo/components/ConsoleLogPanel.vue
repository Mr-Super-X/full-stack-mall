<script setup lang="ts">
/**
 * ConsoleLogPanel —— 渲染 useConsoleCapture 捕获的日志
 *
 * 设计：ElCollapse 默认折叠；error 红 / warn 黄；单条 > 200 字截断（视图层二次截断，捕获层 500 字）
 * 仅 emit `clear` 事件；数据由父组件通过 logs prop 传入（单一职责）
 */
import type { CapturedLog } from '../composables/useConsoleCapture'

const _props = withDefaults(
  defineProps<{
    logs: CapturedLog[]
    title?: string
    empty?: string
  }>(),
  {
    title: '控制台输出',
    empty: '暂无日志',
  }
)
// props 当前未在模板中显式引用（仅透传给 ElCollapse 的 title 与 v-if 空态展示）
// 保留定义以便未来扩展 props；eslint 视未使用变量为可忽略，加 _ 前缀规避
void _props

const emit = defineEmits<{
  clear: []
}>()

const RENDER_LIMIT = 200

function truncate(msg: string): string {
  return msg.length > RENDER_LIMIT ? `${msg.slice(0, RENDER_LIMIT)}...[视图层截断]` : msg
}

const bem = createNamespace('demo-console-log-panel')
</script>

<template>
  <el-collapse :class="bem.b()">
    <el-collapse-item :title="title">
      <template v-if="logs.length === 0">
        <p :class="bem.e('empty')">{{ empty }}</p>
      </template>
      <template v-else>
        <pre :class="bem.e('list')"><div
          v-for="(log, i) in logs"
          :key="`${log.timestamp}-${i}`"
          :class="[bem.e('item'), bem.is('level-error', log.level === 'error'), bem.is('level-warn', log.level === 'warn')]"
        >
          <span :class="bem.e('level')">{{ log.level.toUpperCase() }}</span>
          <span :class="bem.e('msg')">{{ truncate(log.message) }}</span>
        </div></pre>
        <el-button link size="small" @click="emit('clear')">清空</el-button>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-console-log-panel {
  margin-top: 12px;

  &__empty {
    color: var(--el-text-color-secondary, #909399);
    font-size: 13px;
    margin: 0;
    padding: 8px 0;
  }

  &__list {
    margin: 0;
    padding: 8px 12px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 4px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    max-height: 240px;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  &__item {
    padding: 4px 0;
    border-bottom: 1px dashed var(--el-border-color-lighter, #ebeef5);

    &:last-child {
      border-bottom: none;
    }

    &.is-level-error &__level {
      color: var(--el-color-danger, #f56c6c);
    }

    &.is-level-warn &__level {
      color: var(--el-color-warning, #e6a23c);
    }
  }

  &__level {
    display: inline-block;
    width: 48px;
    font-weight: 600;
    margin-right: 8px;
  }

  &__msg {
    color: var(--el-text-color-primary, #303133);
    word-break: break-all;
  }
}
</style>
