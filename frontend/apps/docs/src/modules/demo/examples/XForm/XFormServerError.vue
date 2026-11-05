<script setup lang="ts">
/**
 * 演示 setFieldError 服务端错误映射（4 类错误场景）
 *
 * 场景:
 * 1. 表单提交 → 后端返回 422 with errors[] (field, message)
 * 2. 前端解析 errors → 循环调用 XFormExpose.setFieldError(field, message)
 * 3. UI 显示红字(后端 422 自动映射)
 *
 * setFieldError API:
 *   formRef.value?.setFieldError('email', '该邮箱已注册')
 *
 * 注:本 demo 用 mock 模拟 fetch(不真实发请求),演示完整流程
 * 单一职责：仅演示服务端错误映射，响应式断点见 XFormResponsive demo
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { serverErrorMethods } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormServerError.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-server-error')

const { formRef, onReset, copySchema } = useXFormDemo({
  name: 'server-error',
  schema: () => schema,
})

const schema: SchemaNode = {
  // 桌面 6/6/12 等宽布局 —— 响应式断点见 XFormResponsive demo
  row: { gutter: 16 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      col: { span: 6 },
      rules: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    } as SchemaNode,
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      col: { span: 6 },
      rules: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
      ],
    } as SchemaNode,
    {
      label: '密码',
      name: 'password',
      component: 'Input',
      props: { type: 'password' },
      col: { span: 12 },
      rules: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        // 本地规则：密码至少 6 位 —— 失焦即校验，避免用户等到提交才发现弱密码
        { min: 6, message: '密码长度不足,至少 6 位', trigger: 'blur' },
      ],
    } as SchemaNode,
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  password: '',
})

/**
 * 模拟后端 422 响应
 * 真实场景:fetch('/api/users', { method: 'POST', body: ... })
 *           失败时 response.json() = { errors: [{ field, message }, ...] }
 */
const mockSaveToBackend = async (
  data: Record<string, unknown>
): Promise<{ success: boolean; errors?: Array<{ field: string; message: string }> }> => {
  // 模拟 500ms 网络延迟
  await new Promise((r) => setTimeout(r, 500))

  // 模拟各种 422 场景 —— 每个错误独立触发,互不耦合
  // 场景 1:用户名 admin → 仅报用户名已存在
  if (data.username === 'admin') {
    return {
      success: false,
      errors: [{ field: 'username', message: '用户名已存在' }],
    }
  }
  // 场景 2:邮箱 admin@example.com → 仅报邮箱已被注册(独立的邮箱唯一性校验)
  if (data.email === 'admin@example.com') {
    return {
      success: false,
      errors: [{ field: 'email', message: '该邮箱已被注册' }],
    }
  }
  // 场景 3:邮箱 test@spam.com → 仅报域名黑名单
  if (data.email === 'test@spam.com') {
    return {
      success: false,
      errors: [{ field: 'email', message: '该邮箱域名在黑名单中' }],
    }
  }
  if (data.password === '123456') {
    // 前端 min:6 通过,但后端要求"必须含字母"——演示前后端规则不同时的映射
    return {
      success: false,
      errors: [{ field: 'password', message: '密码强度不足,必须包含字母' }],
    }
  }
  if (typeof data.password === 'string' && data.password.length < 6) {
    return {
      success: false,
      errors: [{ field: 'password', message: '密码长度不足,至少 6 位' }],
    }
  }
  return { success: true }
}

async function onSave() {
  if (!formRef.value) return
  // 1. 先做本地校验（基于当前输入；旧的服务端错误已在用户修改字段时自动清除）
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('本地校验失败')
    return
  }
  // 2. 提交到后端
  const result = await mockSaveToBackend(model)
  if (result.success) {
    ElMessage.success('保存成功')
    return
  }
  // 3. 后端 422 错误 → 调用 validateFromServer 适配器
  //    一行替代原本 4 行循环（clearValidate + 逐个 setFieldError）
  const count = formRef.value.validateFromServer(result)
  if (count > 0) {
    ElMessage.error(`保存失败,已映射 ${count} 个字段错误,请根据红字提示修改`)
  }
}

const tocItems = [
  { id: 'demo-server-error', label: '服务端错误演示' },
  { id: 'api-server-error', label: '相关实例方法' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="服务端错误映射（4 类错误场景演示）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '后端返回 422 with errors[] → 前端循环调用 setFieldError(field, message) → UI 显示红字',
      '本 demo 模拟 4 类独立错误场景，每个错误单独触发：用户名冲突 / 邮箱重复 / 邮箱黑名单 / 密码强度不足',
      '测试场景（每个输入独立触发对应错误，互不耦合）:',
      '   - 用户名=admin → 红字「用户名已存在」',
      '   - 邮箱=admin@example.com → 红字「该邮箱已被注册」',
      '   - 邮箱=test@spam.com → 红字「该邮箱域名在黑名单中」',
      '   - 密码=123456 → 前端 min:6 通过，红字「必须包含字母」（后端额外规则）',
      '   - 密码=123 → 前端失焦红字「密码长度不足」（本地 min:6 规则）',
      '对比 demos：响应式断点见 XFormResponsive；批量校验见 XFormOrderCreate',
    ]"
  >
    <section id="demo-server-error">
      <DemoField label="服务端错误映射" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onSave">保存(测试后端 422 错误)</el-button>
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('state')">
          <div>
            <strong>测试 422 错误场景（4 类独立错误）:</strong>
            <ul>
              <li>用户名=admin → 红字「用户名已存在」</li>
              <li>邮箱=admin@example.com → 红字「该邮箱已被注册」</li>
              <li>邮箱=test@spam.com → 红字「该邮箱域名在黑名单中」</li>
              <li>密码=123456 → 前端通过，保存后红字「必须包含字母」</li>
              <li>密码=123 → 前端失焦红字「密码长度不足」</li>
            </ul>
          </div>
          <ModelPreview :model="model" />
        </div>
      </DemoField>
    </section>

    <ApiTable title="相关实例方法" :items="serverErrorMethods" anchor="api-server-error" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-server-error {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__state {
    margin-top: 16px;

    ul {
      margin: 4px 0;
      padding-left: 20px;
    }
  }
}
</style>
