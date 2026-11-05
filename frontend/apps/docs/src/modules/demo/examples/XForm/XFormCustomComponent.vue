<script setup lang="ts">
/**
 * 演示 XFormProps.components —— 注册业务自定义组件到 schema
 *
 * 场景：工单标签选择器（自定义 MyTagSelector 组件）
 *   1. 业务自定义 Component（h() 渲染函数写法）
 *   2. 通过 components prop 注册（key = schema.component 字符串）
 *   3. schema 内 component: 'MyTagSelector' 自动解析
 *   4. props.modelValue + emit('update:modelValue') 自动双向绑定
 */
import { h, defineComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { ElTag, ElInput } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { customComponentItems } from './configs/xform-demos-api'
import xFormSource from './XFormCustomComponent.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'custom-component',
  schema: () => schema,
  model: () => model,
})

/**
 * 业务自定义组件：标签选择器（chips 输入 + 已选标签列表）
 * 复用 ElTag / ElInput 降低手写成本
 *
 * 使用 defineComponent + setup 形式：函数式 setup body 内不能直接用 ref()，
 * 改用 defineComponent 拿到 setup() 钩子用于本地 inputValue 状态。
 */
const MyTagSelector = defineComponent({
  name: 'MyTagSelector',
  props: {
    modelValue: { type: Array as () => string[], default: () => [] },
    options: {
      type: Array as () => Array<{ label: string; value: string }>,
      default: () => [],
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const inputValue = ref('')
    const selected = computed(() => props.modelValue ?? [])
    const opts = computed(() => props.options ?? [])

    function onRemove(v: string): void {
      emit(
        'update:modelValue',
        selected.value.filter((s) => s !== v)
      )
    }
    function onAdd(): void {
      const v = inputValue.value.trim()
      if (!v) return
      emit('update:modelValue', [...selected.value, v])
      inputValue.value = ''
    }
    function onSuggestClick(v: string): void {
      if (selected.value.includes(v)) return
      emit('update:modelValue', [...selected.value, v])
    }

    return () =>
      h('div', { class: 'my-tag-selector' }, [
        h(
          'div',
          { class: 'my-tag-selector__tags' },
          selected.value.map((v) =>
            h(
              ElTag,
              {
                key: v,
                closable: true,
                onClose: () => onRemove(v),
                class: 'my-tag-selector__tag',
              },
              () => v
            )
          )
        ),
        opts.value.length === 0
          ? null
          : h('div', { class: 'my-tag-selector__suggest' }, [
              h('span', { class: 'my-tag-selector__suggest-label' }, '快速选择：'),
              ...opts.value.map((o) =>
                h(
                  'button',
                  {
                    key: o.value,
                    type: 'button',
                    class: 'my-tag-selector__suggest-btn',
                    onClick: () => onSuggestClick(o.value),
                  },
                  o.label
                )
              ),
            ]),
        // ⭐ ElInput 双向绑 v-model：modelValue 绑 inputValue，update:modelValue 回写
        // h(ElInput, ...) 中 ElInput 的 props 类型推断复杂，用 any 局部断言避免 5+ 个 overload 不匹配错误
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h(ElInput as any, {
          modelValue: inputValue.value,
          'onUpdate:modelValue': (v: string | number | undefined) => {
            inputValue.value = v == null ? '' : String(v)
          },
          placeholder: '输入标签后回车',
          onKeydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter') onAdd()
          },
          class: 'my-tag-selector__input',
        }),
      ])
  },
})

const TAG_OPTIONS = [
  { label: '紧急', value: 'urgent' },
  { label: '重要', value: 'important' },
  { label: '需复盘', value: 'review' },
  { label: '已完成', value: 'done' },
]

const model = reactive<Record<string, unknown>>({
  ticketName: '',
  tags: ['urgent', 'important'],
})

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '工单名称',
      name: 'ticketName',
      component: 'Input',
      props: { placeholder: '请输入工单名称', clearable: true },
    },
    {
      // 业务自定义组件：components prop 已注册 MyTagSelector
      label: '工单标签',
      name: 'tags',
      component: 'MyTagSelector',
      props: { options: TAG_OPTIONS },
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

const tocItems = [
  { id: 'demo-custom-component', label: '自定义组件演示' },
  { id: 'api-custom-component', label: 'components prop 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormProps.components —— 注册业务自定义组件"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'components prop 注册业务自定义 Component，schema 内 component 字符串自动解析',
      '本 demo 演示 MyTagSelector：chips 显示已选标签 + 快速选择 + 输入框添加新标签 + ElTag closable 删除',
      'props.modelValue / update:modelValue 双向绑定（与 el-input 同模式，无需 modelProp）',
      '配合 module augmentation 扩展 ComponentPropsRegistry 可获得完整 TS 类型推导（见 types/custom-component.test-d.ts）',
    ]"
  >
    <section id="demo-custom-component">
      <DemoField label="工单录入（自定义组件）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" :components="{ MyTagSelector }" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="components prop 字段速查"
      :items="customComponentItems"
      anchor="api-custom-component"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-custom-component {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  .my-tag-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;

    &__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-height: 24px;
    }

    &__suggest {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__suggest-btn {
      padding: 2px 8px;
      font-size: 12px;
      background: var(--el-fill-color-light);
      border: 1px solid var(--el-border-color-light);
      border-radius: 3px;
      cursor: pointer;

      &:hover {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-5);
      }
    }
  }
}
</style>
