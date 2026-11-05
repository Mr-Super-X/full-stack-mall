<script setup lang="ts">
/**
 * 字典标签 —— el-tag 的 dictCode + value 驱动封装。
 *
 * 设计要点：
 * - 内部自动调用 useDict，按 value 匹配字典项的 label / type / cssClass 渲染
 * - 契约兜底：字典未加载完或找不到匹配项时**直接显示 value 原文**，不报错、不白屏
 *   （后端历史脏数据 / 字典下线场景下页面依然可渲染）
 * - value 为空（null / undefined / ''）显示 '-' 占位（表格列空值惯例）
 * - cssClass 透传到 el-tag 根节点：业务可给特定字典项定制样式
 *   （mock 数据 gender.female 带 cssClass，演示页有配套样式）
 * - `v-bind="$attrs"` 透传 el-tag 原生能力（size / effect 等）
 *
 * 多根节点（el-tag / 占位 span）+ inheritAttrs:false：attrs 显式绑定到
 * el-tag 分支，避免 Vue 把透传属性挂到 fragment 上产生告警。
 *
 * @example
 * ```vue
 * <DictTag dict-code="user_status" :value="row.status" />
 * ```
 *
 * @see `@vv/shared` composables/useDict —— 内部字典数据源（包内 composables/ 仅 useDialog 族，2026-10-27 审计修断链）
 * @see `@vv/shared` types/dict —— DictItem 契约（type / cssClass 字段；ui/src/types 不存在，原相对链接断链）
 * @group 字典组件
 */
import type { Ref } from 'vue'
import type { DictItem } from '@vv/shared'

interface Props {
  /** 字典 code（对应后端 /api/dict/:code） */
  dictCode: string
  /** 要展示的字典值 */
  value?: string | number | null
}

const props = defineProps<Props>()

// attrs 显式透传到 el-tag（多根节点组件需关闭自动继承，否则告警）
defineOptions({ inheritAttrs: false })

// 运行时 BEM 命名空间：vv-dict-tag
const bem = createNamespace('dict-tag')

// —— 字典数据：内部自动调用 useDict（项目 composable，AutoImport 注入）——
const dictState = useDict(props.dictCode)
const options = computed<DictItem[]>(() => {
  const entry = (dictState as Record<string, Ref<DictItem[]>>)[props.dictCode]
  return isRef(entry) ? entry.value : []
})
// dictCode 切换时补拉新字典（同 DictSelect）
watch(
  () => props.dictCode,
  (code) => {
    if (code && !(code in dictState)) {
      Object.assign(dictState, useDict(code))
    }
  }
)

/** 当前 value 命中的字典项（未命中为 undefined） */
const matched = computed(() => options.value.find((item) => item.value === props.value))

/** 显示文本：命中 → label；未命中 → value 原文（契约要求）；value 为空 → ''（走占位） */
const displayText = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return ''
  return matched.value?.label ?? String(props.value)
})

/**
 * el-tag 绑定：type 只在命中且有值时绑定（空串 = 默认主题不绑定）。
 * exactOptionalPropertyTypes 下不能给可选 prop 显式传 undefined，
 * 故用 v-bind 对象展开而非 `:type="x || undefined"`。
 * 与 $attrs 合并为单个 v-bind：模板里写两个 v-bind 会触发
 * vite-plugin-vue-inspector 的 Duplicate attribute 编译告警（vue-devtools 内置）。
 */
const attrs = useAttrs()
const tagBind = computed(() => ({
  ...attrs,
  ...(matched.value?.type ? { type: matched.value.type } : {}),
}))
</script>

<template>
  <el-tag v-if="displayText" :class="[bem.b(), matched?.cssClass]" v-bind="tagBind">
    {{ displayText }}
  </el-tag>
  <span v-else :class="bem.e('empty')">-</span>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-dict-tag {
  // 字典标签默认沿用 el-tag 主题；业务通过字典项的 cssClass 钩子定制
  //（如 mock 的 gender.female → .vv-dict-tag--female，配套样式见 Dict.vue 演示页）

  &__empty {
    color: var(--el-text-color-secondary);
  }
}
</style>
