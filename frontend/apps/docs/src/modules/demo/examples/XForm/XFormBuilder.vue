<script setup lang="ts">
/**
 * 演示 builder 控件补齐
 *
 * 场景(全部用对象字面量写法 —— makeBuilder 类型 cast 限制 + 链式 Ext 方法返回类型
 * 推断为 `never`,Demo 统一用 type-safe 的对象字面量演示):
 * 1. Upload(图片上传):props.action/accept/listType
 * 2. Transfer(穿梭框):props.data/titles/filterable/button-texts
 * 3. Cascader(级联选择):props.options/showAllLevels/separator
 * 4. TimePicker + TimeSelect(时间选择):props.format/valueFormat
 * 5. Autocomplete(自动补全):props.fetchSuggestions/triggerOnFocus
 * 6. TreeSelect(树形选择):props.data/multiple
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import {
  xCascader,
  xUpload,
  xTransfer,
  xTimePicker,
  xTimeSelect,
  xAutocomplete,
  xTreeSelect,
  xArray,
  xCard,
  xInput,
  xInputNumber,
} from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { builderItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormBuilder.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'builder',
  schema: () => schema,
  model: () => model,
})

// ============== Cascader 数据(省/市/区) ==============
const CASCADER_DATA = [
  {
    value: 'zj',
    label: '浙江省',
    children: [
      { value: 'hz', label: '杭州市' },
      { value: 'nb', label: '宁波市' },
      { value: 'wz', label: '温州市' },
    ],
  },
  {
    value: 'js',
    label: '江苏省',
    children: [
      { value: 'nj', label: '南京市' },
      { value: 'sz', label: '苏州市' },
      { value: 'wx', label: '无锡市' },
    ],
  },
  {
    value: 'gd',
    label: '广东省',
    children: [
      { value: 'gz', label: '广州市' },
      { value: 'sz', label: '深圳市' },
      { value: 'dg', label: '东莞市' },
    ],
  },
]

// ============== Transfer 数据(用户角色) ==============
const TRANSFER_DATA = [
  { key: 1, label: '管理员' },
  { key: 2, label: '编辑' },
  { key: 3, label: '查看者' },
  { key: 4, label: '审计员' },
  { key: 5, label: '财务' },
]

// ============== Autocomplete 数据(编程语言) ==============
const LANGS = ['JavaScript', 'TypeScript', 'Java', 'Python', 'Go', 'Rust', 'C++', 'Ruby']

// ============== TreeSelect 数据(部门) ==============
const TREE_DATA = [
  {
    id: 1,
    label: '总经办',
    children: [{ id: 11, label: '总裁办' }],
  },
  {
    id: 2,
    label: '技术部',
    children: [
      { id: 21, label: '前端组' },
      { id: 22, label: '后端组' },
    ],
  },
]

// —— Builder 链式 vs 对象字面量 ——
/**
 * 链式 builder 的核心价值：编译时类型校验 + IDE 自动补全
 * - xXxx() 入口绑死 component 名 → 后续链式 prop 字段名由 TS 推导
 * - 拼错 props 字段名（如 listTyp）→ 编译报错 vs 对象字面量运行时静默失效
 *
 * 局限：builder 不支持 slots/tips/asyncOptions/onChange 等 schema-only 字段
 * → 含 slots 的 Upload 字段用对象字面量 + 展开 builder（SchemaNodeFor<'Upload'> 自动推导）
 */
const schema: SchemaNode = {
  column: 1,
  children: [
    // 1. Cascader —— xCascader().options().showAllLevels().separator()
    xCascader('city')
      .label('省/市(选省后自动重置市)')
      .placeholder('选择省/市')
      .options(CASCADER_DATA as unknown[])
      .showAllLevels()
      .separator(' / ')
      .rules([{ required: true, message: '请选择省/市', trigger: 'change' }])
      .build() as SchemaNode,

    // 2. Upload —— 链式 builder 仅覆盖 props，slots 需对象字面量扩展
    //    picture-card 模式需 slots.default 提供 trigger 元素 + slots.tip 提示
    {
      ...xUpload('avatar')
        .label('头像上传')
        .action('/mock/upload')
        .accept('image/*')
        .listType('picture-card')
        .multiple()
        .drag()
        .build(),
      slots: {
        // trigger 元素(picture-card 必需)——直接传 Component 对象,无需 XForm.components 注册
        default: [
          {
            component: 'ElButton',
            props: { type: 'primary', plain: true, round: true },
            children: '+ 上传',
          } as SchemaNode,
        ],
        tip: '支持 jpg/png 格式，单文件不超过 500KB',
      },
    } as unknown as SchemaNode,

    // 3. Transfer —— xTransfer().data().titles().filterable().buttonTexts()
    xTransfer('roles')
      .label('角色分配')
      .data(TRANSFER_DATA)
      .titles('可分配', '已分配')
      .filterable()
      .buttonTexts('取消', '分配')
      .build() as SchemaNode,

    // 4. TimePicker —— xTimePicker().format().valueFormat().range()
    xTimePicker('timeRange')
      .label('时间范围')
      .placeholder('选择时间范围')
      .format('HH:mm:ss')
      .valueFormat('HH:mm:ss')
      .range()
      .build() as SchemaNode,

    // 5. TimeSelect —— xTimeSelect().start().end().step().format()
    xTimeSelect('shift')
      .label('班次')
      .placeholder('选择班次')
      .start('08:00')
      .end('20:00')
      .step('00:30')
      .format('HH:mm')
      .build() as SchemaNode,

    // 6. Autocomplete —— xAutocomplete().fetchSuggestions().triggerOnFocus().placement()
    //    fetchSuggestions 函数签名绑定（queryString, callback），cb 风格兼容 element-plus
    xAutocomplete('language')
      .label('主要编程语言')
      .placeholder('搜索你想用的语言（js / ts / py / go / rust）')
      .triggerOnFocus()
      .placement('bottom-start')
      .fetchSuggestions((qs: string, cb: (s: Array<{ value: string }>) => void): void => {
        cb(
          LANGS.filter((l) => l.toLowerCase().includes(qs.toLowerCase())).map((l) => ({
            value: l,
          }))
        )
      })
      .build() as SchemaNode,

    // 7. TreeSelect —— xTreeSelect().data().multiple().checkStrictly().nodeKey()
    xTreeSelect('dept')
      .label('所属部门（树形多选）')
      .placeholder('选择你所在的部门，支持多选')
      .data(TREE_DATA as unknown[])
      .multiple()
      .checkStrictly()
      .nodeKey('id')
      .build() as SchemaNode,
  ],
}

const model = reactive<Record<string, unknown>>({
  city: '',
  avatar: [],
  roles: [],
  timeRange: null,
  shift: '',
  language: '',
  dept: [],
})

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage({
    message: '保存成功:\n' + JSON.stringify(model, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

// ============== xArray 数组节点演示 ==============
/**
 * 数组节点 builder 的核心价值：链式 .item() / .initialLength() / .minItems() / .maxItems()
 * 替代 XFormArray demo 里展开 { kind: 'array', array: { ... } } 的 7-8 行字面量写法
 *
 * 边界提示：xInputNumber 用基类 NodeBuilder 通用 .prop() 写 controlsPosition；
 * 当前 builder 暂未给 InputNumber 提供专有 Ext（任务范围限 2 个文件，未扩展 builders.ts）
 */
const arrayCode = `// 数组节点 builder：链式 .item() 接收「子 schema 对象」,一行替代展开字面量
const itemsSchema = xArray('items')
  .label('订单明细')
  .title('订单明细')
  .item({
    column: 3,
    children: [
      xInput('product').label('商品').placeholder('商品名').build(),
      xInputNumber('qty').label('数量').prop('controlsPosition', 'right').build(),
      xInputNumber('price').label('单价').prop('controlsPosition', 'right').build(),
    ],
  })
  .initialLength(2)
  .minItems(1)
  .maxItems(5)
  .labels({ add: '新增明细', remove: '删除', moveUp: '上移', moveDown: '下移' })
  .build()

const schema = { children: [itemsSchema] }`

/** 独立 formRef —— 与现有 6-builder section 不共用 ref（同一 ref 无法绑定多个 XForm 实例） */
const arrayFormRef = ref<XFormExpose | null>(null)

const schemaWithArray: SchemaNode = {
  children: [
    xArray('items')
      .label('订单明细')
      .title('订单明细')
      .item({
        column: 3,
        children: [
          xInput('product').label('商品').placeholder('商品名').build() as SchemaNode,
          xInputNumber('qty').label('数量').prop('controlsPosition', 'right').build() as SchemaNode,
          xInputNumber('price')
            .label('单价')
            .prop('controlsPosition', 'right')
            .build() as SchemaNode,
        ],
      })
      .initialLength(2)
      .minItems(1)
      .maxItems(5)
      .labels({ add: '新增明细', remove: '删除', moveUp: '上移', moveDown: '下移' })
      .build(),
  ],
}

const modelArray = reactive<Record<string, unknown>>({
  items: [
    { product: 'sku-001', qty: 1, price: 89 },
    { product: 'sku-002', qty: 2, price: 69 },
  ],
})

// ============== xCard 视觉容器演示 ==============
/**
 * Card builder 链式暴露的字段仅 title / column / gutter（参见 builders.ts:223-235 CardBuilderExt）
 * children 由对象字面量补充 —— XFormOrderCreate / XFormDetailFill 等 demo 都用此模式
 * （{...xCard('xxx').build(), children: [...]}）避免给 builder 加无意义的 children() 方法
 */
const cardCode = `// Card 视觉容器 builder：链式构造容器属性 + 对象字面量补充 children
const schema = {
  children: [
    {
      ...xCard('userInfo').title('用户信息').column(2).build(),
      children: [
        xInput('username').label('用户名').required().build(),
        xInput('email').label('邮箱').build(),
      ],
    },
    {
      ...xCard('contact').title('联系信息').column(1).build(),
      children: [
        xInput('phone').label('手机号').build(),
      ],
    },
  ],
}`

const cardFormRef = ref<XFormExpose | null>(null)

const schemaWithCard: SchemaNode = {
  children: [
    {
      ...(xCard('userInfo').title('用户信息').column(2).build() as SchemaNode),
      children: [
        xInput('username').label('用户名').required().build() as SchemaNode,
        xInput('email').label('邮箱').build() as SchemaNode,
      ],
    },
    {
      ...(xCard('contact').title('联系信息').column(1).build() as SchemaNode),
      children: [xInput('phone').label('手机号').build() as SchemaNode],
    },
  ],
}

const modelCard = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  phone: '',
})

const tocItems = [
  { id: 'demo-builder', label: '构建器演示' },
  { id: 'demo-builder-array', label: 'xArray 演示' },
  { id: 'demo-builder-card', label: 'xCard 演示' },
  { id: 'api-builder', label: 'builder 链式方法' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="builder 链式 API（7 个复杂控件真实链式写法）"
    source="src/components/form-schema/builders.ts"
    :introductions="[
      'XForm 提供 27 个 xXxx() 链式 builder：每个绑死 component 名 + props 类型，链式调用时 IDE 自动补全 props 字段名',
      '核心价值：编译时类型校验 —— 拼错字段（如 listTyp）编译报错；等价对象字面量写法则运行时静默失效',
      '本 demo 覆盖 7 个复杂控件的真实链式写法：xCascader / xUpload / xTransfer / xTimePicker / xTimeSelect / xAutocomplete / xTreeSelect',
      '使用边界：builder 不支持 slots / asyncOptions / on.change —— 含这些字段时用 builder.build() + 对象字面量展开（如 Upload 字段演示）',
      '建议接入顺序：先用对象字面量理解 schema DSL → 复杂表单再用 builder 获得类型安全',
    ]"
  >
    <section id="demo-builder">
      <DemoField label="builder 链式" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <section id="demo-builder-array">
      <div :class="bem.e('new-section')">
        <DemoField label="xArray 数组节点" :code="arrayCode">
          <XForm ref="arrayFormRef" :schema="schemaWithArray" :model="modelArray" />
          <ModelPreview :model="modelArray" />
        </DemoField>
      </div>
    </section>

    <section id="demo-builder-card">
      <div :class="bem.e('new-section')">
        <DemoField label="xCard 视觉容器" :code="cardCode">
          <XForm ref="cardFormRef" :schema="schemaWithCard" :model="modelCard" />
          <ModelPreview :model="modelCard" />
        </DemoField>
      </div>
    </section>

    <ApiTable title="builder 链式方法" :items="builderItems" anchor="api-builder" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-builder {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  // xArray / xCard 新 section 与上方 demo-builder 拉开视觉间距
  &__new-section {
    margin-top: 32px;
  }
}
</style>
