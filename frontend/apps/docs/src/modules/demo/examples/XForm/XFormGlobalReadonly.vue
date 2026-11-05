<script setup lang="ts">
/**
 * 演示 schema 顶层 readonly（全局只读：所有字段按 view 态纯文本展示）
 *
 * 与 XFormFieldPermission 区别：XFormFieldPermission 演示字段级 permission；
 * 本页演示顶层 schema.readonly（透传 XForm globalReadonly → permission gate 走 view 态渲染）
 *
 * 与 XFormDisabled 区别：disabled 字段仍渲染为可识别控件但不可编辑；readonly 字段
 * 渲染为纯文本（view 态），跳过校验，不包 form-item 包装
 *
 * 三种写法（顶层 schema.readonly 是 ReactionValue<boolean>）：
 *   ① 字面量：readonly: true（写死）
 *   ② 函数：readonly: (m) => m.lockAll（响应开关）
 *   ③ {{ fn }} 表达式：readonly: '{{ (m) => m.lockAll }}'（沙箱隔离版）
 *
 * 优先级：hidden > readonly(view) > edit
 * 字段级只读请用 permission: 'view'（顶层 readonly 仅顶层生效）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { globalReadonlyItems } from './configs/xform-demos-api'
import xFormSource from './XFormGlobalReadonly.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-global-readonly')

const { formRef, copySchema, onReset } = useXFormDemo({
  name: 'global-readonly',
  schema: () => schema.value,
  model: () => model,
})

const model = reactive({
  lockAll: false,
  name: '张三',
  role: 'admin',
  email: 'zhangsan@example.com',
  remark: '这是一段备注',
  // 字段级权限演示
  fieldHidden: 'permission: hidden 字段',
  fieldView: 'permission: view 字段（始终纯文本）',
  fieldEdit: 'permission: edit 字段（始终可编辑，覆盖顶层 readonly）',
})

const mode = ref<'literal_true' | 'literal_false' | 'fn' | 'expr'>('fn')

/** schema computed：根据 mode 切换顶层 readonly 写法 */
const schema = computed<SchemaNode>(() => {
  let topReadonly: SchemaNode['readonly']
  if (mode.value === 'literal_true') topReadonly = true
  else if (mode.value === 'literal_false') topReadonly = false
  else if (mode.value === 'fn')
    topReadonly = (m: Record<string, unknown>) => Boolean((m as { lockAll: boolean }).lockAll)
  else topReadonly = '{{ (m) => m.lockAll === true }}'
  return {
    readonly: topReadonly,
    column: 2,
    row: { gutter: 16 },
    children: [
      {
        component: 'Card',
        props: { header: '① 顶层 schema.readonly 3 种写法对比（切换 RadioGroup）' },
        column: 2,
        children: [
          { name: 'name', label: '姓名', component: 'Input' },
          { name: 'email', label: '邮箱', component: 'Input' },
          {
            name: 'remark',
            label: '备注',
            component: 'Input',
            props: { type: 'textarea', rows: 2 },
          },
        ],
      },
      {
        component: 'Card',
        props: { header: '② 优先级：hidden > readonly(view) > edit' },
        column: 1,
        children: [
          {
            name: 'fieldHidden',
            label: 'permission: hidden（始终不渲染）',
            component: 'Input',
            permission: 'hidden',
          },
          {
            name: 'fieldView',
            label: 'permission: view（始终纯文本）',
            component: 'Input',
            permission: 'view',
          },
          {
            name: 'fieldEdit',
            label: 'permission: edit（始终可编辑，覆盖顶层 readonly）',
            component: 'Input',
            permission: 'edit',
          },
        ],
      },
    ],
  }
})

const currentModeLabel = computed(
  () =>
    ({
      literal_true: '字面量 readonly: true（写死，整表 view 化）',
      literal_false: '字面量 readonly: false（写死，整表可编辑）',
      fn: '函数 (m) => m.lockAll（响应 lockAll 开关）',
      expr: '{{ fn }} 表达式（同函数，沙箱隔离）',
    })[mode.value]
)

// formRef / copySchema 由 useXFormDemo 统一提供

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
  { id: 'demo-global-readonly', label: '全局 readonly 演示' },
  { id: 'api-global-readonly', label: '字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="顶层 schema.readonly（全局只读：所有字段 view 化）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'XFormFieldPermission 演示字段级 permission；本页演示顶层 schema.readonly（透传 XForm globalReadonly → permission gate 走 view 态渲染）。',
      '与全局 disabled 区别：disabled 字段仍渲染为可识别控件但不可编辑；readonly 字段渲染为纯文本（view 态），跳过校验，不包 form-item 包装。',
      'XForm 顶层 readonly 写法 3 种：字面量 / 函数 / {{ fn }} 表达式（顶层 readonly 是 ReactionValue<boolean>）。',
      '优先级：hidden > readonly(view) > edit；字段级只读请用 permission: view。',
    ]"
  >
    <section id="demo-global-readonly">
      <div :class="bem.e('controls')">
        <el-radio-group v-model="mode" size="large">
          <el-radio-button value="literal_true">字面量 true</el-radio-button>
          <el-radio-button value="literal_false">字面量 false</el-radio-button>
          <el-radio-button value="fn">函数</el-radio-button>
          <el-radio-button value="expr">
            <span v-pre>{{ fn }}</span>
            表达式
          </el-radio-button>
        </el-radio-group>
        <el-switch
          v-model="model.lockAll"
          :disabled="mode === 'literal_true' || mode === 'literal_false'"
          active-text="lockAll"
        />
        <span :class="bem.e('hint')">当前模式：{{ currentModeLabel }}</span>
      </div>
      <DemoField label="演示表单（切换 RadioGroup 看顶层 readonly 表现）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="顶层 schema.readonly 字段速查"
      :items="globalReadonlyItems"
      anchor="api-global-readonly"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-global-readonly {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #ecfdf5;
    border-radius: 4px;
    border-left: 4px solid #10b981;
    flex-wrap: wrap;
  }
  &__hint {
    font-size: 13px;
    color: #6b7280;
    width: 100%;
  }
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
