<script setup lang="ts">
/**
 * XFormProps 高级配置 demo —— 4 个独立 XForm 实例 + DemoField 包裹
 *
 * 覆盖字段：
 *   1. permissionResolver：权限码 → view/edit/hidden 三态映射函数
 *   2. componentProps：按组件名注入默认 props（节点级可覆盖）
 *   3. reactionBudget：reaction 循环联动预算（超限 console.error 后跳过）
 *   4. expressionFunctions：业务白名单 + 字符串表达式直接引用
 *
 * 结构演进：原版 4 个 section 嵌套在单个 XForm（用 Card 分组），但 Card 标题与 DemoField
 * 折叠代码区分离 → 页面割裂。重构为每个 section 独立 XForm 实例 + DemoField 包裹，
 * 与 element-plus 官网演示风格一致（每个示例独立 + 独立代码区）。
 *
 * 与已有 demo 互补：
 *   - XFormFieldPermission：字面量 / 函数 / 表达式 三种 permission 来源
 *   - XFormDirectives：含 componentProps 的指令与全局配置（但未单独聚焦）
 *   - XFormReactionDeps：reaction 自循环 + 预算兜底（默认 50，本 demo 显式配置 5）
 *   - XFormExpression / XFormExpressionSandbox：{{ fn }} 字符串表达式 + 白名单
 */
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ConsoleLogPanel from '../../components/ConsoleLogPanel.vue'
import { useConsoleCapture } from '../../composables/useConsoleCapture'
import { propsAdvancedItems } from './configs/xform-demos-api'
import {
  permissionCode,
  componentPropsCode,
  reactionBudgetCode,
  expressionFunctionsCode,
} from './configs/xform-props-advanced-snippets'
import {
  permissionResolverSchema,
  componentPropsSchema,
  reactionBudgetSchema,
  expressionFunctionsSchema,
} from './configs/xform-props-advanced-schema'

const bem = createNamespace('demo-x-form-props-advanced')

// —— 1. permissionResolver ——
//  业务侧通常这样写：
//    <XForm :permission-resolver="(p) => hasPerm(p) ? 'edit' : 'hidden'" />
//  此处硬编码 PERM_TABLE 模拟 useAuth().hasPerm；'user.view' 单独映射为 'view' 演示完整三态
const PERM_TABLE: Record<string, boolean> = {
  'user.view': true,
  'user.edit': true,
  'user.admin': false,
  'order.edit': false,
}
function mockHasPerm(perm: string): boolean {
  return Boolean(PERM_TABLE[perm])
}
function permissionResolver(perm: string): 'view' | 'edit' | 'hidden' {
  if (perm === 'user.view') return 'view'
  return mockHasPerm(perm) ? 'edit' : 'hidden'
}

// —— 2. componentProps ——
const componentPropsGlobal = {
  Input: { clearable: true, size: 'small' as const },
  Select: { filterable: true, clearable: true },
}

// —— 4. expressionFunctions ——
const expressionFunctions = {
  toCurrency: (v: unknown): string => `¥${Number(v ?? 0).toFixed(2)}`,
  upper: (v: unknown): string => String(v ?? '').toUpperCase(),
  concat: (...args: unknown[]): string => args.map((a) => String(a ?? '')).join('-'),
}

// 共享 props（4 个 XForm 实例各自接收）
const sharedProps = {
  'permission-resolver': permissionResolver,
  'component-props': componentPropsGlobal,
  'reaction-budget': 5,
  'expression-functions': expressionFunctions,
} as const

// 4 个独立 model（每个 section 独立，不跨 section 联动）
const permissionModel = reactive<Record<string, unknown>>({
  username: 'guest',
  email: 'guest@example.com',
  phone: '13800000000',
  submitter: '管理员',
})

const componentPropsModel = reactive<Record<string, unknown>>({
  title: '演示全局 small + clearable',
  city: 'BJ',
  qty: 1,
})

const reactionBudgetModel = reactive<Record<string, unknown>>({
  loopA: 0,
  loopB: 0,
  loopCount: 0,
})

const expressionFunctionsModel = reactive<Record<string, unknown>>({
  price: 88,
  qty2: 3,
  code: 'abc',
})

// 控制台日志捕获（仅 [XForm] 前缀）
const { logs, clear } = useConsoleCapture('[XForm]')

const tocItems = [
  { id: 'demo-permission-resolver', label: '1. permissionResolver' },
  { id: 'demo-component-props', label: '2. componentProps' },
  { id: 'demo-reaction-budget', label: '3. reactionBudget' },
  { id: 'demo-expression-functions', label: '4. expressionFunctions' },
  { id: 'api-props-advanced', label: '高级配置速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormProps 高级配置"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '集中演示 4 个 XFormProps 字段：permissionResolver / componentProps / reactionBudget / expressionFunctions。',
      '每个 section 独立 XForm 实例 + DemoField 包裹 —— 与 element-plus 官网演示风格一致。',
      '1. permissionResolver：把字符串字面量权限码映射为 view / edit / hidden 三态，业务侧注入 useAuth().hasPerm 即可。',
      '2. componentProps：按组件名注入默认 props，节点级 props 可覆盖（适合批量调整全局 UI 风格）。',
      '3. reactionBudget：reaction 循环联动兜底，本 demo 用 5 次预算演示超限 console.error。',
      '4. expressionFunctions：业务函数白名单，字符串表达式 {{ fn }} 直接按名引用（适合后端 JSON 配置场景）。',
    ]"
  >
    <!-- Section 1: permissionResolver —— 独立 XForm 实例 + DemoField 包裹 -->
    <section id="demo-permission-resolver" :class="bem.e('section')">
      <h3>1. permissionResolver —— 权限码 → 三态映射</h3>
      <p>
        本段演示：业务侧把字符串权限码交给 resolver 映射三态。
        <code>phone</code>
        与
        <code>submitter</code>
        因 resolver 返回
        <code>'hidden'</code>
        而完全不渲染；
        <code>username</code>
        映射为
        <code>'view'</code>
        渲染为只读纯文本。
      </p>
      <DemoField label="permissionResolver 用法" :code="permissionCode">
        <XForm :schema="permissionResolverSchema" :model="permissionModel" v-bind="sharedProps" />
      </DemoField>
    </section>

    <!-- Section 2: componentProps -->
    <section id="demo-component-props" :class="bem.e('section')">
      <h3>2. componentProps —— 全局默认 props（节点级可覆盖）</h3>
      <p>
        所有
        <code>Input</code>
        默认
        <code>clearable + size=small</code>
        ；
        <code>Select</code>
        默认
        <code>filterable + clearable</code>
        。
        <code>qty</code>
        节点显式
        <code>size: 'default'</code>
        覆盖全局默认。
      </p>
      <DemoField label="componentProps 用法" :code="componentPropsCode">
        <XForm :schema="componentPropsSchema" :model="componentPropsModel" v-bind="sharedProps" />
      </DemoField>
    </section>

    <!-- Section 3: reactionBudget -->
    <section id="demo-reaction-budget" :class="bem.e('section')">
      <h3>3. reactionBudget —— 循环联动预算</h3>
      <p>
        改
        <code>A</code>
        → 触发
        <code>loopReactionA</code>
        → 写
        <code>B</code>
        → 触发
        <code>loopReactionB</code>
        → 写
        <code>A</code>
        → 死循环。
        <code>reactionBudget=5</code>
        在第 6 次
        <code>console.error</code>
        后跳过，观察下方
        <code>reaction 实际执行次数</code>
        应稳定在
        <span :class="bem.e('trigger-count')">5</span>
        。
      </p>
      <DemoField label="reactionBudget 用法" :code="reactionBudgetCode">
        <XForm :schema="reactionBudgetSchema" :model="reactionBudgetModel" v-bind="sharedProps" />
      </DemoField>
    </section>

    <!-- Section 4: expressionFunctions -->
    <section id="demo-expression-functions" :class="bem.e('section')">
      <h3>4. expressionFunctions —— 业务白名单 + 字符串表达式引用</h3>
      <p>
        修改
        <code>单价</code>
        /
        <code>数量</code>
        /
        <code>代码</code>
        ， 观察
        <code>合计</code>
        与
        <code>拼接大写</code>
        label 实时变化 —— 字符串表达式按名引用白名单函数（与 XFormExpressionSandbox
        共用同一套机制）。
      </p>
      <DemoField label="expressionFunctions 用法" :code="expressionFunctionsCode">
        <XForm
          :schema="expressionFunctionsSchema"
          :model="expressionFunctionsModel"
          v-bind="sharedProps"
        />
      </DemoField>
    </section>

    <ApiTable title="XFormProps 高级配置" :items="propsAdvancedItems" anchor="api-props-advanced" />
    <ConsoleLogPanel
      :logs="logs"
      title="[XForm] 日志（reaction 预算超限等告警）"
      empty="暂无警告（修改 reactionBudget 段 A 字段后会触发循环联动 console.error）"
      @clear="clear"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-props-advanced {
  &__section {
    margin-top: 24px;
    h3 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
    }
    p {
      margin: 0 0 12px;
      color: #606266;
      line-height: 1.7;
    }
  }
  &__trigger-count {
    color: #409eff;
    font-weight: 600;
  }
}
</style>
