<script setup lang="ts">
/**
 * XForm slots 支持 render function / JSX 演示
 *
 * 覆盖功能：
 *   1. 函数 slot：直接传入函数作为 Vue slot，返回 VNode
 *   2. scoped slot：函数接收 scope 参数（如 el-table 行数据，这里用 el-card 演示）
 *   3. JSX 产物：函数内部用 h() 模拟 JSX 编译结果
 *   4. 字符串 slot：保持现有行为，走 schema 渲染
 */
import { h } from 'vue'
import { ElButton, ElIcon } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { slotTypeItems } from './configs/xform-demos-api'
import xFormSlotsSource from './XFormSlots.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, onReset, copySchema } = useXFormDemo({
  name: 'slots',
  schema: () => schema,
})

// model 中 file 是 Upload 组件的 fileList（modelProp: 'fileList'）——
// el-upload 期望 Array，初始必须 [] 而非 ''（否则触发 ElUploadContent 的
// Invalid prop 警告：Expected Array, got String）
const model = reactive<Record<string, unknown>>({
  file: [],
})

// 函数 slot：header 区域渲染一个 ElButton
const headerSlot = () =>
  h(ElButton, { type: 'primary', size: 'small' }, { default: () => '函数 slot：header 按钮' })

// scoped slot：接收 scope 参数，渲染带图标的提示
const scopedSlot = (scope?: Record<string, unknown>) =>
  h('div', { class: 'scoped-slot-content' }, [
    h(ElIcon, null, { default: () => h(Upload) }),
    h('span', null, scope?.label as string),
  ])

// JSX 产物模拟：用 h() 构造上传触发按钮
const jsxSlot = () =>
  h(
    ElButton,
    { type: 'primary' },
    {
      default: () => [h(ElIcon, null, { default: () => h(Upload) }), ' 点击上传'],
    }
  )

const schema: SchemaNode = {
  children: [
    {
      component: 'Card',
      label: '函数 slot 演示',
      slots: {
        header: headerSlot,
      },
      children: [
        {
          component: 'Input',
          name: 'file',
          label: '文件说明',
          slots: {
            // scoped slot：scope 由 el-input 传入（如 prefix/suffix 无 scope 时为空对象）
            suffix: scopedSlot,
          },
          props: { placeholder: '请输入文件说明' },
        },
      ],
    },
    {
      component: 'Upload',
      name: 'file',
      label: '上传组件',
      modelProp: 'fileList',
      props: {
        autoUpload: false,
        listType: 'text',
      },
      slots: {
        // 字符串 slot 保持现有行为
        tip: '支持 jpg / png 格式，单个文件不超过 5MB',
        // JSX 产物 slot
        default: jsxSlot,
      },
    },
  ],
}

const formRef = ref<InstanceType<typeof XForm> | null>(null)
const msg = ref('')

function onValidate() {
  formRef.value?.validate().then((valid: boolean) => {
    msg.value = valid ? '✅ 校验通过' : '❌ 校验失败'
  })
}

const tocItems = [
  { id: 'demo-slots', label: '插槽演示' },
  { id: 'api-slots-type', label: '插槽三种形式' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XForm Slots 支持 render function / JSX"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'schema.slots 支持三种内容：SchemaNode / 字符串 / 函数。',
      '函数 slot 会被直接作为 Vue slot 函数使用，支持 scoped slot（接收 scope 参数）。',
      'JSX 编译产物本质上就是返回 VNode 的函数，因此同样受支持。',
    ]"
  >
    <section id="demo-slots">
      <DemoField label="slots 渲染演示" :code="xFormSlotsSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <span :class="bem.e('msg')">{{ msg }}</span>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="插槽三种形式" :items="slotTypeItems" anchor="api-slots-type" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-slots {
  padding: 16px;

  &__actions {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__msg {
    color: #666;
  }
}

.scoped-slot-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 13px;
}
</style>
