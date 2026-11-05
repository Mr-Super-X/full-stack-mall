<script setup lang="ts">
/**
 * 演示 label 函数式 i18n —— label: (t) => t('key') + XFormProps.t 注入
 *
 * 场景：中英双语表单
 *   1. label 写函数式，XForm 渲染期以注入的 t 求值
 *   2. 切换语言 = 换 t 引用（demo 为字典闭包；真实项目注入 vue-i18n 的 t，
 *      t 内部响应 locale，语言切换自动重渲，无需重建 schema）
 *   3. 未注入 t 时函数式 label 收到 identity（key 原样返回）
 */
import type { SchemaNode, XFormTranslateFn } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { i18nItems } from './configs/xform-demos-api'

const DICTS = {
  zh: {
    'form.email': '邮箱',
    'form.password': '密码',
    'form.passwordConfirm': '确认密码',
  },
  en: {
    'form.email': 'Email',
    'form.password': 'Password',
    'form.passwordConfirm': 'Confirm Password',
  },
} as const

type Locale = keyof typeof DICTS

const locale = ref<Locale>('zh')

// 字典闭包模拟 vue-i18n 的 t：真实项目直接传 useI18n().t
const t = computed<XFormTranslateFn>(
  () => (key: string) => DICTS[locale.value][key as keyof (typeof DICTS)['zh']] ?? key
)

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'i18n',
  schema: () => schema,
  model: () => model,
})

const model = reactive<Record<string, unknown>>({ email: '', password: '', passwordConfirm: '' })

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: (tt) => tt('form.email'),
      name: 'email',
      component: 'Input',
      rules: [{ required: true, trigger: 'blur' }],
    },
    {
      label: (tt) => tt('form.password'),
      name: 'password',
      component: 'InputPassword',
    },
    {
      label: (tt) => tt('form.passwordConfirm'),
      name: 'passwordConfirm',
      component: 'InputPassword',
      rules: [
        {
          dependsOn: 'password',
          trigger: 'blur',
          crossValidator: (v: unknown, password: unknown) =>
            v === password || '两次输入的密码不一致',
        },
      ],
    },
  ],
}

function switchLocale(next: string | number | boolean | undefined) {
  if (next === 'zh' || next === 'en') locale.value = next
}

const tocItems = [
  { id: 'demo-i18n', label: 'label 函数式 i18n' },
  { id: 'api-i18n', label: 'i18n 接入要点' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XForm label 函数式 i18n"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'label 支持函数式：label: (t) => t(\'form.email\')，渲染期以注入的 t 求值。',
      'XForm 不绑定 i18n 库 —— t 由调用方注入（demo 用字典闭包；真实项目传 vue-i18n 的 t）。',
      '切换语言按钮 = 换 t 引用；vue-i18n 场景下 t 内部响应 locale，无需重建 schema。',
      '未注入 t 时函数式 label 收到 identity（key 原样返回），可用于调试 key。',
    ]"
  >
    <section id="demo-i18n" :class="bem.b()">
      <div :class="bem.e('toolbar')">
        <el-radio-group :model-value="locale" @update:model-value="switchLocale">
          <el-radio-button value="zh">中文</el-radio-button>
          <el-radio-button value="en">English</el-radio-button>
        </el-radio-group>
      </div>
      <XForm ref="formRef" :schema="schema" :model="model" :t="t" />
      <div :class="bem.e('actions')">
        <el-button @click="onReset">重置</el-button>
        <el-button @click="copySchema">复制 schema</el-button>
      </div>
      <ModelPreview :model="model" />
    </section>

    <ApiTable title="i18n 接入要点" :items="i18nItems" anchor="api-i18n" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-i18n {
  &__toolbar {
    margin-bottom: 16px;
  }

  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
