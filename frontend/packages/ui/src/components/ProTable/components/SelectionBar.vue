<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * SelectionBar —— 批量操作浮出条（spec 2026-09-18 §3.2，设计 D5/D6）
 *
 * 选中行 > 0 时由编排层条件挂载（v-if），浮出表格上方：左侧「已选 N 项 + 清除」，
 * 右侧批量操作区。双通道（slot 优先）：
 * - 提供 default slot：完全接管右侧（作用域 = ctx + clear）
 * - 否则：selectionBarActions 配置经 ToolbarRenderer 渲染
 *
 * 纯渲染组件：选中数据/刷新全经 props.ctx 注入，清除仅 emit 上抛（编排层调 useTable.clearSelection）。
 *
 * @group ProTable 子组件
 */
import { computed, useSlots } from 'vue'
import { ElButton } from 'element-plus' // element-plus 按需注入
import ToolbarRenderer from './ToolbarRenderer.vue'
import type { ToolbarAction, ToolbarCtx } from '../types'

interface Props {
  /** 编排层聚合的上下文（selectedCount 驱动「已选 N 项」显示） */
  ctx: ToolbarCtx<T>
  /** 批量操作配置（slot 未提供时生效） */
  actions?: ToolbarAction<T>[]
  /** 直出上限（透传 ToolbarRenderer，默认 3）；`| undefined` 兼容 exactOptionalPropertyTypes 显式传 undefined */
  maxVisible?: number | undefined
}
const props = withDefaults(defineProps<Props>(), {
  actions: () => [],
  maxVisible: 3,
})

const emit = defineEmits<{
  /** 清除全部选中 —— 编排层接到后调 useTable.clearSelection（同步清 UI 勾选态） */
  clear: []
}>()

const bem = createNamespace('pro-table-selection-bar')

/**
 * 2026-09-18 review：useSlots() 必须在 setup 顶层调用。
 * 原写在 computed getter 内，依赖「重算时刻恰有 active instance」——边缘触发路径
 * （响应式上下文外重算）currentInstance 为 null 会取不到 slots，
 * hasDefaultSlot 误降为 false 导致 slot 与 actions 并存渲染。
 */
const slots = useSlots()

/** 右侧是否被 slot 完全接管（slot 优先于 actions 配置） */
const hasDefaultSlot = computed(() => Boolean(slots.default))

/** slot 作用域：ctx 全量 + 清除句柄（命名 clearSelection 与 ProTableExpose 对齐） */
const slotScope = computed(() => ({
  ...props.ctx,
  clearSelection: () => emit('clear'),
}))
</script>

<template>
  <div :class="bem.b()" role="status" aria-live="polite">
    <div :class="bem.e('info')">
      <span :class="bem.e('text')">
        已选
        <b :class="bem.e('count')">{{ props.ctx.selectedCount }}</b>
        项
      </span>
      <ElButton
        link
        type="primary"
        size="small"
        :class="bem.e('clear')"
        aria-label="清除选择"
        data-test="selection-clear"
        @click="emit('clear')"
      >
        清除
      </ElButton>
    </div>
    <div :class="bem.e('actions')">
      <slot v-bind="slotScope" />
      <ToolbarRenderer
        v-if="!hasDefaultSlot && props.actions.length > 0"
        :actions="props.actions"
        :ctx="props.ctx"
        :max-visible="props.maxVisible"
      />
    </div>
  </div>
</template>

<style lang="scss">
/* 浮出条出现动画：transform/opacity 走合成器（web/performance 规范） */
@keyframes #{$BEM_PREFIX}-pro-table-selection-bar-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.#{$BEM_PREFIX}-pro-table-selection-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  animation: #{$BEM_PREFIX}-pro-table-selection-bar-in 0.2s ease-out;

  &__info {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  &__count {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
}

/* 尊重减弱动效偏好（web/performance 规范）：用户系统开启 reduced-motion 时跳过进场动画 */
@media (prefers-reduced-motion: reduce) {
  .#{$BEM_PREFIX}-pro-table-selection-bar {
    animation: none;
  }
}
</style>
