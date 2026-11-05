<script setup lang="ts">
/**
 * ProDialogForm 用法总览 —— ProDialog + XForm 的高级弹窗表单组合
 *
 * 演示覆盖点：
 * 1. v-model 显隐 + ProDialog 原生 props 透传（width / close-on-click-modal）
 * 2. onSubmit 异步提交（模拟 800ms API 请求）+ 提交期间按钮 loading
 * 3. 提交失败不关闭弹窗（错误向上抛出，由调用方 toast 提示）
 * 4. 关闭后自动 resetFields（无需父组件手动清理）
 * 5. 通过 ref 调用 expose 方法（setFieldError 模拟服务端 422 回填）
 * 6. footer 作用域插槽自定义底部按钮（保留默认 submit/cancel/loading）
 *
 * 路由：/demo/pro-dialog-form-overview（import.meta.glob 自动派生）
 *
 * 验证清单（按顺序操作）：
 * ① 点「打开弹窗」→ 看到空白表单 + 「确 定 / 取 消」
 * ② 点「确 定」空提交 → XForm 字段红字（必填校验失败）→ 弹窗不关闭
 * ③ 填齐所有字段 → 点「确 定」→ 按钮变 loading → 800ms 后弹窗自动关闭 + success 提示
 * ④ 再次打开弹窗 → 表单已重置（空白）—— 验证「关闭自动重置」
 * ⑤ 填齐字段 → 勾选「演示提交失败」→ 点「确 定」→ loading 结束后弹窗保持打开
 *    + 控制台有错误日志（验证「失败不关闭」+ 「错误向上抛出」）
 * ⑥ 任意状态下点「取消 / X / 遮罩」→ 弹窗关闭 + 表单重置
 * ⑦ 点「服务端错误回填（expose）」→ 调 setFieldError 写「用户名已被占用」红字
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import type { ProDialogFormExpose } from '@vv/ui/components/common/ProDialogForm/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-pro-dialog-form')

// —— 弹窗显隐（v-model）——
const visible = ref(false)

// —— onSubmit 模拟开关：勾选后下次提交返回 reject ——
// 用 ref 控制「下次提交行为」而非 mock flag 硬编码，方便演示「失败不关闭」效果
const failNextSubmit = ref(false)

// —— 表单数据：reactive 对象，与 XForm 的 model 契约对齐 ——
// 字段先全部显式声明（即使为空字符串），避免 XForm 校验/默认值/reaction 失效
const formModel = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  age: 18,
  gender: 'unknown',
  remark: '',
})

// —— schema：顶层 2 列布局，含 5 个字段 + 必填/邮箱/数字校验 ——
// 注：rules 通常内联在 schema 节点里（schema.rules），与 XForm 契约一致
const formSchema: SchemaNode = {
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      props: { placeholder: '请输入用户名', clearable: true, maxlength: 20 },
      rules: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '请输入邮箱', clearable: true },
      rules: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
      ],
    },
    {
      label: '年龄',
      name: 'age',
      component: 'InputNumber',
      props: { min: 1, max: 150, controlsPosition: 'right' },
      rules: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
    },
    {
      label: '性别',
      name: 'gender',
      component: 'Select',
      props: {
        placeholder: '请选择性别',
        clearable: true,
        options: [
          { value: 'unknown', label: '未知' },
          { value: 'male', label: '男' },
          { value: 'female', label: '女' },
        ],
      },
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '可选', maxlength: 200 },
      col: { span: 24 },
    },
  ],
}

// —— 异步提交：模拟 800ms API 请求；failNextSubmit=true 时返回 reject ——
// 注意：原版 3 处 console.log 全部删除（用户复制 demo 代码后不会污染 DevTools）；
// 真实业务场景应走 Sentry 埋点 / ElMessage 提示。
async function onSubmit(model: Record<string, unknown>): Promise<unknown> {
  // 提交埋点位置（真实业务：Sentry.captureMessage / analytics.track）
  await new Promise<void>((resolve) => setTimeout(resolve, 800))

  if (failNextSubmit.value) {
    // 故意抛错：演示「失败不关闭弹窗 + 错误向上抛出」
    throw new Error('提交失败：服务端返回 500（模拟）')
  }

  return { id: Date.now(), ...model }
}

// —— success 事件回调：父组件通常在此刷新列表 ——
function onSuccess(): void {
  ElMessage.success('提交成功（success 事件已触发）')
}

// —— submit-failed 事件回调：父组件在此处理 onSubmit 抛出的错误 ——
function onSubmitFailed(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  ElMessage.error(`提交失败：${message}（submit-failed 事件已触发）`)
}

// —— expose 演示：手动写入字段错误（模拟服务端 422 回填）——
const proDialogFormRef = ref<ProDialogFormExpose | null>(null)

function simulateServerError(): void {
  proDialogFormRef.value?.setFieldError('username', '用户名已被占用（模拟服务端 422 回填）')
  proDialogFormRef.value?.setFieldError('email', '邮箱已被注册')
  ElMessage.warning('已通过 setFieldError 写入错误信息，字段红字可见')
}

// —— 演示代码片段（嵌入 DemoField）——
const SNIPPET_BASIC = `<ProDialogForm
  v-model="visible"
  title="新建用户"
  width="640px"
  :schema="formSchema"
  :model="formModel"
  :on-submit="onSubmit"
  @success="onSuccess"
/>`

const SNIPPET_CUSTOM_FOOTER = `<ProDialogForm v-model="visible" :schema="formSchema" :model="formModel" :on-submit="onSubmit">
  <template #footer="{ submit, cancel, loading }">
    <el-button @click="cancel">返回</el-button>
    <el-button type="primary" :loading="loading" @click="submit">立即创建</el-button>
  </template>
</ProDialogForm>`

const SNIPPET_EXPOSE = `// 父组件通过 ref 获取 ProDialogForm 实例，直接调用 XForm 的 19 个方法
const formRef = ref<ProDialogFormExpose | null>(null)
formRef.value?.setFieldError('username', '用户名已被占用')
formRef.value?.resetFields()
formRef.value?.validate()`

const tocItems = [
  { id: 'demo-basic', label: '基础用法（v-model + onSubmit）' },
  { id: 'demo-failure', label: '提交失败处理（不关闭弹窗）' },
  { id: 'demo-reset', label: '关闭自动重置表单' },
  { id: 'demo-footer', label: '自定义 footer（作用域插槽）' },
  { id: 'demo-expose', label: 'expose 方法（setFieldError 422 回填）' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProDialogForm 用法总览（ProDialog + XForm 高级弹窗表单）"
    source="src/components/common/ProDialogForm/ProDialogForm.vue"
    :introductions="[
      'ProDialog + XForm 的高级弹窗表单组合：内置「校验 → 异步提交 → 自动关闭 → 自动重置」全链路。',
      '点「确 定」时自动校验 XForm，校验通过后调用 onSubmit；onSubmit 返回 resolve 后自动关闭弹窗 + emit success；reject 时弹窗保持打开。',
      '提交期间按钮 loading 防重复提交；关闭弹窗后（动画结束）自动 resetFields 清空数据。',
      '通过 defineExpose 暴露 XFormExpose 全部 19 个方法（validate / resetFields / setFieldError / ...），父组件可直接调用。',
    ]"
  >
    <!-- ① 基础用法 -->
    <section id="demo-basic">
      <DemoField :code="SNIPPET_BASIC" label="① 基础用法：v-model + onSubmit + success">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="visible = true">打开弹窗</el-button>
          <el-switch v-model="failNextSubmit" active-text="下次提交失败" inactive-text="正常提交" />
        </div>
        <p :class="bem.e('para')">
          点「打开弹窗」→ 留空必填项点「确 定」→ 字段红字（不关闭）；填齐后点「确 定」→ 按钮 loading
          → 800ms 后弹窗关闭 + success 提示。
        </p>
        <ProDialogForm
          ref="proDialogFormRef"
          v-model="visible"
          title="新建用户（基础用法）"
          width="640px"
          :schema="formSchema"
          :model="formModel"
          :on-submit="onSubmit"
          submit-button-text="提 交"
          @success="onSuccess"
          @submit-failed="onSubmitFailed"
        />
      </DemoField>
    </section>

    <!-- ② 提交失败 -->
    <section id="demo-failure">
      <DemoField
        label="② 提交失败处理：弹窗不关闭 + emit('submit-failed') 通知父组件"
        :code="onSubmit.toString()"
      >
        <p :class="bem.e('para')">
          勾选上方「下次提交失败」开关 → 填齐所有字段 → 点「确 定」→ loading 结束后弹窗保持打开，
          右上角弹出
          <code>ElMessage.error</code>
          提示（来自
          <code>@submit-failed="onSubmitFailed"</code>
          监听器）， 控制台同时有
          <code>[ProDialogForm] onSubmit failed</code>
          日志便于排查。
        </p>
        <p :class="bem.e('para')">
          <b>关键设计</b>
          ：组件
          <b>不</b>
          通过
          <code>throw err</code>
          上抛错误（会冒泡到全局 errorHandler → 重定向 500）， 改用
          <code>emit('submit-failed', err)</code>
          让调用方完全控制错误处理（toast / 字段红字 / 静默均可）。
        </p>
      </DemoField>
    </section>

    <!-- ③ 关闭自动重置 -->
    <section id="demo-reset">
      <DemoField label="③ 关闭后自动重置表单（动画结束后）" :code="''">
        <p :class="bem.e('para')">
          弹窗关闭时（动画结束 ~300ms 后），自动调用 XForm 的
          <code>resetFields()</code>
          清空数据与校验红字。 再次打开弹窗应看到空白表单，而非上次填写的内容。取消按钮 / X / ESC /
          遮罩点击均会触发重置。
        </p>
      </DemoField>
    </section>

    <!-- ④ 自定义 footer -->
    <section id="demo-footer">
      <DemoField :code="SNIPPET_CUSTOM_FOOTER" label="④ 自定义 footer：作用域插槽保留默认行为">
        <p :class="bem.e('para')">
          <code>#footer</code>
          插槽为作用域插槽，暴露
          <code>submit / cancel / loading</code>
          三个参数，调用方可完全自定义底部 UI（按钮文案 / 图标 / 拆分布局）， 同时复用组件内置的
          loading + 校验 + 关闭逻辑，避免重复实现。
        </p>
      </DemoField>
    </section>

    <!-- ⑤ expose 方法 -->
    <section id="demo-expose">
      <DemoField :code="SNIPPET_EXPOSE" label="⑤ expose 方法：setFieldError 模拟服务端 422 回填">
        <div :class="bem.e('controls')">
          <el-button @click="simulateServerError">写入服务端错误（用户名 + 邮箱）</el-button>
        </div>
        <p :class="bem.e('para')">
          通过
          <code>ref</code>
          拿到 ProDialogForm 实例后，可直接调用 XFormExpose 全部 19 个方法。 本例演示
          <code>setFieldError(name, message)</code>
          模拟服务端 422 错误回填到字段红字。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-dialog-form {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__para {
    margin: 0 0 8px;
    line-height: 1.7;
    color: var(--el-text-color-regular, #606266);

    &:last-child {
      margin-bottom: 0;
    }

    code {
      padding: 1px 6px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px;
      color: var(--el-color-primary);
    }
  }
}
</style>
