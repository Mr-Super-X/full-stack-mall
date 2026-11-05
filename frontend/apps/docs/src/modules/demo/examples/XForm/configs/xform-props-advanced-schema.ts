/**
 * XFormPropsAdvanced demo —— 4 个独立 schema export
 *
 * 拆分依据：每个 section 演示一个独立的 XFormProps，互不依赖
 * （已评估跨 section 联动：permissionResolver/componentProps/reactionBudget/expressionFunctions
 * 各 section 内部联动，跨 section 无依赖）
 *
 * 每个 schema 自带 children + reaction 闭包；model 在 XFormPropsAdvanced.vue 内各自独立
 *
 * @see ./XFormPropsAdvanced.vue —— 4 个独立 XForm 实例 + DemoField 包裹
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'

/**
 * 循环联动函数（reactionBudget 演示用）
 * 循环 A → 写 B → 循环 B → 写 A → 死循环；
 * budget=5 时 use-reaction 预算耗尽 console.error 跳过
 */
export function loopReactionA(m: Record<string, unknown>): void {
  m.loopB = Number(m.loopA ?? 0) + 1
  m.loopCount = (Number(m.loopCount) || 0) + 1
}
export function loopReactionB(m: Record<string, unknown>): void {
  m.loopA = Number(m.loopB ?? 0) + 1
  m.loopCount = (Number(m.loopCount) || 0) + 1
}

// ============================================================
// Section 1: permissionResolver —— 节点 permission 字符串走 resolver 映射三态
// ============================================================
export const permissionResolverSchema: SchemaNode = {
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      name: 'username',
      label: '用户名（user.view → view，只读纯文本）',
      component: 'Input',
      permission: 'user.view',
    },
    {
      name: 'email',
      label: '邮箱（user.edit → edit，可编辑）',
      component: 'Input',
      permission: 'user.edit',
    },
    {
      name: 'phone',
      label: '手机（user.admin → hidden，不渲染）',
      component: 'Input',
      permission: 'user.admin',
    },
    {
      name: 'submitter',
      label: '提交人（order.edit → hidden）',
      component: 'Input',
      permission: 'order.edit',
    },
  ],
}

// ============================================================
// Section 2: componentProps —— 全局默认 props（节点级可覆盖）
// ============================================================
export const componentPropsSchema: SchemaNode = {
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      name: 'title',
      label: 'Input（默认 clearable + small）',
      component: 'Input',
      props: { placeholder: '全局默认已生效：右上有清空图标' },
    },
    {
      name: 'city',
      label: 'Select（默认 filterable + clearable）',
      component: 'Select',
      props: {
        placeholder: '可搜索、可清空',
        options: [
          { value: 'BJ', label: '北京' },
          { value: 'SH', label: '上海' },
          { value: 'GZ', label: '广州' },
        ],
      },
    },
    {
      name: 'qty',
      label: 'InputNumber（节点级 size 覆盖为 default）',
      component: 'InputNumber',
      props: { min: 0, size: 'default' as const, controlsPosition: 'right' },
    },
  ],
}

// ============================================================
// Section 3: reactionBudget —— reaction 循环联动预算（演示用 5）
// ============================================================
export const reactionBudgetSchema: SchemaNode = {
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      name: 'loopA',
      label: 'A（每次变化触发 B）',
      component: 'InputNumber',
      props: { controlsPosition: 'right' },
      reaction: { _effect: loopReactionA },
    },
    {
      name: 'loopB',
      label: 'B（每次变化又触发 A）',
      component: 'InputNumber',
      props: { disabled: true, controlsPosition: 'right' },
      reaction: { _effect: loopReactionB },
    },
    {
      name: 'loopCount',
      label: 'reaction 实际执行次数',
      component: 'Input',
      props: { disabled: true, placeholder: '观察 counter 是否稳定在 5' },
    },
  ],
}

// ============================================================
// Section 4: expressionFunctions —— 字符串表达式直接引用白名单函数
// ============================================================
export const expressionFunctionsSchema: SchemaNode = {
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      name: 'price',
      label: '单价',
      component: 'InputNumber',
      props: { min: 0, precision: 2, controlsPosition: 'right' },
    },
    {
      name: 'qty2',
      label: '数量',
      component: 'InputNumber',
      props: { min: 1, controlsPosition: 'right' },
    },
    {
      // 反应式 label 引用白名单 toCurrency
      name: 'total',
      label: '合计（自动计算）',
      component: 'Input',
      props: { disabled: true, placeholder: '合计 = 单价 × 数量' },
      reaction: {
        label: '{{ (m) => toCurrency((m.price ?? 0) * (m.qty2 ?? 0)) }}',
      },
    },
    {
      name: 'code',
      label: '代码',
      component: 'Input',
      props: { placeholder: '输入字母' },
    },
    {
      // 反应式 label 引用白名单 concat + upper
      name: 'codeUpper',
      label: '拼接大写（自动）',
      component: 'Input',
      props: { disabled: true, placeholder: 'concat(code, price, qty2) 后大写' },
      reaction: {
        label: '{{ (m) => upper(concat(m.code, m.price, m.qty2)) }}',
      },
    },
  ],
}
