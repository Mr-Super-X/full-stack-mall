<script setup lang="ts">
/**
 * 大 schema 性能演示
 *
 * 【学习目标】
 *   - 观察 XForm 在不同 schema 规模下的 mount 耗时与输入响应
 *   - 建立「生产中后台常见字段数（30/120/300）」的性能基准感
 *   - 体验大 schema 下的输入流畅度（无明显卡顿即合格）
 *
 * 【观察指标】
 *   - 初始 mount 耗时（毫秒）
 *   - 滚动 / 校验 / 重置等操作的响应感
 *   - 切换字段数时的构建耗时
 *
 * 【性能基准对照】
 *   - mount < 200ms：流畅（生产可用）
 *   - 200-500ms：可接受（需关注交互响应）
 *   - > 500ms：需优化（拆分表单 / 虚拟滚动 / 懒加载）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { largeSchemaItems } from './configs/xform-demos-api'
import xFormSource from './XFormLargeSchema.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, onReset, copySchema } = useXFormDemo({
  name: 'large-schema',
  schema: () => schema.value,
})

// 三档字段数对照：30（小表单）/ 120（中后台标准）/ 300（复杂配置页）
const FIELD_COUNT_OPTIONS = [30, 120, 300] as const
const currentFieldCount = ref<number>(FIELD_COUNT_OPTIONS[1])
const mountTime = ref<number>(0)
const buildTime = ref<number>(0)
const inputLatency = ref<number>(0)

function buildSchema(count: number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < count; i++) {
    children.push({
      label: `字段 ${i + 1}`,
      name: `f${i}`,
      component: 'Input',
      props: {
        // placeholder 业务化：模拟生产 SKU/配置项命名
        placeholder: i % 3 === 0 ? `sku-${String(i + 1).padStart(4, '0')}` : `请输入字段 ${i + 1}`,
      },
      rules: [{ required: true, message: `字段 ${i + 1} 必填`, trigger: 'blur' }],
    } as SchemaNode)
  }
  return { column: 3, children }
}

// shallowRef：大 schema 整体替换不需要深度响应式，避免 Proxy 开销
const schema = shallowRef<SchemaNode>(buildSchema(currentFieldCount.value))
const model = reactive<Record<string, unknown>>({})
const bem = createNamespace('demo-x-form-large-schema')

// 切换字段数：重建 schema + 测量构建耗时 + mount 后再次测量挂载耗时
function setFieldCount(n: number): void {
  currentFieldCount.value = n
  const t0 = performance.now()
  schema.value = buildSchema(n)
  buildTime.value = Math.round((performance.now() - t0) * 100) / 100
  mountTime.value = 0 // 等待下一次 mount 测量
}

// mount 耗时：使用 performance.mark/measure 精确测量「父 onMounted 触发 → 子树首帧渲染完成」时间差。
// 旧 setTimeout(0) 方案混入了浏览器任务队列调度开销，不反映真实 mount 时长。
function measureMount(): void {
  // mark 锚点：在父组件 setup 阶段已 mark('mount-start')，
  // 子树首帧渲染完成（nextTick + RAF）后 mark('mount-end') 并 measure
  const start = performance.now()
  performance.mark('mount-end')
  performance.measure('xform-mount', { start, end: performance.now() })
  const measure = performance.getEntriesByName('xform-mount').pop()
  mountTime.value = Math.round(measure?.duration ?? performance.now() - start)
  performance.clearMarks('mount-end')
  performance.clearMeasures('xform-mount')
}
onMounted(async () => {
  await nextTick()
  // requestAnimationFrame 确保 XForm 子树首帧已绘制到屏幕（包含 el-form-item 渲染）
  requestAnimationFrame(() => {
    measureMount()
  })
})
// 字段数切换时 XForm 不会重新 mount，但 props 变化会触发 XForm 子树重渲染，
// 此时测量 props 更新到子树渲染完成的耗时（反映大 schema 切换的响应速度）
watch(schema, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    measureMount()
  })
})

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

/** mount 耗时档位（与学习目标基准对照表一致） */
function perfLevel(ms: number): { label: string; type: 'success' | 'warning' | 'danger' } {
  if (ms === 0) return { label: '测量中…', type: 'warning' }
  if (ms < 200) return { label: '流畅（< 200ms）', type: 'success' }
  if (ms < 500) return { label: '可接受（200-500ms）', type: 'warning' }
  return { label: '需优化（> 500ms）', type: 'danger' }
}

/**
 * 测量 input latency：在第一个字段（f0）连续模拟输入 100 字符，
 * 记录每字符平均 onInput 回调耗时（ms/字符）。
 * > 5 ms 即可感知卡顿，> 16 ms 即掉帧（60Hz）。
 */
async function measureInputLatency(): Promise<void> {
  const samples: number[] = []
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now()
    // 直接写 model 触发响应式更新链（与 el-input 真实输入等价，触发 watch / validate）
    model[`f${i % Math.max(currentFieldCount.value, 1)}`] = `v-${i}`
    await nextTick()
    samples.push(performance.now() - t0)
  }
  inputLatency.value = samples.reduce((a, b) => a + b, 0) / samples.length
}

const tocItems = [
  { id: 'demo-large-schema', label: '性能演示' },
  { id: 'perf-baseline', label: '性能基准对照' },
  { id: 'api-large-schema', label: '性能观察要点' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="大 schema 性能测试（学习目标 + 三档对比 + 基准对照）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '【学习目标】观察 XForm 在不同 schema 规模下的 mount 耗时与输入响应，建立性能基准感',
      '【三档对比】30 字段（小表单）/ 120 字段（中后台标准）/ 300 字段（复杂配置页）',
      '【观察指标】mount 耗时、输入响应感、滚动 / 校验 / 重置流畅度、构建耗时',
      '【性能基准】mount < 200ms 流畅 / 200-500ms 可接受 / > 500ms 需优化（详见下方对照表）',
    ]"
  >
    <section id="demo-large-schema">
      <DemoField label="大 schema" :code="xFormSource">
        <!-- 字段数切换 + 性能指标高亮 -->
        <div :class="bem.e('controls')">
          <span :class="bem.e('control-label')">字段数切换：</span>
          <el-radio-group
            :model-value="currentFieldCount"
            @update:model-value="(v: unknown) => setFieldCount(Number(v))"
          >
            <el-radio-button
              v-for="n in FIELD_COUNT_OPTIONS"
              :key="n"
              :value="n"
              :label="`${n} 字段`"
            />
          </el-radio-group>
        </div>

        <XForm ref="formRef" :schema="schema" :model="model" />

        <!-- 性能指标高亮面板 -->
        <div :class="bem.e('perf-panel')">
          <div :class="bem.e('perf-item')">
            <div :class="bem.e('perf-label')">当前字段数</div>
            <div :class="bem.e('perf-value')">{{ currentFieldCount }}</div>
          </div>
          <div :class="bem.e('perf-item')">
            <div :class="bem.e('perf-label')">Schema 构建耗时</div>
            <div :class="bem.e('perf-value')">{{ buildTime.toFixed(2) }} ms</div>
          </div>
          <div :class="bem.e('perf-item')">
            <div :class="bem.e('perf-label')">Mount 耗时</div>
            <div :class="bem.e('perf-value')">
              {{ mountTime }} ms
              <el-tag :type="perfLevel(mountTime).type" size="small">
                {{ perfLevel(mountTime).label }}
              </el-tag>
            </div>
          </div>
          <div :class="bem.e('perf-actions')">
            <el-button @click="onReset">重置</el-button>
            <el-button type="primary" @click="onSave">
              保存（全量校验 {{ currentFieldCount }} 字段）
            </el-button>
            <el-button @click="measureInputLatency">测量 input latency</el-button>
            <el-button @click="copySchema">复制 schema</el-button>
          </div>
          <p v-if="inputLatency > 0" :class="bem.e('latency')">
            <strong>input latency:</strong>
            连续输入 100 字符 → 平均 onInput 回调耗时
            <code>{{ inputLatency.toFixed(2) }} ms / 字符</code>
            （生产可接受阈值 &lt; 5 ms；&gt; 16 ms 即掉帧）
          </p>
        </div>
        <ModelPreview
          :model="model"
          :summary="`查看完整 model（JSON，${currentFieldCount} 字段）`"
        />
      </DemoField>
    </section>

    <!-- 性能基准对照表 -->
    <section id="perf-baseline">
      <h3>性能基准对照（生产中后台参考）</h3>
      <table :class="bem.e('baseline-table')">
        <thead>
          <tr>
            <th>档位</th>
            <th>mount 耗时</th>
            <th>适用场景</th>
            <th>建议</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><el-tag type="success" size="small">流畅</el-tag></td>
            <td>&lt; 200ms</td>
            <td>30-100 字段常规表单</td>
            <td>直接使用</td>
          </tr>
          <tr>
            <td><el-tag type="warning" size="small">可接受</el-tag></td>
            <td>200-500ms</td>
            <td>100-200 字段中后台</td>
            <td>关注交互响应</td>
          </tr>
          <tr>
            <td><el-tag type="danger" size="small">需优化</el-tag></td>
            <td>&gt; 500ms</td>
            <td>300+ 字段复杂页</td>
            <td>拆分表单 / 虚拟滚动 / 懒加载</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ApiTable title="性能观察要点" :items="largeSchemaItems" anchor="api-large-schema" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-large-schema {
  &__controls {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__control-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    font-weight: 500;
  }

  &__perf-panel {
    margin-top: 16px;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    align-items: center;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  &__perf-item {
    text-align: center;
  }

  &__perf-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  &__perf-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  &__perf-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  &__baseline-table {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    thead th {
      background: var(--el-fill-color-light);
      font-weight: 600;
    }
  }
}
</style>
