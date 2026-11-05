<script setup lang="ts">
/**
 * 演示 schema 字段 formItem —— 自定义 form-item 包装
 *
 * 场景：用户录入（含特殊 label / 必填样式 / 提示语）
 *   1. formItem: false —— 裸渲染组件（无 form-item 包装，作为展示型 UI 块）
 *   2. formItem: { props: { labelWidth } } —— 单字段 label 宽度独立于全局
 *   3. formItem: { slots: { label } } —— 自定义 label 内容（如加 icon）
 *   4. formItem: { component: 'FormItemPlus' } —— 用自定义组件替代 ElFormItem
 */
import { h, defineComponent } from 'vue'
import { ElMessage, ElFormItem } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { customFormItemItems } from './configs/xform-demos-api'
import xFormSource from './XFormCustomFormItem.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'custom-form-item',
  schema: () => schema,
  model: () => model,
})

const model = reactive<Record<string, unknown>>({
  username: '',
  password: '',
  bio: '',
  agreement: false,
})

/**
 * 业务侧自定义 FormItemPlus（演示如何在 XForm 之外注册组件替代 ElFormItem）
 * 真实项目建议放在 @vv/ui/components/common/FormItemPlus/（或 app 私有 src/components/），导出 Vue 组件
 * 本 demo 内 inline 实现：透传 props + slots 到 ElFormItem，外加 highlight 视觉扩展
 */
const FormItemPlus = defineComponent({
  name: 'FormItemPlus',
  props: {
    label: { type: String, default: '' },
    labelWidth: { type: String, default: undefined },
    highlight: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    // 合并 attrs 透传给 ElFormItem（保持 rules/prop/error 等链路工作）
    const itemProps: Record<string, unknown> = { ...attrs, label: props.label }
    if (props.labelWidth) itemProps.labelWidth = props.labelWidth

    // highlight 视觉扩展：用 inline style 强制生效（避免 CSS 选择器特异性问题 + 不依赖 CSS 加载时机）
    // wrapper 加类名让 CSS 选择器仍可命中（fallback），inline style 作主路径
    const wrapperClass = props.highlight ? 'demo-form-item-plus-highlight' : undefined
    const wrapperStyle = props.highlight
      ? {
          background: '#fef2f2',
          borderRadius: '4px',
          padding: '8px',
          border: '1px solid #fca5a5',
          width: '100%',
        }
      : { width: '100%' }
    // 给 ElFormItem 传 highlight 类名让其内部 label/input 也带上标记，便于 CSS/JS 选择
    // （element-plus 2.x 的 ElFormItem 根 class 透传通过根 div 拼接生效）
    if (props.highlight) {
      itemProps.class = 'demo-form-item-plus-highlight-el-form-item'
    }
    return () =>
      h('div', { class: wrapperClass, style: wrapperStyle }, [h(ElFormItem, itemProps, slots)])
  },
})

const schema: SchemaNode = {
  column: 1,
  children: [
    // ① formItem: false —— 裸渲染展示块（不是表单字段，仅展示）
    {
      label: '系统说明',
      component: 'div',
      formItem: false,
      children: '📌 本 demo 展示 4 种 formItem 自定义写法',
    },
    // ② 字段 1：自定义 label 插槽 + 加宽 label
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      rules: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
      formItem: {
        props: { labelWidth: '220px' },
        slots: {
          // ⭐ 用 bem 实例生成 class——确保 BEM 前缀与 SCSS 根选择器匹配
          label: () =>
            h('span', { class: bem.e('label') }, [
              '👤 用户名（自定义 label）',
              h(InfoFilled, { class: bem.e('label-icon') }),
            ]),
        },
      },
      props: { placeholder: '独立 label 宽度 180px + 自定义插槽', clearable: true },
    },
    // ③ 字段 2：默认 formItem 包装
    {
      label: '密码',
      name: 'password',
      component: 'InputPassword',
      rules: [{ required: true, message: '请输入密码', trigger: 'blur' }],
      props: { placeholder: '默认 ElFormItem 包装' },
    },
    // ④ 字段 3：自定义 formItem 组件（演示 project 内 FormItemPlus）
    {
      label: '个人简介',
      name: 'bio',
      component: 'InputTextArea',
      rules: [{ required: true, message: '请输入简介', trigger: 'blur' }],
      formItem: {
        // formItem.component 用字符串名 + XForm.components 注册（schema DSL 兼容写法）
        component: 'FormItemPlus',
        props: { highlight: true },
      },
      props: {
        rows: 3,
        maxlength: 200,
        placeholder: '使用 FormItemPlus 包装（含 highlight 视觉扩展）',
      },
    },
    // ⑤ 字段 4：必填图标增强
    {
      label: '同意协议',
      name: 'agreement',
      component: 'Switch',
      rules: [
        {
          validator: (_r: unknown, v: unknown, cb: (err?: Error) => void) => {
            cb(v === true ? undefined : new Error('请同意用户协议'))
          },
        },
      ],
      formItem: {
        slots: {
          label: () => '📜 同意《用户协议》（formItem 包装 + 必填校验）',
        },
      },
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
  ElMessage.success('保存成功')
}

const tocItems = [
  { id: 'demo-custom-form-item', label: 'formItem 自定义演示' },
  { id: 'api-custom-form-item', label: 'formItem 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="schema 字段 formItem —— 自定义 form-item 包装"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'formItem: false —— 不包 form-item，裸渲染组件（展示型 UI 块）',
      'formItem: { props } —— 单字段 label 宽度 / 必填样式独立于全局',
      'formItem: { slots } —— 自定义 label 内容（如加 icon / 提示）',
      'formItem: { component } —— 用业务自定义 FormItemPlus 替代 ElFormItem（需在 components 注册）',
    ]"
  >
    <section id="demo-custom-form-item">
      <DemoField label="用户录入（formItem 自定义）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" :components="{ FormItemPlus }" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="formItem 字段速查"
      :items="customFormItemItems"
      anchor="api-custom-form-item"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-custom-form-item {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__label-icon {
    color: var(--el-color-primary);
    font-size: 14px;
    // 显式限制 svg 宽高 —— Element Plus Icon 的 size prop 通过 CSS 变量传递，
    // 但 svg 元素本身不识别 CSS 变量，必须显式 width/height attribute
    width: 20px;
    height: 20px;
  }

  // FormItemPlus highlight 视觉扩展（demo 局部字符串类名，与组件内部透传对应）
  // 注意：不能用 .#{$BEM_PREFIX}-demo-x-form-custom-form-item 限定根，因为 demo 顶层用了 DocLayout，
  // bem.b() 类名未应用到 DOM 根 → 后代选择器永远不命中。直接用全局 demo 前缀类名。
  .demo-form-item-plus-highlight {
    .el-form-item__label {
      color: #b91c1c;
      font-weight: 600;
    }

    .el-input__wrapper,
    .el-textarea__inner {
      box-shadow: 0 0 0 1px #fca5a5 inset;
      background: #fef2f2;

      &:focus-within {
        box-shadow:
          0 0 0 1px #ef4444 inset,
          0 0 0 3px rgb(239 68 68 / 12%);
      }
    }
  }
}
</style>
