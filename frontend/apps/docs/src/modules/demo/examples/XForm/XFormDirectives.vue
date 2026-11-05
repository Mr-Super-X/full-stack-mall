<script setup lang="ts">
/**
 * 演示 XFormProps 三个全局配置：directives 节点指令 / componentProps 默认 props / rules 命名引用
 *
 * 场景：供应商录入
 *
 * 覆盖功能：
 *   1. node.directives（Directive 对象形式）：focus 指令挂载自动聚焦；audit 指令标记审计敏感字段
 *   2. componentProps：Input 全局默认 clearable、InputNumber 全局默认 controlsPosition/min
 *   3. rules 命名引用：node.rules 写字符串 'phone'，从 XFormProps.rules 命名表取规则
 *   4. 节点级 props 覆盖：备注字段 clearable: false 覆盖全局默认
 */
import { ElMessage } from 'element-plus'
import type { Directive } from 'vue'
import type { SchemaNode, RuleItem } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { componentPropsItems, directivesItems, ruleRefItems } from './configs/xform-demos-api'
import xFormSource from './XFormDirectives.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'directives',
  schema: () => schema,
})

/** 聚焦指令：mounted 后自动聚焦输入框（演示 Directive 对象 + 无 value/arg/modifiers） */
const focusDirective: Directive<HTMLElement> = {
  mounted(el) {
    el.querySelector('input')?.focus()
  },
}

/** 审计标记指令：给审计敏感字段加橙色边框 + title 提示（演示 arg / modifiers / value 透传） */
const auditDirective: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    // 内联 box-shadow 锁死橙色：CSS 变量方案会被 element-plus 的 .el-input 组件根
    // 变量定义（--el-input-border-color: var(--el-border-color)）重置，不生效
    const wrapper = el.querySelector('.el-input__wrapper') as HTMLElement | null
    wrapper?.style.setProperty('box-shadow', '0 0 0 1px #e6a23c inset')
    const strong = binding.modifiers?.strong ? '（重点审计）' : ''
    el.title = `${binding.value ?? '该字段'}为审计敏感字段${strong}`
  },
}

// 校验规则命名表：node.rules 写字符串 'phone' 时从此表取规则
const rules: Record<string, RuleItem> = {
  phone: { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
}

// 全局默认 props：按组件名注入，节点级 props 可覆盖
const componentProps = {
  Input: { clearable: true },
  InputNumber: { controlsPosition: 'right', min: 0 },
}

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '供应商名称',
      name: 'supplierName',
      component: 'Input',
      directives: [{ directive: focusDirective }],
      props: { placeholder: '挂载后自动聚焦（focus 指令）' },
      rules: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
    },
    {
      label: '联系人手机号',
      name: 'phone',
      component: 'Input',
      rules: 'phone',
      props: { placeholder: 'rules: "phone" 命名引用' },
    },
    {
      label: '采购金额',
      name: 'amount',
      component: 'InputNumber',
      directives: [
        { directive: auditDirective, arg: 'audit', modifiers: { strong: true }, value: '采购金额' },
      ],
      props: { placeholder: '审计敏感字段（audit 指令标记）' },
      rules: [{ required: true, message: '请输入采购金额', trigger: 'blur' }],
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      props: {
        type: 'textarea',
        rows: 3,
        placeholder: '节点级 clearable: false 覆盖全局默认',
        clearable: false,
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  supplierName: '',
  phone: '',
  amount: undefined,
  remark: '',
})

// formRef 由 useXFormDemo 统一提供

async function onValidate() {
  const valid = await formRef.value?.validate()
  if (valid) {
    ElMessage.success('校验通过')
  } else {
    ElMessage.error('校验失败，请检查红字提示')
  }
}

const tocItems = [
  { id: 'demo-directives', label: '供应商录入演示' },
  { id: 'api-directives', label: 'node.directives 节点指令' },
  { id: 'api-component-props', label: 'componentProps 全局默认 props' },
  { id: 'api-rule-ref', label: 'rules 命名引用' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="节点指令 + 全局默认 props + 规则命名引用"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'node.directives 直接传带钩子的 Directive 对象（mounted / updated…），value / arg / modifiers 透传 binding。',
      '已知限制：字符串指令名 + XFormProps.directives 注册表暂未接线，当前请直接传 Directive 对象。',
      'componentProps 按组件名注入默认 props（与内置默认合并），节点级 props 优先级最高。',
      'node.rules 写字符串时查 XFormProps.rules 命名表：命中取对应 RuleItem，未命中退化为 required。',
    ]"
  >
    <section id="demo-directives">
      <DemoField label="供应商录入（指令 + 全局配置）" :code="xFormSource">
        <XForm
          ref="formRef"
          :schema="schema"
          :model="model"
          :rules="rules"
          :component-props="componentProps"
        />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="node.directives 节点指令" :items="directivesItems" anchor="api-directives" />
    <ApiTable
      title="componentProps 全局默认 props"
      :items="componentPropsItems"
      anchor="api-component-props"
    />
    <ApiTable title="rules 命名引用" :items="ruleRefItems" anchor="api-rule-ref" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-directives {
  &__actions {
    margin-top: 16px;
  }
}
</style>
