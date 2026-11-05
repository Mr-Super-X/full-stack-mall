<script setup lang="ts">
/**
 * 演示：permissionResolver 注入 — 业务侧权限码 → 三态映射
 *
 * 与 XFormFieldPermission.vue 的区别：本 demo 聚焦「业务侧如何把权限码字符串
 * （如 'user.edit'）映射为 XForm 的 view/edit/hidden 三态」——通过 XFormProps.permissionResolver
 * 注入转换函数，避免每个字段都手写 permission 字面量。
 *
 * 映射策略（演示用 mock）：
 *   - 权限码后缀 '.edit' + mockHasPerm 为真 → edit（可编辑）
 *   - 权限码后缀 '.view' → view（纯文本只读）
 *   - 未识别 / 无权限 → hidden（兜底隐藏，保守策略）
 *
 * 验证方法：
 *   - "权限码-可编辑"（user.edit，mock 拥有）→ 可编辑输入框
 *   - "权限码-只读"（order.view，view 后缀）→ 纯文本只读
 *   - "权限码-管理员"（admin.delete，无权限）→ DOM 中不渲染
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { permissionItems } from './configs/xform-demos-api'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, onReset, copySchema } = useXFormDemo({
  name: 'field-permission-resolver',
  schema: () => schemaWithCodes,
  model: () => model,
})

// ---------- permissionResolver 演示：业务侧权限码 → 三态映射 ----------
// 模拟业务侧 useAuth().hasPerm 封装：当前 mock 用户拥有的权限（仅 'user.edit' / 'order.view'）
function mockHasPerm(perm: string): boolean {
  const ownedPerms = new Set(['user.edit', 'order.view'])
  return ownedPerms.has(perm)
}

// 业务侧把权限码映射为三态：拥有权限 → edit；只读权限 → view；无权限 → hidden
// 这是 XFormProps.permissionResolver 的标准注入形态（参考 types/xform.ts 阶段 2.3 契约）
const permissionResolver = (perm: string): 'view' | 'edit' | 'hidden' => {
  if (perm.endsWith('.edit')) return mockHasPerm(perm) ? 'edit' : 'hidden'
  if (perm.endsWith('.view')) return 'view'
  return 'hidden' // 未识别权限码 → 兜底隐藏（最保守的可见策略）
}

// 关键代码片段（用于 DemoField 展示）
const resolverCode = `// 业务侧把 useAuth().hasPerm 封装注入 XForm
// permission 字符串字面量（如 'user.edit'）会作为权限码传入 resolver
const permissionResolver = (perm) => {
  if (perm.endsWith('.edit')) return hasPerm(perm) ? 'edit' : 'hidden'
  if (perm.endsWith('.view')) return 'view'
  return 'hidden'  // 未识别权限码 → 兜底隐藏
}

<XForm :permission-resolver="permissionResolver" :schema="schema" :model="model" />`

// 权限码形式 schema：permission 字段直接传权限码字符串，由 resolver 在运行时映射为三态
const formRef = ref<XFormExpose | null>(null)

const schemaWithCodes: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      // 权限码形式：当前用户拥有 'user.edit' → resolver 返回 'edit'（可编辑）
      name: 'editByCode',
      label: '权限码-可编辑',
      component: 'Input',
      permission: 'user.edit',
      defaultValue: '可编辑字段',
    },
    {
      // 权限码形式：'order.view' 走 .view 后缀 → resolver 返回 'view'（只读纯文本）
      name: 'viewByCode',
      label: '权限码-只读',
      component: 'Input',
      permission: 'order.view',
      defaultValue: '只读字段',
    },
    {
      // 权限码形式：当前用户无 'admin.delete' → resolver 返回 'hidden'（不渲染）
      name: 'adminByCode',
      label: '权限码-管理员',
      component: 'Input',
      permission: 'admin.delete',
      defaultValue: '此字段不渲染',
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  editByCode: '可编辑字段',
  viewByCode: '只读字段',
  adminByCode: '此字段不渲染',
})

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success(`提交成功：${JSON.stringify(model, null, 2)}`)
}

const tocItems = [
  { id: 'demo-permission-resolver', label: 'permissionResolver 注入' },
  { id: 'api-permission', label: 'permission 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="permissionResolver 注入（权限码 → 三态映射）"
    source="src/components/form-schema/composables/use-field-permission.ts"
    :introductions="[
      'permissionResolver：业务侧把权限码字符串（如 user.edit）映射为 XForm 的 view/edit/hidden 三态。',
      '1) 权限码-可编辑：user.edit + 当前用户拥有 → edit（可编辑）',
      '2) 权限码-只读：order.view 走 .view 后缀 → view（纯文本只读）',
      '3) 权限码-管理员：admin.delete 无权限 → hidden（DOM 中不渲染）',
      '4) 未识别权限码：兜底隐藏，避免默认可见带来的越权风险',
    ]"
  >
    <section id="demo-permission-resolver">
      <DemoField label="permissionResolver 注入" :code="resolverCode">
        <div :class="bem.b()">
          <div :class="bem.e('resolver-section')">
            <XForm
              ref="formRef"
              :schema="schemaWithCodes"
              :model="model"
              :permission-resolver="permissionResolver"
            />
            <p :class="bem.e('resolver-hint')">说明：</p>
            <ul :class="bem.e('resolver-list')">
              <li>
                <code>user.edit</code>
                → 当前用户拥有 → edit 态（可编辑）
              </li>
              <li>
                <code>order.view</code>
                → 只读权限 → view 态（纯文本）
              </li>
              <li>
                <code>admin.delete</code>
                → 无权限 → hidden 态（不渲染）
              </li>
            </ul>
          </div>
          <div :class="bem.e('actions')">
            <el-button @click="onReset">重置</el-button>
            <el-button type="primary" @click="onSave">保存</el-button>
            <el-button @click="copySchema">复制 schema</el-button>
          </div>
          <ModelPreview :model="model" />
        </div>
      </DemoField>
    </section>

    <ApiTable
      title="permission 字段 + permissionResolver 注入"
      :items="permissionItems"
      anchor="api-permission"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-field-permission-resolver {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  &__resolver-section {
    margin-top: 8px;
  }
  &__resolver-hint {
    margin-top: 12px;
    color: #303133;
    font-weight: 500;
  }
  &__resolver-list {
    margin-top: 8px;
    padding-left: 20px;
    color: #606266;
    line-height: 1.8;
    list-style: disc;
  }
}
</style>
