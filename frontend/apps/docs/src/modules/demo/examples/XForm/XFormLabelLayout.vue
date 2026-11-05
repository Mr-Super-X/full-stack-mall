<script setup lang="ts">
/**
 * 演示顶层 schema 字段 labelPosition / labelWidth —— 表单整体布局
 *
 * 场景：响应式中后台录入
 *   1. labelPosition: 'top' —— 移动端友好（label 在字段上方）
 *   2. labelPosition: 'left' + labelWidth: '120px' —— 桌面端标准
 *   3. 切换演示三种 labelPosition 的视觉差异
 *   4. labelPosition / labelWidth 顶层为默认；字段级可声明 override 顶层（line 67-77 演示）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { labelLayoutItems } from './configs/xform-demos-api'
import xFormSource from './XFormLabelLayout.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'label-layout',
  schema: () => schema.value,
})

type LabelPosition = 'left' | 'right' | 'top'
const position = ref<LabelPosition>('left')
const width = ref<string>('120px')

const model = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  age: undefined,
  remark: '',
})

/** schema computed：切换 position / width 自动重新渲染 */
const schema = ref<SchemaNode>(buildSchema())

function buildSchema(): SchemaNode {
  return {
    labelPosition: position.value,
    labelWidth: width.value,
    column: 1,
    children: [
      {
        label: '用户名',
        name: 'username',
        component: 'Input',
        rules: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
      },
      {
        label: '邮箱',
        name: 'email',
        component: 'Input',
        rules: [{ required: true, type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
      },
      {
        label: '年龄',
        name: 'age',
        component: 'InputNumber',
        props: { min: 0, max: 150, controlsPosition: 'right' },
      },
      {
        label: '备注（字段级 labelPosition=top）',
        name: 'remark',
        component: 'Input',
        // ⭐ 字段级 labelPosition override 顶层 'left'
        labelPosition: 'top',
        props: {
          type: 'textarea',
          placeholder: '字段级 labelPosition=top 独立 override 顶层',
          clearable: true,
        },
      },
    ],
  }
}

/**
 * 监听 position / width 自动 rebuild：用户改任一控件即重建 schema，无需点「应用」按钮
 * rebuild 函数定义在 schema ref 初始化之后，watch 在 setup 末尾执行
 */
function rebuild(): void {
  schema.value = buildSchema()
}
watch([position, width], rebuild)

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

const tocItems = [
  { id: 'demo-label-layout', label: 'label 布局演示' },
  { id: 'api-label-layout', label: 'labelPosition / labelWidth 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="labelPosition / labelWidth —— 顶层默认 + 字段级 override"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'labelPosition / labelWidth 顶层配置为表单整体默认；字段级可声明 override 顶层',
      'top：移动端推荐（label 在字段上方，节省横向空间）',
      'left：桌面端标准（label 左对齐 + 120px 宽）',
      'right：右对齐（少见，用于对齐要求严格的表单）',
      'element-plus el-form-item 原生支持 labelPosition / labelWidth，字段级与顶层可独立设置',
      '字段级未声明时 el-form-item 自动继承 el-form 顶层（element-plus 原生行为）',
    ]"
  >
    <section id="demo-label-layout">
      <div :class="bem.e('controls')">
        <span>labelPosition：</span>
        <el-radio-group v-model="position">
          <el-radio-button value="left">left</el-radio-button>
          <el-radio-button value="right">right</el-radio-button>
          <el-radio-button value="top">top（推荐移动端）</el-radio-button>
        </el-radio-group>
        <span>labelWidth：</span>
        <el-input v-model="width" placeholder="如 120px / 160px" style="width: 140px" />
        <!-- 「应用」按钮保留作为手动 rebuild 入口（watch 已自动触发，可省略） -->
      </div>

      <DemoField label="用户录入（label 布局切换）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="labelPosition / labelWidth 字段速查"
      :items="labelLayoutItems"
      anchor="api-label-layout"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-label-layout {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    flex-wrap: wrap;
    font-size: 13px;
  }

  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
