<script setup lang="ts">
/**
 * 演示校验失败自动滚动（scrollToError）
 *
 * 场景：供应商入库登记 —— 长表单（10 字段），第一个必填错误「生产许可证号」
 * 位于表单底部视口外，校验失败时页面自动滚动到该字段。
 *
 * 覆盖功能：
 *   1. scrollToError 开关：字段规则失败由 ElForm 原生滚动到第一个 .el-form-item.is-error
 *   2. scrollIntoViewOptions 透传：滚动行为（smooth + center）
 *   3. 前 8 个字段带 defaultValue 挂载自动填充（非必填），licenseNo 必填留空作为滚动目标
 *   4. 跨字段错误同样参与自动滚动（XForm 内部按 keyPath 滚动，见 XFormCrossField demo）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { scrollToErrorItems } from './configs/xform-demos-api'
import xFormSource from './XFormScrollToError.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'scroll-to-error',
  schema: () => schema.value,
})

const CATEGORY_OPTIONS = ['电子元件', '五金配件', '包装材料'].map((c) => ({ value: c, label: c }))
const WAREHOUSE_OPTIONS = ['华南一号仓', '华东二号仓', '华北三号仓'].map((w) => ({
  value: w,
  label: w,
}))
const INVOICE_OPTIONS = ['增值税专用发票', '增值税普通发票'].map((i) => ({ value: i, label: i }))

/** 已填充字段（defaultValue 自动填充）——18 个字段撑长表单，让必填错误位于视口外 */
const FILLED_FIELDS: Array<{
  name: string
  label: string
  value: unknown
  component?: string
  options?: Array<{ value: string; label: string }>
}> = [
  { name: 'supplierName', label: '供应商名称', value: '华南电子供应链有限公司' },
  { name: 'contact', label: '联系人', value: '张三' },
  { name: 'phone', label: '联系电话', value: '13800138000' },
  { name: 'email', label: '邮箱', value: 'zhangsan@example.com' },
  { name: 'address', label: '仓库地址', value: '广东省深圳市南山区科技园 88 号' },
  { name: 'registeredAddress', label: '注册地址', value: '广东省深圳市南山区科技园 88 号' },
  { name: 'legalPerson', label: '法定代表人', value: '李四' },
  { name: 'creditCode', label: '统一社会信用代码', value: '91440300MA5XXXXX1X' },
  {
    name: 'category',
    label: '物料分类',
    value: '电子元件',
    component: 'Select',
    options: CATEGORY_OPTIONS,
  },
  {
    name: 'warehouse',
    label: '入库仓库',
    value: '华南一号仓',
    component: 'Select',
    options: WAREHOUSE_OPTIONS,
  },
  { name: 'bank', label: '开户银行', value: '中国工商银行深圳科技园支行' },
  { name: 'bankAccount', label: '银行账号', value: '4000021209200123456' },
  {
    name: 'invoiceType',
    label: '发票类型',
    value: '增值税专用发票',
    component: 'Select',
    options: INVOICE_OPTIONS,
  },
  { name: 'taxNo', label: '纳税人识别号', value: '91440300MA5XXXXX1X' },
  { name: 'qualityStandard', label: '质量标准', value: 'GB/T 19001-2016' },
  { name: 'deliveryTerm', label: '交货周期', value: '7 个工作日' },
  { name: 'paymentTerm', label: '结算方式', value: '月结 30 天' },
  { name: 'remark', label: '备注', value: '加急入库，请优先验收' },
  { name: 'acceptanceStandard', label: '验收标准', value: '按采购合同技术条款验收' },
  { name: 'packingRequirement', label: '包装要求', value: '防静电袋 + 防震泡沫' },
  { name: 'transportMode', label: '运输方式', value: '公路运输' },
  { name: 'carrier', label: '承运商', value: '顺丰速运' },
  { name: 'expectedArrival', label: '预计到货日期', value: '2026-09-05' },
  { name: 'inspector', label: '质检员', value: '王五' },
  { name: 'receiptNo', label: '入库单号', value: 'RK-20260826-001' },
  { name: 'supplierCode', label: '供应商编号', value: 'SUP-000123' },
  { name: 'contactTitle', label: '联系人职位', value: '采购经理' },
  { name: 'backupPhone', label: '备用电话', value: '13900139000' },
  { name: 'companyEmail', label: '企业邮箱', value: 'sales@huanan-elec.com' },
  { name: 'website', label: '企业官网', value: 'https://www.huanan-elec.com' },
  { name: 'logisticsNo', label: '物流单号', value: 'SF1234567890' },
  { name: 'logisticsStatus', label: '物流状态', value: '运输中' },
  { name: 'supplierRating', label: '供应商评级', value: 'A 级' },
  { name: 'cooperationYears', label: '合作年限', value: '5 年' },
  { name: 'annualAmount', label: '年采购额', value: '约 800 万元' },
  { name: 'warrantyTerm', label: '质保条款', value: '到货 12 个月' },
  { name: 'penaltyClause', label: '违约条款', value: '按合同第 8 条执行' },
  { name: 'confidentiality', label: '保密协议', value: '已签署' },
]

const schemaChildren: SchemaNode['children'] = [
  ...FILLED_FIELDS.map((f) => ({
    label: f.label,
    name: f.name,
    component: f.component ?? 'Input',
    defaultValue: f.value,
    props: { placeholder: f.label, ...(f.options ? { options: f.options } : {}) },
  })),
  {
    label: '生产许可证号',
    name: 'licenseNo',
    component: 'Input',
    col: { span: 12 },
    rules: [{ required: true, message: '请输入生产许可证号', trigger: 'blur' }],
    props: { placeholder: '必填 —— 留空点校验，页面自动滚动到这里' },
  },
  {
    label: '许可证到期日',
    name: 'expiryDate',
    component: 'DatePicker',
    defaultValue: '2027-12-31',
    col: { span: 12 },
    props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择到期日' },
  },
]

// 仅声明必填字段（留空作滚动目标）；其余字段由 schema defaultValue 挂载填充
const model = reactive<Record<string, unknown>>({
  licenseNo: '',
})

// formRef 由 useXFormDemo 统一提供

// 滚动开关（开 → 校验失败自动滚动；关 → 只显示红字不滚动）
const scrollToError = ref(true)

// scrollToError / scrollIntoViewOptions 在 schema 顶层配置（与 labelPosition 同模式，仅顶层生效）
const schema = computed<SchemaNode>(() => ({
  scrollToError: scrollToError.value,
  scrollIntoViewOptions: { behavior: 'smooth', block: 'center' },
  column: 2,
  row: { gutter: 24 },
  children: schemaChildren,
}))
const lastResult = ref('')

async function onValidate() {
  const valid = await formRef.value?.validate()
  if (valid) {
    lastResult.value = '✅ 校验通过'
    ElMessage.success('校验通过')
  } else {
    lastResult.value = scrollToError.value
      ? '❌ 校验失败 —— 页面已自动滚动到第一个错误字段（生产许可证号）'
      : '❌ 校验失败 —— scrollToError 已关闭，未自动滚动（红字在表单底部）'
    ElMessage.error('校验失败，请检查红字提示')
  }
}

const tocItems = [
  { id: 'demo-scroll-to-error', label: '自动滚动演示' },
  { id: 'api-scroll-to-error', label: 'scrollToError API' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="校验失败自动滚动（scrollToError）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'scrollToError 开启时，validate() 失败自动滚动到第一个错误字段：字段规则失败由 element-plus ElForm 原生处理，跨字段失败由 XForm 内部滚动。',
      '演示：前 8 个字段已由 defaultValue 自动填充，仅「生产许可证号」必填留空 —— 点校验后页面滚动到底部红字字段。',
      '切换开关后再次校验对比滚动行为差异。scrollToError / scrollIntoViewOptions 在 schema 顶层配置（同 labelPosition）。',
    ]"
  >
    <section id="demo-scroll-to-error">
      <DemoField label="供应商入库登记（10 字段长表单）" :code="xFormSource">
        <div :class="bem.e('actions')">
          <span :class="bem.e('switch-label')">自动滚动：</span>
          <el-switch v-model="scrollToError" />
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <span :class="bem.e('result')">{{ lastResult }}</span>
        </div>
        <XForm ref="formRef" :schema="schema" :model="model" />
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="scrollToError 自动滚动"
      :items="scrollToErrorItems"
      anchor="api-scroll-to-error"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-scroll-to-error {
  &__actions {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__switch-label {
    font-size: 13px;
    color: #606266;
  }

  &__result {
    font-size: 13px;
    color: #909399;
  }
}
</style>
