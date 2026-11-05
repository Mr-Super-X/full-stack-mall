<script setup lang="ts">
/**
 * ProDialogForm —— ProDialog + XForm 的高级弹窗表单组合
 *
 * 能力:v-model 控制显隐 / 内置「确定 / 取消」footer(校验→onSubmit→自动关闭) /
 * 关闭后(动画结束)自动 resetFields / 提交期间按钮 loading / 透传 ProDialog 原生 attrs。
 *
 * 依赖:ProDialog(弹窗底层) + XForm(表单底层)。
 * @see ./types.ts Props/Emits/Expose 类型
 * @see ./composables/useDialogSubmit.ts 提交逻辑封装
 * @see ./composables/useResetOnClose.ts 关闭重置封装
 * @see ./composables/buildXFormExposeProxy.ts defineExpose 代理工厂
 * @see ../ProDialog/ProDialog.vue
 * @see ../../../form-schema/components/XForm.vue
 * @group 通用组件:ProDialogForm
 */
import type { ProDialogFormExpose, ProDialogFormProps } from './types'
import type { RuleItem } from '../../form-schema/types.ts'
import { useDialogSubmit } from './composables/useDialogSubmit'
import { useResetOnClose } from './composables/useResetOnClose'
import { buildXFormExposeProxy } from './composables/buildXFormExposeProxy'

/**
 * 空 rules 稳定引用 —— 不能用模板内联 `props.rules ?? {}`：
 * 内联对象每次父渲染生成新引用，XForm 的 renderOpts 引用比较会判定 rules 换代，
 * 触发 optsEpoch++ → 全部字段 SchemaField 失效重建（性能回归）
 */
const EMPTY_RULES: Record<string, RuleItem> = {}

defineOptions({
  name: 'ProDialogForm',
  // 透传原生 attrs(close-on-click-modal / before-close 等)到内部 ProDialog
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ProDialogFormProps>(), {
  width: '500px',
  submitButtonText: '确 定',
  cancelButtonText: '取 消',
  resetOnClose: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
  submitFailed: [error: unknown]
}>()

// BEM 命名空间占位(createNamespace 由 unplugin-auto-import 注入,详见 CLAUDE.md §1.6)
const bem = createNamespace('pro-dialog-form')

// XForm 实例 ref —— 挂载后由模板赋值,卸载后被 Vue 置 null
const formRef = ref<ProDialogFormExpose | null>(null)

// 提交逻辑(防重复 + loading 控制 + 错误归一化)—— 见 useDialogSubmit 内部实现
const { submitLoading, handleSubmit } = useDialogSubmit({
  formRef: () => formRef.value,
  // 用 getter 闭包 props.onSubmit + props.model,保留响应式追踪
  onSubmit: () => props.onSubmit(props.model),
  onSuccess: () => {
    emit('update:modelValue', false)
    emit('success')
  },
  onSubmitFailed: (err) => {
    // 不 throw err(避免触发全局 errorHandler → 500 重定向);调用方监听 @submit-failed 自行提示
    // console.error 仅在调试场景留痕,生产环境可通过替换 useDialogSubmit 的 onError hook 接管
    console.error('[ProDialogForm] onSubmit failed:', err)
    emit('submitFailed', err)
  },
})

// 关闭时重置表单(动画结束后调用 resetFields,避免闪烁)—— timer 在 onUnmounted 中清理
const { handleClose } = useResetOnClose({
  formRef: () => formRef.value,
  resetOnClose: () => props.resetOnClose,
  onReset: (ref) => ref.resetFields(),
})

// defineExpose:透传 XFormExpose 全部 19 个方法 —— 见 buildXFormExposeProxy 内部实现
defineExpose<ProDialogFormExpose>(buildXFormExposeProxy(() => formRef.value))
</script>

<template>
  <ProDialog
    :class="bem.b()"
    :model-value="modelValue"
    :title="title"
    :width="width"
    v-bind="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <!--
      XForm 表单主体 —— 通过 ref 绑定,submit 时调用 validate()
      v-bind="xformProps" 在前：显式 props（schema/model/rules）后绑定，
      同名键以显式 props 为准（扩展能力不覆盖主数据契约）
    -->
    <XForm
      ref="formRef"
      v-bind="xformProps"
      :schema="schema"
      :model="model"
      :rules="props.rules ?? EMPTY_RULES"
    />

    <!-- 默认插槽:在表单之后插入额外内容(分隔线 / 说明文字) -->
    <slot />

    <!-- footer 插槽:作用域插槽,暴露 submit/cancel/loading 供调用方复用 -->
    <template #footer>
      <slot
        name="footer"
        :submit="handleSubmit"
        :cancel="() => emit('update:modelValue', false)"
        :loading="submitLoading"
      >
        <el-button @click="emit('update:modelValue', false)">
          {{ cancelButtonText }}
        </el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ submitButtonText }}
        </el-button>
      </slot>
    </template>
  </ProDialog>
</template>

<style lang="scss">
/* 命名空间占位 —— 子组件样式按需下钻到 .#{$BEM_PREFIX}-pro-dialog-form__xxx */
.#{$BEM_PREFIX}-pro-dialog-form {
}
</style>
