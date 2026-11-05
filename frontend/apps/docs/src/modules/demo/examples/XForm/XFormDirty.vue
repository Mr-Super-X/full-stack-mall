<script setup lang="ts">
/**
 * 演示：表单 dirty 状态追踪
 *
 * 【为什么需要这个】
 * isDirty 用来回答"用户改了表单但没保存"这个问题，是关闭弹窗/路由切换
 * 时弹出"未保存提示"、提交后重置 dirty 等 UX 保护的标准信号。
 *
 * 【XForm 启动行为】
 * XForm 内部 useFormDirty 在 setup 末尾会自动调一次 resetDirty() 拍"空基线"。
 * 所以：加载后直接改任意字段 → isDirty 立即变 true（无需手动拍基线）。
 * 业务上常见拍基线时机：
 *   - 加载远程数据完成后（基线 = 服务端返回值）
 *   - 用户点保存成功后（基线 = 当前已保存值）
 *   - 用户点"放弃修改"后（基线 = 原始值）
 *
 * 【本 demo 场景】
 * 1. 加载表单 → isDirty = false（XForm 自动拍空基线）
 * 2. 直接改字段 → isDirty = true（无需先点"标记基线"！）
 * 3. 点击"标记基线" → isDirty = false（基线 = 当前已修改的值）
 * 4. 再改字段 → isDirty = true（新基线下的修改）
 * 5. 模拟"未保存提示"：点击"关闭表单"，若 dirty 则 confirm
 *
 * 验证方法：
 * - 依次操作上述场景，观察 isDirty 按钮状态变化
 * - getDirtyFields 列表实时更新
 */
import { ElMessage, ElMessageBox } from 'element-plus'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { dirtyMethods } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-dirty')

// 关键代码片段（用于 DemoField 展示）
const dirtyCode = `// 标记基线：snapshot 拍下
formRef.value?.resetDirty()

// 检查 dirty 状态
formRef.value?.isDirty()              // true/false
formRef.value?.getDirtyFields()       // ['email', 'bio']
formRef.value?.isTouched('email')     // true/false

// 未保存提示
if (formRef.value?.isDirty()) {
  await ElMessageBox.confirm('有未保存的修改，确定关闭吗？')
}`

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      props: { placeholder: '请输入用户名', clearable: true },
      defaultValue: 'guest',
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '请输入邮箱', clearable: true },
    },
    {
      label: '年龄',
      name: 'age',
      component: 'InputNumber',
      props: { min: 0, max: 150, controlsPosition: 'right' },
      defaultValue: 18,
    },
    {
      label: '简介',
      name: 'bio',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '一句话介绍' },
    },
    // 嵌套对象字段：dirty 快照必须深拷贝，
    // 原位修改 address.city 时 isDirty 应能检测到（活引用快照会漏检）
    {
      label: '城市',
      name: 'address.city',
      component: 'Input',
      props: { placeholder: '嵌套字段 address.city', clearable: true },
    },
    {
      label: '街道',
      name: 'address.street',
      component: 'Input',
      props: { placeholder: '嵌套字段 address.street', clearable: true },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: 'guest',
  email: '',
  age: 18,
  bio: '',
  address: { city: '深圳', street: '' },
})

const formRef = ref<XFormExpose | null>(null)

/** 每次 resetDirty 后立即查询一次（响应式 trigger 还没跑完时） */
const isDirtyState = ref(false)
const dirtyFieldsState = ref<string[]>([])

function refreshDirtyState() {
  isDirtyState.value = formRef.value?.isDirty() ?? false
  dirtyFieldsState.value = formRef.value?.getDirtyFields() ?? []
}

function onMarkBaseline() {
  formRef.value?.resetDirty()
  refreshDirtyState()
  ElMessage.success('已标记当前状态为基线（dirty 已重置）')
}

function onResetFields() {
  formRef.value?.resetFields()
  refreshDirtyState()
  ElMessage.info('表单字段已重置（但 dirty 状态保留初始 snapshot）')
}

async function onCloseForm() {
  if (!formRef.value) return
  if (formRef.value.isDirty()) {
    const fields = formRef.value.getDirtyFields().join(', ')
    try {
      await ElMessageBox.confirm(
        `表单有未保存的修改（字段：${fields}）。确定关闭吗？`,
        '未保存提示',
        { type: 'warning' }
      )
      ElMessage.success('已关闭（用户确认放弃修改）')
    } catch {
      ElMessage.info('已取消关闭')
    }
  } else {
    ElMessage.success('表单无修改，直接关闭')
  }
}

/** 实时监控：每个字段的 isTouched 状态 */
const touchedStatus = computed(() => {
  if (!formRef.value) return {} as Record<string, boolean>
  return {
    username: formRef.value.isTouched('username'),
    email: formRef.value.isTouched('email'),
    age: formRef.value.isTouched('age'),
    bio: formRef.value.isTouched('bio'),
    'address.city': formRef.value.isTouched('address.city'),
    'address.street': formRef.value.isTouched('address.street'),
  }
})

/** 监听 model 变化 → 刷新 dirty 状态显示 */
watch(
  () => [model.username, model.email, model.age, model.bio, model.address],
  () => refreshDirtyState(),
  { deep: true }
)

const tocItems = [
  { id: 'demo-dirty', label: '脏状态演示' },
  { id: 'api-dirty', label: '相关实例方法' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="表单 dirty 状态追踪"
    source="src/components/form-schema/composables/use-form-dirty.ts"
    :introductions="[
      'isDirty / getDirtyFields / isTouched / resetDirty：回答「用户改了表单但没保存」的标准信号。',
      'XForm 启动时自动拍一次空基线，加载后直接改任意字段即触发 isDirty=true。',
      '「标记基线」把当前 model 设为新基线（提交后归零）；「关闭表单」模拟未保存提示。',
      '城市/街道是嵌套字段（address.city / address.street）：原位修改嵌套属性也必须被 dirty 检测到（快照深拷贝）。',
    ]"
  >
    <section id="demo-dirty">
      <DemoField label="dirty 追踪：6 字段表单（含 2 个嵌套字段）+ 实时状态显示" :code="dirtyCode">
        <div :class="bem.b()">
          <XForm ref="formRef" :schema="schema" :model="model" />
          <div :class="bem.e('status')">
            <div>
              isDirty:
              <strong :class="isDirtyState ? bem.e('dirty-yes') : bem.e('dirty-no')">
                {{ isDirtyState ? '是（有未保存修改）' : '否（无修改）' }}
              </strong>
            </div>
            <div>
              dirty 字段:
              <strong>
                {{ dirtyFieldsState.length === 0 ? '（无）' : dirtyFieldsState.join(', ') }}
              </strong>
            </div>
            <div>
              字段级 touched：
              <ul :class="bem.e('touched')">
                <li>username: {{ touchedStatus.username ? '✓' : '·' }}</li>
                <li>email: {{ touchedStatus.email ? '✓' : '·' }}</li>
                <li>age: {{ touchedStatus.age ? '✓' : '·' }}</li>
                <li>bio: {{ touchedStatus.bio ? '✓' : '·' }}</li>
                <li>address.city: {{ touchedStatus['address.city'] ? '✓' : '·' }}</li>
                <li>address.street: {{ touchedStatus['address.street'] ? '✓' : '·' }}</li>
              </ul>
            </div>
          </div>
          <div :class="bem.e('actions')">
            <el-button @click="onMarkBaseline">标记基线（resetDirty）</el-button>
            <el-button @click="onResetFields">重置字段（resetFields）</el-button>
            <el-button type="danger" @click="onCloseForm">关闭表单（模拟未保存提示）</el-button>
          </div>
          <ModelPreview :model="model" />
        </div>
      </DemoField>
    </section>

    <ApiTable title="相关实例方法" :items="dirtyMethods" anchor="api-dirty" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-dirty {
  &__status {
    margin-top: 16px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.8;
  }
  &__dirty-yes {
    color: #f56c6c;
  }
  &__dirty-no {
    color: #67c23a;
  }
  &__touched {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    li {
      padding: 2px 8px;
      background: #fff;
      border-radius: 3px;
    }
  }
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}
</style>
