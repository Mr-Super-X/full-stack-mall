<script setup lang="ts">
/**
 * 演示 validateField(name) 逐字段校验 + resetFields(names) 部分重置
 *
 * 场景：员工入职登记（姓名 / 邮箱 / 部门 / 入职日期）
 * 1. validateField(name)：只校验指定字段——提交前逐字段预检，不用全量 validate
 * 2. resetFields(names)：模拟服务端 422 双字段红字后，只重置其中一个，
 *    另一个红字保留（全量 resetFields 会清掉所有）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { validateFieldItems } from './configs/xform-demos-api'
import xFormSource from './XFormValidateField.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef } = useXFormDemo({
  name: 'validate-field',
  schema: () => schema,
})

const DEPT_OPTIONS = ['研发部', '产品部', '运营部'].map((d) => ({ value: d, label: d }))

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '姓名',
      name: 'name',
      component: 'Input',
      rules: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
      props: { placeholder: '必填' },
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      rules: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
      ],
      props: { placeholder: '必填 + 邮箱格式' },
    },
    {
      label: '部门',
      name: 'dept',
      component: 'Select',
      rules: [{ required: true, message: '请选择部门', trigger: 'change' }],
      props: { placeholder: '必选', options: DEPT_OPTIONS },
    },
    {
      label: '入职日期',
      name: 'hireDate',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '非必填（对照组）' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  name: '',
  email: '',
  dept: '',
  hireDate: '',
})

// formRef 由 useXFormDemo 统一提供

// ---- validateField(name) 演示 ----
const fieldResults = ref<Record<string, string>>({})

async function validateOne(name: string, label: string) {
  const ok = await formRef.value?.validateField(name)
  fieldResults.value = {
    ...fieldResults.value,
    [name]: ok ? `✅ ${label} 校验通过` : `❌ ${label} 未通过（红字已显示在字段下方）`,
  }
}

// ---- resetFields(names) 演示 ----
function mockServerError() {
  formRef.value?.setFieldError('name', '该姓名已被注册（服务端 422）')
  formRef.value?.setFieldError('email', '该邮箱已被占用（服务端 422）')
  ElMessage.warning('已模拟服务端 422：姓名 + 邮箱双红字')
}

function resetOnlyName() {
  formRef.value?.resetFields(['name'])
  ElMessage.info('已部分重置 name —— 观察 email 红字仍然保留')
}

function resetAll() {
  formRef.value?.resetFields()
  ElMessage.info('已全量重置（所有值与红字清空）')
}

const tocItems = [
  { id: 'demo-validate-field', label: 'validateField 演示' },
  { id: 'demo-reset-fields', label: 'resetFields 演示' },
  { id: 'api-validate-field', label: 'API' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="validateField 逐字段校验 + resetFields 部分重置"
    source="src/components/form-schema/composables/use-form-instance.ts"
    :introductions="[
      'validateField(name)：透传 el-form 逐字段校验，返回 boolean —— 提交前逐字段预检，不用全量 validate。',
      'resetFields(names)：部分重置指定字段（值 + 红字），其他字段与红字保留；不传 names 为全量重置。',
      '演示：先点「校验此字段」逐个预检；再模拟服务端 422 双红字，对比部分重置与全量重置的差异。',
    ]"
  >
    <section id="demo-validate-field">
      <DemoField label="员工入职登记（4 字段）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />

        <div :class="bem.e('group')">
          <div :class="bem.e('group-title')">① validateField(name) 逐字段校验</div>
          <div :class="bem.e('actions')">
            <el-button size="small" @click="validateOne('name', '姓名')">校验姓名</el-button>
            <el-button size="small" @click="validateOne('email', '邮箱')">校验邮箱</el-button>
            <el-button size="small" @click="validateOne('dept', '部门')">校验部门</el-button>
            <el-button size="small" @click="validateOne('hireDate', '入职日期')">
              校验入职日期
            </el-button>
          </div>
          <ul :class="bem.e('results')">
            <li v-for="(result, field) in fieldResults" :key="field">{{ result }}</li>
            <li v-if="Object.keys(fieldResults).length === 0" :class="bem.e('placeholder')">
              （点击上方按钮，结果逐字段显示在这里）
            </li>
          </ul>
        </div>

        <div :class="bem.e('group')" id="demo-reset-fields">
          <div :class="bem.e('group-title')">② resetFields(names) 部分重置</div>
          <div :class="bem.e('actions')">
            <el-button size="small" type="warning" @click="mockServerError">
              模拟服务端 422（双红字）
            </el-button>
            <el-button size="small" type="primary" @click="resetOnlyName">
              只重置 name（email 红字保留）
            </el-button>
            <el-button size="small" @click="resetAll">全部重置</el-button>
          </div>
        </div>

        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="validateField / resetFields API"
      :items="validateFieldItems"
      anchor="api-validate-field"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-validate-field {
  &__group {
    margin-top: 16px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
  }

  &__group-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__results {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.8;
    color: #606266;
  }

  &__placeholder {
    color: #909399;
    list-style: none;
    margin-left: -18px;
  }
}
</style>
