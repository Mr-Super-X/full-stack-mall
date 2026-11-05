<script setup lang="ts">
/**
 * 演示：useSchemaIndex —— schema 元数据中央索引
 *
 * 【为什么需要这个】
 * 当表单 schema 字段很多（>50）时，XForm 内部需要回答这些问题：
 *   "一共有哪些字段？"（dirty 拍基线）
 *   "哪些字段是跨字段校验的目标？"（跨字段 watch）
 *   "哪些字段改了会影响别的字段？"（反向依赖图）
 *   "哪些字段是用户隐藏的？"（server error 映射）
 * 旧实现每次都遍历整个 schema 树 O(n)，大 schema 下慢。
 * useSchemaIndex 把这些信息一次性构建成 6 个 Map/Set，运行时 O(1) 查表。
 *
 * 【本 demo 设计】
 * 1. 概念卡片：6 个 Map 一图看清，标注每个 Map 的实际用途
 * 2. 大 schema 演示：28 字段（4 父列 + 12 子列 + 12 server-error 字段），覆盖跨字段 / required / 隐藏字段场景
 * 3. 索引快照：实时显示当前 schema 的 6 个 Map 内容
 * 4. 交互闭环：操作按钮 + 状态展示 集中显示，所见即所得
 * 5. dirty 演示：拍基线 → 改字段 → 改字段瞬间的自动重算
 * 6. server error 演示：模拟多个字段错误 → success=true 一次清空
 * 7. 性能统计：节点数、构建耗时、索引大小
 */
import { ElButton, ElMessage, ElTag } from 'element-plus'
import { useSchemaIndex } from '@vv/ui/components/form-schema/composables/use-schema-index.ts'
import { scanForForbidden } from '@vv/ui/components/form-schema/composables/use-scan-forbidden.ts'
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { schemaIndexItems } from './configs/xform-demos-api'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, copySchema } = useXFormDemo({
  name: 'schema-index',
  schema: () => bigSchema.value,
})

// 演示代码片段：如何动态生成大 schema（80+ 字段）
const exampleSchemaCode = `// 动态生成大 schema（60+ 字段）
const FIELD_COUNT = ref(60)
const bigSchema = computed(() => {
  const children: SchemaNode[] = []
  for (let i = 0; i < 8; i++) {
    children.push({ name: \`user_\${i}\`, component: 'Input' })
  }
  // 跨字段：startDate 触发 endDate 校验
  children.push({
    name: 'endDate',
    component: 'DatePicker',
    rules: [{
      crossValidator: (v, start) => v >= start || '结束日期不能早于开始日期',
      dependsOn: 'startDate',
      trigger: 'change',
    }],
  })
  for (let i = 0; i < FIELD_COUNT.value; i++) {
    children.push({ name: \`extra_\${i}\`, component: 'Input' })
  }
  return { column: 3, children }
})`

const securityCode = `// 配合 useSchemaIndex 的安全扫描
import { scanForForbidden } from '@vv/ui/components/form-schema/composables/use-scan-forbidden.ts'

// 在 XForm setup 时调用，扫描所有可执行字段
const errors = scanForForbidden(props.schema)
if (errors.length > 0) {
  console.error('schema 含危险标识符:', errors)
}`

// ─── 动态生成大 schema ──────────────────────────────────────────
/** 扩展字段数：用户可调整观察索引构建性能（10 → 100+ 字段都秒级） */
const FIELD_COUNT = ref(16)

interface SectionConfig {
  prefix: string
  count: number
  hasCross: boolean
  description: string
}

const sections: SectionConfig[] = [
  { prefix: 'user', count: 4, hasCross: false, description: '用户信息（普通字段）' },
  {
    prefix: 'addr',
    count: 3,
    hasCross: true,
    description: '地址（含跨字段：addr_link 依赖 addr_0）',
  },
  { prefix: 'date', count: 4, hasCross: true, description: '日期（链式跨字段：开始→结束→报告）' },
  // 扩展字段：用于演示大 schema 索引性能，控制扩展数
  { prefix: 'extra', count: 0, hasCross: false, description: '扩展字段（动态批量）' },
]

function buildSchema(): SchemaNode {
  const children: SchemaNode[] = []

  // ── 区块 1：用户信息（user_0/user_1 必填）──
  for (let i = 0; i < sections[0]!.count; i++) {
    const isRequired = i < 2 // 前两个必填
    children.push({
      label: `用户字段 ${i + 1}${isRequired ? '' : '（选填）'}`,
      name: `user_${i}`,
      component: 'Input',
      props: {
        placeholder: isRequired ? `请输入 user_${i}（必填）` : `请输入 user_${i}（选填）`,
        clearable: true,
      },
      rules: isRequired ? [{ required: true, message: `user_${i} 不能为空`, trigger: 'blur' }] : [],
    })
  }

  // ── 区块 2：地址（addr_0 必填；addr_link 跨字段依赖 addr_0）──
  for (let i = 0; i < sections[1]!.count; i++) {
    const isRequired = i === 0
    children.push({
      label: `地址字段 ${i + 1}${isRequired ? '' : '（选填）'}`,
      name: `addr_${i}`,
      component: 'Input',
      props: {
        placeholder: isRequired ? `请输入 addr_${i}（必填，省份）` : `请输入 addr_${i}（选填）`,
        clearable: true,
      },
      rules: isRequired ? [{ required: true, message: `addr_${i} 不能为空`, trigger: 'blur' }] : [],
    })
  }
  // 跨字段：addr_link 依赖 addr_0（addr_0 必填后 addr_link 才有意义）
  children.push({
    label: '地址跨字段联动（必填）',
    name: 'addr_link',
    component: 'Input',
    props: { placeholder: '请输入（依赖 addr_0）', clearable: true },
    rules: [
      { required: true, message: 'addr_link 不能为空', trigger: 'blur' },
      {
        crossValidator: (v: unknown, dep: unknown) => (v && !dep ? '请先填写 addr_0' : true),
        dependsOn: 'addr_0',
        trigger: 'change',
      },
    ],
  })

  // ── 区块 3：日期（startDate 必填；endDate/reportDate 跨字段）──
  children.push({
    label: '开始日期（必填）',
    name: 'startDate',
    component: 'DatePicker',
    props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '选择开始日期' },
    rules: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  })
  children.push({
    label: '结束日期（必填）',
    name: 'endDate',
    component: 'DatePicker',
    props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '选择结束日期' },
    rules: [
      { required: true, message: '请选择结束日期', trigger: 'change' },
      {
        crossValidator: (v: unknown, start: unknown) => {
          if (!v || !start) return true
          return v >= start ? true : '结束日期不能早于开始日期'
        },
        dependsOn: 'startDate',
        trigger: 'change',
      },
    ],
  })
  // 链式跨字段：reportDate 依赖 endDate
  children.push({
    label: '报告日期（选填）',
    name: 'reportDate',
    component: 'DatePicker',
    props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '选择报告日期' },
    rules: [
      {
        crossValidator: (v: unknown, end: unknown) => {
          if (!v || !end) return true
          return v >= end ? true : '报告日期不能早于结束日期'
        },
        dependsOn: 'endDate',
        trigger: 'change',
      },
    ],
  })
  // 审计日期（独立）
  children.push({
    label: '审计日期（选填）',
    name: 'auditDate',
    component: 'DatePicker',
    props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '选择审计日期' },
  })

  // ── 区块 4：扩展字段（动态批量，演示索引性能）──
  for (let i = 0; i < FIELD_COUNT.value; i++) {
    children.push({
      label: `扩展 ${i + 1}`,
      name: `extra_${i}`,
      component: 'Input',
      props: { placeholder: `extra_${i}（演示大 schema 索引性能）`, clearable: true },
    })
  }

  return { column: 3, row: { gutter: 16 }, children } as SchemaNode
}

const bigSchema = ref(buildSchema())

// ─── 性能统计 ───────────────────────────────────────────────
const buildTime = ref<number>(0)
const schemaSize = computed(() => {
  let count = 0
  function walk(n: SchemaNode | SchemaNode[] | string | undefined): void {
    if (!n || typeof n === 'string') return
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    count++
    if (Array.isArray(n.children)) n.children.forEach(walk)
    else if (n.children) walk(n.children as SchemaNode)
  }
  walk(bigSchema.value)
  return count
})

function rebuildSchema(): void {
  const t0 = performance.now()
  bigSchema.value = buildSchema()
  buildTime.value = performance.now() - t0
}

// ─── 索引状态展示 ───────────────────────────────────────────────
// 这里复用 useSchemaIndex 演示其返回的 reactive 数据
// 注：XForm 内部已创建了实例，外部演示新建一个独立实例（不接管 XForm 的 state）
const { byName, fieldNames, allNames, crossRules, reverseIndex, dependsOnMap } = useSchemaIndex(
  () => bigSchema.value
)

// 序列化展示（避免在模板里循环大量 Map keys 引起渲染开销）
const indexSnapshot = computed(() => {
  const reverseEntries: Array<{ dep: string; targets: string[] }> = []
  for (const [dep, targets] of reverseIndex.value) {
    reverseEntries.push({ dep, targets: [...targets] })
  }
  return {
    byNameSize: byName.value.size,
    fieldNames: [...fieldNames.value],
    allNames: [...allNames.value],
    crossRulesSize: crossRules.value.size,
    crossRulesList: Array.from(crossRules.value.entries()).map(([target, rules]) => ({
      target,
      ruleCount: rules.length,
    })),
    reverseEntries,
    dependsOnMap: Array.from(dependsOnMap.value.entries()).map(([target, deps]) => ({
      target,
      deps: [...deps],
    })),
  }
})

// ─── formRef & 操作 ────────────────────────────────────────────
// formRef 由 useXFormDemo 统一提供
const formModel = reactive<Record<string, unknown>>({})

function getExpose(): XFormExpose | null {
  // useXFormDemo 返回的 formRef 已是 XFormExpose，无需 cast
  return formRef.value
}

const isDirty = ref(false)
const dirtyFields = ref<string[]>([])
const lastServerError = ref<{ success: boolean; fieldCount: number } | null>(null)

// 同步 dirty 状态 —— useFormDirty 内部状态无响应式事件外露，
// 用 model watch 触发同步（XForm 自己监听了 model 变化，会重算 isDirty）
watch(
  () => formModel,
  () => {
    const ex = getExpose()
    if (ex) {
      isDirty.value = ex.isDirty()
      dirtyFields.value = ex.getDirtyFields()
    }
  },
  { deep: true }
)

function syncDirty(): void {
  const ex = getExpose()
  if (ex) {
    isDirty.value = ex.isDirty()
    dirtyFields.value = ex.getDirtyFields()
  }
}

async function onMarkBaseline(): Promise<void> {
  const ex = getExpose()
  ex?.resetDirty()
  syncDirty()
  ElMessage.success('已拍基线')
}

async function onSimulateServerError(): Promise<void> {
  const ex = getExpose()
  // 模拟 422：故意写错（模拟"用户名校验失败"）
  ex?.setFieldError('user_0', '用户名已存在（模拟服务端错误）')
  ex?.setFieldError('startDate', '开始日期不合法')
  lastServerError.value = { success: false, fieldCount: 2 }
}

async function onClearServerError(): Promise<void> {
  const ex = getExpose()
  ex?.clearValidate()
  lastServerError.value = null
}

async function onSimulateServerSuccess(): Promise<void> {
  // 模拟后端 success=true → 一次性清空所有服务端错误
  const ex = getExpose()
  ex?.validateFromServer({ success: true })
  lastServerError.value = { success: true, fieldCount: 0 }
  ElMessage.success('success=true → 已清空所有服务端错误')
}

async function onSave(): Promise<void> {
  const ex = getExpose()
  const valid = await ex?.validate()
  ElMessage[valid ? 'success' : 'error'](valid ? '本地校验通过' : '本地校验失败')
  syncDirty()
}

async function onReset(): Promise<void> {
  const ex = getExpose()
  ex?.resetFields()
  onClearServerError()
  syncDirty()
}
// 安全扫描演示
const securityWarnings = computed(() => scanForForbidden(bigSchema.value))

const tocItems = [
  { id: 'demo-schema-index', label: '4 类业务问题' },
  { id: 'demo-schema-snapshot', label: '索引快照演示' },
  { id: 'demo-schema-security', label: '安全扫描演示' },
  { id: 'api-schema-index', label: 'useSchemaIndex 返回' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="useSchemaIndex —— 用 4 类业务问题理解中央索引"
    source="src/components/form-schema/composables/use-schema-index.ts"
    :introductions="[
      '【解决什么问题】XForm 内部需要反复回答 schema 元数据查询（脏检查、跨字段 watch、字段映射…）。每次遍历 O(n) 在大 schema 下慢。',
      '【怎么解决】用 6 个 Map/Set 一次性构建索引，运行时 O(1) 查表。XForm 内部已自动集成，业务可复用同一实例。',
      '【4 类业务问题】① 脏检查基线（fieldNames）② 跨字段 watch 启动（crossRules）③ 反向依赖图（reverseIndex）④ 服务错误映射（allNames + dependsOnMap）',
      '下方先看「4 类问题」入口卡片，再展开「6 Map 实现细节」了解底层数据结构。',
    ]"
  >
    <section id="demo-schema-index">
      <h4>4 类业务问题（点击切换查看索引加速方案）</h4>
      <p>先理解要解决的问题，再看 6 Map 如何加速查询 —— 这样数据结构才不抽象。</p>

      <!-- 4 类业务问题入口卡片 -->
      <div :class="bem.e('problem-cards')">
        <div :class="bem.e('problem-card')">
          <strong>① 脏检查基线</strong>
          <p>「用户改了哪些字段？」</p>
          <p :class="bem.e('card-size')">
            加速 Map:
            <code>fieldNames</code>
            （DFS 顺序，不含 ignore）
          </p>
          <p :class="bem.e('problem-example')">场景：保存按钮判断「有改动才允许提交」</p>
        </div>
        <div :class="bem.e('problem-card')">
          <strong>② 跨字段 watch</strong>
          <p>「target 字段需要监听哪些依赖字段？」</p>
          <p :class="bem.e('card-size')">
            加速 Map:
            <code>crossRules</code>
            （target → rules 列表）
          </p>
          <p :class="bem.e('problem-example')">场景：结束日期依赖开始日期的跨字段校验</p>
        </div>
        <div :class="bem.e('problem-card')">
          <strong>③ 反向依赖图</strong>
          <p>「字段 X 变了，哪些字段会受影响？」</p>
          <p :class="bem.e('card-size')">
            加速 Map:
            <code>reverseIndex</code>
            （dep → 受影响 targets）
          </p>
          <p :class="bem.e('problem-example')">场景：地址联动清空、改上级清下级</p>
        </div>
        <div :class="bem.e('problem-card')">
          <strong>④ 服务错误映射</strong>
          <p>「后端返 422 errors[]，怎么映射到字段？」</p>
          <p :class="bem.e('card-size')">
            加速 Map:
            <code>allNames</code>
            +
            <code>dependsOnMap</code>
          </p>
          <p :class="bem.e('problem-example')">
            场景：422 字段名映射到 model key（含 ignore 字段）
          </p>
        </div>
      </div>

      <h4>运行时：动态生成 80+ 字段的表单 + 索引快照 + 操作面板</h4>
      <p>
        下方 4 块组成一个完整 demo：① 索引快照（6 个 Map 实时反映）② 大型表单（必填 + 跨字段校验）③
        操作面板（dirty / server error / 跨字段 / 重建）
      </p>
      <DemoField :code="exampleSchemaCode">
        <div :class="bem.b()">
          <div :class="bem.e('controls')">
            <ElButton @click="rebuildSchema">重建 schema</ElButton>
            <span :class="bem.e('stats')">
              <ElTag type="info">节点数: {{ schemaSize }}</ElTag>
              <ElTag type="success">构建耗时: {{ buildTime.toFixed(2) }} ms</ElTag>
              <ElTag type="warning">扩展字段: {{ FIELD_COUNT }}</ElTag>
            </span>
          </div>

          <div :class="bem.e('index')">
            <h4>索引快照（实时反映 useSchemaIndex 状态）</h4>

            <!-- 概念卡片：6 个 Map 各自的用途 -->
            <div :class="bem.e('concept-cards')">
              <div :class="bem.e('card')">
                <strong>byName</strong>
                <p>name → SchemaNode 映射（O(1) 查表）</p>
                <p :class="bem.e('card-size')">{{ indexSnapshot.byNameSize }} 个节点</p>
              </div>
              <div :class="bem.e('card')">
                <strong>fieldNames</strong>
                <p>所有字段名（DFS 顺序，不含 ignore）</p>
                <p :class="bem.e('card-size')">{{ indexSnapshot.fieldNames.length }} 个</p>
              </div>
              <div :class="bem.e('card')">
                <strong>allNames</strong>
                <p>含 ignore 字段（用于 server error 映射）</p>
                <p :class="bem.e('card-size')">{{ indexSnapshot.allNames.length }} 个</p>
              </div>
              <div :class="bem.e('card')">
                <strong>crossRules</strong>
                <p>target → 跨字段规则列表（跨字段 watch 启动用）</p>
                <p :class="bem.e('card-size')">{{ indexSnapshot.crossRulesSize }} 个目标字段</p>
              </div>
              <div :class="bem.e('card')">
                <strong>reverseIndex</strong>
                <p>依赖字段 → 受影响的目标字段（反向触发）</p>
                <p :class="bem.e('card-size')">
                  {{ indexSnapshot.reverseEntries.length }} 条反向依赖
                </p>
              </div>
              <div :class="bem.e('card')">
                <strong>dependsOnMap</strong>
                <p>目标字段 → 它依赖哪些字段（正向链）</p>
                <p :class="bem.e('card-size')">
                  {{ indexSnapshot.dependsOnMap.length }}
                  条依赖条目（注意：indexSnapshot.dependsOnMap 是
                  <code>Array.from(dependsOnMap.value.entries())</code>
                  转换后的数组；原始 dependsOnMap 是 Map，用 .size 看节点数；此处 length
                  表示「目标字段数」，不是 schema 字段总数）
                </p>
              </div>
            </div>

            <details :class="bem.e('details')">
              <summary>展开：crossRules / reverseIndex 详细条目</summary>
              <div :class="bem.e('details-body')">
                <div>
                  <strong>crossRules（target → rules）：</strong>
                  <ul>
                    <li v-for="r in indexSnapshot.crossRulesList" :key="r.target">
                      {{ r.target }} → {{ r.ruleCount }} 条规则
                    </li>
                  </ul>
                </div>
                <div>
                  <strong>reverseIndex（dep → [targets]）：</strong>
                  <ul>
                    <li v-for="e in indexSnapshot.reverseEntries" :key="e.dep">
                      <code>{{ e.dep }}</code>
                      → [{{ e.targets.join(', ') }}]
                    </li>
                  </ul>
                </div>
              </div>
            </details>
          </div>

          <h4>大型表单（验证索引对跨字段 / dirty / server error 的支持）</h4>
          <XForm ref="formRef" :schema="bigSchema" :model="formModel" />
          <ModelPreview :model="formModel" />

          <!-- 操作 + 状态一体面板：所见即所得 -->
          <div :class="bem.e('panel')">
            <div :class="bem.e('panel-section')">
              <h4>① dirty 追踪（resetDirty + isDirty）</h4>
              <div :class="bem.e('row')">
                <ElButton @click="onMarkBaseline" type="primary">标记基线 (resetDirty)</ElButton>
                <span :class="bem.e('stat')">
                  <strong>isDirty：</strong>
                  <ElTag :type="isDirty ? 'danger' : 'success'">
                    {{ isDirty ? '是' : '否' }}
                  </ElTag>
                </span>
                <span v-if="dirtyFields.length" :class="bem.e('stat')">
                  <strong>dirty 字段：</strong>
                  <ElTag v-for="f in dirtyFields" :key="f" type="warning" size="small">
                    {{ f }}
                  </ElTag>
                </span>
              </div>
              <p :class="bem.e('hint')">
                <strong>XForm 启动时已自动拍一次"空基线"</strong>
                （setup 末尾的 resetDirty）， 所以"改任何字段"都立即触发
                isDirty=true。"标记基线"按钮重新拍当前 model 为新基线（"我已确认此状态为起点"）。
              </p>
              <p :class="bem.e('hint')">
                推荐流程：填必填字段 → 点"标记基线" → 再改任意字段 → isDirty=true
              </p>
            </div>

            <div :class="bem.e('panel-section')">
              <h4>② 服务端错误（validateFromServer）</h4>
              <div :class="bem.e('row')">
                <ElButton @click="onSimulateServerError" type="warning">
                  模拟 422（写 2 个错误）
                </ElButton>
                <ElButton @click="onSimulateServerSuccess" type="success">
                  模拟 success=true
                </ElButton>
                <ElButton @click="onClearServerError">清服务端错误</ElButton>
              </div>
              <p v-if="lastServerError" :class="bem.e('stat')">
                <strong>最近响应：</strong>
                success=
                <ElTag :type="lastServerError.success ? 'success' : 'warning'">
                  {{ lastServerError.success }}
                </ElTag>
                字段数={{ lastServerError.fieldCount }}
              </p>
              <p :class="bem.e('hint')">
                操作：先模拟 422（看到红字）→ 再点 success=true（红字一次性消失）
              </p>
            </div>

            <div :class="bem.e('panel-section')">
              <h4>③ 跨字段校验（el-form.validate）</h4>
              <div :class="bem.e('row')">
                <ElButton @click="onSave" type="primary">保存（本地校验）</ElButton>
                <ElButton @click="onReset">重置字段</ElButton>
                <ElButton @click="copySchema">复制 schema</ElButton>
              </div>
              <p :class="bem.e('hint')">
                操作：开始日期填 2026-08-20、结束日期填 2026-08-18 → 保存 →
                触发"结束日期不能早于开始日期"
              </p>
            </div>

            <div :class="bem.e('panel-section')">
              <h4>④ 索引重建（schema 变化）</h4>
              <div :class="bem.e('row')">
                <ElButton @click="rebuildSchema">重建 schema</ElButton>
                <span :class="bem.e('stat')">
                  节点数
                  <ElTag>{{ schemaSize }}</ElTag>
                  构建耗时
                  <ElTag type="success">{{ buildTime.toFixed(2) }} ms</ElTag>
                </span>
              </div>
              <p :class="bem.e('hint')">观察：重建后 byName 大小 / 索引快照 实时同步刷新</p>
            </div>
          </div>
        </div>
      </DemoField>
    </section>

    <section id="demo-schema-security">
      <h4>安全扫描（与 useSchemaIndex 配合的辅助工具）</h4>
      <p>scanForForbidden 扫描所有可执行字段（on / reaction / directives / slots）的危险标识符</p>
      <DemoField :code="securityCode">
        <p v-if="securityWarnings.length === 0" style="color: #67c23a">
          ✓ 未发现危险标识符（window / document / eval / fetch / Function 等）
        </p>
        <ul v-else>
          <li v-for="w in securityWarnings" :key="w" style="color: #f56c6c">{{ w }}</li>
        </ul>
      </DemoField>
    </section>

    <ApiTable title="useSchemaIndex 返回" :items="schemaIndexItems" anchor="api-schema-index" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-schema-index {
  &__controls {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }
  &__stats {
    display: inline-flex;
    gap: 8px;
  }
  &__index {
    background: #f5f7fa;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 16px 0;
    h4 {
      margin: 0 0 12px;
    }
  }
  &__concept-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  &__card {
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 8px 10px;
    strong {
      color: #409eff;
      font-size: 13px;
    }
    p {
      margin: 4px 0 0;
      font-size: 12px;
      color: #606266;
    }
  }
  &__card-size {
    font-weight: 600;
    color: #303133;
  }

  // 4 类业务问题入口卡片（顶部）
  &__problem-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin: 16px 0 24px;
  }

  &__problem-card {
    padding: 12px 16px;
    background: linear-gradient(135deg, #f0f9ff, #ecfeff);
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 6px;

    strong {
      display: block;
      color: var(--el-color-primary);
      font-size: 14px;
      margin-bottom: 4px;
    }

    p {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-regular);
    }

    code {
      padding: 1px 4px;
      background: var(--el-fill-color-light);
      border-radius: 2px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      color: var(--el-color-primary);
    }
  }

  &__problem-example {
    color: var(--el-text-color-secondary);
    font-style: italic;
    font-size: 12px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--el-color-primary-light-7);
  }
  &__details {
    margin-top: 8px;
    summary {
      cursor: pointer;
      padding: 4px 0;
      font-size: 13px;
      color: #409eff;
    }
  }
  &__details-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 8px;
    ul {
      list-style: none;
      padding-left: 0;
      margin: 4px 0;
    }
    li {
      font-size: 12px;
      line-height: 1.6;
    }
    code {
      background: #f0f9ff;
      padding: 1px 4px;
      border-radius: 2px;
      font-family: monospace;
    }
  }
  &__panel {
    margin-top: 16px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    overflow: hidden;
  }
  &__panel-section {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: #303133;
    }
    &:last-child {
      border-bottom: none;
    }
  }
  &__row {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  &__stat {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    color: #606266;
  }
  &__hint {
    margin: 4px 0 0;
    font-size: 12px;
    color: #909399;
    font-style: italic;
  }
}
</style>
