<script setup lang="ts">
/**
 * 演示：model prop 缺省时的 dev mode 警告
 *
 * 场景：
 * 1. 不传 model prop → 控制台 warn（XForm 校验/默认值/reaction 全部失效）
 * 2. 传 reactive({}) → 合法但不写入任何字段，提交为空
 * 3. 传 reactive({ email: '' }) → 对照组，正常工作
 *
 * 验证方法：打开 DevTools Console 查看场景 1 的警告
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import { useConsoleCapture } from '../../composables/useConsoleCapture'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ConsoleLogPanel from '../../components/ConsoleLogPanel.vue'
import { modelWarnItems } from './configs/xform-demos-api'

const { bem } = useXFormDemo({
  name: 'model-warn',
  schema: () => schema,
})

// 实时捕获 XForm 的 model 警告（场景 1 不传 model 时触发）
const { logs, clear } = useConsoleCapture('[XForm]')

// 每个场景的代码片段（用于 DemoField 展示，方便复制对照）
const scenario1Code = `<XForm :schema="schema" />\n// ⚠️ 控制台 warn：model prop 未传入`
const scenario2Code = `const emptyModel = reactive({})\n<XForm :schema="schema" :model="emptyModel" />`
const scenario3Code = `const normalModel = reactive({ email: '' })\n<XForm :schema="schema" :model="normalModel" />`

const schema: SchemaNode = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  defaultValue: 'user@example.com',
  rules: [{ required: true, message: '邮箱必填', trigger: 'blur' }],
}

const emptyModel = reactive<Record<string, unknown>>({})
const normalModel = reactive<Record<string, unknown>>({ email: '' })

function onSave(target: Record<string, unknown>, label: string) {
  ElMessage.info(`${label}：${JSON.stringify(target)}`)
}

const tocItems = [
  { id: 'demo-model-warn', label: '警告演示' },
  { id: 'api-model-warn', label: 'model prop 三种形态' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="model 缺省 dev 警告"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'model prop 未传入时，dev mode 触发 console.warn（双通道：console + errorBus 各 1 条）。',
      '下方「控制台输出」面板实时显示 XForm 的警告（不需打开 DevTools）。',
      '场景 1：未传 model → 自动捕获 [XForm] model 警告',
      '场景 2：reactive({}) → 合法（不警告，字段始终为空）',
      `场景 3：reactive({ email: '' }) → 对照组，正常工作`,
      '校验 / 默认值 / reaction / dirty 追踪 在场景 1 下均不会生效。',
    ]"
  >
    <section id="demo-model-warn">
      <DemoField label="场景 1：不传 model prop（会触发 console.warn）" :code="scenario1Code">
        <div :class="bem.b()">
          <XForm :schema="schema" />
          <el-button :class="bem.e('submit')" @click="onSave({}, '场景 1 提交')">提交</el-button>
        </div>
      </DemoField>

      <DemoField label="场景 2：空对象 model（合法，不警告）" :code="scenario2Code">
        <div :class="bem.b()">
          <XForm :schema="schema" :model="emptyModel" />
          <el-button :class="bem.e('submit')" @click="onSave(emptyModel, '场景 2 提交')">
            提交
          </el-button>
        </div>
      </DemoField>

      <DemoField label="场景 3：完整 model（对照组）" :code="scenario3Code">
        <div :class="bem.b()">
          <XForm :schema="schema" :model="normalModel" />
          <el-button
            :class="bem.e('submit')"
            type="primary"
            @click="onSave(normalModel, '场景 3 提交')"
          >
            提交
          </el-button>
        </div>
      </DemoField>
    </section>

    <ApiTable title="model prop 三种形态" :items="modelWarnItems" anchor="api-model-warn" />
    <ConsoleLogPanel
      :logs="logs"
      title="XForm 控制台输出"
      empty="暂无警告（场景 1 应捕获 2 条 [XForm] model 警告：console.warn + errorBus 双通道）"
      @clear="clear"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-model-warn {
  &__submit {
    margin-top: 16px;
  }
}
</style>
