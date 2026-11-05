<script setup lang="ts">
/**
 * 演示 XForm 3 层 beforeChange 拦截 —— 全局 Props / 命名空间 / 字段级
 *
 * A. 全局 Props（第 1 层）：提现金额超额回弹 + 自动取百位 + ctx.setFieldError
 * B. 字段级（第 3 层）：输入手机号自动去空格 + 选城市联动清空区（ctx.setFieldValue）
 * C. 命名空间（第 2 层）：数组 items[*].phone 用正则统一格式化
 */
import { ElMessage } from 'element-plus'
import type {
  BeforeChangeFn,
  BeforeChangeRule,
  SchemaNode,
} from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { beforeChangePropsItems } from './configs/xform-demos-api'
import xFormSource from './XFormBeforeChange.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

type TabKey = 'global' | 'field' | 'namespace'
const activeTab = ref<TabKey>('global')

const tocItems = [
  { id: 'demo-before-change', label: '3 层 beforeChange 演示' },
  { id: 'api-before-change', label: 'beforeChange 字段速查' },
]

useDocToc(tocItems)

// ════════════════════════════════════════════════════════════
// Tab A: 全局 Props（第 1 层：横切关注点）
// ════════════════════════════════════════════════════════════
const modelA = reactive<Record<string, unknown>>({
  balance: 500,
  amount: 50,
  recipient: '张三',
})
const schemaA: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '账户余额（元）',
      name: 'balance',
      component: 'InputNumber',
      props: { disabled: true, controlsPosition: 'right' },
    },
    {
      label: '提现金额（元）',
      name: 'amount',
      component: 'InputNumber',
      props: {
        min: 0,
        controlsPosition: 'right',
        placeholder: '试 800（超额拦截）/ 156（>100 自动取百位）',
      },
    },
    {
      label: '收款人',
      name: 'recipient',
      component: 'Input',
      props: { placeholder: '姓名', clearable: true },
    },
  ],
}

/** 全局 Props beforeChange：按 item.name 分派到具体字段 */
const beforeChangeA = (item: { name?: string }, newVal: unknown, _oldVal: unknown): unknown => {
  if (item.name !== 'amount') return newVal
  const nv = newVal as number
  const bal = modelA.balance as number
  if (nv > bal) {
    ElMessage.warning(`超过可用余额（¥${bal}）`)
    return _oldVal
  }
  if (nv > 100) {
    const rounded = Math.round(nv / 100) * 100
    ElMessage.info(`自动四舍五入到百位：¥${nv} → ¥${rounded}`)
    return rounded
  }
  return newVal
}

// ════════════════════════════════════════════════════════════
// Tab B: 字段级（第 3 层：业务内聚）
// ════════════════════════════════════════════════════════════
const modelB = reactive<Record<string, unknown>>({
  phone: '',
  city: '',
  district: '',
  remark: '',
})

/**
 * 字段级 beforeChange：手机号自动去空格
 * BeforeChangeFn 签名固定为 5 参数：(item, newValue, oldValue, allValues, ctx)
 * 用命名 const 函数 + 显式标注 BeforeChangeFn 类型，避免 TS 推断把 newValue 推到 item
 */
const trimPhone: BeforeChangeFn = (_item, newValue, _old, _all) => {
  return typeof newValue === 'string' ? newValue.replace(/\s/g, '') : newValue
}

/**
 * 字段级 beforeChange：选城市时联动清空"区"字段（ctx.setFieldValue 用法）
 */
const clearDistrictOnCityChange: BeforeChangeFn = (_item, newValue, _old, _all, ctx) => {
  if (ctx) ctx.setFieldValue('district', null)
  return newValue
}

/**
 * 字段级 beforeChange：输入"bad"时显示红字（ctx.setFieldError 用法）
 */
const errorOnReason: BeforeChangeFn = (_item, newValue, _old, _all, ctx) => {
  if (newValue === 'bad' && ctx) {
    ctx.setFieldError('remark', '不允许输入 bad')
  }
  return newValue
}

const schemaB: SchemaNode = {
  column: 1,
  children: [
    {
      label: '手机号',
      name: 'phone',
      component: 'Input',
      props: { placeholder: '输入会自动去空格', clearable: true },
      beforeChange: trimPhone,
    },
    {
      label: '城市',
      name: 'city',
      component: 'Select',
      props: {
        placeholder: '选城市会清空区字段',
        options: [
          { label: '北京', value: '北京' },
          { label: '上海', value: '上海' },
        ],
      },
      beforeChange: clearDistrictOnCityChange,
    },
    {
      label: '区',
      name: 'district',
      component: 'Input',
      props: { placeholder: '由城市清空', clearable: true },
    },
    {
      label: '备注（错误演示）',
      name: 'remark',
      component: 'Input',
      props: { placeholder: '输入 "bad" 显示红字' },
      beforeChange: errorOnReason,
    },
  ],
}

// ════════════════════════════════════════════════════════════
// Tab C: 命名空间（第 2 层：动态数组场景）
// ════════════════════════════════════════════════════════════
const modelC = reactive<Record<string, unknown>>({
  contacts: [{ name: 'Alice', phone: '138 0013 8000' }],
})
const schemaC: SchemaNode = {
  column: 1,
  children: [
    {
      label: '联系人列表',
      name: 'contacts',
      kind: 'array',
      array: {
        initialLength: 1,
        itemSchema: {
          column: 2,
          children: [
            { label: '姓名', name: 'name', component: 'Input', props: { clearable: true } },
            {
              label: '手机号（自动去空格）',
              name: 'phone',
              component: 'Input',
              props: { placeholder: '输入会自动去空格', clearable: true },
            },
          ],
        },
      },
    },
  ],
}

/** 命名空间规则：所有 contacts[i].phone 自动去空格（正则匹配动态路径）
 * BeforeChangeFn 签名固定 5 参数：(item, newValue, oldValue, allValues, ctx)
 * 必须用完整签名否则 TS 推断把 value 推到 item
 */
const trimContactsPhone: BeforeChangeFn = (_item, newValue) => {
  return typeof newValue === 'string' ? newValue.replace(/\s/g, '') : newValue
}
const beforeChangeRulesC: BeforeChangeRule[] = [
  {
    pattern: /^contacts\[\d+\]\.phone$/,
    handler: trimContactsPhone,
  },
]

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'before-change',
  schema: () => {
    if (activeTab.value === 'global') return schemaA
    if (activeTab.value === 'field') return schemaB
    return schemaC
  },
})

function currentModel(): Record<string, unknown> {
  if (activeTab.value === 'global') return modelA
  if (activeTab.value === 'field') return modelB
  return modelC
}

async function onSave(): Promise<void> {
  const valid = await formRef.value?.validate()
  if (valid) {
    ElMessage.success(`model: ${JSON.stringify(currentModel()).slice(0, 80)}...`)
  } else {
    ElMessage.error('校验失败')
  }
}
</script>

<template>
  <DemoFrame
    title="XForm 3 层 beforeChange 拦截"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'beforeChange 升级为 3 层拦截：全局 Props（第 1 层）→ 命名空间规则（第 2 层）→ 字段级（第 3 层）',
      '每层返回新值透传给下一层；任何层返回 Promise.reject / 抛异常 → 中断写入',
      'ctx 提供 setFieldValue / setFieldError / abort / name 4 个能力',
      '拦截执行位于 composables/build-vmodel-bindings.ts 的 invokeBeforeChange 阶段',
      '切换 Tab 体验不同拦截层级',
    ]"
  >
    <section id="demo-before-change">
      <div :class="bem.e('tabs')">
        <el-radio-group v-model="activeTab">
          <el-radio-button value="global">A. 全局 Props（第 1 层）</el-radio-button>
          <el-radio-button value="field">B. 字段级（第 3 层）</el-radio-button>
          <el-radio-button value="namespace">C. 命名空间（第 2 层）</el-radio-button>
        </el-radio-group>
      </div>

      <!-- Tab A -->
      <DemoField
        v-if="activeTab === 'global'"
        label="提现金额（全局 Props 拦截 + 格式化）"
        :code="xFormSource"
      >
        <XForm ref="formRef" :schema="schemaA" :model="modelA" :before-change="beforeChangeA" />
      </DemoField>

      <!-- Tab B -->
      <DemoField
        v-else-if="activeTab === 'field'"
        label="手机号/城市/备注（字段级 beforeChange）"
        :code="xFormSource"
      >
        <XForm ref="formRef" :schema="schemaB" :model="modelB" />
      </DemoField>

      <!-- Tab C -->
      <DemoField v-else label="数组联系人手机号（命名空间正则匹配）" :code="xFormSource">
        <XForm
          ref="formRef"
          :schema="schemaC"
          :model="modelC"
          :before-change-rules="beforeChangeRulesC"
        />
        <!-- 正则匹配路径示意 -->
        <pre :class="bem.e('pattern-diagram')">
正则: /&#94;contacts\[\d+\]\.phone$/
       ↓ 命中以下动态路径:
       ├─ contacts[0].phone → trimContactsPhone
       ├─ contacts[1].phone → trimContactsPhone
       ├─ contacts[2].phone → trimContactsPhone
       └─ ... (新增行自动应用)
          </pre>
      </DemoField>

      <div :class="bem.e('actions')">
        <el-button @click="onReset">重置</el-button>
        <el-button @click="copySchema">复制 schema</el-button>
        <el-button @click="onSave">打印 model</el-button>
      </div>

      <ModelPreview :model="currentModel()" />
    </section>
    <ApiTable
      title="beforeChange 字段速查"
      :items="beforeChangePropsItems"
      anchor="api-before-change"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-before-change {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  &__pattern-diagram {
    margin-top: 12px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    white-space: pre;
    overflow-x: auto;
  }
}
</style>
