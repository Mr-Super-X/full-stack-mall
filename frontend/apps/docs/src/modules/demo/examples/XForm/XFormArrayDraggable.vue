<script setup lang="ts">
/**
 * 演示 ArrayNode 行拖拽排序（draggable）
 *
 * 场景：迭代任务队列 — 团队按优先级排期任务，支持：
 * 1. .draggable() 开启 HTML5 行拖拽（drop 后走 moveItem 更新 model）
 * 2. 「数据换位」验证：先编辑某行内容再拖动，值跟着行走（行身份保持）
 * 3. 上下移按钮与拖拽共存，同一条 moveItem 数据通路
 * 4. minItems / maxItems 边界约束照常生效
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { arrayItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormArrayDraggable.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, copySchema } = useXFormDemo({
  name: 'array-draggable',
  schema: () => schema,
})

// formRef 已通过 useXFormDemo 解构出来（XFormExpose 类型），无须再额外 ref。
// getNames / validate 演示按钮调用同一 formRef，避免重复声明造成两份状态。

/** 单行 schema：任务名 + 负责人 + 预估工时并排 */
const taskItemSchema: SchemaNode = {
  column: 3,
  row: { gutter: 12 },
  children: [
    {
      label: '任务名称',
      name: 'title',
      rules: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
      component: 'Input',
      props: { placeholder: '如：梳理 PRD 评审意见' },
    },
    {
      label: '负责人',
      name: 'owner',
      rules: [{ required: true, message: '请输入负责人', trigger: 'blur' }],
      component: 'Input',
      props: { placeholder: '角色或姓名' },
    },
    {
      label: '预估工时(h)',
      name: 'hours',
      component: 'InputNumber',
      props: { min: 0, max: 40, placeholder: '0-40', controlsPosition: 'right' },
    },
  ],
}

/** 顶层 schema：单个 ArrayNode，链式末尾 .draggable() 开启拖拽 */
const schema: SchemaNode = {
  children: [
    xArray('tasks')
      .label('任务队列')
      .title('任务队列（可拖拽行调整顺序）')
      .item(taskItemSchema)
      .initialLength(3)
      .minItems(1)
      .maxItems(6)
      .labels({ add: '新增任务', remove: '删除', moveUp: '上移', moveDown: '下移' })
      .draggable()
      .build(),
  ],
}

const model = reactive<Record<string, unknown>>({
  tasks: [
    { title: '梳理 PRD 评审意见', owner: '产品', hours: 4 },
    { title: '联调登录接口', owner: '前端', hours: 8 },
    { title: '补充回归测试用例', owner: '测试', hours: 6 },
  ],
})

// formRef 由 useXFormDemo 统一提供

/** 当前任务顺序的只读文本（拖拽后随 model 实时刷新） */
const taskOrderText = computed(() =>
  ((model.tasks as Array<{ title?: string }> | undefined) ?? [])
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join('\n')
)

/** getNames() 同步校验演示：调用 formRef.getNames() 拿到当前 schema 渲染的字段路径列表，
 *  与 model.tasks 顺序比对——拖拽换位后字段路径保持稳定，model 顺序变化不影响路径，
 *  但 model 数组内容顺序决定「数据顺序」。 console.log 让用户直观看到实时调用结果 */
const lastGetNamesResult = ref<string[]>([])
const lastGetNamesAt = ref('')
function logGetNames(): void {
  if (!formRef.value) return
  const names = formRef.value.getNames()
  lastGetNamesResult.value = names
  lastGetNamesAt.value = new Date().toLocaleTimeString()
  console.log('[XFormArrayDraggable] getNames() =', names)
}

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查必填项')
    return
  }
  ElMessage({
    message: '保存成功，当前顺序：\n' + taskOrderText.value,
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

function onReset() {
  formRef.value?.resetFields()
}

const tocItems = [
  { id: 'demo-array-draggable', label: '拖拽排序演示' },
  { id: 'api-array-draggable', label: 'ArrayNodeConfig' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="数组行拖拽排序（ArrayNode draggable）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '1. 链式调用末尾 .draggable() 开启行拖拽，等价于 schema 上 array.draggable: true',
      '2. 按住行的任意位置拖到目标行松开即换位 —— HTML5 Drag & Drop，drop 后调 moveItem 更新 model',
      '3. 「数据换位」而非仅视图换位：先在某一行的输入框里改内容，再拖动该行 —— 已编辑的值会跟着行走',
      '4. 与上移/下移按钮共存，两条交互路径共用同一个 moveItem，model 只有一份真相',
      '5. 未配置 draggable 时行不可拖，其余行为完全一致',
    ]"
  >
    <section id="demo-array-draggable">
      <DemoField label="任务队列（按住行拖拽排序）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('summary')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button type="info" plain @click="logGetNames">console.log(getNames())</el-button>
        </div>
        <div :class="bem.e('state')">
          <div>model.tasks 当前顺序（拖拽后实时刷新）：</div>
          <pre>{{ taskOrderText }}</pre>
        </div>
        <div v-if="lastGetNamesResult.length" :class="bem.e('names-log')">
          <div>
            <strong>getNames() 返回</strong>
            <span :class="bem.e('names-at')">（{{ lastGetNamesAt }}）</span>
            ：
          </div>
          <pre>{{ lastGetNamesResult.join('\n') }}</pre>
          <p :class="bem.e('names-hint')">
            拖拽换位后字段路径（如
            <code>tasks.0.title</code>
            /
            <code>tasks.1.title</code>
            ）保持稳定——路径由 数组下标决定，下标在 moveItem 时同步更新。所以「拖拽换位后点保存 →
            validate 仍通过」， 不会因为换位产生 false-positive 校验失败。
          </p>
        </div>
        <ModelPreview :model="model" />
        <p :class="bem.e('hint')">
          <strong>验证步骤（validate 链路）：</strong>
          1) 拖动某行换位 → 2) 修改某行的「任务名称」输入框验证内容跟着行走 → 3) 点「保存」 → 触发
          <code>formRef.validate()</code>
          → ElMessage 显示「保存成功，当前顺序：...」+ 校验通过。无 false-positive
          报错（字段路径稳定 + 必填项仍由各行自己持有）。
          <br />
          <strong>拖拽失败兜底：</strong>
          HTML5 拖拽在 Element Plus Card 遮罩层 / 嵌套容器下偶发失效（如 drop event 未冒泡），
          此时请用每行右侧的「上移」「下移」按钮（与拖拽共享同一 moveItem
          数据通路），按钮演示结果与拖拽完全一致——既能验证行换位逻辑，也能在拖拽失效时作为后备交互。
        </p>
      </DemoField>
    </section>

    <ApiTable title="ArrayNodeConfig" :items="arrayItems" anchor="api-array-draggable" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-array-draggable {
  &__summary {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__state {
    margin-top: 16px;
    font-size: 12px;
    color: #909399;

    pre {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Menlo', 'Consolas', monospace;
      white-space: pre-wrap;
      margin: 4px 0;
    }
  }

  // getNames() 返回值展示（V3.6-35 design fix）
  &__names-log {
    margin-top: 12px;
    padding: 10px 14px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);

    pre {
      background: var(--el-bg-color);
      padding: 8px 12px;
      border-radius: 3px;
      font-family: monospace;
      white-space: pre-wrap;
      margin: 4px 0;
    }

    code {
      padding: 1px 4px;
      background: var(--el-bg-color);
      border-radius: 2px;
      font-family: monospace;
    }
  }

  &__names-at {
    color: var(--el-text-color-secondary);
    font-weight: normal;
    margin-left: 4px;
  }

  &__names-hint {
    margin: 6px 0 0;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  &__hint {
    margin-top: 16px;
    padding: 10px 14px;
    background: var(--el-color-primary-light-9);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 3px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);

    code {
      padding: 1px 4px;
      background: var(--el-bg-color);
      border-radius: 2px;
      font-family: monospace;
    }
  }

  /* 可拖拽行的视觉提示（ArrayNode 渲染的行容器类） */
  .array-node__row {
    cursor: grab;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &:active {
      cursor: grabbing;
    }
  }
}
</style>
