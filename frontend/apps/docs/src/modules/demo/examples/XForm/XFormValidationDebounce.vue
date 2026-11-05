<script setup lang="ts">
/**
 * 演示跨字段校验的 debounce 调度
 *
 * 场景：密码 / 确认密码 —— 高频输入场景，每键都校验会视觉干扰
 *
 * 三种模式对比（顶部 RadioGroup 切换）：
 *   A. 实时模式（schema.debounceValidation 未设）：每键触发 confirmPassword 校验
 *   B. 全局 500ms：依赖字段停止变化 500ms 后才跑 crossValidator
 *   C. 全局 500ms + 字段级覆盖：confirmPassword 用 1000ms（更慢），email 字段级 debounceMs: 0（实时）
 *
 * 注意：crossValidator 走 use-cross-field-trigger 路径（享受 debounce）；
 *      element-plus 原生 async-validator（rule.validator）不走此路径，不受 debounce 影响
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { debounceItems } from './configs/xform-demos-api'
import xFormSource from './XFormValidationDebounce.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, copySchema, onReset } = useXFormDemo({
  name: 'validation-debounce',
  schema: () => schema.value,
})

const bem = createNamespace('demo-x-form-validation-debounce')

const model = reactive({
  password: '',
  confirmPassword: '',
  email: '',
  confirmEmail: '',
})
// 计数器：可视化跨字段校验调用次数（A 实时 vs B/C debounce 对比）
const counter = reactive({
  password: 0,
  confirmPassword: 0,
  email: 0,
  confirmEmail: 0,
})

const mode = ref<'realtime' | 'debounce500' | 'mixed'>('realtime')

// 切换模式时重置表单：清空 model / counter / 校验错误，避免上模式残留干扰新模式观察
watch(mode, () => {
  model.password = ''
  model.confirmPassword = ''
  model.email = ''
  model.confirmEmail = ''
  counter.password = 0
  counter.confirmPassword = 0
  counter.email = 0
  counter.confirmEmail = 0
  void nextTick(() => {
    formRef.value?.clearValidate?.()
  })
})

const currentModeLabel = computed(
  () =>
    ({
      realtime: 'A 实时模式（schema 无 debounceValidation）',
      debounce500: 'B 全局 500ms debounce（schema.debounceValidation=500）',
      mixed: 'C 全局 500ms + 字段级覆盖（confirmPassword 1000ms / email 实时）',
    })[mode.value]
)

const schema = computed<SchemaNode>(() => {
  const isMixed = mode.value === 'mixed'
  const globalMs = mode.value === 'realtime' ? undefined : 500
  return {
    ...(globalMs !== undefined ? { debounceValidation: globalMs } : {}),
    column: 2,
    row: { gutter: 16 },
    children: [
      {
        name: 'password',
        label: '密码',
        component: 'Input',
        props: { type: 'password', placeholder: '请输入密码', clearable: true },
      },
      {
        name: 'confirmPassword',
        label: '确认密码',
        component: 'Input',
        props: { type: 'password', placeholder: '再输入一次密码', clearable: true },
        rules: [
          {
            ...(isMixed ? { debounceMs: 1000 } : {}),
            dependsOn: 'password',
            crossValidator: (value: unknown, password: unknown) => {
              counter.confirmPassword++
              if (!value) return '请确认密码'
              return value === password ? true : '两次密码不一致'
            },
            trigger: 'change',
          },
        ],
      },
      {
        name: 'email',
        label: '邮箱',
        component: 'Input',
        props: { placeholder: '请输入邮箱', clearable: true },
      },
      {
        name: 'confirmEmail',
        label: '确认邮箱',
        component: 'Input',
        props: { placeholder: '再输入一次邮箱', clearable: true },
        rules: [
          {
            ...(isMixed ? { debounceMs: 0 } : {}),
            dependsOn: 'email',
            crossValidator: (value: unknown, email: unknown) => {
              counter.confirmEmail++
              if (!value) return '请确认邮箱'
              return value === email ? true : '两次邮箱不一致'
            },
            trigger: 'change',
          },
        ],
      },
    ],
  }
})

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
  { id: 'demo-debounce', label: 'debounce 调度演示' },
  { id: 'api-debounce', label: '字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="跨字段校验 debounce 调度（高频输入减负）"
    source="src/components/form-schema/composables/use-cross-field-trigger.ts"
    :introductions="[
      '跨字段校验默认每键触发（密码/确认密码高频输入会视觉干扰）。',
      'A 模式（实时）：每键触发 confirmPassword 校验，counter 飙升；',
      'B 模式（全局 500ms）：停止输入 500ms 后只跑 1 次，counter +1；',
      'C 模式（全局 500ms + 字段级覆盖）：confirmPassword 1000ms（更慢），email 字段覆盖 debounceMs: 0（实时，跨字段 asyncValidator 演示），',
      'schema.debounceValidation 顶层全局默认，rules[i].debounceMs 字段级覆盖（0 = 强制实时）。',
    ]"
  >
    <section id="demo-debounce">
      <div :class="bem.e('controls')">
        <el-radio-group v-model="mode" size="large">
          <el-radio-button value="realtime">A 实时</el-radio-button>
          <el-radio-button value="debounce500">B 全局 500ms</el-radio-button>
          <el-radio-button value="mixed">C 全局 500ms + 字段覆盖</el-radio-button>
        </el-radio-group>
        <span :class="bem.e('hint')">当前模式：{{ currentModeLabel }}</span>
      </div>
      <DemoField label="高频输入演示：连打 6 字符 '123456' 看 counter 变化" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button
            @click="Object.keys(counter).forEach((k) => (counter[k as keyof typeof counter] = 0))"
          >
            清零 counter
          </el-button>
        </div>
        <div :class="bem.e('counters')">
          <div :class="bem.e('counter')">
            <strong>confirmPassword 校验次数：</strong>
            {{ counter.confirmPassword }}
            <span :class="bem.e('counter-tip')">
              连打 6 字符：A 模式应 6 次，B 模式应 1 次，C 模式应 1 次（停止打字后等 1 秒：C 模式
              confirmPassword 防抖 1000ms 后触发）
            </span>
          </div>
          <div :class="bem.e('counter')">
            <strong>confirmEmail 校验次数：</strong>
            {{ counter.confirmEmail }}
            <span :class="bem.e('counter-tip')">
              连打 6 字符：A 模式应 6 次，B 模式应 1 次，C 模式应 6 次（debounceMs: 0 强制实时）
            </span>
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable title="debounce 字段速查" :items="debounceItems" anchor="api-debounce" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-validation-debounce {
  &__controls {
    display: flex;
    align-items: center;
    gap: 16px;
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
  &__counters {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  &__counter {
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.7;
    strong {
      color: #2563eb;
      margin-right: 4px;
    }
  }
  &__counter-tip {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
    font-style: italic;
  }
}
</style>
