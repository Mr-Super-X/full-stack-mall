<script setup lang="ts">
/**
 * 演示异步校验（asyncValidator callback 形式）
 *
 * 场景：
 * 1. 用户名唯一性：asyncValidator 模拟 500ms 远程接口,blur 后 el-form-item 显示 loading 图标
 * 2. 邮箱黑名单：asyncValidator 检查预定义黑名单,命中时返回错误信息
 * 3. 服务端密码强度校验：asyncValidator 模拟「服务端强度比对」,无跨字段依赖
 *
 * 注：跨字段异步校验见 XFormCrossField demo（dependsOn + crossValidator 形式）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xInput } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoField from '../../components/DemoField.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { useDocToc } from '../../composables/useDocToc'
import { asyncValidatorItems } from './configs/xform-demos-api'
import xFormSource from './XFormAsyncValidator.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'async-validator',
  schema: () => schema,
  model: () => model,
})

// 模拟远程接口（用户名唯一性）
function checkUsernameAvailable(name: string): Promise<true | string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const taken = ['admin', 'root', 'test']
      resolve(taken.includes(name) ? '用户名已被占用' : true)
    }, 500)
  })
}

// 邮箱黑名单
const EMAIL_BLACKLIST = ['@spam.com', '@temp.com']

// 模拟服务端密码强度比对
function serverCheckPasswordStrength(password: string): Promise<true | string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (password.length < 6) return resolve('密码至少 6 位（服务端校验）')
      if (/^\d+$/.test(password)) return resolve('密码不能全是数字（服务端校验）')
      resolve(true)
    }, 300)
  })
}

const schema: SchemaNode = {
  children: [
    // 1. 用户名唯一性 —— asyncValidator 模拟 500ms 远程接口
    xInput('username')
      .label('用户名')
      .prop('placeholder', 'admin/test/root 已被占用')
      .required()
      .asyncValidator(async (_rule, value, cb) => {
        if (typeof value !== 'string' || value.length === 0) return cb()
        const result = await checkUsernameAvailable(value)
        cb(result === true ? undefined : new Error(result))
      }, 'blur')
      .build() as SchemaNode,

    // 2. 邮箱黑名单 —— asyncValidator 同步检查（模拟同步校验但走 callback 包装）
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '@spam.com / @temp.com 在黑名单中' },
      rules: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        {
          type: 'email',
          message: '邮箱格式不正确',
          trigger: 'blur',
        },
        {
          validator: async (_rule, value, cb) => {
            if (typeof value !== 'string' || value.length === 0) return cb()
            await new Promise((r) => setTimeout(r, 300))
            const hit = EMAIL_BLACKLIST.find((suffix) => value.endsWith(suffix))
            cb(hit ? new Error(`邮箱域名 ${hit} 在黑名单中`) : undefined)
          },
          trigger: 'blur',
        },
      ],
    },

    // 3. 异步服务端校验 —— 密码强度（无跨字段依赖,使用 asyncValidator 链式）
    xInput('password')
      .label('密码')
      .prop('type', 'password')
      .prop('placeholder', '至少 6 位,不能全是数字')
      .prop('clearable', true)
      .required()
      .asyncValidator(async (_rule, value, cb) => {
        if (typeof value !== 'string' || value.length === 0) return cb()
        const result = await serverCheckPasswordStrength(value)
        cb(result === true ? undefined : new Error(result))
      }, 'blur')
      .build() as SchemaNode,
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  password: '',
})

// formRef / onReset / copySchema 由 useXFormDemo 统一提供（见 import 区上方）
// 自定义 onSave：要展示 model JSON dump
async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查红字提示')
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
  { id: 'demo-async', label: '异步校验演示' },
  { id: 'api-async-validator', label: '异步校验' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="异步校验（asyncValidator callback）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '演示 element-plus 原生 validating loading + form-schema asyncValidator 异步 callback:',
      '1. 用户名唯一性：xInput.asyncValidator(fn, \'blur\') 模拟 500ms 远程接口,blur 后 form-item 显示 loading 图标',
      '2. 邮箱黑名单：async 校验器检查预定义黑名单,300ms 返回;邮箱格式 + 黑名单 两条规则并行触发',
      '3. 服务端密码强度校验：asyncValidator 模拟「服务端强度比对」,300ms 返回（无跨字段依赖）',
      '说明：el-form 的 async callback validator 自动管理 validating 状态(loading 图标),form-schema 无需介入',
      '跨字段异步校验（dependsOn + crossValidator）见 XFormCrossField demo',
    ]"
  >
    <section id="demo-async">
      <DemoField label="异步校验" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="异步校验" :items="asyncValidatorItems" anchor="api-async-validator" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-async {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
