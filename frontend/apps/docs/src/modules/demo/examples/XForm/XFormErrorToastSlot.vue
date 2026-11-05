<script setup lang="ts">
/**
 * 演示 XForm 错误 toast 容器替换 —— #toastContainer slot
 *
 * 场景：业务希望用 element-plus ElNotification 替代默认 XFormErrorToast，
 * 通过 slot 完整接管错误提示容器（接入业务统一通知体系/自定义样式）。
 *
 * 演示闭环（已接通 errorBus 真实事件流，非空转）：
 * 1. 密码与确认密码填不一致（或留空必填项）→ 点「校验」
 * 2. validateForm() 失败 → errorBus.report(...) → slot 注入的 events 更新
 * 3. 桥接组件 XFormElNotificationHost watch 到新事件 → 命令式 ElNotification 右上角弹出
 * 4. 同时 el-form 字段红字（错误定位能力不受容器替换影响）
 *
 * 关键认知：
 * - ElNotification 是命令式 API —— slot 内声明式 <ElNotification v-for> 会把通知
 *   内容内联渲染进表单 DOM，而非 body 浮层；正确姿势是 watch events → 命令式调用
 * - slot 契约仅注入 { events }（见 docs/24 §Slots），errorBus.dismiss 对消费方不可达，
 *   业务单向接管即可；不传 slot 时 fallback 走默认 XFormErrorToast，行为与升级前一致
 *
 * @see ./utils/XFormElNotificationHost.vue （events → ElNotification 桥接实现）
 * @see @vv/ui/components/form-schema/components/XForm.vue （slot 定义处）
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { errorToastSlotItems } from './configs/xform-demos-api'
import xFormErrorToastSlotSource from './XFormErrorToastSlot.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'
import XFormElNotificationHost from './utils/XFormElNotificationHost.vue'

// formRef 必须解构进 setup 作用域，模板 ref="formRef" 才能回填（漏解构会让重置静默失效）
const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'error-toast-slot',
  schema: () => schema,
  model: () => model,
})

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      props: { placeholder: '请输入用户名（必填）', clearable: true },
      rules: [{ required: true, message: '请输入用户名', trigger: 'change' }],
    },
    {
      label: '密码',
      name: 'password',
      component: 'Input',
      props: { type: 'password', placeholder: '6 位以上', clearable: true },
      rules: [{ required: true, message: '请输入密码', trigger: 'change' }],
    },
    {
      label: '确认密码',
      name: 'confirmPassword',
      component: 'Input',
      props: { type: 'password', placeholder: '再次输入密码（演示跨字段校验）', clearable: true },
      rules: [
        { required: true, message: '请再次输入密码', trigger: 'change' },
        // 提交时跨字段兜底 —— 校验失败经 errorBus 上报，由 slot 接管的 ElNotification 弹出
        {
          dependsOn: ['password'],
          crossValidator: (value: unknown, password: unknown) =>
            value === password || '两次密码不一致',
        },
      ],
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  password: '',
  confirmPassword: '',
})

/**
 * 触发校验 —— 失败反馈完全走 slot 接管的 ElNotification，不额外弹 ElMessage，
 * 避免默认反馈渠道掩盖「容器已被业务接管」的演示效果
 */
async function onValidate(): Promise<void> {
  await formRef.value?.validate()
}

const tocItems = [
  { id: 'demo-error-toast-slot', label: 'toastContainer 替换演示' },
  { id: 'api-error-toast-slot', label: 'toastContainer slot 速查' },
]

useDocToc(tocItems)

const introductions = [
  'XForm 默认嵌入 XFormErrorToast 展示 errorBus 事件；通过 #toastContainer slot 可完整接管容器',
  'slot 契约仅注入响应式 events 数组（FormErrorEvent[]，含 dismissed 标记），errorBus.dismiss 对消费方不可达（见 docs/24 §Slots）',
  'ElNotification 是命令式 API：slot 里声明式 <ElNotification v-for> 会把通知内联渲染进表单 DOM，正确姿势是 watch events → 命令式调用',
  '演示闭环：密码与确认密码填不一致（或留空必填项）→ 点「校验」→ errorBus 事件经桥接组件弹出 ElNotification，同时表单字段红字',
  '不传 slot 时 fallback 走默认 XFormErrorToast，行为与升级前完全一致',
]
</script>

<template>
  <DemoFrame
    title="XForm 错误 toast 容器替换 —— #toastContainer slot"
    source="src/components/form-schema/components/XForm.vue"
    :introductions="introductions"
  >
    <section id="demo-error-toast-slot">
      <DemoField label="toastContainer 替换演示" :code="xFormErrorToastSlotSource">
        <XForm ref="formRef" :schema="schema" :model="model">
          <!--
              slot 接管：events 经桥接组件转为命令式 ElNotification。
              host 不渲染 DOM（ElNotification 自带 teleport to body），
              此处挂 slot 只为替换默认 XFormErrorToast 的渲染层
            -->
          <template #toastContainer="{ events }">
            <XFormElNotificationHost :events="events" />
          </template>
        </XForm>
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="toastContainer slot 速查"
      :items="errorToastSlotItems"
      anchor="api-error-toast-slot"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-error-toast-slot {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
