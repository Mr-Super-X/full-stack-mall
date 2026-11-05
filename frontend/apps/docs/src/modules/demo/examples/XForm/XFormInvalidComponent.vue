<script setup lang="ts">
/**
 * 演示：schema 组件名拼写错误校验
 *
 * 场景：
 * 1. 已知 EL 组件短名（Input）→ 不警告
 * 2. 已知 EL 组件全名（ElInput）→ 不警告（自动识别）
 * 3. 拼写错误的组件名（Inpurt）→ 控制台 warn + Debug Banner 红条
 * 4. 自定义组件未在 components prop 注册（MyUnregisteredComp）→ 警告
 * 5. 自定义组件已在 components prop 注册 → 不警告
 *
 * 验证方法：
 * - 打开 DevTools Console 查看 [XForm][validate] 警告
 * - 右下角 Debug Banner（dev 模式）应显示红条 + 错误列表
 */
import { ElMessage, ElInput } from 'element-plus'
import type { SchemaNode, XFormProps } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import { useConsoleCapture } from '../../composables/useConsoleCapture'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ConsoleLogPanel from '../../components/ConsoleLogPanel.vue'
import { invalidComponentItems } from './configs/xform-demos-api'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem } = useXFormDemo({
  name: 'invalid-component',
  schema: () => schema,
})

// 实时捕获 XForm 触发的 console 输出，错误诊断 demo 让用户"在页面上"看到
const { logs, clear } = useConsoleCapture('[XForm]')

// 场景代码片段（用于 DemoField 展示）
const invalidComponentCode = `{
  component: 'Inpurt', // 故意拼错
  name: 'fieldC',
  label: '拼写错误',
}`
const registeredComponentCode = `<XForm
  :schema="schema"
  :model="model"
  :components="{ MyCustomInput: MyInputComp }"
/>`

/** 自定义组件（仅用于演示 userComponents 命中场景） */
// 用真实的 ElInput 注入到 components prop，让 userComponents 命中且能正常渲染
const customComponents: XFormProps['components'] = { MyCustomInput: ElInput }

const model = reactive<Record<string, unknown>>({})

/**
 * 含 4 种场景的演示 schema
 * - 字段 A：已知 EL 短名（Input）→ 通过
 * - 字段 B：已知 EL 全名（ElInput）→ 通过
 * - 字段 C：拼写错误（Inpurt）→ 警告
 * - 字段 D：未注册的自定义组件（MyUnregisteredComp，未传）→ 警告
 */
const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: 'A. 已知 EL 短名（应通过）',
      name: 'fieldA',
      component: 'Input',
      props: { placeholder: '正常：Input 短名' },
    },
    {
      label: 'B. 已知 EL 全名（应通过）',
      name: 'fieldB',
      component: 'ElInput',
      props: { placeholder: '正常：ElInput 全名也识别' },
    },
    {
      label: 'C. 拼写错误 Inpurt（应警告）',
      name: 'fieldC',
      component: 'Inpurt', // 故意拼错
      props: { placeholder: '应触发警告' },
    },
    {
      label: 'D. 未注册自定义组件（应警告）',
      name: 'fieldD',
      component: 'MyUnregisteredComp', // 未在 components prop 注册
      props: { placeholder: '应触发警告' },
    },
  ],
}

/** 已注册自定义组件的对照组 */
const registeredModel = reactive<Record<string, unknown>>({})
const registeredSchema: SchemaNode = {
  label: 'E. 已注册自定义组件（对照组）',
  children: [
    {
      label: 'E. 已注册 MyCustomInput（应通过）',
      name: 'fieldE',
      component: 'MyCustomInput', // 已在 components prop 注册
      props: { placeholder: '正常：userComponents 命中' },
    },
  ],
}

function onSaveA() {
  ElMessage.info('提交 A/B 字段（详见下方预览）')
}
function onSaveE() {
  ElMessage.info('提交 E 字段（详见下方预览）')
}

const tocItems = [
  { id: 'demo-invalid-component', label: '校验演示' },
  { id: 'api-invalid-component', label: '组件名解析规则' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="组件名校验"
    source="src/components/form-schema/composables/use-validate.ts"
    :introductions="[
      'schema component 字段拼写错误时，dev mode 触发 console.error + Debug Banner 错误。',
      '下方「控制台输出」面板自动展示 XForm 触发的错误（不需打开 DevTools）。',
      '字段 A（应通过）、B（应通过）、E（应通过）不触发警告；字段 C（应警告）、D（应警告）触发警告。',
      '右下角 Debug Banner（dev 模式）会显示红色错误条。',
    ]"
  >
    <section id="demo-invalid-component">
      <DemoField label="场景 1：含拼写错误组件名（预期 2 个警告）" :code="invalidComponentCode">
        <div :class="bem.b()">
          <XForm :schema="schema" :model="model" />
          <el-button :class="bem.e('submit')" @click="onSaveA">提交</el-button>
          <ModelPreview :model="model" />
        </div>
      </DemoField>

      <DemoField label="场景 2：userComponents 已注册（无警告）" :code="registeredComponentCode">
        <div :class="bem.b()">
          <XForm
            :schema="registeredSchema"
            :model="registeredModel"
            :components="customComponents"
          />
          <el-button :class="bem.e('submit')" @click="onSaveE">提交</el-button>
          <ModelPreview :model="registeredModel" />
        </div>
      </DemoField>
    </section>

    <ApiTable
      title="组件名解析规则"
      :items="invalidComponentItems"
      anchor="api-invalid-component"
    />
    <ConsoleLogPanel
      :logs="logs"
      title="XForm 控制台输出（实时捕获）"
      empty="暂无警告（应仅字段 C/D 触发 [XForm] validate 警告）"
      @clear="clear"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-invalid-component {
  &__submit {
    margin-top: 16px;
  }
}
</style>
