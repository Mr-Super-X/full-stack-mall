<script setup lang="ts">
/**
 * 新建自营商品 dialog（mall-admin 模块组件）。
 *
 * 项目弹窗表单统一口径：ProDialogForm = ProDialog + XForm + 提交 footer 三件套（@vv/ui）——
 * 校验 / loading / 成功关窗全部由组件承担；本组件只声明 schema/model，onSubmit 调创建 API
 * （resolve = 成功自动关窗 emit success，reject = 保持打开 emit submit-failed）。
 * label 右对齐（顶层 labelPosition: 'right'，行内 labelWidth 55px 经容器继承传播）。
 */
defineOptions({ name: 'MallAdminProductCreateDialog' })

import { nextTick, reactive, ref, watch } from 'vue'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { adminProductApi } from '../apis/products'
import type { CategoryTreeNode } from '../apis/products'

const props = defineProps<{
  visible: boolean
  /** 类目树数据由父页面加载传入（C 端匿名接口 /mall/product/category/tree） */
  categoryTree: CategoryTreeNode[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 创建成功（组件已自动关窗）——父刷新列表 */
  success: []
}>()

const formRef = ref<XFormExpose | null>(null)

interface ItemRow {
  size?: string
  color?: string
  price?: number
  originPrice?: number
  stock?: number
}

/** 规格单行 schema：labelWidth 55px 对齐短 label（容器级传播，2 字 label 不用吃顶层 90px） */
const itemRowSchema: SchemaNode = {
  column: 3,
  row: { gutter: 8 },
  labelWidth: '55px',
  children: [
    { component: 'Input', name: 'size', label: '尺码', props: { placeholder: '如 M' } },
    { component: 'Input', name: 'color', label: '颜色' },
    {
      component: 'InputNumber',
      name: 'price',
      label: '价格',
      props: { min: 0.01, precision: 2, controlsPosition: 'right' },
      rules: [{ required: true, message: '请输入大于 0 的价格', trigger: 'blur' }],
    },
    {
      component: 'InputNumber',
      name: 'originPrice',
      label: '划线价',
      props: { min: 0, precision: 2, controlsPosition: 'right' },
    },
    {
      component: 'InputNumber',
      name: 'stock',
      label: '库存',
      props: { min: 0, precision: 0, controlsPosition: 'right' },
      rules: [{ required: true, message: '请输入非负整数库存', trigger: 'blur' }],
    },
  ],
}

const schema: SchemaNode = {
  labelWidth: '90px',
  labelPosition: 'right',
  children: [
    {
      component: 'Input',
      name: 'name',
      label: '商品名',
      props: { placeholder: '如：陶土色垂感风衣' },
      rules: [{ required: true, message: '请输入商品名', trigger: 'blur' }],
    },
    {
      component: 'TreeSelect',
      name: 'categoryId',
      label: '类目',
      props: {
        data: [],
        nodeKey: 'id',
        props: { label: 'name', value: 'id', children: 'children' },
        checkStrictly: true,
        renderAfterExpand: false,
        placeholder: '选择类目',
      },
      rules: [{ required: true, message: '请选择类目', trigger: 'change' }],
    },
    { component: 'Input', name: 'brand', label: '品牌' },
    { component: 'Input', name: 'tag', label: '角标', props: { placeholder: '如：-27%、本季主打（可空）' } },
    {
      component: 'Input',
      name: 'sellingPoint',
      label: '卖点',
      props: { placeholder: '卡内小标签，如：100% 羊毛（可空）' },
    },
    { component: 'InputTextArea', name: 'detailHtml', label: '详情', props: { rows: 3 } },
    {
      component: 'InputTextArea',
      name: 'imageUrls',
      label: '图片 URL',
      props: {
        rows: 2,
        placeholder: '每行一个图片 URL，首行为主图（可空，空则 C 端走线稿占位）',
      },
    },
    xArray('items')
      .label('规格')
      .item(itemRowSchema)
      .initialLength(1)
      .minItems(1)
      // 规格顺序无业务意义（sort 语义在图片侧）——上移/下移按钮整个隐藏（showActions 控制显隐，labels 只改文案）
      .showActions({ add: true, remove: true, move: false })
      .labels({ add: '+ 添加规格', remove: '删' })
      .build(),
  ],
}

/** data 依赖 props.categoryTree（打开时注入；schema 静态对象，直接改节点 props 即可） */
function syncCategoryTree(): void {
  const categoryNode = (schema.children as SchemaNode[]).find((n) => n.name === 'categoryId')
  if (categoryNode) categoryNode.props = { ...categoryNode.props, data: props.categoryTree }
}

function freshModel(): Record<string, unknown> {
  return {
    name: '',
    brand: '',
    tag: '',
    sellingPoint: '',
    categoryId: null,
    detailHtml: '',
    imageUrls: '',
    items: [{}] as ItemRow[],
  }
}

const model = reactive<Record<string, unknown>>(freshModel())

function resetModel(): void {
  Object.assign(model, freshModel())
}

// 打开时重置为干净表单（上次取消的残留清掉）+ 同步最新类目树
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    syncCategoryTree()
    resetModel()
    void nextTick(() => formRef.value?.clearValidate())
  }
)

/** ProDialogForm 契约：resolve = 成功（组件自动关窗 + emit success），reject = 保持打开 */
async function onSubmit(): Promise<void> {
  const items = ((model.items as ItemRow[] | undefined) ?? []).map((row) => ({
    size: row.size?.trim() || null,
    color: row.color?.trim() || null,
    price: Number(row.price),
    originPrice: row.originPrice ?? null,
    stock: Number(row.stock),
  }))
  const images = String(model.imageUrls ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url }))
  await adminProductApi.create({
    categoryId: Number(model.categoryId),
    name: String(model.name ?? '').trim(),
    brand: String(model.brand ?? '').trim() || null,
    tag: String(model.tag ?? '').trim() || null,
    sellingPoint: String(model.sellingPoint ?? '').trim() || null,
    detailHtml: String(model.detailHtml ?? '').trim() || null,
    items,
    images: images.length > 0 ? images : undefined,
  })
}

function onSubmitFailed(err: unknown): void {
  ElMessage.error(err instanceof Error ? err.message : '创建失败')
}
</script>

<template>
  <ProDialogForm
    :model-value="visible"
    title="新建自营商品"
    width="640px"
    :schema="schema"
    :model="model"
    submit-button-text="创建"
    :on-submit="onSubmit"
    @update:model-value="emit('update:visible', $event)"
    @success="emit('success')"
    @submit-failed="onSubmitFailed"
  />
</template>
