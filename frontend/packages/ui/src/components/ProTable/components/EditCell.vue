<script setup lang="ts">
/**
 * EditCell —— ProTable 行内编辑单元格控件（v2.0 自 ProTable.vue 模板抽取）
 *
 * 承接列 edit 配置的四种控件分支（input / input-number / select / 自定义组件名），
 * 让 ProTable.vue 模板不再内联四段编辑控件渲染。
 * 数据流：父级传入当前编辑值（rowEdit.getValue 的结果），用户输入经 update 事件
 * 回传父级写回 rowEdit.setValue —— 本组件不直接持有 rowEdit 实例（保持展示组件纯粹）。
 *
 * v3.0 5d：edit.updateEvent='blur' 时改用 @blur 触发同步（与 ProTable trigger='blur' 对齐）
 *
 * @see [`../composables/useRowEdit`](../composables/useRowEdit.ts) 编辑态与值管理
 * @group ProTable 组件
 */
import { computed } from 'vue'
import type { ProColumn, TableDensity } from '../types'

const props = defineProps<{
  /** 当前编辑行的 rowKey 值（仅透传给 update 事件，便于父级写回） */
  rowKey: string | number
  /** 列定义 —— edit 配置（控件类型 + 透传 props）从这里读取 */
  col: ProColumn
  /** 当前编辑值（父级 rowEdit.getValue 的结果，受控） */
  value: unknown
  /** 当前表格密度档位 —— 编辑控件尺寸随密度联动（由引擎 body 组件透传） */
  density?: TableDensity | undefined
}>()

const emit = defineEmits<{
  /** 编辑值变化 —— 父级据此调用 rowEdit.setValue 写回 */
  (e: 'update', prop: string, value: unknown): void
}>()

/** 列编辑配置（父级模板 v-else-if 已保证 col.edit 存在，此处仅做类型收窄） */
const editConfig = computed(() => props.col.edit)

/** v3.0 5d：触发事件名 —— 默认 'input' 实时，'blur' 失焦（与 ProTable trigger='blur' 对齐） */
const triggerEvent = computed(() => editConfig.value?.updateEvent ?? 'input')

/** BEM 命名空间 —— 编辑控件统一尺寸/宽度的样式挂载点（见 style 块注释） */
const bem = createNamespace('edit-cell')

/**
 * 编辑控件尺寸 —— 随表格密度档位联动（element-plus size 三档：small 24 / default 32 / large 40）。
 * 映射与密度行高 token 对齐：compact 行高小配 small 控件，loose 行高大配 large 控件。
 * 未传 density（独立使用场景）回落 'small'，保持 v3.1 前写死 small 的默认行为不变。
 * 绑定顺序：:size 在 v-bind="edit.props" 之前 —— 列级 edit.props.size 显式声明优先于此映射
 */
const controlSize = computed<'small' | 'default' | 'large'>(() => {
  switch (props.density) {
    case 'compact':
      return 'small'
    case 'default':
      return 'default'
    case 'loose':
      return 'large'
    default:
      return 'small'
  }
})

/**
 * el-select 专用的 size 兼容出口 —— element-plus 2.14 的 select.d.ts 中 size 是
 * buildProp 返回的原始声明对象（带 __epPropKey 标记），与 el-input 的 ExtractPublicPropTypes
 * 形态不一致：vue-tsc 模板检查会把绑定值与该定义对象比对，误报 TS2322。
 * cast 仅为绕开库侧类型缺陷，运行时值与 controlSize 完全一致
 */
const selectSizeCompat = computed(() => controlSize.value as never)

/** 输入控件的当前 modelValue（受控） */
const modelValue = computed(() => props.value as never)

/**
 * 解析编辑控件（el: 'input' | 'select' | 'input-number' | 自定义组件名）
 * —— 内置三种映射到 element-plus 组件，其余按组件名字符串原样交给 <component :is>。
 */
function resolveEditComp(el: string): string {
  switch (el) {
    case 'input':
      return 'el-input'
    case 'select':
      return 'el-select'
    case 'input-number':
      return 'el-input-number'
    default:
      return el
  }
}

/** input 事件统一出口：携带列 prop 回传，父级无需再闭包列名 */
function handleUpdate(v: unknown): void {
  emit('update', props.col.prop, v)
}

/** v3.0 5d：blur 事件出口 —— 仅在 triggerEvent='blur' 时由 el-input @blur 触发 */
function handleBlur(evt: FocusEvent): void {
  const target = evt.target as HTMLInputElement | null
  // el-input 的 blur 事件 target.value 即当前输入值
  emit('update', props.col.prop, target?.value ?? props.value)
}

/**
 * v3.5 PR1-A：A11y 播报 —— 进入编辑态时屏幕阅读器朗读「已进入编辑 字段名」，
 * 让盲用户明确感知「我现在处于编辑态可以输入」。sr-only 视觉隐藏但 aria-live
 * 区域可被 NVDA / JAWS / VoiceOver 识别。
 */
const ariaLiveMessage = computed(() => `已进入编辑 ${props.col.label ?? props.col.prop}`)
</script>

<template>
  <div :class="bem.b()">
    <!--
      v3.5 PR1-A：编辑态播报（aria-live）
      - 进入编辑：屏幕阅读器朗读「已进入编辑 字段名」
      - 视觉隐藏：position absolute + clip-path（_a11y.scss sr-only 工具类复用）
    -->
    <span class="sr-only" aria-live="polite">{{ ariaLiveMessage }}</span>
    <!-- 统一根 div：编辑控件尺寸/宽度样式的 BEM 挂载点（input-number 宽度 100% 需要稳定后代选择器）。
         注意根元素前不能放 HTML 注释 —— Vue 3 会把注释计为 fragment 额外根节点，$el 指向注释锚点 -->
    <!-- :size 在 v-bind 之前：edit.props.size 显式优先；缺省随 density 映射（compact→small / default→default / loose→large） -->
    <el-input
      v-if="editConfig?.el === 'input'"
      :model-value="modelValue"
      :size="controlSize"
      @update:model-value="handleUpdate"
      @blur="triggerEvent === 'blur' ? handleBlur : undefined"
      v-bind="editConfig.props ?? {}"
    />
    <el-input-number
      v-else-if="editConfig?.el === 'input-number'"
      :model-value="modelValue"
      :size="controlSize"
      @update:model-value="handleUpdate"
      @blur="triggerEvent === 'blur' ? handleBlur : undefined"
      v-bind="editConfig.props ?? {}"
    />
    <!-- v2.1：el-select 类型适配后改回 el-option 列表 -->
    <el-select
      v-else-if="editConfig?.el === 'select'"
      :model-value="modelValue"
      :size="selectSizeCompat"
      @update:model-value="handleUpdate"
      @change="triggerEvent === 'blur' ? handleUpdate : undefined"
      v-bind="editConfig.props ?? {}"
    />
    <component
      v-else-if="editConfig"
      :is="resolveEditComp(editConfig.el)"
      :model-value="value"
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-edit-cell {
  /* el-input-number 默认固定 150px 宽（element-plus 源码实证），在宽列编辑态显窄；
     编辑态应撑满单元格，与 el-input / el-select 默认 100% 对齐。
     用户经 edit.props 传 style/width 内联样式仍可覆盖（内联优先级高于类） */
  .el-input-number {
    width: 100%;
  }
}
</style>
