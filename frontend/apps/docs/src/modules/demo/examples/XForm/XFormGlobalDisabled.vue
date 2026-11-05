<script setup lang="ts">
/**
 * 演示 schema 顶层 disabled（全局禁用整个表单）
 *
 * 与 XFormDisabled.vue 区别：XFormDisabled 演示字段级 node.disabled；本页演示顶层
 * schema.disabled（透传 el-form disabled，与 labelPosition 同模式），并对比 3 种写法
 * 与字段级 disabled / permission: 'hidden' 的优先级
 *
 * 三种写法（顶层 schema.disabled 是 ReactionValue<boolean>）：
 *   ① 字面量：disabled: true（写死，写在顶层 schema）
 *   ② 函数：disabled: (m) => m.lockAll（响应顶层开关）
 *   ③ {{ fn }} 表达式：disabled: '{{ (m) => m.lockAll }}'（沙箱隔离版）
 *
 * 优先级：permission: 'hidden'（最高，不渲染）> 字段级 props.disabled > 顶层 schema.disabled
 * el-form 自动跳过 disabled 字段的校验（async-validator 行为）。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { globalDisabledItems } from './configs/xform-demos-api'
import xFormSource from './XFormGlobalDisabled.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-global-disabled')

const { formRef, copySchema, onReset } = useXFormDemo({
  name: 'global-disabled',
  schema: () => schema.value,
  model: () => model,
})

const model = reactive({
  lockAll: false,
  field1: '字段 1（被顶层 disabled 控制）',
  field2: '字段 2（被顶层 disabled 控制）',
  fieldLevelDisabled: '字段级 props.disabled = true（无论顶层如何始终禁用）',
  hiddenByPermission: 'permission: hidden（始终不渲染）',
  viewByPermission: 'permission: view（顶层 disabled 不会改变 view 态展示）',
})

// 全局 disabled 写法 4 选 1
const mode = ref<'literal_true' | 'literal_false' | 'fn' | 'expr'>('fn')

/** schema computed：根据 mode 切换顶层 disabled 写法；XForm watch 重新求值 */
const schema = computed<SchemaNode>(() => {
  // 顶层 disabled：4 种写法各自表达
  let topDisabled: SchemaNode['disabled']
  if (mode.value === 'literal_true') topDisabled = true
  else if (mode.value === 'literal_false') topDisabled = false
  else if (mode.value === 'fn')
    topDisabled = (m: Record<string, unknown>) => Boolean((m as { lockAll: boolean }).lockAll)
  else topDisabled = '{{ (m) => m.lockAll === true }}'
  return {
    disabled: topDisabled,
    column: 1,
    children: [
      {
        component: 'Card',
        props: { header: '① 顶层 schema.disabled 4 种写法对比（切换上方 RadioGroup）' },
        column: 2,
        row: { gutter: 16 },
        children: [
          {
            name: 'field1',
            label: '字段 1',
            component: 'Input',
            props: { placeholder: '受顶层 disabled 控制' },
          },
          {
            name: 'field2',
            label: '字段 2',
            component: 'Input',
            props: { placeholder: '受顶层 disabled 控制' },
          },
        ],
      },
      {
        component: 'Card',
        props: { header: '② 优先级：permission > 字段级 props.disabled > 顶层 disabled' },
        column: 1,
        row: { gutter: 16 },
        children: [
          {
            name: 'fieldLevelDisabled',
            label: '字段级 props.disabled = true（始终禁用）',
            component: 'Input',
            props: { disabled: true },
          },
          {
            name: 'hiddenByPermission',
            label: 'permission: hidden（不渲染，优先级最高）',
            component: 'Input',
            permission: 'hidden',
            props: { placeholder: '无论顶层 disabled 如何，permission: hidden 字段不渲染' },
          },
          {
            name: 'viewByPermission',
            label: 'permission: view（始终纯文本展示，不受 disabled 影响）',
            component: 'Input',
            permission: 'view',
            props: { placeholder: 'permission: view 字段不走 disabled 路径，渲染为纯文本' },
          },
        ],
      },
    ],
  }
})

const currentModeLabel = computed(
  () =>
    ({
      literal_true: '字面量 disabled: true（写死）',
      literal_false: '字面量 disabled: false（写死）',
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
  { id: 'demo-global-disabled', label: '全局 disabled 演示' },
  { id: 'api-global-disabled', label: '字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="顶层 schema.disabled（全局禁用整个表单）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'XFormDisabled 演示字段级 node.disabled；本页演示顶层 schema.disabled（透传 el-form disabled，与 labelPosition 同模式）。',
      'XForm 顶层 disabled 写法 4 种：字面量 true / 字面量 false / 函数 / {{ fn }} 表达式（顶层 disabled 是 ReactionValue<boolean>，不支持 reaction 对象）。',
      '优先级：permission: hidden（最高，不渲染） > 字段级 props.disabled > 顶层 schema.disabled',
      'el-form 自动跳过 disabled 字段的校验（async-validator 行为）。',
    ]"
  >
    <section id="demo-global-disabled">
      <div :class="bem.e('controls')">
        <el-radio-group v-model="mode" size="large">
          <el-radio-button value="literal_true">字面量 true</el-radio-button>
          <el-radio-button value="literal_false">字面量 false</el-radio-button>
          <el-radio-button value="fn">函数</el-radio-button>
          <el-radio-button value="expr">
            <code>{{ '{' }}{{ '{' }} fn {{ '}' }}{{ '}' }}</code>
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
      <DemoField label="演示表单（切换 RadioGroup 看顶层 disabled 表现）" :code="xFormSource">
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
      title="顶层 schema.disabled 字段速查"
      :items="globalDisabledItems"
      anchor="api-global-disabled"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-global-disabled {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #fef9c3;
    border-radius: 4px;
    border-left: 4px solid #eab308;
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
