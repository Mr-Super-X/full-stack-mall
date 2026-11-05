<script setup lang="ts">
/**
 * 演示字段事件（node.on）与值变更拦截（beforeChange）
 *
 * 场景：订单录入 —— 订单号自动格式化 + 金额风控拦截 + 备注实时字数统计
 *
 * 覆盖功能：
 *   1. node.on 函数形式：备注 input 实时字数统计；收货城市 change 清空下级区县
 *   2. node.on 表达式形式：{{ fn }} 沙箱表达式（model 为只读副本，仅适合日志类副作用）
 *   3. beforeChange 同步拦截：订单号转大写 + 过滤非法字符（返回值替换新值）
 *   4. beforeChange 异步拦截：金额 > 100000 模拟风控 reject → 跳过更新
 *   5. beforeChange 返回 undefined → 放行原值（默认行为）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { beforeChangeItems, onEventItems } from './configs/xform-demos-api'
import xFormSource from './XFormEvents.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'events',
  schema: () => schema,
})

// 风控上限（演示用常量）
const AMOUNT_LIMIT = 100000

const DISTRICTS = ['天河区', '越秀区', '海珠区', '南山区', '福田区', '宝安区']

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '订单号',
      name: 'orderNo',
      component: 'Input',
      props: { placeholder: '如 ord-2024-001（自动转大写）', clearable: true },
      rules: [{ required: true, message: '请输入订单号', trigger: 'blur' }],
    },
    {
      label: '订单金额',
      name: 'amount',
      component: 'InputNumber',
      props: { min: 0, controlsPosition: 'right', placeholder: `上限 ${AMOUNT_LIMIT}` },
      rules: [{ required: true, message: '请输入订单金额', trigger: 'blur' }],
    },
    {
      label: '订单状态',
      name: 'status',
      component: 'Select',
      props: {
        placeholder: '请选择状态',
        clearable: true,
        options: ['待支付', '已支付', '已发货', '已完成'].map((s) => ({ value: s, label: s })),
      },
      // 表达式形式：沙箱内 model 为只读副本，写 m.xxx 不会回写真实 model
      // console 不在危险标识符黑名单，可用作轻量日志；生产环境请用函数形式接入埋点 SDK
      on: {
        change: '{{ (m, v) => console.info("[XFormEvents] status changed:", m.orderNo, "->", v) }}',
      },
    },
    {
      label: '收货城市',
      name: 'city',
      component: 'Select',
      props: {
        placeholder: '请选择城市',
        clearable: true,
        options: ['广州市', '深圳市'].map((c) => ({ value: c, label: c })),
      },
      // 函数形式：闭包可直接读写真实 model（联动清空区县）
      on: {
        change: () => {
          model.district = ''
        },
      },
    },
    {
      label: '收货区县',
      name: 'district',
      component: 'Select',
      props: {
        placeholder: '切换城市后自动清空',
        clearable: true,
        options: DISTRICTS.map((d) => ({ value: d, label: d })),
      },
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      props: {
        type: 'textarea',
        rows: 3,
        placeholder: '最多 200 字',
        maxlength: 200,
        showWordLimit: true,
      },
      on: {
        // 函数形式：实时统计字数（v-model 已先行写入 model，这里读到的即最新值）
        input: (value: unknown) => {
          remarkLength.value = String(value ?? '').length
        },
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  orderNo: '',
  amount: undefined,
  status: '',
  city: '',
  district: '',
  remark: '',
})

/**
 * beforeChange：字段值写入 model 前的统一拦截（XFormProps 级，按 node.name 分派）
 * - 同步返回非 undefined → 用返回值替换新值
 * - Promise resolve → resolve 值写入；reject → 跳过更新（model 保持旧值）
 * - 返回 undefined → 放行原值
 */
function beforeChange(
  node: SchemaNode,
  newVal: unknown,
  oldVal: unknown
): unknown | Promise<unknown> {
  if (node.name === 'orderNo') {
    // 订单号自动规范化：转大写 + 仅保留字母数字
    return String(newVal)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }
  if (node.name === 'amount') {
    // 模拟服务端风控（300ms）：超额 reject 跳过更新，输入框回弹到旧值
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Number(newVal) > AMOUNT_LIMIT) {
          ElMessage.warning(`金额 ${newVal} 超过风控上限（原值 ${oldVal ?? '空'}），已拦截`)
          reject(new Error('amount-limit'))
        } else {
          resolve(newVal)
        }
      }, 300)
    })
  }
  return undefined
}

// formRef 由 useXFormDemo 统一提供
const remarkLength = ref(0)

async function onValidate() {
  const valid = await formRef.value?.validate()
  if (valid) {
    ElMessage.success('校验通过')
  } else {
    ElMessage.error('校验失败，请检查红字提示')
  }
}

const tocItems = [
  { id: 'demo-events', label: '订单录入演示' },
  { id: 'api-before-change', label: 'beforeChange 值拦截' },
  { id: 'api-on-events', label: 'node.on 字段事件' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="字段事件与值拦截（on + beforeChange）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'node.on 支持函数与 {{ fn }} 表达式两种形式：函数形式闭包可直接读写真实 model（推荐）；表达式形式运行在沙箱中，model 为只读副本，仅适合日志类副作用。',
      'beforeChange 在每次 v-model 写入前拦截：同步返回值替换新值，Promise reject 跳过更新，返回 undefined 放行原值。',
      '演示点：订单号输入自动转大写；金额超 10 万被风控拦截并回弹；切换收货城市自动清空区县；备注实时字数统计。',
    ]"
  >
    <section id="demo-events">
      <DemoField label="订单录入（事件 + 拦截）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" :before-change="beforeChange" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <span :class="bem.e('remark-count')">备注字数：{{ remarkLength }} / 200</span>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="beforeChange 值拦截" :items="beforeChangeItems" anchor="api-before-change" />
    <ApiTable title="node.on 字段事件" :items="onEventItems" anchor="api-on-events" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-events {
  &__actions {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__remark-count {
    font-size: 13px;
    color: #909399;
  }
}
</style>
