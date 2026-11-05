<script setup lang="ts">
/**
 * 演示 useFormPersist.restoreFilter —— schema 升级后裁剪旧草稿
 *
 * 场景：用户填写一半的问卷草稿
 *   1. v1 schema: 字段 a / b / oldField（已废弃）
 *   2. 模拟用户填到一半保存草稿
 *   3. 切到 v2 schema: 移除 oldField，新增 c（恢复时字段映射）
 *   4. 加载草稿时 restoreFilter 裁剪旧字段
 */
import { ElMessage } from 'element-plus'
import { useFormPersist } from '@vv/ui/components/form-schema/index.ts'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { persistItems } from './configs/xform-demos-api'
import xFormSource from './XFormPersistSchemaVersion.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, copySchema } = useXFormDemo({
  name: 'persist-schema-version',
  schema: () => schema.value,
})

const model = reactive<Record<string, unknown>>({
  a: '',
  b: '',
})

// —— 草稿持久化：restoreFilter 处理 schema 升级裁剪 ——
// 真实场景：v1 → v2 时字段重命名/移除。restoreFilter 在 load 时裁剪旧字段。
const persist = useFormPersist({
  key: 'demo.xform-persist-schema-version.draft',
  model,
  debounce: 300,
  restoreFilter: (draft: Record<string, unknown>) => {
    // v2 schema 不再需要 oldField；c 是 v2 新增字段（默认值）
    const { oldField, ...rest } = draft
    if (oldField) {
      console.info('[restoreFilter] 已裁剪废弃字段 oldField:', oldField)
    }
    return { ...rest, c: 'v2-default' }
  },
})

/**
 * 草稿存在综合状态：
 * - persist.hasDraft 反映初始 localStorage 中 key 是否存在
 * - persist.lastSavedAt 反映本次会话内是否已 save 过
 * 综合两者作为按钮 disabled 状态依据，避免"已 save 但 hasDraft 未更新"的中间态误禁用
 */
const hasDraftOrSaved = computed(() => persist.hasDraft.value || persist.lastSavedAt.value !== null)

// —— 模拟 schema 升级 ——
type Version = 'v1' | 'v2'
const version = ref<Version>('v1')

const schema = ref<SchemaNode>(buildV1Schema())

function buildV1Schema(): SchemaNode {
  return {
    column: 1,
    children: [
      {
        label: '字段 a',
        name: 'a',
        component: 'Input',
        props: { placeholder: 'a', clearable: true },
      },
      {
        label: '字段 b',
        name: 'b',
        component: 'Input',
        props: { placeholder: 'b', clearable: true },
      },
      {
        label: '废弃字段（v1 → v2 移除）',
        name: 'oldField',
        component: 'Input',
        props: { placeholder: 'v1 字段，restoreFilter 会裁剪', clearable: true },
      },
    ],
  }
}

function buildV2Schema(): SchemaNode {
  return {
    column: 1,
    children: [
      {
        label: '字段 a',
        name: 'a',
        component: 'Input',
        props: { placeholder: 'a（保留）', clearable: true },
      },
      {
        label: '字段 b',
        name: 'b',
        component: 'Input',
        props: { placeholder: 'b（保留）', clearable: true },
      },
      // v2 新增字段 c
      {
        label: '字段 c（v2 新增）',
        name: 'c',
        component: 'Input',
        props: { placeholder: 'v2 默认值由 restoreFilter 注入', clearable: true },
      },
    ],
  }
}

function switchVersion(v: Version): void {
  version.value = v
  schema.value = v === 'v1' ? buildV1Schema() : buildV2Schema()
  // ⭐ 切版本时的关键时序（最终版）：
  // 1. Object.assign 清空 model —— 触发 watch 调度 debounceWrite(300ms)
  // 2. 必须用 nextTick 等待 watch 同步触发完毕（Vue watch 是微任务异步）
  //    否则同步调 cancelPendingSave 取消不到还没创建的 debounce 实例
  // 3. nextTick 后 cancelPendingSave() 真正取消该 debounce → localStorage 保留 v1 草稿
  // 4. 切后点「加载草稿」时 restoreFilter 裁剪 oldField + 注入 c=v2-default
  Object.assign(model, { a: '', b: '', oldField: '', c: '' })
  void nextTick(() => {
    persist.cancelPendingSave()
  })
  ElMessage.info(`已切换到 ${v.toUpperCase()} schema`)
}

function onSaveDraft(): void {
  persist.save()
  ElMessage.success('草稿已手动落盘（也可等 debounce 300ms 自动保存）')
}

function onLoadDraft(): void {
  if (!persist.hasDraft.value) {
    ElMessage.warning('当前没有草稿（先填字段再点"保存草稿"）')
    return
  }
  persist.load()
  formRef.value?.resetDirty()
  ElMessage.success(`草稿已恢复（当前 ${version.value}）`)
}

function onClearDraft(): void {
  // 先重置 model（会触发 watch 重新调度 debounce）+ 立刻 cancel pending
  // 再调 persist.clear()（删 localStorage + 重置 hasDraft/lastSavedAt）
  // 顺序敏感：若先 clear 后 assign，watch 重新写入空草稿让 hasDraftOrSaved 误显示「存在」
  Object.assign(model, { a: '', b: '', oldField: '', c: '' })
  persist.clear()
  ElMessage.success('草稿已清除')
}

onMounted(() => {
  if (persist.hasDraft.value) {
    ElMessage.info('检测到草稿，点"加载草稿"恢复')
  }
})

const tocItems = [
  { id: 'demo-persist-schema-version', label: 'restoreFilter 演示' },
  { id: 'demo-step-guide', label: '7 步交互指引' },
  { id: 'api-persist-schema-version', label: 'useFormPersist 配置速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="useFormPersist.restoreFilter —— schema 升级后裁剪旧草稿"
    source="src/components/form-schema/composables/use-form-persist.ts"
    :introductions="[
      '【应用场景】schema 升级时字段会重命名 / 移除 / 新增；存量用户的草稿不能因为字段变更就丢',
      '【restoreFilter】在 load() 时裁剪旧字段 + 注入新字段默认值',
      '下方按 7 步交互指引走完整个升级流程：v1 填字段 → 切 v2 → 加载草稿 → 验证裁剪',
    ]"
  >
    <section id="demo-persist-schema-version">
      <!-- 7 步交互指引（折叠面板，默认折叠让用户主动展开） -->
      <el-collapse :class="bem.e('guide-collapse')">
        <el-collapse-item title="📋 7 步交互指引（按顺序走完整个升级流程）" name="guide">
          <ol :class="bem.e('guide-list')">
            <li>
              <strong>v1 模式</strong>
              填字段：a=hello、b=world、oldField=legacy（v1 独有字段）
            </li>
            <li>点「保存草稿」→ 草稿写入 localStorage（key 含 v1 数据）</li>
            <li>
              切到
              <strong>v2</strong>
              （radio）→ schema 切换到 v2 版本
            </li>
            <li>点「加载草稿」→ restoreFilter 裁剪 oldField + 注入 c=v2-default</li>
            <li>验证：表单显示 a=hello、b=world、c=v2-default，oldField 字段消失</li>
            <li>
              控制台查看
              <code>[restoreFilter] 已裁剪废弃字段 oldField: legacy</code>
            </li>
            <li>点「清除草稿」→ 重置 + 清 localStorage，可重新开始</li>
          </ol>
        </el-collapse-item>
      </el-collapse>

      <div :class="bem.e('controls')">
        <span>schema 版本：</span>
        <el-radio-group
          v-model="version"
          @change="(v: string | number | boolean | undefined) => switchVersion(v as Version)"
        >
          <el-radio-button value="v1">v1（含 oldField）</el-radio-button>
          <el-radio-button value="v2">v2（移除 oldField，新增 c）</el-radio-button>
        </el-radio-group>
        <el-button @click="onSaveDraft">保存草稿</el-button>
        <el-button @click="onLoadDraft" :disabled="!hasDraftOrSaved">加载草稿</el-button>
        <el-button @click="onClearDraft">清除草稿</el-button>
        <el-button @click="copySchema">复制 schema</el-button>
        <span :class="bem.e('hint')">
          草稿状态：
          <strong>{{ hasDraftOrSaved ? '存在' : '无' }}</strong>
        </span>
      </div>

      <DemoField label="schema 版本切换 + 草稿裁剪" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable
      title="useFormPersist 配置速查"
      :items="persistItems"
      anchor="api-persist-schema-version"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-persist-schema-version {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    flex-wrap: wrap;
    font-size: 13px;
  }

  &__hint {
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    strong {
      color: var(--el-color-warning);
    }
  }

  &__guide-collapse {
    margin-bottom: 16px;
  }

  &__guide-list {
    margin: 0;
    padding-left: 20px;
    line-height: 1.8;
    font-size: 13px;
    color: var(--el-text-color-regular);

    li {
      margin-bottom: 4px;
    }

    strong {
      color: var(--el-color-primary);
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
