<script setup lang="ts">
/**
 * 字典下拉选择器 —— el-select 的 dictCode 驱动封装。
 *
 * 设计要点：
 * - 传一个 dictCode，字典加载 / 缓存 / 并发合并全部内部完成
 *   （内部自动调用 useDict），调用方零样板：v-model + dictCode 两个属性即可
 * - `v-bind="$attrs"` 透传 el-select 原生能力（clearable / filterable /
 *   placeholder / multiple 等），本组件不重复声明这些 props —— 新能力零成本
 * - 契约字段 `disabled` 自动映射 el-option 的 disabled（如「锁定」态禁选）
 * - dictCode 支持运行时切换（watch 补拉新字典，应对 v-if 复用同一组件实例的场景）
 *
 * 为什么 modelValue 显式声明为 prop：Vue 3 中已声明的 prop 不会落入 $attrs，
 * 父级 v-model 值由 props.modelValue 接收；$attrs 里只剩未声明属性（clearable 等），
 * 透传给 el-select 时不会与本组件的 v-model 桥接冲突。
 *
 * @example
 * ```vue
 * <DictSelect v-model="form.gender" dict-code="gender" clearable filterable />
 * ```
 *
 * @see `@vv/shared` composables/useDict —— 内部字典数据源（包内 composables/ 仅 useDialog 族，2026-10-27 审计修断链）
 * @see `@vv/shared` types/dict —— DictItem 契约（disabled 字段；ui/src/types 不存在，原相对链接断链）
 * @group 字典组件
 */
// 只 import ElSelect / ElOption 的「类型」（import type 不产生运行时绑定）。
// 为什么不能运行时 import { ElSelect, ElOption }：
// unplugin-vue-components 的 ElementPlusResolver 按**模板标签**做按需注册 + 样式注入；
// 一旦 <script setup> 有同名局部运行时绑定，Vue SFC 编译器优先把模板标签
// 解析到该局部变量，运行时组件虽是 ElSelect 本身，但样式注入被跳过 → 下拉无样式。
// 保留类型导入：optionBind 的断言链需要 ElOptionProps（构造签名 → $props 路径）。
// 模板 <el-select> / <el-option> 标签走全局注册（运行时正常 + 样式按需注入）。
import type { Ref } from 'vue'
import type { ElOption, ElSelect } from 'element-plus'
import type { DictItem } from '@vv/shared'

/**
 * 本地版 ComponentProps 提取（与 form-schema/types/schema-node.ts:50 同款）。
 * 用于给 optionBind 的断言链一个语义正确的目标类型（ElOption 的 props 类型）。
 */
type ComponentProps<T> = T extends new (...args: never[]) => infer R
  ? R extends { $props: infer P }
    ? P
    : never
  : never
type ElOptionProps = ComponentProps<typeof ElOption>

// 消费 ElSelect 类型（仅类型引用，无运行时产物）——模板 <el-select> 标签
// 的运行时解析走全局注册，类型在此处仅作 ComponentProps 能力的对称声明
type ElSelectProps = ComponentProps<typeof ElSelect>
void (0 as unknown as ElSelectProps)

interface Props {
  /** 字典 code（对应后端 /api/dict/:code） */
  dictCode: string
  /** 选中值（v-model） */
  modelValue?: string | number | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
}>()

// 运行时 BEM 命名空间：vv-dict-select
const bem = createNamespace('dict-select')

// —— 字典数据：内部自动调用 useDict（项目 composable，AutoImport 注入）——
const dictState = useDict(props.dictCode)
// dictCode 是运行时 prop，动态 key 从 useDict 返回对象中取对应 Ref
const options = computed<DictItem[]>(() => {
  const entry = (dictState as Record<string, Ref<DictItem[]>>)[props.dictCode]
  return isRef(entry) ? entry.value : []
})
// dictCode 切换时补拉新字典（合并新 Ref 到本组件持有的状态对象）
watch(
  () => props.dictCode,
  (code) => {
    if (code && !(code in dictState)) {
      Object.assign(dictState, useDict(code))
    }
  }
)

// —— v-model 桥接：el-select 更新 → 透传父级 ——
const innerValue = computed<Props['modelValue']>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * el-select 绑定：modelValue 为 null / undefined（空选）时不绑定 model-value；
 * $attrs 一并合并进同一个对象。两个原因：
 * - exactOptionalPropertyTypes：el-select 的 modelValue 类型不含 undefined / null，
 *   显式 `:model-value="可能为空的值"` 会报 TS2379
 * - 模板里写两个 v-bind（$attrs + selectBind）会触发 vite-plugin-vue-inspector
 *   的 Duplicate attribute 编译告警（vue-devtools 内置）
 */
const attrs = useAttrs()
const selectBind = computed(() => {
  const v = props.modelValue
  return v === null || v === undefined ? { ...attrs } : { ...attrs, modelValue: v }
})

/**
 * el-option 绑定：只在字段有值时才放入绑定对象。
 * exactOptionalPropertyTypes 下不能给可选 prop 显式传 undefined。
 *
 * 返回类型为何用 `as unknown as ElOptionProps` 断言链：
 * EP 2.14.3 的 option.vue.d.ts 在 TypeScript 6.0.3 + vue-tsc 3.3.11 下
 * ExtractPropTypes 对 value / label 不求值（已用隔离组件验证：最简单的
 * `:value="'a'"` 绑定也报 TS2322，属 EP 类型 bug，与本组件代码无关）。
 * 断言仅绕过类型检查 —— 运行时绑定结构（value / label / disabled）正确。
 * EP 修复后应移除断言，恢复直接返回。
 */
function optionBind(item: DictItem): ElOptionProps {
  const bind: { value: string | number; label: string; disabled?: boolean } = {
    value: item.value,
    label: item.label,
  }
  if (item.disabled) bind.disabled = true
  return bind as unknown as ElOptionProps
}
</script>

<template>
  <!-- selectBind 已合并 $attrs 透传（clearable / filterable / placeholder 等）与
       v-model 桥接（modelValue 在后优先级更高） -->
  <el-select :class="bem.b()" v-bind="selectBind" @update:model-value="innerValue = $event">
    <el-option v-for="item in options" :key="item.value" v-bind="optionBind(item)" />
  </el-select>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-dict-select {
  // 宽度由消费方布局决定（行内表单 / 栅格场景差异大），组件不预设；
  // 需要固定宽度时由业务在外层包裹或传 class
}
</style>
