/**
 * XFormPropsAdvanced demo 用的代码片段（DemoField 展示用）
 *
 * 4 个 section 各配一段可独立运行的最小代码块，方便读者复制复用
 */

/** Section 1: permissionResolver —— 权限码 → 三态映射 */
export const permissionCode = `// XFormProps.permissionResolver：权限码 → 三态映射
const PERM_TABLE = { 'user.view': true, 'user.edit': true,
                     'user.admin': false, 'order.edit': false }
function permissionResolver(perm) {
  if (perm === 'user.view') return 'view'   // 只读纯文本
  return PERM_TABLE[perm] ? 'edit' : 'hidden'  // 可编辑 / 不渲染
}

<XForm :permission-resolver="permissionResolver" :schema="schema" :model="model" />

// schema 中节点用字符串字面量权限码（业务侧通常与后端约定命名）：
{ name: 'email',    label: '邮箱', component: 'Input', permission: 'user.edit' }
{ name: 'phone',    label: '手机', component: 'Input', permission: 'user.admin' }   // hidden
{ name: 'submitter', label: '提交人', component: 'Input', permission: 'order.edit' } // hidden`

/** Section 2: componentProps —— 全局默认 props（节点级可覆盖） */
export const componentPropsCode = `// XFormProps.componentProps：按组件名注入默认 props
const componentPropsGlobal = {
  Input:  { clearable: true, size: 'small' },    // 所有 Input 默认可清空 + 小尺寸
  Select: { filterable: true, clearable: true }, // 所有 Select 默认可搜索 + 可清空
}

<XForm :component-props="componentPropsGlobal" :schema="schema" :model="model" />

// 节点级 props 可覆盖全局默认：
{ name: 'qty', component: 'InputNumber', props: { size: 'default' } }  // 覆盖 small`

/** Section 3: reactionBudget —— reaction 循环联动预算（默认 50） */
export const reactionBudgetCode = `// XFormProps.reactionBudget：reaction 循环联动预算（默认 50）
<XForm :reaction-budget="5" :schema="schema" :model="model" />

// 演示 reaction 写自身依赖形成环（A → B → A）：
function loopA(m) { m.loopB = Number(m.loopA ?? 0) + 1; m.loopCount++ }
function loopB(m) { m.loopA = Number(m.loopB ?? 0) + 1; m.loopCount++ }

{ name: 'loopA', component: 'InputNumber', reaction: { _effect: loopA } }
{ name: 'loopB', component: 'InputNumber', reaction: { _effect: loopB } }

// 改 loopA 后：loopA 触发 loopA → 写 loopB → 触发 loopB → 写 loopA → ...
// 第 6 次时预算耗尽 console.error('reaction 单批次执行超过 5 次，疑似循环联动') 跳过`

/** Section 4: expressionFunctions —— 业务白名单 + 字符串表达式引用 */
export const expressionFunctionsCode = `// XFormProps.expressionFunctions：业务白名单 + 字符串表达式引用
const expressionFunctions = {
  toCurrency: (v) => \`¥\${Number(v ?? 0).toFixed(2)}\`,
  upper:      (v) => String(v ?? '').toUpperCase(),
  concat:     (...args) => args.map(a => String(a ?? '')).join('-'),
}

<XForm :expression-functions="expressionFunctions" :schema="schema" :model="model" />

// 反应式 label 内直接引用白名单（字符串表达式，按名查找）：
{ name: 'total', label: '合计',
  reaction: { label: '{{ (m) => \`合计：\${toCurrency(m.price * m.qty2)}\` }}' } }

{ name: 'codeUpper', label: '拼接大写',
  reaction: { label: '{{ (m) => \`拼接：\${upper(concat(m.code, m.price, m.qty2))}\` }}' } }`
