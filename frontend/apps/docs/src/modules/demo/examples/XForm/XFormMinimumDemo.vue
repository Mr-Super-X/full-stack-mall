<script setup lang="ts">
/**
 * 最小可运行示例 —— 展示 XForm 最简用法
 * 一个 input + 校验按钮 + 提交反馈
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { minimumItems } from './configs/xform-demos-api'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'minimum',
  schema: () => schema,
})

const model = reactive<Record<string, unknown>>({})

const schema: SchemaNode = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  defaultValue: 'user@example.com',
  rules: [
    { required: true, message: '邮箱必填', trigger: 'blur' },
    {
      validator: (_r: unknown, v: unknown, cb: (err?: Error) => void) => {
        const ok = typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        cb(ok ? undefined : new Error('邮箱格式不正确'))
      },
    },
  ],
}

async function onSave() {
  // 演示 XForm validate 链路：先校验 → 通过才提示成功；失败时 ElMessage 报错
  const valid = await formRef.value?.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查必填项')
    return
  }
  ElMessage.success('保存成功（已通过 validate 校验）')
}

const tocItems = [
  { id: 'demo-minimum', label: '最小示例' },
  { id: 'api-minimum', label: '最小示例三要素' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XForm 最小可运行示例"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'XForm 最简用法：写 schema + 传 model + 渲染。',
      'defaultValue 会在挂载时自动填充到 model（如果未设置）。',
      'rules 支持 async-validator 格式，必填 + 正则校验。',
    ]"
  >
    <section id="demo-minimum" :class="bem.b()">
      <XForm ref="formRef" :schema="schema" :model="model" />
      <div :class="bem.e('actions')">
        <el-button @click="onReset">重置</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
        <el-button @click="copySchema">复制 schema</el-button>
      </div>
      <ModelPreview :model="model" />
    </section>

    <ApiTable title="最小示例三要素" :items="minimumItems" anchor="api-minimum" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-minimum {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
