<script setup lang="ts">
/**
 * 演示跨字段校验（crossValidator）
 *
 * 场景：
 * 1. 密码 = 确认密码（dependsOn: ['password']）
 * 2. 开始日期 ≤ 结束日期（双向：互相依赖）
 * 3. 主联系人 / 备用联系人不能同时为空（A xor B）
 * 4. 未成年须填写监护人（年龄 dependsOn guardian 联动：填监护人两处红字一起消）
 *
 * ⚠️ 已知限制（element-plus 2.14 shallowRef 内部响应式限制）:
 * - 密码 / 确认密码等 Input 字段:失焦立即实时校验 ✅
 * - 日期 / Select / Cascader 等复杂控件:跨字段红字**只在点击保存时显示**(失焦不显示)
 *   - v-model 写入 + crossValidator 跑通,但 element-plus 2.x 内部 setFieldError 不触发 UI 重渲染
 *   - 这是 element-plus 自身的实现限制,form-schema 已尽力(提供 v-model 主动触发 + nextTick splice)
 *   - 后续可通过升级 element-plus 或改造 setFieldError 集成方式解决
 *
 * 实际校验仍生效:点击「保存」时 validateForm() 跑 el-form.validate + runCrossFieldValidation,
 * 失败时 setFieldError 写入错误 + toast 提示
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { crossFieldItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormCrossField.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-cross-field')

const { formRef, onReset, copySchema } = useXFormDemo({
  name: 'cross-field',
  schema: () => schema,
  model: () => model,
})

const CONTACT_OPTIONS = [
  { value: 'email', label: '邮箱' },
  { value: 'phone', label: '手机' },
  { value: 'wechat', label: '微信' },
]

/** 共享校验函数 —— validator 和 crossValidator 共用同一份逻辑,避免漂移 */
function checkPasswordMatch(value: unknown, password: unknown): true | string {
  return value === password || '两次密码不一致'
}

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '密码',
      name: 'password',
      component: 'Input',
      props: { type: 'password', placeholder: '请输入密码', clearable: true },
      rules: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    },
    {
      label: '确认密码',
      name: 'passwordConfirm',
      component: 'Input',
      props: { type: 'password', placeholder: '再次输入密码', clearable: true },
      rules: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        // blur 触发的单字段校验 —— 实时反馈(走 el-form validate 流程)
        {
          validator: (_rule: unknown, value: unknown, cb: (err?: Error) => void) => {
            const result = checkPasswordMatch(value, model.password)
            cb(result === true ? undefined : new Error(result))
          },
          trigger: 'blur',
        },
        // 提交时跨字段兜底 —— crossValidator 仅在 validateForm() 入口触发
        // 保留是为了：1) 提交时再过一遍最新值;2) 演示 crossValidator 用法
        {
          dependsOn: ['password'],
          crossValidator: (value: unknown, password: unknown) =>
            checkPasswordMatch(value, password),
        },
      ],
    },
    {
      label: '开始日期',
      name: 'startDate',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择开始日期' },
      rules: [
        { required: true, message: '请选择开始日期', trigger: 'change' },
        // 反向校验:startDate 失焦时检查 startDate ≤ endDate
        // 注:crossValidator 只在该字段失焦时跑,所以 startDate 失焦时
        // 只有 startDate 自己会红字 —— endDate 不会自动反向红字
        // (实现"改 A 让 B 自动红字"需要 reaction 联动)
        {
          dependsOn: ['endDate'],
          crossValidator: (value: unknown, endDate: unknown) =>
            !value ||
            !endDate ||
            (value as string) <= (endDate as string) ||
            '开始日期不能晚于结束日期',
          trigger: 'change',
        },
      ],
    },
    {
      label: '结束日期',
      name: 'endDate',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择结束日期' },
      rules: [
        { required: true, message: '请选择结束日期', trigger: 'change' },
        {
          dependsOn: ['startDate'],
          crossValidator: (value: unknown, startDate: unknown) =>
            !value ||
            !startDate ||
            (value as string) >= (startDate as string) ||
            '结束日期不能早于开始日期',
          trigger: 'change',
        },
      ],
    },
    {
      label: '主联系人方式',
      name: 'primaryContact',
      component: 'Select',
      props: { placeholder: '选择主联系人方式', clearable: true, options: CONTACT_OPTIONS },
      rules: [
        {
          dependsOn: ['backupContact'],
          crossValidator: (value: unknown, backup: unknown) =>
            Boolean(value) || Boolean(backup) || '主联系人 / 备用联系人至少填一个',
        },
      ],
    },
    {
      label: '备用联系人方式',
      name: 'backupContact',
      component: 'Select',
      props: { placeholder: '选择备用联系人方式', clearable: true, options: CONTACT_OPTIONS },
      rules: [
        {
          dependsOn: ['primaryContact'],
          crossValidator: (value: unknown, primary: unknown) =>
            Boolean(value) || Boolean(primary) || '主联系人 / 备用联系人至少填一个',
        },
      ],
    },
    // ── H3 验证：嵌套路径直改触发跨字段重算 ─────────────────────────
    // 字段挂在 model.user.age（嵌套路径），通过下方「直改 model」按钮绕过
    // v-model 直接改值 —— deps 值快照 diff 命中 → crossValidator 自动重算，红字消失。
    // 年龄规则 dependsOn 含自引用（target 快照分支）+ guardian（跨字段 dep 分支）：
    // 两条分支由「填监护人」与「直改按钮」分别验证（见 rules 内注释）
    {
      label: '年龄（嵌套 user.age）',
      name: 'user.age',
      // InputNumber 的 v-model 输出 number，与初始值/直改按钮的类型一致，
      // 手输、加减按钮、直改三条路径都不会触发 async-validator 类型校验
      component: 'InputNumber',
      props: { placeholder: '请输入年龄', min: 0 },
      rules: [
        {
          /**
           * 产品语义：未成年**且未填监护人**才标红。真实用户改不了年龄，
           * 「未成年」必须是一条可消除的联动提示（填 guardian 即消），
           * 而不是只能靠把年龄改成 ≥18 才能消除的死胡同红字。
           * 与 guardian 规则同文案（同「主/备联系人」成对报错模式）。
           * dependsOn 同时含自引用 'user.age'（引擎 target 快照分支：
           * 改自身重算）与 'guardian'（跨字段 dep 分支：填监护人反向重算）——
           * 两条分支由下方「直改 model」按钮 + 填 guardian 动作一并验证
           * （cross 规则由 XForm 三路径接管，不透传 el-form——无需 type 声明）
           */
          dependsOn: ['user.age', 'guardian'],
          crossValidator: (age: unknown, _ageDep: unknown, guardian: unknown) =>
            age === '' ||
            age === undefined ||
            age === null ||
            Number(age) >= 18 ||
            Boolean(guardian) ||
            '未成年须填写监护人',
          trigger: 'change',
        },
      ],
    },
    {
      label: '监护人',
      name: 'guardian',
      component: 'Input',
      props: { placeholder: '未成年时必填', clearable: true },
      rules: [
        {
          // 真正的跨字段：依赖嵌套路径 user.age。年龄 ≥18 时本字段无要求；
          // 点「直改 model」后 deps 快照 diff 命中 → 本字段红字自动消失（H3 dep 分支）。
          // 注：实时触发有空值跳过语义（target 为空直接 clearValidate），
          // 所以「须填监护人」红字先由「保存」写入，再由直改按钮验证自动清除
          dependsOn: ['user.age'],
          crossValidator: (guardian: unknown, age: unknown) =>
            age === '' ||
            age === undefined ||
            age === null ||
            Number(age) >= 18 ||
            Boolean(guardian) ||
            '未成年须填写监护人',
          trigger: 'change',
        },
      ],
    },
    // ── H1 验证：standalone 函数形态 disabled / hidden ──────────────
    // 不用 reaction 简写，直接写字段级函数形态 —— 克隆阶段归一化为 reaction 条目求值，
    // 随 agree 开关联动
    {
      label: '同意协议（联动开关）',
      name: 'agree',
      component: 'Switch',
    },
    {
      label: 'standalone disabled 字段',
      name: 'h1DisabledField',
      component: 'Input',
      props: { placeholder: '打开上方开关后启用' },
      disabled: (m: Record<string, unknown>) => !m.agree,
    },
    {
      label: 'standalone hidden 字段',
      name: 'h1HiddenField',
      component: 'Input',
      props: { placeholder: '打开上方开关后显示' },
      hidden: '{{ (m) => !m.agree }}',
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  password: '',
  passwordConfirm: '',
  startDate: '',
  endDate: '',
  primaryContact: '',
  backupContact: '',
  // H3 验证：嵌套路径字段 + 跨字段监护人
  user: { age: 10 },
  guardian: '',
  // H1 验证：联动开关（默认关 → 下方 standalone 字段禁用/隐藏）
  agree: false,
  h1DisabledField: '',
  h1HiddenField: '',
})

/**
 * 错误浮窗 OSD 开关 —— 演示 XFormProps.showErrorToast（默认关闭）
 * 开启后跨字段校验失败的 errorBus 事件以右上角 toast 弹出（5s 固定窗口去重）
 */
const showErrorToast = ref(false)

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

/** H3 验证：直改嵌套路径（绕过 v-model / onValueChange）
 * 先点「保存」制造两处红字（年龄 + 监护人「未成年须填写监护人」），
 * 再点本按钮直改 model.user.age = 30
 * 预期：两处红字都自动消失（deps 值快照 diff 命中 → crossValidator 重算 → clearValidate）
 * 对照路径：不点本按钮、改填「监护人」字段 → 反向触发年龄规则重算 → 两处红字也应一起消失 */
function onDirectSetAge() {
  ;(model.user as { age: number }).age = 30
}

/** 演示 validateDetail：异步返回所有跨字段错误（用于调试或自定义展示） */
async function onInspectDetail() {
  const detail = await formRef.value?.validateDetail()
  if (!detail) return
  if (detail.isValid) {
    ElMessage.success('跨字段校验通过')
  } else {
    ElMessage({
      message: '跨字段错误：\n' + JSON.stringify(detail.errors, null, 2),
      type: 'warning',
      duration: 0,
      showClose: true,
    })
  }
}

const tocItems = [
  { id: 'demo-cross-field', label: '跨字段校验演示' },
  { id: 'api-cross-field', label: 'RuleItem 跨字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="跨字段校验（crossValidator）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'RuleItem dependsOn + crossValidator 两个字段,声明式跨字段校验:',
      '1. 密码 = 确认密码 — dependsOn: [\'password\']',
      '2. 开始日期 ≤ 结束日期 — 结束日期 dependsOn: [\'startDate\']',
      '3. 主/备用联系人至少填一个 — 双向 dependsOn 互相校验',
      'crossValidator 返回 true 表示通过,返回 string 作为错误信息(form-schema 自动写入对应 form-item)',
      'validateDetail() 同步返回完整跨字段错误列表(用于调试或自定义展示)',
      'H3 验证：「年龄」挂在嵌套路径 user.age，「监护人」dependsOn 该嵌套路径（年龄亦 dependsOn guardian 联动）—— 年龄 10 时点「保存」制造两处红字(未成年须填写监护人)；① 填「监护人」→ 两处红字一起消失(跨字段反向重算)；② 或点「直改 model.user.age = 30」按钮(绕过 v-model 走兜底 watch)—— 两处红字也应自动消失',
      'H1 验证：「standalone disabled/hidden 字段」使用字段级函数形态(非 reaction 简写)—— 切换「同意协议」开关,两字段应联动禁用/启用、隐藏/显示,dev 控制台无 prop type 警告',
      'showErrorToast：打开右侧「浮窗」开关后点「保存」,跨字段校验失败的 errorBus 事件会以右上角 toast 弹出(默认关闭;同码错误 5s 固定窗口去重)',
    ]"
  >
    <section id="demo-cross-field">
      <DemoField label="跨字段校验" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" :show-error-toast="showErrorToast" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="onInspectDetail">查看跨字段详情</el-button>
          <el-button type="warning" plain @mousedown.prevent @click="onDirectSetAge">
            直改 model.user.age = 30（H3）
          </el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-switch
            v-model="showErrorToast"
            inline-prompt
            active-text="浮窗开"
            inactive-text="浮窗关"
            style="margin-left: auto"
          />
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="RuleItem 跨字段" :items="crossFieldItems" anchor="api-cross-field" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-cross-field {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
