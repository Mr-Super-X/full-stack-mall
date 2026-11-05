<script setup lang="ts">
/**
 * XForm 基础用法 demo —— 2 列栅格 + 字符串 / 函数校验规则
 *
 * 对照参考仓场景命名（form/base）—— 业务模块可参照本 demo 搭建订单 / 用户等查询表单。
 *
 * 🠶 三种"隐藏"语义对比（hidden / ignore / permission: 'hidden'）：见 docs/24-XForm使用指南.md §4.2
 *
 * 场景：订单查询表单（贴合 orders 模块）
 * 字段：订单号 / 订单状态 / 下单日期区间 / 备注
 * 特性：column 2 列栅格 + rules（'required' 字符串 + validator 函数）
 */
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { ruleItems } from './configs/xform-demos-api'
import xFormSource from './XFormBase.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'base',
  schema: () => schema,
  model: () => model,
})

// —— 订单状态字典（mock 远程接口） ——
const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'shipped', label: '已发货' },
  { value: 'done', label: '已完成' },
  { value: 'canceled', label: '已取消' },
]

const schema: SchemaNode = {
  // 顶层用 row 而非 column：顶层 column 会把每个节点包进固定 span 的 ElCol，
  // 节点级 col.span 被外层半宽限制无法突破 —— 用 row + 节点级 col.span 分配列宽
  row: { gutter: 24 },
  children: [
    {
      label: '订单号',
      name: 'orderNo',
      col: { span: 6 },
      rules: [
        'required',
        {
          // ORD- 开头 + 6 位数字，如 ORD-202401
          validator: (_rule: unknown, value: unknown, cb: (err?: Error) => void) => {
            if (typeof value === 'string' && !/^ORD-\d{6}$/.test(value)) {
              cb(new Error('订单号格式：ORD- 开头 + 6 位数字'))
            } else {
              cb()
            }
          },
        },
      ],
      component: 'Input',
      props: { placeholder: '如 ORD-202401', clearable: true },
    },
    {
      label: '订单状态',
      name: 'status',
      col: { span: 18 },
      component: 'Select',
      props: {
        placeholder: '请选择状态',
        clearable: true,
        options: ORDER_STATUS_OPTIONS,
      },
    },
    {
      label: '开始日期',
      name: 'startDate',
      col: { span: 12 },
      rules: 'required',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择开始日期' },
    },
    {
      label: '结束日期',
      name: 'endDate',
      col: { span: 12 },
      rules: [
        'required',
        {
          validator: (_rule: unknown, value: unknown, cb: (err?: Error) => void) => {
            const today = dayjs().format('YYYY-MM-DD')
            if (typeof value === 'string' && value > today) {
              cb(new Error('不能晚于今天'))
            } else {
              cb()
            }
          },
        },
      ],
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择结束日期' },
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      col: { span: 24 },
      props: { type: 'textarea', rows: 3, placeholder: '备注信息（整行占满）' },
    },
    {
      label: '密码',
      name: 'pwd',
      col: { span: 12 },
      component: 'InputPassword',
      rules: { required: true, message: '请输入密码', trigger: 'blur' },
      defaultValue: 'secret-123',
    },
    {
      label: '描述',
      name: 'desc',
      col: { span: 12 },
      component: 'InputTextArea',
      rules: 'required',
      defaultValue: '这是 InputTextArea 别名的默认效果。',
      props: {
        rows: 4,
        maxlength: 100,
      },
    },
    {
      label: '技能标签',
      name: 'tags',
      col: { span: 12 },
      component: 'InputTag',
      rules: 'required',
      defaultValue: ['Vue', 'Element Plus'],
    },
    {
      label: '主题色',
      name: 'color',
      col: { span: 12 },
      component: 'ColorPicker',
      rules: 'required',
      defaultValue: '#1890ff',
    },
    {
      label: '负责人',
      name: 'owner',
      col: { span: 12 },
      component: 'Mention',
      rules: 'required',
      defaultValue: '@alice',
      props: {
        options: [
          { value: 'alice', label: 'Alice' },
          { value: 'bob', label: 'Bob' },
        ],
      },
    },
    {
      label: '评分',
      name: 'score',
      col: { span: 12 },
      component: 'Rate',
      rules: { type: 'number', min: 1, message: '请选择评分', required: true },
      // defaultValue: 4,
    },
    {
      label: '最低价',
      name: 'minPrice',
      col: { span: 12 },
      component: 'InputNumber',
      rules: 'required',
      defaultValue: 1,
      props: { min: 0 },
    },
    {
      label: '商品描述',
      name: 'description',
      col: { span: 24 },
      // 不在 EL 组件集、未通过 :components 注册 —— 演示 resolveComponentFor 全局组件 fallback
      // （unplugin-vue-components 把 @vv/ui/components/common/**（包源码三目录）自动注册到 GlobalComponents）
      component: 'RichTextEditor',
      // RichTextEditor 内部 handleChange 已把「视觉为空」映射为 emit('')，业务方可直接用
      // 字符串 'required' 触发 el-form 标准校验（async-validator），无须自定义 validator
      rules: 'required',
      defaultValue: '<p>富文本编辑器默认内容</p>',
      props: { height: '320px', placeholder: '请输入商品描述（支持富文本）' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({})

/**
 * 自定义 onSave：展示 model JSON dump（XFormBase 演示需求）
 * 其他 demo 若只需「validate + toast」可直接用 useXFormDemo 暴露的 onSave
 */
async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (valid) {
    ElMessage.success('保存成功')
  } else {
    ElMessage.error('校验失败，请检查字段')
  }
}

const tocItems = [
  { id: 'demo-base', label: '基础用法演示' },
  { id: 'api-rule', label: 'RuleItem 常用字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="基础用法（订单查询表单）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '订单查询表单：订单号 / 状态 / 日期区间 / 备注 4 字段。',
      '顶层 row.gutter: 24 + 节点级 col.span 分配列宽：前 4 字段各 12 列，备注 24 列整行占满。',
      '注意：顶层 column 会把每个节点包进固定 span 的 ElCol，节点级 col.span 无法突破半宽——混用列宽时用 row + col.span 组合。',
      'rules 支持 「required」字符串 + validator 函数。订单号带格式校验，结束日期不能晚于今天。',
      '新增组件字段：密码 / 描述 / 技能标签 / 主题色 / 负责人 / 评分 / 最低价（验证 InputPassword/InputTextArea/InputTag/ColorPicker/Mention/Rate 别名、默认 props、节点覆盖与 v-model）。',
      '商品描述字段演示「全局组件 fallback」：schema.component 直接写 RichTextEditor，依赖 unplugin-vue-components 自动注册到 GlobalComponents，无需在 XForm 上 :components 重复注册。',
    ]"
  >
    <section id="demo-base">
      <DemoField label="订单查询（2 列栅格）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
        <p :class="bem.e('hint')">
          <strong>特殊字段操作指引：</strong>
          <br />
          <strong>技能标签（InputTag）：</strong>
          1) 在输入框输入
          <code>Vue3</code>
          → 2) 按回车确认 → 3) 重复添加 2~3 个 tag → 4) 点击 tag 右侧 × 删除；支持失焦自动确认。
          <br />
          <strong>主题色（ColorPicker）：</strong>
          1) 点击色块打开拾色器 → 2) 拖动色相滑块选色 → 3) 在饱和度面板点击精确取色 → 4) 按 Enter
          或点击外部关闭，model.color 同步为 hex 字符串。
          <br />
          <strong>负责人（Mention）：</strong>
          1) 输入框输入
          <code>@</code>
          触发提及下拉 → 2) 输入
          <code>al</code>
          模糊匹配
          <code>alice</code>
          → 3) 鼠标点击或回车选中 → model.owner 写入完整
          <code>@alice</code>
          字符串。
          <br />
          <strong>评分（Rate）：</strong>
          1) 鼠标悬停星星预览分数 → 2) 点击第 N 颗星锁定分数（1~5）→ model.score 即为数值。
        </p>
      </DemoField>
    </section>

    <ApiTable title="RuleItem 常用字段" :items="ruleItems" anchor="api-rule" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-base {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
