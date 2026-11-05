<script setup lang="ts">
/**
 * SelectedTags —— 已选条件回显区（v3.2 升级）
 *
 * 设计动机：用户筛选后往往忘记自己设置了哪些条件，tag 回显能：
 * 1) 直观看到当前生效的查询条件
 * 2) 一键清除单个条件（tag 右上角 × 按钮）
 * 3) 一键清除全部（右侧「清除全部」按钮）
 *
 * 位置：在 ProTable 搜索区与表格区之间，视觉上不干扰搜索区
 *
 * 行为约定：
 * - 监听 props.searchParams 变化，自动重算 tag 列表
 * - 不显示空值（undefined / null / '' / 空数组）
 * - select 类字段的 enum 值自动翻译为 label（避免显示数字 ID）
 * - 单个 tag × 点击：emit('clear-one', prop) 让父组件清字段
 * - 「清除全部」点击：emit('clear-all') 让父组件清所有
 */
import { computed } from 'vue' // vue（生命周期/底层 API）
import { ElTag, ElButton } from 'element-plus' // element-plus 按需注入
import type { ProColumn } from '../types'

interface Props {
  /** 完整 columns（用于 prop → label 翻译 + select 枚举值翻译） */
  columns: ProColumn[]
  /** 当前 searchParams（响应式） */
  searchParams: Record<string, unknown>
  /**
   * v3.2 升级：枚举值翻译 Map（select 字段值 → label）
   * 例：{ 'paid': '已支付', 'shipped': '已发货' }
   * 不传则用原始值显示
   */
  enumMaps?: Record<string, Record<string | number, string>>
}
interface Emits {
  /** 清除单个条件（父组件收到后清字段 + 触发搜索） */
  (e: 'clear-one', prop: string): void
  /** 清除全部条件 */
  (e: 'clear-all'): void
}
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const bem = createNamespace('pro-table-selected-tags')

/**
 * 非 select 字段的显示值格式化（review R12）
 * - Date（el-date-picker 单日期默认返回 Date 对象）：YYYY-MM-DD
 * - 二元组（如 el-date-picker daterange 的 [start, end]，元素可能是 Date / string / number）：
 *   `start ~ end`，每个元素按各自类型格式化
 * - 其余数组：`[N 项]`
 * - 对象：`[对象]` —— 不再 JSON.stringify 截断展示（避免内部字段泄露到 UI +
 *   UTF-16 按单元截断多字节字符产生乱码）
 */
function formatDisplayValue(v: unknown): string {
  if (v instanceof Date) {
    // el-date-picker type='date' 默认返回 Date 对象（type='datetime' 返回 Date，
    // type='daterange' / 'datetimerange' 返回 [Date, Date]）；toISOString 输出 ISO 8601
    // 字符串，slice(0, 10) 截取 YYYY-MM-DD（datetime 类场景下会丢失时分秒，但 UI
    // 回显区只需要日期维度；时分秒用户能从原输入框回看，截断是可接受的精度折中）
    return v.toISOString().slice(0, 10)
  }
  if (Array.isArray(v)) {
    const isPair =
      v.length === 2 &&
      v.every((item) => ['string', 'number'].includes(typeof item) || item instanceof Date)
    if (isPair) {
      // 数组元素按各自类型格式化：Date → YYYY-MM-DD；string/number → String()
      const fmt = (item: unknown): string =>
        item instanceof Date ? item.toISOString().slice(0, 10) : String(item)
      return `${fmt(v[0])} ~ ${fmt(v[1])}`
    }
    return `[${v.length} 项]`
  }
  if (typeof v === 'object' && v !== null) return '[对象]'
  return String(v)
}

/**
 * 已选 tag 列表：[{ prop, label, value, displayValue }]
 * - prop: 字段名（用于清除时定位）
 * - label: 字段显示名（如「订单状态」）
 * - displayValue: 用户可读的值（select 翻译后的 label）
 *
 * review R2：直接依赖 props.searchParams —— useSearch v3.2 起契约即 re-assign 新对象
 * （见 useSearch.ts updateParams/reset），浅依赖引用即可捕获全部更新；原 deep watch +
 * version 计数器是为「原地 mutation 生产者」设计的兜底，useSearch 修复后已是过时设计
 * （每次变更 deep traverse 整个参数树是 O(n) 浪费，且 void version.value 打断
 * Vue 依赖追踪的声明式语义）。与 SearchForm.vue 的浅 watch 注释同一前提。
 */
interface SelectedTag {
  prop: string
  label: string
  displayValue: string
  rawValue: unknown
}
const selectedTags = computed<SelectedTag[]>(() => {
  const tags: SelectedTag[] = []
  for (const col of props.columns) {
    if (!col.search) continue // 无 search 配置的列不参与 tag
    const v = props.searchParams[col.prop]
    // 跳过空值
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    // 翻译显示值
    let displayValue: string
    if (col.search.el === 'select' && props.enumMaps?.[col.prop]) {
      const enumMap = props.enumMaps[col.prop]
      // 收紧 null 检查避免 TS18048 + 运行时崩溃
      displayValue = enumMap ? String(enumMap[v as string | number] ?? v) : String(v)
    } else {
      displayValue = formatDisplayValue(v)
    }
    tags.push({
      prop: col.prop,
      label: col.label,
      displayValue,
      rawValue: v,
    })
  }
  return tags
})

function handleClearOne(prop: string): void {
  emit('clear-one', prop)
}

function handleClearAll(): void {
  emit('clear-all')
}
</script>

<template>
  <div v-if="selectedTags.length > 0" :class="bem.b()" role="region" aria-label="当前已选筛选条件">
    <span :class="bem.e('label')">当前筛选：</span>
    <ElTag
      v-for="tag in selectedTags"
      :key="tag.prop"
      closable
      :class="bem.e('tag')"
      :data-test="`selected-tag-${tag.prop}`"
      :aria-label="`清除筛选条件 ${tag.label}`"
      @close="handleClearOne(tag.prop)"
    >
      {{ tag.label }}: {{ tag.displayValue }}
    </ElTag>
    <ElButton
      text
      type="primary"
      :class="bem.e('clear-all')"
      data-test="clear-all-tags"
      aria-label="清除全部筛选条件"
      @click="handleClearAll"
    >
      清除全部
    </ElButton>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-table-selected-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 8px 0 12px;

  &__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-right: 4px;
  }

  &__tag {
    font-size: 12px;
  }

  &__clear-all {
    margin-left: auto;
    font-size: 12px;
  }
}
</style>
