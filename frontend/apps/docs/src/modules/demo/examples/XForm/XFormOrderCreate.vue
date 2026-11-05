<script setup lang="ts">
/**
 * XFormOrderCreate —— 端到端业务示例（订单创建页）
 *
 * 串联 XForm 7 大能力的"完整业务形态"，对应真实中后台编辑页标准链路：
 *   1. 基础校验（async-validator 规则）
 *   2. 跨字段校验（crossValidator：客户名/电话至少填一个）
 *   3. 反应式联动（needInvoice → invoiceTitle 必填 + 隐藏）
 *   4. 异步级联选项（city → district asyncOptions deps）
 *   5. 数组节点（xArray 商品明细：增删/minItems/maxItems）
 *   6. 草稿持久化（useFormPersist 刷新不丢、exclude 排除 orderNo）
 *   7. dirty 追踪（实时显示 isDirty + dirty 字段）
 *
 * 设计目标：让新人 5 分钟看完整 XForm 业务形态，避免在 50+ 个独立 demo 间来回跳转。
 * 路由：/demo/xform-order-create（由 import.meta.glob 自动派生）
 *
 * 验证清单：
 *   ① 客户名/电话都留空 → 点保存 → 提示「至少填一个」
 *   ② 填电话 13800 → blur → 红字「手机号格式不正确」
 *   ③ 城市选「北京」→ 区域 options 自动加载
 *   ④ 开「需要发票」→ 发票抬头显示 + 必填；关闭 → 隐藏
 *   ⑤ 点「新增明细」→ 加一行；删到 1 行时删除按钮禁用
 *   ⑥ 填几个字段 → F5 刷新 → 点「恢复草稿」→ 数据恢复 + isDirty 重置
 *   ⑦ 改任意字段 → isDirty=true（isDirty 与 getDirtyFields 实时同步）
 */
import { ElMessage } from 'element-plus'
import { useFormPersist } from '@vv/ui/components/form-schema/index.ts'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'

// v3.5 末次审计 CRITICAL 修复：原 demo 用 ?raw 自引用 514 行 raw 文本给 DemoField，
// 脆弱（重命名/移动即坏）+ 演示代码过长（用户复制会粘出整个 demo 文件）。
// 现改为 schema 字符串化：DemoField 专注展示 schema 本体（约 80 行 JSON），
// 真实可读、可复制、可作为业务参考。
// schema 是普通 SchemaNode 对象（非 ref），computed 包装以满足 <DemoField> 类型推断
const xFormSchemaCode = computed(() => JSON.stringify(schema, null, 2))

// —— Mock 字典数据（真实项目从后端拉）——
const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'paid', label: '已支付' },
  { value: 'shipped', label: '已发货' },
  { value: 'canceled', label: '已取消' },
]
const PRODUCT_OPTIONS = [
  { value: 'sku-001', label: 'Vue 3 实战' },
  { value: 'sku-002', label: 'TypeScript 进阶' },
  { value: 'sku-003', label: 'Vite 工程化' },
]
const CITIES = [
  { id: 1, name: '北京' },
  { id: 2, name: '上海' },
  { id: 3, name: '广州' },
  { id: 4, name: '深圳' },
]
const DISTRICTS: Record<number, Array<{ id: number; name: string }>> = {
  1: [
    { id: 11, name: '朝阳区' },
    { id: 12, name: '海淀区' },
  ],
  2: [
    { id: 21, name: '浦东新区' },
    { id: 22, name: '徐汇区' },
  ],
  3: [{ id: 31, name: '天河区' }],
  4: [{ id: 41, name: '南山区' }],
}

const mockFetchCities = async (): Promise<typeof CITIES> => {
  await new Promise((r) => setTimeout(r, 300))
  return CITIES
}
const mockFetchDistricts = async (
  cityId: number | null
): Promise<Array<{ id: number; name: string }>> => {
  await new Promise((r) => setTimeout(r, 200))
  return cityId ? (DISTRICTS[cityId] ?? []) : []
}
const toOptions = (raw: unknown[]) =>
  (raw as Array<{ id: number; name: string }>).map((it) => ({ label: it.name, value: it.id }))

// —— 共享校验函数：客户名 + 联系电话至少填一个 ——
// 放在 model 之前避免 TDZ；customerName / contactPhone 的 rules 都引用同一份逻辑
const PHONE_PATTERN = /^1[3-9]\d{9}$/
function atLeastOneContact(value: unknown, ...deps: unknown[]): true | string {
  const hasAny = Boolean(value) || deps.some((d) => Boolean(d))
  return hasAny || '客户名称、联系电话至少填一个'
}

// —— 商品明细单行 schema（column=3 三列）——
const orderItemSchema: SchemaNode = {
  column: 3,
  row: { gutter: 12 },
  children: [
    {
      label: '商品',
      name: 'product',
      component: 'Select',
      rules: [{ required: true, message: '请选择商品', trigger: 'change' }],
      props: { placeholder: '请选择商品', clearable: true, options: PRODUCT_OPTIONS },
    },
    {
      label: '数量',
      name: 'qty',
      component: 'InputNumber',
      rules: [{ required: true, message: '请输入数量', trigger: 'blur' }],
      props: { min: 1, controlsPosition: 'right' },
    },
    {
      label: '单价(元)',
      name: 'price',
      component: 'InputNumber',
      rules: [{ required: true, message: '请输入单价', trigger: 'blur' }],
      props: { min: 0, precision: 2, controlsPosition: 'right' },
    },
  ],
}

// —— 顶层 schema：column=2 + 数组行内再排 3 列 ——
const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '订单号',
      name: 'orderNo',
      component: 'Input',
      props: { disabled: true, placeholder: '保存后自动生成' },
    },
    {
      label: '订单状态',
      name: 'status',
      component: 'Select',
      props: { placeholder: '请选择订单状态', clearable: true, options: STATUS_OPTIONS },
      rules: [{ required: true, message: '请选择订单状态', trigger: 'change' }],
    },
    {
      label: '客户名称',
      name: 'customerName',
      component: 'Input',
      props: { placeholder: '客户名称与联系电话至少填一个', clearable: true, maxlength: 50 },
      // 跨字段：与 contactPhone 双向依赖，至少一个非空
      rules: [
        {
          dependsOn: ['contactPhone'],
          crossValidator: atLeastOneContact,
          trigger: 'blur',
        },
      ],
    },
    {
      label: '联系电话',
      name: 'contactPhone',
      component: 'Input',
      props: { placeholder: '11 位手机号', clearable: true, maxlength: 11 },
      rules: [
        { pattern: PHONE_PATTERN, message: '手机号格式不正确', trigger: 'blur' },
        // 反向 crossValidator：与 customerName 双向依赖
        {
          dependsOn: ['customerName'],
          crossValidator: atLeastOneContact,
          trigger: 'blur',
        },
      ],
    },
    {
      label: '城市',
      name: 'city',
      component: 'Select',
      props: { placeholder: '请选择城市（异步加载）', clearable: true },
      asyncOptions: { source: mockFetchCities, transform: toOptions },
      on: {
        // 用户改城市 → 清空区域（避免城市与区域错配）
        // 整体回填时不经 on.change 故不误清
        change: () => {
          model.district = undefined
        },
      },
    },
    {
      label: '区域',
      name: 'district',
      component: 'Select',
      props: { placeholder: '先选城市', clearable: true },
      asyncOptions: {
        source: () => mockFetchDistricts(model.city as number | null),
        deps: 'city',
        transform: toOptions,
      },
      rules: [{ required: true, message: '请选择区域', trigger: 'change' }],
    },
    {
      label: '需要发票',
      name: 'needInvoice',
      component: 'Switch',
    },
    {
      label: '发票抬头',
      name: 'invoiceTitle',
      component: 'Input',
      props: { placeholder: '需要发票时必填', clearable: true, maxlength: 100 },
      reaction: { hidden: (m) => !m.needInvoice },
      rules: [{ required: true, message: '请输入发票抬头', trigger: 'blur' }],
    },
    {
      ...xArray('items')
        .label('订单明细')
        .item(orderItemSchema)
        .minItems(1)
        .maxItems(10)
        .labels({ add: '新增明细', remove: '删除', moveUp: '上移', moveDown: '下移' })
        .build(),
      col: { span: 24 },
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '订单备注（可选）' },
      col: { span: 24 },
    },
  ],
}

// —— 字段先声明再异步覆盖：整表无字段会让校验/默认值/reaction 失效（参见 XFormModelWarn）——
const model = reactive<Record<string, unknown>>({
  orderNo: '',
  status: 'draft',
  customerName: '',
  contactPhone: '',
  city: undefined,
  district: undefined,
  needInvoice: false,
  invoiceTitle: '',
  items: [{ product: 'sku-001', qty: 1, price: 89 }],
  remark: '',
})

// —— 草稿持久化（orderNo 由保存时生成，不落盘）——
const persist = useFormPersist({
  key: 'demo.xform-order-create.draft',
  model,
  exclude: ['orderNo'],
})

// —— formRef + onReset 用 composable，onSave 自定义（要处理跨字段 + 模拟提交）——
const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'order-create',
  schema: () => schema,
  model: () => model,
})

/**
 * 端到端保存：el-form.validate 触发全部字段规则 + 跨字段规则
 * - 字段规则失败：ElForm 原生红框 + 滚动到第一个错误（schema 顶层 scrollToError 控制）
 * - 跨字段规则失败：crossValidator 红字自动写入对应 form-item（无需手动 setFieldError）
 * 全部失败信息由 schema rules 自动展示在 UI 上，本函数无需关心
 */
async function onSave(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查红字字段')
    return
  }
  // 模拟提交
  model.orderNo = `ORD-${Date.now().toString().slice(-8)}`
  await new Promise<void>((r) => setTimeout(r, 400))
  ElMessage.success(`订单 ${model.orderNo} 创建成功`)
  persist.clear()
  formRef.value.resetDirty()
  refreshDirty()
}

function onRestoreDraft(): void {
  if (!persist.hasDraft.value) {
    ElMessage.warning('当前没有草稿（先填几个字段刷新页面再试）')
    return
  }
  persist.load()
  formRef.value?.resetDirty()
  refreshDirty()
  ElMessage.success('草稿已恢复')
}

// —— dirty 状态：XForm 不发 change 事件，用 watch model 同步 ——
const isDirty = ref(false)
const dirtyFields = ref<string[]>([])
function refreshDirty(): void {
  isDirty.value = formRef.value?.isDirty() ?? false
  dirtyFields.value = formRef.value?.getDirtyFields() ?? []
}
watch(model, refreshDirty, { deep: true })

onMounted(() => {
  if (persist.hasDraft.value) {
    ElMessage.info('检测到上次未保存的草稿，点"恢复草稿"加载')
  }
  refreshDirty()
})

/**
 * 验证指引面板展开状态（默认展开——本 demo 是「建议新接入 XForm 先看」入口，
 * 默认折叠会与 introductions 「建议新接入先看本 demo」矛盾，反而隐藏了 7 步价值）
 */
const guideActive = ref<string[]>(['guide'])

const tocItems = [
  { id: 'demo-order-create', label: '订单创建演示' },
  { id: 'demo-draft', label: '草稿与 dirty' },
  { id: 'capability-summary', label: '能力覆盖清单' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormOrderCreate —— 端到端业务示例（订单创建页）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '本 demo 串联 XForm 7 大能力的「完整业务形态」：基础校验 + 跨字段 + 联动必填 + 异步级联 + 数组节点 + 草稿持久化 + dirty 追踪。',
      '对应真实中后台编辑页标准链路：拉数据 → 表单交互 → 校验 → 提交 → dirty 基线归零 / 草稿恢复。',
      '建议新接入 XForm 的同学先看本 demo，再按需点开 50+ 个独立 demo 深入单个能力。',
      '下方「验证指引」面板按 7 步走完即可体验全部能力（默认折叠）。',
    ]"
  >
    <el-collapse v-model="guideActive" :class="bem.e('guide-collapse')">
      <el-collapse-item title="📋 验证指引（7 步覆盖 XForm 7 大能力）" name="guide">
        <ol :class="bem.e('guide-list')">
          <li>客户名/电话都留空 → 点保存 → 提示「客户名称、联系电话至少填一个」</li>
          <li>填电话 13800 → blur → 红字「手机号格式不正确」</li>
          <li>城市选「北京」→ 区域 options 自动加载</li>
          <li>开「需要发票」→ 发票抬头显示 + 必填；关闭 → 隐藏</li>
          <li>点「新增明细」→ 加一行；删到 1 行时删除按钮禁用</li>
          <li>填几个字段 → F5 刷新 → 点「恢复草稿」→ 数据恢复 + isDirty 重置</li>
          <li>改任意字段 → isDirty=true（isDirty 与 getDirtyFields 实时同步）</li>
        </ol>
      </el-collapse-item>
    </el-collapse>
    <section id="demo-order-create">
      <DemoField label="端到端业务演示：订单创建（拉详情 → 校验 → 提交）" :code="xFormSchemaCode">
        <div :class="bem.b()">
          <!--
              Enter 提交示范（设计师审查 F10）：ElForm 渲染原生 form 但不 prevent submit，
              @submit.prevent 经 attrs 继承落到 XForm 根 div，form 内 submit 冒泡到此被拦截 → onSave。
              「保存订单」用 native-type="submit" 而不绑 @click —— 点击与 Enter 统一走 submit 单路径，避免双触发。
            -->
          <XForm ref="formRef" :schema="schema" :model="model" @submit.prevent="onSave">
            <template #footer>
              <div :class="bem.e('toolbar')">
                <el-button @click="onReset">重置字段</el-button>
                <el-button plain :disabled="!persist.hasDraft.value" @click="onRestoreDraft">
                  恢复草稿
                </el-button>
                <el-button native-type="submit" type="primary">保存订单</el-button>
                <el-button @click="copySchema">复制 schema</el-button>
              </div>
            </template>
          </XForm>
          <ModelPreview :model="model" />
        </div>
      </DemoField>
    </section>

    <section id="demo-draft">
      <h4>实时状态（草稿 + dirty）</h4>
      <div :class="bem.e('state')">
        <div>
          草稿：
          <strong :class="bem.is('active', persist.hasDraft.value)">
            {{ persist.hasDraft.value ? '存在（刷新不丢）' : '无' }}
          </strong>
        </div>
        <div>
          isDirty：
          <strong :class="bem.is('dirty', isDirty)">
            {{ isDirty ? `是（${dirtyFields.join(', ') || '整体'}）` : '否（相对基线）' }}
          </strong>
        </div>
        <div v-if="model.orderNo">
          最新订单号：
          <strong>{{ model.orderNo }}</strong>
        </div>
      </div>
    </section>

    <section id="capability-summary">
      <h4>本 demo 覆盖的 XForm 能力清单</h4>
      <table :class="bem.e('capability-table')">
        <thead>
          <tr>
            <th>能力</th>
            <th>本 demo 中的具体体现</th>
            <th>对应独立 demo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>① 基础校验</td>
            <td>客户名/电话/区域/订单状态 rules 必填</td>
            <td><code>/demo/xform-base</code></td>
          </tr>
          <tr>
            <td>② 跨字段校验</td>
            <td>
              <code>crossValidator</code>
              ：客户名/电话至少一个（schema rules 自动触发，无需 onSave 内检查）
            </td>
            <td><code>/demo/xform-cross-field</code></td>
          </tr>
          <tr>
            <td>③ 反应式联动</td>
            <td>needInvoice → invoiceTitle hidden + 必填</td>
            <td><code>/demo/xform-reaction</code></td>
          </tr>
          <tr>
            <td>④ 异步级联选项</td>
            <td>城市/区域：asyncOptions + deps: 'city'</td>
            <td><code>/demo/xform-async-options</code></td>
          </tr>
          <tr>
            <td>⑤ 数组节点</td>
            <td>订单明细：xArray + minItems + maxItems</td>
            <td><code>/demo/xform-array</code></td>
          </tr>
          <tr>
            <td>⑥ 草稿持久化</td>
            <td>useFormPersist + exclude: ['orderNo']</td>
            <td><code>/demo/xform-persist</code></td>
          </tr>
          <tr>
            <td>⑦ dirty 追踪</td>
            <td>isDirty + getDirtyFields 实时同步</td>
            <td><code>/demo/xform-dirty</code></td>
          </tr>
        </tbody>
      </table>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-order-create {
  &__toolbar {
    display: flex;
    gap: 8px;
    margin: 16px 0;
    flex-wrap: wrap;
  }

  &__guide-collapse {
    margin-bottom: 16px;
  }

  &__guide-list {
    margin: 0;
    padding-left: 20px;
    line-height: 1.8;
    font-size: 13px;
    color: var(--el-text-color-regular, #606266);

    li {
      margin-bottom: 4px;
    }
  }

  &__state {
    margin-top: 12px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.8;

    strong {
      color: var(--el-text-color-primary);

      &.is-active {
        color: var(--el-color-warning);
      }

      &.is-dirty {
        color: var(--el-color-danger);
      }
    }
  }

  &__capability-table {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-lighter);
      vertical-align: top;
    }

    thead th {
      background: var(--el-fill-color-light);
      font-weight: 600;
    }

    code {
      padding: 1px 6px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      color: var(--el-color-primary);
    }
  }
}
</style>
