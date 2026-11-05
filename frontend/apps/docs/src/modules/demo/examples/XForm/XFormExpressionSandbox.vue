<script setup lang="ts">
/**
 * 演示 expressionFunctions 白名单 + 沙箱安全（scanForForbidden）
 *
 * 场景：低代码后台（运营人员从 JSON 配置表单）
 *   1. expressionFunctions 注册白名单函数（格式化、计算、转换）—— 表达式按名调用
 *   2. 表达式字符串 {{ fn }} 从后端 JSON 配置下发也能跑（无需打包时编译）
 *   3. 沙箱安全：含 document / window / fetch / eval 等 forbidden 标识符 → console.error + Debug Banner 红字
 *   4. 与 XFormExpression 互补：本 demo 专门讲白名单与安全边界
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
import { expressionSandboxItems } from './configs/xform-demos-api'
import xFormSource from './XFormExpressionSandbox.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'expression-sandbox',
  schema: () => schema,
  model: () => model,
})

// 实时捕获沙箱拒绝原因（securityTest 字段触发时）
const { logs, clear } = useConsoleCapture('[XForm]')

// —— 白名单函数（expressionFunctions prop）——
const expressionFunctions = {
  toCurrency: (v: unknown): string => {
    const n = Number(v ?? 0)
    return `¥${n.toFixed(2)}`
  },
  upper: (v: unknown): string => String(v ?? '').toUpperCase(),
  concat: (...args: unknown[]): string => args.map((a) => String(a ?? '')).join('-'),
}

const model = reactive<Record<string, unknown>>({
  price: 88,
  qty: 3,
  code: 'abc',
})

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '单价',
      name: 'price',
      component: 'InputNumber',
      props: { min: 0, precision: 2, controlsPosition: 'right' },
    },
    {
      label: '数量',
      name: 'qty',
      component: 'InputNumber',
      props: { min: 1, controlsPosition: 'right' },
    },
    {
      // 演示 1：反应式 label —— 内联函数版本（基线对照，验证引擎工作正常）
      // 字符串表达式版本见 XForm.vue 中 reaction.disabled 字段（已验证支持）
      label: '合计',
      name: 'total',
      component: 'Input',
      props: { disabled: true, placeholder: '合计自动计算（内联函数版）' },
      reaction: {
        label: (m: Record<string, unknown>) => {
          const price = (m.price as number) ?? 0
          const qty = (m.qty as number) ?? 0
          return `合计：¥${(price * qty).toFixed(2)}`
        },
      },
    },
    {
      // 演示 2：反应式 label 大写转换（内联版）—— 演示反应式 label 在 XForm 的运行机制
      label: '代码（大写）',
      name: 'codeUpper',
      component: 'Input',
      props: { disabled: true, placeholder: '内联实现（基线对照）' },
      reaction: {
        label: (m: Record<string, unknown>) =>
          `代码（大写）：${String(m.code ?? '').toUpperCase()}`,
      },
    },
    {
      // 演示 3：反应式 label 拼接（内联版）
      label: '拼接演示',
      name: 'concatDemo',
      component: 'Input',
      props: { disabled: true, placeholder: '内联实现（基线对照）' },
      reaction: {
        label: (m: Record<string, unknown>) =>
          `拼接：${[m.code, m.price, m.qty].map((x) => String(x ?? '')).join('-')}`,
      },
    },
    {
      // 演示 4：沙箱安全——document 在沙箱中被屏蔽（字符串表达式触发拒绝）
      // 字符串表达式 '{{ (m) => document.title }}' 编译时扫描到 document → console.error + Debug Banner 红字
      // 注意：内联函数不经过沙箱（直接 Vue 文件作用域），所以必须用字符串表达式才能触发拒绝
      // 沙箱 = 函数体执行环境，与 model 副本 + 全局黑名单（document/fetch/eval/window 等）双重隔离
      label: '安全测试（含 document）',
      name: 'securityTest',
      component: 'Input',
      props: { disabled: true, placeholder: '字符串表达式含 document → 沙箱拒绝 + console.error' },
      reaction: {
        label: '{{ (m) => document.title }}',
      },
    },
    {
      // 演示 6：反应式 rules —— 按 model 状态动态返回 rules 数组
      // 注意：顶层 rules 不能用字符串（XForm 把它当「命名规则」查注册表 → 找不到就降级 + warn）
      // 字符串表达式场景见 XForm.vue 中 reaction.disabled 字段（已验证支持）
      label: '反应式 rules（按 model 动态返回）',
      name: 'whitelistTest',
      component: 'Input',
      // 不禁用：用户需要能 blur 才能触发 rules 校验
      props: { placeholder: 'blur 此字段触发校验：price/qty 留空时显示动态红字' },
      reaction: {
        rules: (m: Record<string, unknown>) => {
          // 模型已完整填写 → 无校验（通过）
          if (m.price && m.qty) return []
          // 模型不完整 → 动态生成必填校验
          return [
            {
              required: true,
              message: `请先填写价格和数量（当前：price=${String(m.price)} / qty=${String(m.qty)}）`,
              trigger: 'blur',
            },
          ]
        },
      },
    },
    {
      // 演示 5：沙箱安全——fetch 在沙箱中被屏蔽（字符串表达式触发拒绝）
      label: '安全测试（含 fetch）',
      name: 'securityTest2',
      component: 'Input',
      reaction: {
        label: '{{ (m) => typeof fetch }}',
      },
    },
  ],
}

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
  { id: 'demo-expression-sandbox', label: '白名单 + 沙箱安全演示' },
  { id: 'api-expression-sandbox', label: '沙箱字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="expressionFunctions 白名单 + 沙箱安全"
    source="src/components/form-schema/composables/use-expression.ts"
    :introductions="[
      '【注册白名单】expressionFunctions prop 注入白名单函数名（toCurrency / upper / concat）',
      '【应用场景】后端 JSON 配置表单：表达式字符串 `{{ (m) => toCurrency(m.x) }}` 可直接引用注册名（无需打包编译）',
      '【字符串表达式支持】reaction.disabled 等字段已验证支持 `{{ (m) => ... }}` 字符串表达式（见 XForm.vue）',
      '【reaction.label / reaction.rules 实践】本 demo 用内联函数（避免字符串表达式与白名单注册的时序耦合）',
      '【沙箱安全】含 document / fetch / eval / window 等 forbidden 标识符 → console.error + Debug Banner 红字',
      '测试 1: 修改 price / qty → 合计/代码/拼接 label 实时更新（内联基线）',
      '测试 2: 加载页面即触发 → 下方「控制台输出」面板显示 document / fetch 沙箱拒绝原因（无需打开 DevTools）',
      '测试 3: 在「反应式 rules」字段 blur（先 focus 再点别处）→ price/qty 留空时显示动态红字',
      '⚠️ 安全规则：禁止把 schema 来自 URL 参数 / localStorage / 用户输入——仅允许后端预校验或项目硬编码',
    ]"
  >
    <section id="demo-expression-sandbox">
      <DemoField label="白名单函数 + 沙箱安全" :code="xFormSource">
        <XForm
          ref="formRef"
          :schema="schema"
          :model="model"
          :expression-functions="expressionFunctions"
        />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="沙箱字段速查"
      :items="expressionSandboxItems"
      anchor="api-expression-sandbox"
    />
    <ConsoleLogPanel
      :logs="logs"
      title="沙箱拒绝原因（实时捕获）"
      empty="暂无警告（应仅安全测试字段变更后出现 [XForm] scanForForbidden 日志）"
      @clear="clear"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-expression-sandbox {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
