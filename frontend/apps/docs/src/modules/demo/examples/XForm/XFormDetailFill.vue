<script setup lang="ts">
/**
 * 演示「详情接口数据回填表单」+ 联动复杂情况（编辑页标准形态）
 *
 * 回填三步曲：Object.assign 整体写入 → clearValidate 清残留红字 → resetDirty 重拍基线
 *
 * 联动点：①级联回填时序（区域 options 就绪前显示裸 id；整体赋值不走组件事件，on.change
 * 清空联动不会误伤回填数据）②hidden 回归（隐藏必填不阻塞校验）③只读联动（shipped 即灰）
 * ④数组批量回填 ⑤dirty 基线（首载即拍 / 原地切换须 resetDirty / 保存归零）
 * ⑥三态防御（首载 AsyncState 骨架屏 + Error 重试）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { detailFillItems } from './configs/xform-demos-api'
import { fetchCities, fetchDistricts, fetchOrderDetail } from './utils/xform-detail-fill-mock'
import xFormSource from './XFormDetailFill.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'detail-fill',
  schema: () => schema,
})

// 反应式函数复用引用：只读联动 / 发票隐藏
const shippedDisabled = (m: Record<string, unknown>) => m.status === 'shipped'
const invoiceHidden = (m: Record<string, unknown>) => !m.needInvoice

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'shipped', label: '已发货' },
  { value: 'cancelled', label: '已取消' },
]

const PRODUCT_OPTIONS = [
  { value: 'sku-001', label: 'Vue 3 实战' },
  { value: 'sku-002', label: 'TypeScript 进阶' },
  { value: 'sku-003', label: 'Vite 工程化' },
]

/** 字典接口原始数据 → Select options（AsyncOptionsConfig.transform 的入参约定为 unknown[]，数据源可控直接收窄） */
const toOptions = (raw: unknown[]) =>
  (raw as Array<{ id: number; name: string }>).map((it) => ({ label: it.name, value: it.id }))

/** 明细行子 schema：商品 + 数量 + 单价 */
const itemSchema: SchemaNode = {
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

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    { label: '订单号', name: 'orderNo', component: 'Input', props: { disabled: true } },
    { label: '订单状态', name: 'status', component: 'Select', props: { options: STATUS_OPTIONS } },
    {
      label: '客户名称',
      name: 'customerName',
      component: 'Input',
      rules: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
      reaction: { disabled: shippedDisabled },
      props: { clearable: true },
    },
    {
      label: '联系电话',
      name: 'contactPhone',
      component: 'Input',
      reaction: { disabled: shippedDisabled },
      props: { clearable: true, maxlength: 11 },
    },
    {
      label: '城市',
      name: 'city',
      component: 'Select',
      props: { placeholder: '请选择城市', clearable: true },
      asyncOptions: { source: fetchCities, transform: toOptions },
      on: {
        // 函数形式闭包真实 model：用户换城市清空区域；整体回填不经组件事件所以不误清
        change: () => {
          model.district = undefined
        },
      },
    },
    {
      label: '区域',
      name: 'district',
      component: 'Select',
      rules: [{ required: true, message: '请选择区域', trigger: 'change' }],
      props: { placeholder: 'options 就绪前显示裸 id', clearable: true },
      asyncOptions: {
        source: () => fetchDistricts(model.city as number | null),
        deps: 'city',
        transform: toOptions,
      },
    },
    { label: '需要发票', name: 'needInvoice', component: 'Switch' },
    {
      label: '发票抬头',
      name: 'invoiceTitle',
      component: 'Input',
      rules: [{ required: true, message: '请输入发票抬头', trigger: 'blur' }],
      reaction: { hidden: invoiceHidden },
      props: { clearable: true },
    },
    {
      ...xArray('items').label('订单明细').item(itemSchema).minItems(1).build(),
      col: { span: 24 }, // column:2 下明细占满整行（行内再排 3 列）
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      reaction: { disabled: shippedDisabled },
      props: { type: 'textarea', rows: 2 },
      col: { span: 24 },
    },
  ],
}

// 字段先声明再异步覆盖：「整表无字段」会让校验/默认值/reaction 失效（参见 XFormModelWarn）
const model = reactive<Record<string, unknown>>({
  orderNo: '',
  status: 'draft',
  customerName: '',
  contactPhone: '',
  city: undefined,
  district: undefined,
  needInvoice: false,
  invoiceTitle: '',
  items: [],
  remark: '',
})

const currentId = ref('ORD-A')
const loading = ref(false)
const error = ref<Error | null>(null)
const inited = ref(false) // AsyncState 只管首载；此后切换走原地回填（不卸载表单）
const firstLoading = computed(() => !inited.value && loading.value)

// dirty 实例方法非响应式，model 变化时手动同步展示
const isDirtyState = ref(false)
const dirtyFieldsState = ref<string[]>([])
function refreshDirtyState() {
  isDirtyState.value = formRef.value?.isDirty() ?? false
  dirtyFieldsState.value = formRef.value?.getDirtyFields() ?? []
}
watch(model, refreshDirtyState, { deep: true })

/**
 * 拉取详情并回填。
 *
 * @param idArg 目标 id（演示失败路径传 'FAIL'；缺省用当前选中值）
 */
async function loadOrder(idArg?: string) {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const detail = await fetchOrderDetail(idArg ?? currentId.value)
    // 生产中详情可能缺字段导致旧单残留 → 严谨实现可先重置为初始模板再 assign
    Object.assign(model, detail)
    if (inited.value) {
      formRef.value?.clearValidate()
      // 原地切换必须重拍基线，否则 isDirty 会把「服务端差异」误报为用户修改
      formRef.value?.resetDirty()
    }
    inited.value = true
    ElMessage.success(`订单 ${detail.orderNo} 已回填`)
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err))
  } finally {
    loading.value = false
  }
}

async function onSave() {
  const valid = (await formRef.value?.validate()) ?? false
  if (!valid) return ElMessage.error('校验失败，请检查红字字段')
  await new Promise<void>((resolve) => setTimeout(resolve, 400)) // 模拟提交接口耗时
  formRef.value?.resetDirty() // 提交成功基线归零：isDirty 从此表示「保存后又改了」
  ElMessage.success('保存成功，dirty 已归零')
}

onMounted(() => loadOrder())

const tocItems = [
  { id: 'demo-detail-fill', label: '详情回填演示' },
  { id: 'api-detail-fill', label: '回填要点速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="详情数据回填（远程数据 × 联动复杂情况）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '编辑页标准链路：拉详情 → Object.assign 整体回填 → clearValidate → resetDirty（基线=服务端值）。',
      '级联回填时序：城市+区域同时写入，options 就绪前区域短暂显示裸 id（如 22）；手选城市经 on.change 清空区域，整体回填不经组件事件故不会误清。',
      'hidden 字段回归：B 单 needInvoice=false 时发票抬头隐藏、空值保留；手动开启后重新出现（必填生效）。',
      '只读联动：A 单 status=已发货，客户名称/联系电话/备注回填完成即变灰。',
      'dirty 基线：原地切换订单必须 resetDirty 重拍；保存成功后归零，观察下方 isDirty 变化。',
    ]"
  >
    <section id="demo-detail-fill">
      <DemoField label="订单编辑页模拟（含请求失败重试）" :code="xFormSource">
        <div :class="bem.b()">
          <div :class="bem.e('toolbar')">
            <el-radio-group
              v-model="currentId"
              size="small"
              :disabled="loading"
              @change="() => loadOrder()"
            >
              <el-radio-button value="ORD-A">A · 已发货</el-radio-button>
              <el-radio-button value="ORD-B">B · 草稿</el-radio-button>
            </el-radio-group>
            <el-button
              size="small"
              :disabled="loading"
              title="onError 回调触发：模拟 422 服务端校验失败，演示 XForm 自动展示 ElMessage.error + 字段红字"
              @click="() => loadOrder('FAIL')"
            >
              请求失败路径
            </el-button>
            <el-button size="small" :loading="loading" @click="() => loadOrder()">
              重新加载
            </el-button>
            <el-button size="small" :disabled="loading" @click="onReset">重置</el-button>
            <el-button size="small" :disabled="loading" @click="copySchema">复制 schema</el-button>
            <el-button type="primary" size="small" :disabled="loading" @click="onSave">
              保存
            </el-button>
          </div>

          <!-- 首载走三态容器（骨架屏/错误重试）；已加载后的切换不再卸载表单 -->
          <AsyncState
            :loading="firstLoading"
            :error="error"
            :is-empty="false"
            @retry="() => loadOrder()"
          >
            <XForm ref="formRef" :schema="schema" :model="model" />
          </AsyncState>

          <div :class="bem.e('state')">
            <div>
              isDirty:
              <strong :class="bem.is('dirty', isDirtyState)">
                {{
                  isDirtyState ? `是（${dirtyFieldsState.join(', ')}）` : '否（相对服务端最新值）'
                }}
              </strong>
            </div>
            <ModelPreview :model="model" />
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="回填要点速查" :items="detailFillItems" anchor="api-detail-fill" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-detail-fill {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  &__state {
    margin-top: 16px;
    font-size: 12px;
    color: #909399;

    strong {
      color: #67c23a;

      &.is-dirty {
        color: #f56c6c;
      }
    }
  }
}
</style>
