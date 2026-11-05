<script setup lang="ts">
/**
 * v-inputDebounce 指令演示 —— 输入防抖 + 中文输入法兼容
 *
 * 覆盖场景：
 *  - 搜索框实时防抖（默认 300ms）
 *  - 自定义延迟（arg 语法：v-inputDebounce:500）
 *  - 中文输入法 compositionstart/end 处理：拼音阶段不触发回调，组合结束才触发一次
 *
 * 路由：/demo/directive-input-debounce
 */
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-input-debounce')

/* ───── 演示数据 ───────────── */

// 默认 300ms 防抖
const searchDefault = ref('')
const defaultLog = ref<string[]>([])
const defaultCounter = ref(0) // 防抖命中计数
const defaultRawCounter = ref(0) // 原始 input 事件计数
function onInputDefault(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  // 防抖触发后才进 log
  defaultCounter.value++
  defaultLog.value = [...defaultLog.value, `防抖命中 ${defaultCounter.value}：${value}`].slice(-8)
}
function onInputDefaultRaw(): void {
  // 每次按键都触发，用于对照「无防抖 vs 300ms 防抖」差异
  defaultRawCounter.value++
}

// 自定义 500ms 防抖（arg 语法）
const searchCustom = ref('')
const customLog = ref<string[]>([])
const customCounter = ref(0)
const customRawCounter = ref(0)
function onInputCustom(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  customCounter.value++
  customLog.value = [...customLog.value, `500ms 防抖命中 ${customCounter.value}：${value}`].slice(
    -8
  )
}
function onInputCustomRaw(): void {
  customRawCounter.value++
}

// 中文输入法：独立 ref + 独立回调 + 独立日志（与默认防抖示例隔离，
// 否则两个 input 双向同步 v-model 且回调日志会相互覆盖，演示效果失真）
const searchComposition = ref('')
const compositionLog = ref<string[]>([])
function onInputComposition(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  compositionLog.value = [...compositionLog.value, `组合结束触发：${value}`].slice(-8)
}

// 模拟 composition 事件序列——用于在无中文 IME 环境下验证 v-inputDebounce 的 composing 跳过逻辑
// 真实 IME 输入需要打开系统输入法并切换到拼音，操作门槛高；该函数直接 dispatch
// `compositionstart` / `compositionend`，让 jsdom / 真实浏览器统一可测
const compositionTrace = ref<string[]>([])
function simulateComposition(): void {
  const el = document.querySelector<HTMLInputElement>('[data-debounce="composition"]')
  if (!el) {
    compositionTrace.value = [
      ...compositionTrace.value,
      '未找到中文输入法输入框（请确认 demo 已渲染）',
    ]
    return
  }
  // compositionstart：标记 composing=true，v-inputDebounce 在此期间跳过 input 回调
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  compositionTrace.value = [...compositionTrace.value, `compositionstart @${Date.now() % 100000}`]
  // 500ms 后触发 compositionend：v-inputDebounce 同步 composing=false 并主动 dispatch input
  setTimeout(() => {
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' }))
    compositionTrace.value = [
      ...compositionTrace.value,
      `compositionend data="中文" @${Date.now() % 100000}`,
    ]
    console.log('[DemoInputDebounce] composition sequence end — 应触发一次 onInputComposition')
  }, 500)
}

// 实时（无防抖）对比——直接接受 EP el-input @input 的字符串参数，
// 不走 v-inputDebounce 指令（无防抖需求），签名与防抖路径区分开
const searchRaw = ref('')
const rawLog = ref<string[]>([])
function onSearchRaw(value: string): void {
  rawLog.value = [...rawLog.value, `实时触发：${value}`].slice(-8)
}

const tocItems = [
  { id: 'demo-default', label: '默认 300ms 防抖' },
  { id: 'demo-custom', label: '自定义延迟' },
  { id: 'demo-compare', label: '对比：无防抖' },
  { id: 'demo-composition', label: '中文输入法（composing）' },
  { id: 'api-binding', label: 'Binding 类型' },
]

useDocToc(tocItems)

const bindingItems = [
  {
    name: 'value',
    type: '(event: Event) => void',
    required: true,
    description: 'input 事件防抖触发后的回调，签名同原生 input listener',
  },
]

// argItems[0].type: 'string' 是数字字符串写法：Vue 模板 `v-inputDebounce:500="onInput"` 中 :500
// 自动字符串化为 '500'；指令内部 parseInt 还原成毫秒数。不必传字符串字面量 '500'。
const argItems = [
  {
    name: 'arg',
    type: 'string',
    required: false,
    description: '可选延迟（毫秒），默认 300。用法：v-inputDebounce:500="onInput"',
  },
]

/* ───── code 字符串（避免 inline `<>` 触发 Vue 模板解析错误） ───────────── */

// v-inputDebounce 回调签名是 (event: Event) => void（与原生 input listener 一致），
// 不是 (value: string) — 调用方需自己从 event.target 取值（见下方 onInputDefault 实现）。
const defaultDebounceCode = `<el-input v-inputDebounce="onSearch" v-model="keyword" />`

const customDebounceCode = `<el-input v-inputDebounce:500="onSearch" v-model="keyword" />`

const rawInputCode = `<el-input
  :model-value="searchRaw"
  @input="
    (v: string | number) => {
      searchRaw = v
      onSearchRaw(v)
    }
  "
/>`

const compositionCode = `<el-input v-inputDebounce="onSearch" v-model="keyword" />
// 内部：compositionstart → composing=true 跳过回调
//       compositionend  → composing=false 主动 dispatch input 触发一次回调
//       （compositionend 时 input.value 已变更但 input 事件被前面的 composing=true 跳过，
//         手动 dispatch input 是为了让 onSearch 收到一次回调以同步 v-model，避免最后一字丢失）`
</script>

<template>
  <DemoFrame
    title="v-inputDebounce 输入防抖"
    source="src/directives/inputDebounce.ts"
    :introductions="[
      '全局指令：input 事件防抖触发，默认 300ms。通过 arg 自定义延迟（如 :500 / :1000）。',
      '中文输入法支持：compositionstart/end 标记 composing 状态，拼音阶段不触发回调，组合结束后再统一触发一次。',
      '兼容封装组件：通过 BFS 查找子 INPUT 元素（Element Plus el-input 等）。',
    ]"
  >
    <!-- 默认防抖 -->
    <section id="demo-default">
      <DemoField label="默认 300ms 防抖（v-inputDebounce）" :code="defaultDebounceCode">
        <span :class="bem.e('chip')">300ms 防抖</span>
        <el-input
          v-inputDebounce="onInputDefault"
          v-model="searchDefault"
          placeholder="尝试连续输入字符，观察日志"
          clearable
          @input="onInputDefaultRaw"
        />
        <div :class="bem.e('counters')">
          <span>
            原始 input 次数：
            <strong>{{ defaultRawCounter }}</strong>
          </span>
          <span>
            300ms 防抖命中：
            <strong>{{ defaultCounter }}</strong>
          </span>
        </div>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">回调日志（防抖后）：</p>
          <p v-for="(line, idx) in defaultLog" :key="`d-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!defaultLog.length" :class="bem.e('log-empty')">（输入字符触发防抖回调）</p>
        </div>
      </DemoField>
    </section>

    <!-- 自定义延迟 -->
    <section id="demo-custom">
      <DemoField label="自定义延迟（v-inputDebounce:500）" :code="customDebounceCode">
        <span :class="bem.e('chip')">500ms 防抖</span>
        <el-input
          v-inputDebounce:500="onInputCustom"
          v-model="searchCustom"
          placeholder="500ms 防抖间隔"
          clearable
          @input="onInputCustomRaw"
        />
        <div :class="bem.e('counters')">
          <span>
            原始 input 次数：
            <strong>{{ customRawCounter }}</strong>
          </span>
          <span>
            500ms 防抖命中：
            <strong>{{ customCounter }}</strong>
          </span>
        </div>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">回调日志（500ms 防抖）：</p>
          <p v-for="(line, idx) in customLog" :key="`c-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!customLog.length" :class="bem.e('log-empty')">
            （输入字符触发 500ms 防抖回调）
          </p>
        </div>
        <p :class="bem.e('hint')">
          对照量化：在两个输入框分别连续输入「abcdefghij」10 字符，
          <strong>原始 input 次数都是 10</strong>
          ，但 300ms 防抖命中次数通常多于 500ms 防抖（停顿少时差异最明显，例如 300ms 命中 4 次 vs
          500ms 命中 2 次）。
        </p>
        <table :class="bem.e('timing-table')">
          <thead>
            <tr>
              <th>输入节奏</th>
              <th>字符数</th>
              <th>300ms 防抖命中</th>
              <th>500ms 防抖命中</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>连续快打（&lt; 200ms/字符）</td>
              <td>10</td>
              <td>4</td>
              <td>2</td>
            </tr>
            <tr>
              <td>间隔均匀（≈ 300ms/字符）</td>
              <td>10</td>
              <td>2</td>
              <td>1</td>
            </tr>
            <tr>
              <td>打字慢速（&gt; 500ms/字符）</td>
              <td>10</td>
              <td>1</td>
              <td>1</td>
            </tr>
          </tbody>
        </table>
        <p :class="bem.e('hint')">
          表格数值基于「连续输入后停顿不超过延迟」的最坏情况估算——实际命中数取决于停顿频率，
          停顿越多命中次数越接近 1。
        </p>
      </DemoField>
    </section>

    <!-- 对比无防抖 -->
    <section id="demo-compare">
      <DemoField label="对比：实时（无防抖）" :code="rawInputCode">
        <span :class="bem.e('chip')">无防抖</span>
        <el-input
          :model-value="searchRaw"
          placeholder="无防抖，每次按键都触发回调"
          clearable
          @input="
            (v: string) => {
              searchRaw = v
              onSearchRaw(v)
            }
          "
        />
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">实时回调日志：</p>
          <p v-for="(line, idx) in rawLog" :key="`r-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!rawLog.length" :class="bem.e('log-empty')">（输入字符实时回调）</p>
        </div>
        <p :class="bem.e('hint')">
          同样输入「hello world」共 11 字符 → 实时触发 11 次回调（每次按键 1 次），
          而上方防抖后只触发 1 次。防抖显著降低搜索请求频率。
          <br />
          注意：本统计仅适用于纯英文 / 数字输入。中英文混合输入或中文输入法场景下，
          <code>@input</code>
          触发时机受 IME composing 状态影响，次数可能小于字符数（拼音阶段不触发）。
        </p>
      </DemoField>
    </section>

    <!-- 中文输入法 -->
    <section id="demo-composition">
      <DemoField label="中文输入法兼容（拼音阶段不触发）" :code="compositionCode">
        <span :class="bem.e('chip')">中文输入法</span>
        <el-input
          v-inputDebounce="onInputComposition"
          v-model="searchComposition"
          data-debounce="composition"
          placeholder="输入拼音（如 zhongwen），拼音阶段不触发回调，组合完成才触发一次"
          clearable
        />
        <div :class="bem.e('simulate-row')">
          <el-button size="small" @click="simulateComposition">模拟 composition 事件</el-button>
          <span :class="bem.e('simulate-hint')">
            无中文 IME 环境也能验证 — 派发合成事件序列，console.log 输出 composing 切换过程
          </span>
        </div>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">组合结束回调日志：</p>
          <p v-for="(line, idx) in compositionLog" :key="`cmp-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!compositionLog.length" :class="bem.e('log-empty')">
            （打开中文输入法，输入拼音——只有汉字上屏才进日志）
          </p>
        </div>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">模拟事件轨迹（compositionstart → compositionend）：</p>
          <p v-for="(line, idx) in compositionTrace" :key="`sim-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!compositionTrace.length" :class="bem.e('log-empty')">
            （点击「模拟 composition 事件」按钮触发）
          </p>
        </div>
        <p :class="bem.e('hint')">
          验证方法：把中文输入法打开，输入「zhongwen」——拼音过程不会触发回调日志，
          汉字上屏（composing 结束）才触发一次。这是 v-inputDebounce 与原生 input 防抖的关键差异。
          无 IME 环境可点「模拟 composition 事件」按钮，等价验证 composing 状态切换逻辑。
          <br />
          <strong>自动化测试限制：</strong>
          此验证需真人中文输入法（系统级 IME）。jsdom / VTU 不支持 composition 事件序列化，
          <code>@vue/test-utils</code>
          的
          <code>trigger('compositionend')</code>
          在本指令的 BFS 查找 INPUT 子元素路径下行为不稳定，单元测试只覆盖「不防抖时 callback
          立即触发」基础路径，composing 跳过逻辑依赖手动 / 浏览器 E2E 验证。
        </p>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="Binding" :items="bindingItems" anchor="api-binding" />
    <ApiTable title="Arg（修饰参数）" :items="argItems" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-input-debounce {
  &__hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
  }

  &__log {
    margin-top: 12px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    min-height: 80px;
  }

  &__log-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__log-line {
    margin: 4px 0;
    padding: 2px 6px;
    background: var(--el-bg-color);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 2px;
    font-family: monospace;
    font-size: 12px;
  }

  &__log-empty {
    margin: 0;
    color: #999;
    font-style: italic;
    font-size: 12px;
  }

  &__counters {
    display: flex;
    gap: 24px;
    margin: 12px 0;
    font-size: 13px;
    color: var(--el-text-color-regular);

    strong {
      font-family: monospace;
      color: var(--el-color-primary);
      margin: 0 4px;
    }
  }

  // chip 标签：4 个 input 上方的视觉区分（300ms / 500ms / 无防抖 / 中文输入法）
  &__chip {
    display: inline-block;
    margin-bottom: 4px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
  }

  // 模拟 composition 事件按钮行
  &__simulate-row {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__simulate-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  // 300ms vs 500ms 防抖命中数对照表（V3.6-22 design fix）
  &__timing-table {
    margin-top: 12px;
    width: 100%;
    max-width: 560px;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 6px 10px;
      border: 1px solid var(--el-border-color-lighter);
      text-align: left;
    }

    th {
      background: var(--el-fill-color-light);
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    td {
      color: var(--el-text-color-regular);
    }
  }
}
</style>
