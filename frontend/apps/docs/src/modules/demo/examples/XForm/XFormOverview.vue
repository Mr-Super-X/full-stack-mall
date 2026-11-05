<script setup lang="ts">
/**
 * XForm 用法演示 + API 文档（半自动版）
 *
 * 覆盖功能：
 *   1. 基础 schema 渲染（Input / Select / DatePicker / Switch）
 *   2. async-validator 校验规则（必填 / 正则 / 自定义 validator）
 *   3. reaction 反应式（Switch → 联动禁用 path 字段）
 *   4. 实例方法：validate / resetFields / validateWithZod
 *   5. 自定义组件注入（components prop 覆盖内置映射）
 */
import { h } from 'vue'
import { z } from 'zod'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  eventsItems,
  methodsItems,
  propsItems,
  schemaNodeItems,
  slotsItems,
} from './configs/xform-api'
import ModelPreview from '../../components/ModelPreview.vue'
import xFormSource from './XFormOverview.vue?raw'

const bem = createNamespace('demo-x-form')

// —— 基础 schema：name + email ——
const basicModel = reactive<Record<string, unknown>>({ name: '', email: '' })
const basicSchema: SchemaNode = {
  children: [
    {
      component: 'ElInput',
      name: 'name',
      label: '用户名',
      rules: [{ required: true, message: '用户名必填', trigger: 'blur' }],
      props: { placeholder: '请输入用户名', clearable: true },
    },
    {
      component: 'ElInput',
      name: 'email',
      label: '邮箱',
      rules: [
        { required: true, message: '邮箱必填', trigger: 'blur' },
        {
          validator: (_rule: unknown, value: unknown, cb: (err?: Error) => void) => {
            const ok = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            cb(ok ? undefined : new Error('邮箱格式不正确'))
          },
          trigger: 'blur',
        },
      ],
      props: { placeholder: 'name@example.com', clearable: true },
    },
  ],
}

// —— 反应式 schema：Switch 联动 path ——
const reactiveModel = reactive<Record<string, unknown>>({ enablePath: false, path: '' })
const reactiveSchema = computed<SchemaNode>(() => ({
  children: [
    {
      component: 'ElSwitch',
      name: 'enablePath',
      label: '启用自定义路径',
    },
    {
      component: 'ElInput',
      name: 'path',
      label: '路径',
      reaction: {
        disabled: '{{ (m) => !m.enablePath }}', // 函数表达式：返回 disabled 状态
        rules: '{{ (m) => m.enablePath ? [{ required: true, message: "启用时路径必填" }] : [] }}',
      },
      props: { placeholder: '请输入路径', clearable: true },
    },
  ],
}))

// —— 校验触发 ——
const basicFormRef = ref<{
  validate: (callback?: (valid: boolean) => void) => Promise<boolean>
  resetFields: () => void
  validateWithZod: () => { success: boolean; errors: import('zod').ZodError | null }
} | null>(null)
const validateMsg = ref('')
const zodMsg = ref('')

function onSubmitBasic() {
  // element-plus 2.x 的 validate 失败时 reject errorsMap 对象
  // 用 callback 形式兼容（不依赖 Promise 行为），避免被 ErrorBoundary 兜底
  basicFormRef.value?.validate((valid: boolean) => {
    validateMsg.value = valid ? '✅ 校验通过' : '❌ 校验失败，查看字段红框'
  })
}
function resetBasic() {
  basicFormRef.value?.resetFields()
  validateMsg.value = ''
  zodMsg.value = ''
}

// —— zod 顶层校验（与 async-validator 双轨） ——
const basicZodSchema = z.object({
  name: z.string().min(1, '用户名必填'),
  email: z.string().email('邮箱格式不正确'),
})

function onSubmitZod() {
  const result = basicFormRef.value?.validateWithZod()
  zodMsg.value = result?.success
    ? '✅ zod 校验通过'
    : `❌ ${result?.errors?.issues[0]?.message ?? '校验失败'}`
}

// —— 自定义组件注入示例（用 h() 函数，避免 vue runtime 不支持 template 编译） ——
const customModel = reactive<Record<string, unknown>>({ tag: '' })
const CustomTagInput = {
  name: 'CustomTagInput',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup(props: { modelValue: string }, { emit }: { emit: (e: string, v: string) => void }) {
    return () =>
      h('div', { class: 'custom-tag-input' }, [
        h('span', { class: 'custom-tag-input__label' }, '自定义组件：'),
        h('input', {
          class: 'custom-tag-input__field',
          value: props.modelValue,
          placeholder: '输入标签',
          onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
        }),
      ])
  },
}
const customSchema: SchemaNode = {
  children: [
    {
      component: 'CustomTagInput',
      name: 'tag',
      label: '标签（自定义组件）',
    },
  ],
}

// —— 当前显示区域切换 ——
const activeKey = ref<'basic' | 'reactive' | 'custom'>('basic')

// —— TOC 锚点导航 ——
const tocItems = [
  { id: 'demo-basic', label: '基础用法' },
  { id: 'api-props', label: 'Props' },
  { id: 'api-schema-node', label: 'SchemaNode 字段' },
  { id: 'api-events', label: 'Events' },
  { id: 'api-slots', label: 'Slots' },
  { id: 'api-methods', label: '实例方法' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XForm 动态表单"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '基于 schema DSL 的动态表单引擎，支持全量 19 字段（component / props / on / children / name / label / rules / reaction / formItem / modelProp / defaultValue / row / directives / asyncOptions / slots / disabled / permission / ignore / kind+array ...）。',
      '下方演示：基础渲染 / 反应式联动（Switch → path 联动）/ 自定义组件注入。',
    ]"
  >
    <!-- 先看这个引导卡：减少 30 个 demo 的信息压迫感 -->
    <div :class="bem.e('start-here')">
      <strong>👀 先看这个——3 个场景按推荐顺序浏览</strong>
      <p>
        <strong>① 基础</strong>
        （必看） —— schema + async-validator 校验 + el-form 标准 validate
      </p>
      <p>
        <strong>② 反应式</strong>
        （进阶） —— Switch 联动 path 字段的 disabled / rules 切换
      </p>
      <p>
        <strong>③ 自定义组件</strong>
        （进阶） —— 通过 components prop 注入 CustomTagInput 覆盖默认映射
      </p>
    </div>

    <section id="demo-basic">
      <DemoField label="基础用法（async-validator 校验）" :code="xFormSource">
        <div :class="bem.e('actions')">
          <el-radio-group v-model="activeKey" size="small">
            <el-radio-button value="basic">基础</el-radio-button>
            <el-radio-button value="reactive">反应式</el-radio-button>
            <el-radio-button value="custom">自定义组件</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 基础 -->
        <template v-if="activeKey === 'basic'">
          <XForm
            ref="basicFormRef"
            :schema="basicSchema"
            :model="basicModel"
            :zod-schema="basicZodSchema"
          />
          <div :class="bem.e('buttons')">
            <el-button type="primary" @click="onSubmitBasic">校验</el-button>
            <el-button @click="onSubmitZod">zod 校验</el-button>
            <el-button @click="resetBasic">重置</el-button>
            <span :class="bem.e('msg')">{{ validateMsg }} {{ zodMsg }}</span>
          </div>
          <ModelPreview :model="basicModel" />
        </template>

        <!-- 反应式 -->
        <template v-else-if="activeKey === 'reactive'">
          <XForm :schema="reactiveSchema" :model="reactiveModel" />
          <div :class="bem.e('hint')">
            提示：关闭「启用自定义路径」开关 → 路径字段自动禁用且非必填；开启 → 路径字段启用且必填。
          </div>
          <ModelPreview :model="reactiveModel" />
        </template>

        <!-- 自定义组件 -->
        <template v-else>
          <XForm :schema="customSchema" :model="customModel" :components="{ CustomTagInput }" />
          <div :class="bem.e('hint')">
            提示：通过 components prop 注入 CustomTagInput 组件覆盖默认映射。当前值：
            <b>{{ customModel.tag || '（空）' }}</b>
          </div>
          <ModelPreview :model="customModel" />
        </template>
      </DemoField>
    </section>

    <ApiTable title="Props" :items="propsItems" anchor="api-props" />
    <ApiTable title="SchemaNode 字段（DSL）" :items="schemaNodeItems" anchor="api-schema-node" />
    <ApiTable title="Events" :items="eventsItems" anchor="api-events" />
    <ApiTable title="Slots" :items="slotsItems" anchor="api-slots" />
    <ApiTable title="实例方法（ref）" :items="methodsItems" anchor="api-methods" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form {
  padding: 16px;

  &__actions {
    margin-bottom: 16px;
  }
  &__buttons {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__msg {
    margin-left: 8px;
    color: #666;
  }
  &__hint {
    margin-top: 12px;
    font-size: 13px;
    color: #909399;
  }
  &__start-here {
    display: block;
    margin-bottom: 20px;
    padding: 12px 16px;
    background: linear-gradient(90deg, #ecf5ff, #f0f9ff);
    border-left: 4px solid var(--el-color-primary);
    border-radius: 4px;
    color: var(--el-text-color-regular);

    > strong {
      display: block;
      color: var(--el-color-primary);
      font-size: 14px;
      margin-bottom: 8px;
    }

    p {
      margin: 4px 0;
      line-height: 1.7;
    }

    strong {
      color: var(--el-color-primary);
    }
  }
}

// 自定义组件样式（全局可用，不带前缀）
.custom-tag-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px dashed #409eff;
  border-radius: 4px;
  background: #ecf5ff;

  &__label {
    color: #409eff;
    font-size: 14px;
  }
  &__field {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
  }
}
</style>
