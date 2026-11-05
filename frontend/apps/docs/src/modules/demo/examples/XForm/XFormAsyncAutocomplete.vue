<script setup lang="ts">
/**
 * Autocomplete + asyncOptions 远程搜索（B2 竞态修复场景的浏览器验证入口）
 *
 * 业务场景：远程搜索员工——输入关键词，每键触发一次后端搜索，下拉显示匹配的员工。
 *
 * 要演示的问题（真实业务高频踩坑）：搜索延迟波动时，旧查询的慢响应会后到——
 * 若无竞态令牌防护，下拉会「闪回」旧关键词的结果（你先输「张」又改成「张三丰」，
 * 最后看到的却是「张」的列表）。B2 修复（use-async-options.ts buildAutocompleteFetcher
 * 的序号令牌）：旧响应落地前校验序号，过期即丢弃，只有最后一次输入的响应能进下拉。
 *
 * 本页的核心是可感知的结果断言（下方状态指示区）：
 *   ✅ 下拉结果来自你最后一次输入「张三丰」—— 防护生效
 *   ❌ 下拉结果来自「张」—— 这是先输入的旧词，竞态防护失效（看到它请报告）
 *
 * 操作步骤（延迟随词长递减：3 字 300ms / 2 字 500ms / 1 字 800ms——词越短响应越慢）：
 *   ① 输入法打「张三丰」上屏 —— IME 整句上屏只触发 1 次搜索（发起 1 / 落地 1，属正常）
 *   ② 快速连按 2 次退格删到「张」——累计发起 3 次；两键间隔 < 500ms 时「张三」响应被丢弃
 *     （落地 2），间隔较大则无丢弃——两种情况下判定区 ✅ 都成立（下拉始终跟随最后一次输入）
 *
 * 关于输入触发次数：中文 IME 整句上屏（组词后一次性插入）只触发 1 次 input → 1 次搜索；
 * 逐字上屏（或逐字符插入）才会每字触发。demo 的延迟设计对两种输入都有效。
 *
 * 说明：三个默认值会干扰演示，均已显式关闭——
 * - asyncOptions.immediate（默认 true，挂载拉全量）：Autocomplete 形态数据无处注入，纯噪音
 * - EP Autocomplete triggerOnFocus（默认 true，聚焦拉取）：点输入框就出现日志，易困惑
 * - EP Autocomplete debounce（默认 300ms，输入防抖）：会把快速连续输入合并成一次搜索，
 *   竞态无从演示——demo 设为 0，每次按键/退格立即触发搜索
 * 中文输入法整句上屏一次只触发 1 次搜索，属正常。
 *
 * 路由：自动注册为 /demo/xform-async-autocomplete
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { autocompleteAsyncItems } from './configs/xform-demos-api'
import xFormSource from './XFormAsyncAutocomplete.vue?raw'

const { formRef, bem, onReset, onSave, copySchema } = useXFormDemo({
  name: 'async-autocomplete',
  schema: () => schema,
  model: () => model,
})

interface MockUser {
  id: number
  name: string
  dept: string
}

const MOCK_USERS: MockUser[] = [
  { id: 1, name: '张三丰', dept: '技术部' },
  { id: 2, name: '张三', dept: '市场部' },
  { id: 3, name: '张无忌', dept: '技术部' },
  { id: 4, name: '李四', dept: '财务部' },
  { id: 5, name: '李寻欢', dept: '运营部' },
  { id: 6, name: '王五', dept: '技术部' },
  { id: 7, name: '王熙凤', dept: '市场部' },
  { id: 8, name: '赵六', dept: '财务部' },
]

/** 请求日志（发起/落地配对，可观察「落地 < 发起 = 有旧响应被丢弃」） */
const requestLog = ref<string[]>([])
const issuedCount = ref(0)
const landedCount = ref(0)
/** 最近一个落地响应的关键词 —— 与当前输入值对比即竞态防护的结果断言 */
const lastLandedQuery = ref<string | null>(null)

/**
 * 模拟远程搜索：延迟随关键词变长而递减（1 字 800ms / 每多 1 字 -300ms，下限 200ms）。
 * 效果：词越短响应越慢——不停顿连续输入时，先输的短词（慢）后返回。
 * 发起序号与关键词挂在返回数组上随响应带回：transform 落地时配对记录。
 */
async function fetchUsers(query?: string): Promise<MockUser[]> {
  const keyword = query ?? ''
  const seq = ++issuedCount.value
  requestLog.value.push(`发起 #${seq}「${keyword}」`)
  const delayMs = Math.max(200, 800 - (keyword.length - 1) * 300)
  await new Promise((resolve) => setTimeout(resolve, delayMs))
  const matched = MOCK_USERS.filter((u) => u.name.includes(keyword))
  return Object.assign(matched, { __seq: seq, __query: keyword })
}

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '负责人',
      name: 'owner',
      component: 'Autocomplete',
      props: {
        placeholder: '输入姓名关键词远程搜索（试试输「张三丰」后快速连按退格删到「张」）',
        clearable: true,
        // 关闭输入防抖（EP Autocomplete debounce 默认 300ms 会把快速连续输入合并成一次搜索，
        // 竞态无从演示）+ 关闭 focus 自动拉取：每次按键/退格立即触发一次搜索，日志只记录真实输入
        debounce: 0,
        triggerOnFocus: false,
      },
      asyncOptions: {
        source: fetchUsers,
        // immediate 默认 true 会在挂载时拉一次全量——Autocomplete 形态拉到的数据无处注入
        // （无 options prop），纯属浪费请求且让日志出现「打开页面就有一条」的噪音，故显式关闭
        immediate: false,
        // transform 只在未过期响应里执行（令牌校验在 transform 前）——落地数 < 发起数即防护生效的证据
        transform: (raw) => {
          const arr = raw as MockUser[] & { __seq?: number; __query?: string }
          lastLandedQuery.value = arr.__query ?? null
          landedCount.value++
          requestLog.value.push(`落地 #${arr.__seq}（${raw.length} 条）`)
          return arr.map((u) => ({ label: u.name, value: `${u.name}（${u.dept}）`, id: u.id }))
        },
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({})

/**
 * 竞态防护结果断言：最近落地响应的关键词 vs 输入框当前值。
 * - ✅ 一致（或输入是落地词的选中回填/前缀扩展）→ 下拉内容来自最后一次输入，防护生效
 * - ❌ 不一致 → 下拉内容来自旧词，旧响应覆盖了新输入（防护失效）
 * startsWith 双向兼容：选中 suggestion 后输入框变为完整名（落地词是其前缀）
 */
const raceVerdict = computed((): { ok: boolean | null; text: string } => {
  const owner = (model.owner as string | undefined) ?? ''
  const landed = lastLandedQuery.value
  if (!landed || (!owner && landed === ''))
    return { ok: null, text: '输入关键词后，这里会判定下拉结果是否来自你最后一次输入' }
  if (owner === landed || owner.startsWith(landed) || landed.startsWith(owner)) {
    return { ok: true, text: `下拉结果来自你最后一次输入「${landed}」—— 竞态防护生效 ✅` }
  }
  return {
    ok: false,
    text: `下拉结果来自「${landed}」—— 这是先输入的旧词，你当前输入是「${owner}」。竞态防护失效：旧响应覆盖了新结果 ❌`,
  }
})

function clearLog(): void {
  requestLog.value = []
  issuedCount.value = 0
  landedCount.value = 0
  lastLandedQuery.value = null
}

const tocItems = [
  { id: 'demo-async-autocomplete', label: '远程搜索 + 竞态防护' },
  { id: 'api-async-autocomplete', label: 'Autocomplete asyncOptions' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="Autocomplete 远程搜索（asyncOptions + 竞态令牌）"
    source="src/components/form-schema/composables/use-async-options.ts"
    :introductions="[
      '场景：远程搜索员工——每键触发一次后端搜索。后端延迟有波动时，旧查询的慢响应会后到。',
      '无防护的后果：你输「张」又改成「张三丰」，下拉最终闪回「张」的结果（旧响应覆盖新输入）。',
      '本页下方的「防护判定」直接告诉你下拉结果来自哪个词——✅ 最后一次输入（防护生效）或 ❌ 旧词（防护失效）。',
    ]"
  >
    <section id="demo-async-autocomplete">
      <DemoField label="远程搜索负责人" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button @click="clearLog">清空记录</el-button>
        </div>

        <!-- 竞态防护结果断言：对错一眼可见 -->
        <div
          :class="[
            bem.e('verdict'),
            raceVerdict.ok === true ? bem.em('verdict', 'ok') : '',
            raceVerdict.ok === false ? bem.em('verdict', 'fail') : '',
          ]"
        >
          {{ raceVerdict.text }}
        </div>

        <p :class="bem.e('hint')">
          <strong>日志怎么读：</strong>
          「发起」= 向后端发起搜索的次数；「落地」= 响应通过竞态校验、真正进下拉的次数。 两者相等 =
          没有竞态；
          <strong>落地 &lt; 发起 = 有旧响应被竞态令牌丢弃（防护生效）</strong>
          。 中文输入法整句上屏（如拼音组词）一次输入只触发 1 次搜索，属正常。
        </p>
        <p :class="bem.e('hint')">
          <strong>操作步骤（符合中文输入习惯）</strong>
          ：① 用输入法打「张三丰」并上屏——IME 整句上屏只触发 1 次搜索（发起 1 / 落地 1，属正常）②
          <strong>快速连按 2 次退格</strong>
          删到「张」—— 删「丰」立即搜「张三」(500ms)、删「三」立即搜「张」(800ms)，累计发起 3
          次：两键间隔 &lt; 500ms 时「张三」的响应被丢弃（落地
          2）；间隔较大则无丢弃——无论哪种，判定区显示 ✅ 即防护生效（下拉始终跟随你最后一次输入）。
        </p>

        <div :class="bem.e('log-panel')">
          <div :class="bem.e('log-title')">
            请求日志：发起 {{ issuedCount }} 次 / 落地 {{ landedCount }} 次
            <template v-if="issuedCount > 0">
              （{{
                landedCount < issuedCount
                  ? '有 ' + (issuedCount - landedCount) + ' 个旧响应被丢弃 ✓'
                  : '暂无丢弃'
              }}）
            </template>
          </div>
          <pre :class="bem.e('log')">{{
            requestLog.join('\n') ||
            '（输入关键词后此处出现请求记录——点击输入框/打开页面不会触发，已关闭 focus 自动拉取与挂载拉取）'
          }}</pre>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="Autocomplete asyncOptions 差异点"
      :items="autocompleteAsyncItems"
      anchor="api-async-autocomplete"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-async-autocomplete {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  // 竞态判定条：状态色（ok 绿 / fail 红 / 中性灰）
  &__verdict {
    margin: 12px 0;
    padding: 10px 14px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.7;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-regular);

    &--ok {
      background: var(--el-color-success-light-9);
      color: var(--el-color-success-dark-2);
    }

    &--fail {
      background: var(--el-color-danger-light-9);
      color: var(--el-color-danger-dark-2);
    }
  }

  &__hint {
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__log-panel {
    margin: 12px 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    overflow: hidden;
  }

  &__log-title {
    padding: 8px 12px;
    background: var(--el-fill-color-lighter);
    font-size: 13px;
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  &__log {
    margin: 0;
    padding: 12px;
    max-height: 180px;
    overflow: auto;
    font-family: var(--el-font-family-monospace, monospace);
    font-size: 12px;
    line-height: 1.8;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
  }
}
</style>
