<script setup lang="ts">
/**
 * 演示：useFormPersist —— 表单草稿持久化
 *
 * 【验证流程】
 * 1. 填"用户名"和"银行卡号"
 * 2. 观察状态面板：lastSavedAt 更新（防抖 400ms 后自动落盘）
 * 3. 刷新页面（F5）→ hasDraft=true，表单回到空值
 * 4. 点"恢复草稿"→ 用户名恢复、银行卡号不恢复（exclude 生效）→ isDirty=false（草稿为新基线）
 * 5. 点"模拟提交"→ 草稿清除，再刷新 hasDraft=false
 * 6. DevTools Application 面板可直接查看 localStorage 中的草稿内容（确认无 cardNo）
 */
import { ElButton, ElMessage, ElTag } from 'element-plus'
import { useFormPersist } from '@vv/ui/components/form-schema/index.ts'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { persistItems } from './configs/xform-demos-api'
import { useDocToc } from '../../composables/useDocToc'
import persistSource from './XFormPersist.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-persist')

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      props: { placeholder: '请输入用户名', clearable: true },
    },
    {
      label: '银行卡号（敏感字段，不落盘）',
      name: 'cardNo',
      component: 'Input',
      props: { placeholder: '刷新后不会恢复（exclude 演示）', clearable: true },
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '请输入邮箱', clearable: true },
    },
    {
      label: '简介',
      name: 'bio',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '一句话介绍' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  cardNo: '',
  email: '',
  bio: '',
})

const persist = useFormPersist({
  key: 'demo.x-form-persist.draft',
  model,
  exclude: ['cardNo'], // 敏感字段不落 localStorage
})

const formRef = ref<XFormExpose | null>(null)
const isDirtyState = ref(false)

function refreshDirty() {
  isDirtyState.value = formRef.value?.isDirty() ?? false
}

// XForm 无 change 事件（XForm.vue 未定义 emits），用 watch(model, deep) 同步 isDirty（同 XFormSchemaIndex 模式）
watch(model, refreshDirty, { deep: true })

function onRestore() {
  if (!persist.hasDraft.value) {
    ElMessage.warning('当前没有草稿（先填几个字段刷新页面再试）')
    return
  }
  // 直接调 persist.load()：hasDraft=true 但 localStorage 为空时，load() 内部会返回 false，
  // 我们据此降级为「草稿状态异常」并清空；不再硬编码 'vue3-vite-project:' 前缀读 localStorage（prefix
  // 应统一从 persist 配置读取，避免 key 变更时 demo 跟进遗漏）
  const ok = persist.load()
  if (!ok) {
    persist.clear()
    ElMessage.warning('草稿状态异常或版本不匹配，已自动重置（先填几个字段刷新页面再试）')
    return
  }
  formRef.value?.resetDirty() // 草稿为新基线：isDirty 从草稿起算
  refreshDirty()
  ElMessage.success('草稿已恢复（银行卡号被 exclude 剔除）')
}

function onClear() {
  persist.clear()
  ElMessage.success('草稿已清除')
}

function onSimulateSubmit() {
  // 模拟提交成功：清草稿 + 拍新基线
  persist.clear()
  formRef.value?.resetDirty()
  refreshDirty()
  ElMessage.success('模拟提交成功：草稿已清除、dirty 已归零')
}

// 重置表单字段（与其他 demo 一致；本 demo 额外联动草稿保留）
function onReset() {
  // ⭐ 关键：重置会触发 model 变化 → useFormPersist watch 调度 debouncedWrite → 400ms 后
  // 会用「空 model」覆盖 localStorage 中之前的草稿，导致后续点恢复读到的是空草稿
  // 正确流程：先 markResetting() 屏蔽下一次 watch 写入，再 resetFields；之后 localStorage 中仍是旧草稿
  persist.markResetting()
  formRef.value?.resetFields()
  ElMessage.success('表单已重置（草稿已保留，可再次点恢复还原）')
}

// 复制当前 schema 到剪贴板（与其他 demo 一致；本 demo 不依赖 useXFormDemo，手写实现）
async function copySchema() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(schema, null, 2))
    ElMessage.success('schema 已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  }
}

const lastSavedText = computed(() =>
  persist.lastSavedAt.value === null
    ? '尚未保存'
    : new Date(persist.lastSavedAt.value).toLocaleTimeString()
)

const tocItems = [
  { id: 'demo-x-form-persist', label: '草稿持久化演示' },
  { id: 'api-persist', label: 'useFormPersist API' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="useFormPersist —— 表单草稿持久化"
    source="src/components/form-schema/composables/use-form-persist.ts"
    :introductions="[
      'model 防抖（400ms）自动落盘 + beforeunload 同步 flush 兜底：刷新页面前 400ms 内的输入也不会丢。',
      'exclude 敏感字段剔除（银行卡号不落 localStorage）；hasDraft / load / save / clear 按需恢复与手动补丁。',
      '恢复草稿后 resetDirty() 拍基线，isDirty 从草稿起算；提交成功后 clear() 清草稿。',
    ]"
  >
    <section id="demo-x-form-persist">
      <DemoField :code="persistSource">
        <div :class="bem.b()">
          <div :class="bem.e('status')">
            <ElTag :type="persist.hasDraft.value ? 'warning' : 'info'">
              草稿：{{ persist.hasDraft.value ? '存在' : '无' }}
            </ElTag>
            <ElTag type="success">最后保存：{{ lastSavedText }}</ElTag>
            <ElTag :type="isDirtyState ? 'danger' : 'success'">
              isDirty：{{ isDirtyState ? '是' : '否' }}
            </ElTag>
          </div>

          <XForm ref="formRef" :schema="schema" :model="model" />

          <div :class="bem.e('actions')">
            <ElButton type="primary" :disabled="!persist.hasDraft.value" @click="onRestore">
              恢复草稿（load + resetDirty）
            </ElButton>
            <ElButton @click="onClear">清除草稿（clear）</ElButton>
            <ElButton type="success" @click="onSimulateSubmit">
              模拟提交（clear + resetDirty）
            </ElButton>
            <ElButton @click="onReset">重置</ElButton>
            <ElButton @click="copySchema">复制 schema</ElButton>
          </div>
          <ModelPreview :model="model" />

          <p :class="bem.e('hint')">
            验证步骤：① 填用户名 + 银行卡号 → ② F5 刷新 → ③ 点"恢复草稿"：
            用户名恢复、银行卡号不恢复 → ④ 点"模拟提交" → ⑤ 再刷新：草稿已无。
          </p>
        </div>
      </DemoField>
    </section>

    <ApiTable title="useFormPersist API" :items="persistItems" anchor="api-persist" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-persist {
  &__status {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
  &__hint {
    margin-top: 12px;
    font-size: 13px;
    color: #909399;
  }
}
</style>
