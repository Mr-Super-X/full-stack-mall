<script setup lang="ts">
/**
 * 演示 XFormProps.zodSchema + 实例方法 validateWithZod()
 *
 * 场景：用户注册表单
 *   1. zod schema 集中声明业务校验规则（邮箱 / 年龄区间 / 密码强度）
 *   2. validateWithZod() 异步返回 { success, errors }
 *   3. 与 el-form 校验互补：zod 覆盖复杂业务规则（如密码含大写字母 + 数字）
 */
import { z } from 'zod'
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { zodItems } from './configs/xform-demos-api'
import xFormSource from './XFormZod.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'zod',
  schema: () => schema,
  model: () => model,
})

/** 集中式 zod schema —— 业务规则集中地 */
const userZodSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  age: z.number({ message: '年龄必须是数字' }).min(18, '必须年满 18 岁').max(120, '年龄超出范围'),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .regex(/[A-Z]/, '需含大写字母')
    .regex(/[0-9]/, '需含数字'),
})

const model = reactive<Record<string, unknown>>({
  email: '',
  age: undefined,
  password: '',
})

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: 'a@b.com', clearable: true },
    },
    {
      label: '年龄',
      name: 'age',
      component: 'InputNumber',
      props: { min: 0, max: 150, controlsPosition: 'right' },
    },
    {
      label: '密码',
      name: 'password',
      component: 'InputPassword',
      props: { placeholder: '至少 8 位，含大写字母与数字' },
    },
  ],
}

async function onZodValidate() {
  const result = await formRef.value?.validateWithZod()
  if (!result) {
    ElMessage.error('未配置 zodSchema prop')
    return
  }
  if (result.success) {
    ElMessage.success('zod 校验通过')
  } else {
    ElMessage({
      message: 'zod 校验失败：\n' + JSON.stringify(result.errors, null, 2),
      type: 'warning',
      duration: 0,
      showClose: true,
    })
  }
}

const tocItems = [
  { id: 'demo-zod', label: 'zod 校验演示' },
  { id: 'api-zod', label: 'zodSchema 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormProps.zodSchema + validateWithZod()"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'zodSchema prop 接收 ZodType，validateWithZod() 异步返回 { success, errors: [{ path, message }] }',
      '业务规则集中声明（邮箱格式 / 年龄区间 / 密码强度），schema 保持简洁',
      '与 el-form 字段规则互补：zod 处理跨字段、复杂业务；el-form 处理必填 / 正则等基础规则',
      '测试：邮箱「abc」 → 失败；年龄 12 → 失败；密码「abc」 → 失败（同时满足长度+大写+数字）',
    ]"
  >
    <section id="demo-zod">
      <DemoField label="用户注册（zod 校验）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" :zod-schema="userZodSchema" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onZodValidate">zod 校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable title="zodSchema 字段速查" :items="zodItems" anchor="api-zod" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-zod {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
