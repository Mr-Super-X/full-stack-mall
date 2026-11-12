<script setup lang="ts">
/**
 * 编辑商品 dialog（mall-admin 模块组件）。
 *
 * ProDialogForm 三件套（与新建 dialog 同口径）：只开基础字段——规格与库存不可改
 * （PATCH 不开放规格编辑，裁决见基准 spec §6 补注）；上下架不在此 dialog（行内按钮）。
 * 回填走 watch product；成功由父经 @success 刷新列表。label 右对齐。
 */
defineOptions({ name: 'MallAdminProductEditDialog' })

import { nextTick, reactive, ref, watch } from 'vue'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { adminProductApi } from '../apis/products'
import type { AdminProduct, CategoryTreeNode } from '../apis/products'

const props = defineProps<{
  visible: boolean
  /** 编辑目标；null 时表单为上一次状态（visible 与 product 由父同步维护） */
  product: AdminProduct | null
  categoryTree: CategoryTreeNode[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const formRef = ref<XFormExpose | null>(null)

const schema: SchemaNode = {
  labelWidth: '90px',
  labelPosition: 'right',
  children: [
    {
      component: 'Input',
      name: 'name',
      label: '商品名',
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
    },
    { component: 'Input', name: 'brand', label: '品牌' },
    { component: 'Input', name: 'tag', label: '角标' },
    { component: 'Input', name: 'sellingPoint', label: '卖点' },
    { component: 'InputTextArea', name: 'detailHtml', label: '详情', props: { rows: 3 } },
  ],
}

const model = reactive<Record<string, unknown>>({
  name: '',
  brand: '',
  tag: '',
  sellingPoint: '',
  categoryId: null,
  detailHtml: '',
})

// product 变化（打开 dialog 时）回填表单 + 同步类目树；clearValidate 防残留红字
watch(
  () => props.product,
  (p) => {
    const categoryNode = (schema.children as SchemaNode[]).find((n) => n.name === 'categoryId')
    if (categoryNode) categoryNode.props = { ...categoryNode.props, data: props.categoryTree }
    if (!p) return
    Object.assign(model, {
      name: p.name,
      brand: p.brand ?? '',
      tag: p.tag ?? '',
      sellingPoint: p.sellingPoint ?? '',
      categoryId: p.categoryId,
      detailHtml: p.detailHtml ?? '',
    })
    void nextTick(() => formRef.value?.clearValidate())
  },
  { immediate: true }
)

async function onSubmit(): Promise<void> {
  if (!props.product) throw new Error('编辑目标缺失')
  await adminProductApi.update(props.product.id, {
    name: String(model.name ?? '').trim(),
    brand: String(model.brand ?? '').trim(),
    tag: String(model.tag ?? '').trim(),
    sellingPoint: String(model.sellingPoint ?? '').trim(),
    categoryId: model.categoryId == null ? undefined : Number(model.categoryId),
    detailHtml: String(model.detailHtml ?? '').trim(),
  })
}

function onSubmitFailed(err: unknown): void {
  ElMessage.error(err instanceof Error ? err.message : '保存失败')
}
</script>

<template>
  <ProDialogForm
    :model-value="visible"
    title="编辑商品（规格与库存不可改）"
    width="520px"
    :schema="schema"
    :model="model"
    submit-button-text="保存"
    :on-submit="onSubmit"
    @update:model-value="emit('update:visible', $event)"
    @success="emit('success')"
    @submit-failed="onSubmitFailed"
  />
</template>
