<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * ColSetting —— 列设置抽屉（spec §五组件树 / 附录 A #6 "恢复默认"按钮）
 *
 * 职责：
 * - 复选框切换列可见性
 * - sortablejs 拖拽重排列顺序（emit reorder 事件由 useColumns 处理）
 * - "恢复默认"按钮（附录 A #6）
 *
 * v3.5 PR3：补 generic<T> 透传——原声明落为默认 Record 泛型，
 * 编排层被迫写 `as unknown as` 双断言。
 *
 * @group ProTable 子组件
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElDrawer, ElCheckbox, ElCheckboxGroup, ElButton, ElTooltip } from 'element-plus'
import { Top } from '@element-plus/icons-vue' // 显式 import（§1.6.1 来源注释）
import Sortable from 'sortablejs'
import type { ProColumn } from '../types'

interface Props {
  visible: boolean
  columns: ProColumn<T>[]
  visibleKeys: string[]
  fixedKeys: string[]
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [boolean]
  'update:visibleKeys': [string[]]
  'update:fixedKeys': [string[]]
  /** 拖拽结束 emit 完整新列顺序（col.prop 数组），由 useColumns.setColumnOrder 处理 */
  reorder: [string[]]
  resetToDefault: []
}>()

const bem = createNamespace('pro-table-col-setting')

const listEl = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

/** 包装 v-model:visibleKeys（避免 vue/no-mutating-props lint） */
function handleVisibleChange(keys: string[]): void {
  emit('update:visibleKeys', keys)
}

function handleClose(): void {
  emit('update:visible', false)
}

function handleReset(): void {
  emit('resetToDefault')
  handleClose()
}

/**
 * 置顶列：emit 重排数组（目标列 + 其余保持原序）——复用 reorder 通道，
 * useColumns.setColumnOrder 同步 columnOrder / allColumns 并持久化（与拖拽排序同一链路）
 */
function handleTop(prop: string): void {
  const rest = props.columns.filter((c) => c.prop !== prop).map((c) => c.prop)
  emit('reorder', [prop, ...rest])
}

/**
 * 读取容器内列项的 prop 顺序（item 上的 data-prop 与 col.prop 一一对应）
 */
function readOrder(el: HTMLElement): string[] {
  return Array.from(el.children)
    .map((c) => (c as HTMLElement).dataset?.prop ?? '')
    .filter((prop) => prop !== '')
}

/**
 * 按给定顺序重排 DOM 已有节点（appendChild 移动而非克隆）。
 * 用于 onEnd 还原 sortablejs 的 DOM 变更，让 Vue v-for 保持唯一数据源，
 * 避免 sortablejs 的节点移动与 Vue 的 key 协调叠加出中间态。
 */
function restoreOrder(el: HTMLElement, order: string[]): void {
  const nodeMap = new Map(
    Array.from(el.children).map((c) => [(c as HTMLElement).dataset?.prop ?? '', c as HTMLElement])
  )
  for (const prop of order) {
    const node = nodeMap.get(prop)
    if (node) el.appendChild(node)
  }
}

/**
 * v2.0 列拖拽排序（spec 决策 2：sortablejs 接管）
 * - Sortable 绑到 ElCheckboxGroup（listEl = group ref），让 sortablejs 直接管理 item
 * - 用 handle 限制只在拖拽手柄上按下才触发，避免 checkbox input 抢 pointer event
 * - onEnd emit 完整新顺序（col.prop 数组）给 useColumns.setColumnOrder 处理
 *
 * 关键约束（sortablejs 行为，见 node_modules/sortablejs/Sortable.js _onDragOver/_onDrop）：
 * sortablejs 在拖拽过程中就把"真实节点"插入目标位置（而非 drop 时才移动），
 * 因此 onEnd 时 el.children 已是新顺序，且 children[newIndex] 就是被拖元素本身。
 * 旧实现取 children[newIndex] 当作 to，导致 to === from 被守卫拦截、reorder 事件永不发出。
 */
function initSortable(): void {
  if (!listEl.value || sortableInstance) return
  // 用 group ref 作为 sortable 容器：group 是 .el-checkbox-group，内部直接是 item divs
  const el =
    (listEl.value as unknown as { $el?: HTMLElement }).$el ??
    (listEl.value as unknown as HTMLElement)
  if (!el || typeof el.querySelector !== 'function') return
  /** 拖拽前 DOM 顺序快照（onStart 时 sortablejs 尚未移动节点，DOM 仍是旧顺序） */
  let prevOrder: string[] = []
  sortableInstance = Sortable.create(el, {
    handle: `[data-drag-handle]`,
    // 拖拽热区为整行（handle 在 item 根上），但 checkbox 交互区排除：
    // 命中 filter 时 sortablejs 不启动拖拽（preventOnFilter 默认 true），checkbox 正常勾选
    filter: '.el-checkbox',
    animation: 150,
    onStart: () => {
      prevOrder = readOrder(el)
    },
    onEnd: () => {
      // el.children 即用户拖拽后的目标顺序（sortablejs 拖拽中已移动真实节点）
      const newOrder = readOrder(el)
      restoreOrder(el, prevOrder)
      if (newOrder.length > 0) {
        emit('reorder', newOrder)
      }
    },
  })
}

function destroySortable(): void {
  sortableInstance?.destroy()
  sortableInstance = null
}

onMounted(() => {
  nextTick(() => initSortable())
})

onBeforeUnmount(() => {
  destroySortable()
})

// 当 drawer 打开/关闭时重新初始化（el-drawer 内容是 lazy mounted）
watch(
  () => props.visible,
  (v) => {
    if (v) {
      nextTick(() => initSortable())
    } else {
      destroySortable()
    }
  }
)
</script>

<template>
  <ElDrawer
    :model-value="props.visible"
    title="列设置"
    direction="rtl"
    size="360px"
    @update:model-value="handleClose"
  >
    <ElCheckboxGroup
      ref="listEl"
      :class="bem.e('list')"
      :model-value="props.visibleKeys"
      @update:model-value="(v) => handleVisibleChange(v as string[])"
    >
      <div
        v-for="(col, index) in props.columns"
        :key="col.prop"
        :class="bem.e('item')"
        :data-prop="col.prop"
        :data-drag-handle="col.prop"
        :aria-label="`列设置项 ${col.label ?? col.prop}`"
      >
        <span :class="bem.e('drag-handle')" :aria-label="`拖拽手柄 ${col.label ?? col.prop}`">
          ⋮⋮
        </span>
        <ElCheckbox
          :value="col.prop"
          :data-test="`col-check-${col.prop}`"
          :aria-label="`显示/隐藏 ${col.label ?? col.prop}`"
          @click.stop
        >
          <span v-if="col.label">{{ col.label }}</span>
          <!-- 未命名列（label 空串/缺失）以 prop 兜底展示，弱化样式标识「这是字段名不是显示名」 -->
          <span v-else :class="bem.e('label-fallback')">{{ col.prop }}</span>
        </ElCheckbox>
        <ElTooltip content="置顶">
          <ElButton
            :class="bem.e('top-btn')"
            :icon="Top"
            circle
            size="small"
            :disabled="index === 0"
            :aria-label="`置顶 ${col.label ?? col.prop}`"
            :data-test="`col-top-${col.prop}`"
            @click="handleTop(col.prop)"
          />
        </ElTooltip>
      </div>
    </ElCheckboxGroup>
    <template #footer>
      <ElButton data-test="reset-btn" aria-label="恢复默认列设置" @click="handleReset">
        恢复默认
      </ElButton>
      <ElButton data-test="close-btn" aria-label="关闭列设置" @click="handleClose">关闭</ElButton>
    </template>
  </ElDrawer>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-table-col-setting {
  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    background: var(--el-fill-color-blank);
    cursor: grab;
    transition: background 0.2s;

    &:active {
      cursor: grabbing;
    }

    &:hover {
      background: var(--el-fill-color-light);
    }
  }

  &__drag-handle {
    /* 图标视觉锚点小，用负边距外扩点击热区（透明区域不影响布局） */
    margin: -6px -4px;
    padding: 6px 4px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
    user-select: none;
    cursor: grab;

    &:hover {
      color: var(--el-color-primary);
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__label-fallback {
    color: var(--el-text-color-secondary);
    font-style: italic;
  }

  &__top-btn {
    /* 置顶按钮常显（操作可发现性），右对齐推到 item 尾部 */
    margin-left: auto;
    flex-shrink: 0;
  }
}
</style>
