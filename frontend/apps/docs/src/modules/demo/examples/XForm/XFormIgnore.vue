<script setup lang="ts">
/**
 * 演示 schema 字段 ignore —— 节点跳过渲染
 *
 * 场景：审计日志表单（含服务端内部字段）
 *   1. 创建时间 / 操作人 ID 不渲染（前端无 UI，但传给后端）
 *   2. 隐藏必填校验：忽略字段即使有 rules 也不参与校验
 *   3. getNames 不包含 ignore 字段
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { ignoreItems } from './configs/xform-demos-api'
import xFormSource from './XFormIgnore.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'ignore',
  schema: () => schema,
  model: () => model,
})

const model = reactive<Record<string, unknown>>({
  action: 'create-order',
  operatorId: 'u-10086',
  createdAt: '2026-09-01 10:00:00',
})

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '操作类型',
      name: 'action',
      component: 'Input',
      rules: [{ required: true, message: '请输入操作类型', trigger: 'blur' }],
    },
    // 忽略字段：前端不渲染、不校验、但 model 中保留值（随表单提交传后端）
    {
      name: 'operatorId',
      ignore: true,
      component: 'Input',
      rules: [{ required: true, message: '操作人 ID 必填（不会触发）', trigger: 'blur' }],
    },
    {
      name: 'createdAt',
      ignore: true,
      component: 'Input',
      rules: [{ required: true, message: '创建时间必填（不会触发）', trigger: 'blur' }],
    },
  ],
}

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage({
    message: '保存成功：\n' + JSON.stringify(model, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

function onShowNames() {
  const names = formRef.value?.getNames() ?? []
  ElMessage({
    message: 'getNames() 返回：\n' + JSON.stringify(names, null, 2),
    type: 'info',
    duration: 0,
    showClose: true,
  })
}

const tocItems = [
  { id: 'demo-ignore', label: 'ignore 字段演示' },
  { id: 'api-ignore', label: 'ignore 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="schema 字段 ignore —— 节点跳过渲染"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'ignore: true 节点不创建 DOM、不参与校验、不参与 getNames()',
      '已写入 model 的字段值静默保留——可作「传给后端的隐藏字段」',
      '测试 1: 必填校验只在 action 上跑（operatorId / createdAt 即使有 rules 也不触发）',
      '测试 2: 点「getNames」 → 仅返回 [action]，不含 ignore 字段',
      '与 hidden 区别：hidden 渲染但 display:none + 参与校验；ignore 完全不渲染 + 跳过校验',
    ]"
  >
    <section id="demo-ignore">
      <DemoField label="审计日志表单（含 ignore 字段）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="onShowNames">getNames()</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable title="ignore 字段速查" :items="ignoreItems" anchor="api-ignore" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-ignore {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
