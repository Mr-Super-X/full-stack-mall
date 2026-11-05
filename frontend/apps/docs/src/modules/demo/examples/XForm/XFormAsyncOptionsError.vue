<script setup lang="ts">
/**
 * 演示 asyncOptions.onError + deps 重试机制
 *
 * 场景：城市选择器（含网络异常处理 + 字段依赖触发重试）
 *   1. onError 回调：请求失败 → toast 提示 + 不阻塞 UI（默认行为）
 *   2. asyncOptions.deps：字段依赖——其他字段变化时自动触发 source 重跑
 *   3. 当前限制：immediate: false 节点创建时不请求（依赖 visibleChange 监听，
 *      引擎未实装）；可用 deps 字段依赖或 on.change 事件触发 source 重跑
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { asyncOptionsItems } from './configs/xform-demos-api'
import xFormSource from './XFormAsyncOptionsError.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'async-options-error',
  schema: () => schema,
  model: () => model,
})

const CITIES = [
  { id: 1, name: '北京' },
  { id: 2, name: '上海' },
  { id: 3, name: '广州' },
]

// 模拟接口：根据参数决定成败
// 计数器：每次 source 被调用 +1（首次 mount + 每次 deps 触发），UI 实时显示调用次数
let sourceCallCount = 0
async function mockFetchCities(_keyword?: string): Promise<typeof CITIES> {
  sourceCallCount++
  await new Promise<void>((r) => setTimeout(r, 400))
  // 测试 1: 让 source 故意抛错 → onError 接管
  if (model.forceFail) {
    throw new Error('模拟网络错误（mockFetchCities 抛错）')
  }
  return CITIES
}

const model = reactive<Record<string, unknown>>({
  forceFail: false,
  city: undefined,
})

const schema: SchemaNode = {
  column: 1,
  children: [
    // 测试开关：开启后 source 抛错
    {
      label: '强制失败（模拟接口报错）',
      name: 'forceFail',
      component: 'Switch',
    },
    {
      label: '城市（含 onError 错误处理）',
      name: 'city',
      component: 'Select',
      props: { placeholder: '点击下拉加载', clearable: true },
      asyncOptions: {
        source: mockFetchCities,
        // 监听 forceFail 变化：开/关切换触发 source 重跑，演示 onError 回调
        deps: 'forceFail',
        transform: (raw: unknown[]) =>
          (raw as Array<{ id: number; name: string }>).map((it) => ({
            label: it.name,
            value: it.id,
          })),
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          ElMessage({
            message: '加载失败：' + message,
            type: 'error',
            duration: 0,
            showClose: true,
          })
        },
      },
    },
  ],
}

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

const tocItems = [
  { id: 'demo-async-options-error', label: 'asyncOptions 错误处理演示' },
  { id: 'api-async-options', label: 'AsyncOptionsConfig 速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="asyncOptions.onError 错误处理（deps 触发重试）"
    source="src/components/form-schema/composables/use-async-options.ts"
    :introductions="[
      'asyncOptions.onError：source 抛错时触发——业务侧可接管 toast / 上报 / fallback',
      'asyncOptions.deps：字段依赖——其他字段变化时自动触发 source 重跑（演示重试机制）',
      '默认行为：error 写入节点内部 state，AsyncOptions UI 显示「加载失败」提示',
      '测试 1: 开启「强制失败」开关 → onError toast 立即弹出（deps 触发「城市」字段 source 重跑）',
      '测试 2: 关闭「强制失败」→ 「城市」下拉显示 3 个城市（deps 触发 source 重跑成功）',
      '对比 demos：immediate 行为（默认/手动）见 XFormAsyncOptions；批量 deps 重试见本 demo',
    ]"
  >
    <section id="demo-async-options-error">
      <DemoField label="asyncOptions 错误处理" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('counter')">
          <span>「城市」字段 source 被调用次数：</span>
          <strong>{{ sourceCallCount }}</strong>
          <span :class="bem.e('counter-hint')">
            （首次 mount + 切换「强制失败」开关触发 deps 重跑，每次 +1）
          </span>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <!-- API 限制说明：与本 demo 演示内容分离，避免把 bug 展示当功能 demo -->
    <el-collapse :class="bem.e('limit-collapse')">
      <el-collapse-item title="⚠️ 关于 immediate: false 的引擎限制" name="immediate-limit">
        <p>
          <strong>设计意图</strong>
          ：immediate: false 用于大表单按需加载（节省初次 N 个并发请求）。
        </p>
        <p>
          <strong>当前限制</strong>
          ：XForm 引擎未实现 visibleChange 监听，immediate: false 字段的 source 永远不调用。
        </p>
        <p>
          <strong>变通方案</strong>
          ：用
          <code>asyncOptions.deps</code>
          声明字段依赖（其他字段变化触发 source 重跑，参考本 demo）；或保持
          <code>immediate: true</code>
          由 deps 控制懒加载。
        </p>
        <p>
          <strong>进度</strong>
          ：见 use-async-options.ts 内部 issues 跟踪；本 demo 不演示该字段实际行为。
        </p>
        <p>
          <strong>Backlog</strong>
          ：见
          <code>.claude/.agent-reports/2026-09-21-p1-high-checklist.json</code>
          第 27 项 +
          <code>use-async-options.ts</code>
          内部 comments。
        </p>
      </el-collapse-item>
    </el-collapse>
    <ApiTable
      title="AsyncOptionsConfig 速查"
      :items="asyncOptionsItems"
      anchor="api-async-options"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-async-options-error {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  // source 调用计数器展示：让用户直观看到 deps 触发的重试次数
  &__counter {
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);

    strong {
      font-family: monospace;
      color: var(--el-color-primary);
      margin: 0 4px;
    }
  }

  &__counter-hint {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
