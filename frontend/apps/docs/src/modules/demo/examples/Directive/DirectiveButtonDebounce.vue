<script setup lang="ts">
/**
 * v-buttonDebounce 指令演示 —— 按钮点击节流防重
 *
 * 覆盖场景：
 *  - 默认 500ms 防抖（trailing edge）
 *  - 自定义延迟（arg 语法：v-buttonDebounce:1000）
 *  - 快速连点验证（保护 submit / 支付按钮）
 *  - 与 v-inputDebounce 对比：click 事件无中文输入法问题
 *
 * 路由：/demo/directive-button-debounce
 */
import { ElMessage } from 'element-plus'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-button-debounce')

/* ───── 演示数据 ───────────── */

// 默认 500ms 防抖：defaultClickCount 仅累加点击次数（防抖后命中），defaultLog 记录每次触发时间
const defaultClickCount = ref(0)
const defaultLog = ref<string[]>([])
function onDefaultClick(): void {
  defaultClickCount.value++
  defaultLog.value = [
    ...defaultLog.value,
    `第 ${defaultClickCount.value} 次触发（${new Date().toLocaleTimeString()}）`,
  ].slice(-8)
  ElMessage.success(`默认防抖触发（500ms，累计 ${defaultClickCount.value} 次）`)
}

// 自定义 1000ms 防抖：customClickCount 仅累加命中次数（无独立 log，演示只用 ElMessage）
const customClickCount = ref(0)
function onCustomClick(): void {
  customClickCount.value++
  ElMessage.success(`自定义防抖触发（1000ms，累计 ${customClickCount.value} 次）`)
}

// 无防抖对比：rawClickCount 累加原始点击次数（每次点击都 +1，不防抖）；
// rawLog 同时记录命中次数对应的毫秒级时间戳（HH:MM:SS.mmm 截取），用于直观对照连点频率
const rawClickCount = ref(0)
const rawLog = ref<string[]>([])
function onRawClick(): void {
  rawClickCount.value++
  const ts = new Date().toISOString().slice(14, 23) // HH:MM:SS.mmm 截取时分秒毫秒
  rawLog.value = [...rawLog.value, `第 ${rawClickCount.value} 次（${ts}）`].slice(-12)
}
/** 一键模拟 3 秒内连点 10 次，用于直观对比防抖前后时间分布 */
let rawAutoTimer: ReturnType<typeof setInterval> | null = null
function startRawAutoBurst(): void {
  if (rawAutoTimer) return
  rawLog.value = []
  rawClickCount.value = 0
  rawAutoTimer = setInterval(() => {
    onRawClick()
    if (rawClickCount.value >= 10 && rawAutoTimer) {
      clearInterval(rawAutoTimer)
      rawAutoTimer = null
    }
  }, 300) // 3 秒 ÷ 10 次 ≈ 300ms/次
}

// 实战 submit：独立回调 + 独立计数 + loading 状态，避免与「默认 500ms 防抖」按钮的
// onDefaultClick 共用——共用会让两个按钮点击都增加 defaultClickCount，
// 视觉上像「多次触发」（实际上每个按钮自己仍是防抖 1 次）。
// submitLoading 模拟「提交中」状态，按钮按下后短暂锁定 1s 内不可重复点
const submitClickCount = ref(0)
const submitLog = ref<string[]>([])
const submitLoading = ref(false)
function onSubmitClick(): void {
  submitClickCount.value++
  submitLog.value = [
    ...submitLog.value,
    `第 ${submitClickCount.value} 次提交（${new Date().toLocaleTimeString()}）`,
  ].slice(-8)
  submitLoading.value = true
  ElMessage.success(`submit 防抖触发（500ms，累计 ${submitClickCount.value} 次）`)
  // 1s 后解除 loading —— 模拟真实接口请求耗时
  setTimeout(() => {
    submitLoading.value = false
  }, 1000)
}

const tocItems = [
  { id: 'demo-default', label: '默认 500ms 防抖' },
  { id: 'demo-custom', label: '自定义 1000ms 延迟' },
  { id: 'demo-compare', label: '对比：无防抖' },
  { id: 'demo-submit', label: '实战：连续点击按钮' },
  { id: 'demo-input-vs-button', label: 'input vs button 对照' },
  { id: 'api-binding', label: 'Binding 类型' },
]

useDocToc(tocItems)

const bindingItems = [
  {
    name: 'value',
    type: '(event: Event) => void',
    required: true,
    description: 'click 事件防抖触发后的回调',
  },
]

const argItems = [
  {
    name: 'arg',
    type: 'string',
    required: false,
    description: '可选延迟（毫秒），默认 500。用法：v-buttonDebounce:1000="onClick"',
  },
]

/* ───── code 字符串（避免 inline `<>` 触发 Vue 模板解析错误） ───────────── */

const defaultDebounceCode = `<el-button v-buttonDebounce="onSubmit">提交</el-button>`

const customDebounceCode = `<el-button v-buttonDebounce:1000="onSubmit">提交</el-button>`

const rawClickCode = `<el-button @click="onClick">无防抖</el-button>`

const submitCode = `<el-button v-buttonDebounce="handleSubmit">提交订单</el-button>`

// input vs button 对照演示：同一时间窗内两个控件并行操作，分别计数
const inputVsButtonLog = ref<string[]>([])
const inputVsButtonInputCount = ref(0)
const inputVsButtonBtnCount = ref(0)
function onInputVsButtonInput(): void {
  inputVsButtonInputCount.value++
  inputVsButtonLog.value = [
    ...inputVsButtonLog.value,
    `[input  ${inputVsButtonInputCount.value}] 第 ${inputVsButtonInputCount.value} 次输入回调（${new Date().toISOString().slice(14, 23)}）`,
  ].slice(-15)
}
function onInputVsButtonBtn(): void {
  inputVsButtonBtnCount.value++
  inputVsButtonLog.value = [
    ...inputVsButtonLog.value,
    `[button ${inputVsButtonBtnCount.value}] 第 ${inputVsButtonBtnCount.value} 次点击回调（${new Date().toISOString().slice(14, 23)}）`,
  ].slice(-15)
}
/** 一键并行触发：在 3 秒内分别快速输入 5 字符 + 点击 5 次，直观对比防抖命中数 */
let inputVsButtonTimer: ReturnType<typeof setInterval> | null = null
function startInputVsButtonBurst(): void {
  if (inputVsButtonTimer) return
  inputVsButtonLog.value = []
  inputVsButtonInputCount.value = 0
  inputVsButtonBtnCount.value = 0
  let tickCount = 0
  // 每 300ms 同时触发一次 input + 一次 button（5 轮 ≈ 1.5s 内并行触发）
  inputVsButtonTimer = setInterval(() => {
    onInputVsButtonInput()
    onInputVsButtonBtn()
    tickCount++
    if (tickCount >= 5 && inputVsButtonTimer) {
      clearInterval(inputVsButtonTimer)
      inputVsButtonTimer = null
    }
  }, 300)
}
</script>

<template>
  <DemoFrame
    title="v-buttonDebounce 按钮防抖"
    source="src/directives/buttonDebounce.ts"
    :introductions="[
      '全局指令：click 事件防抖触发，默认 500ms（trailing edge）。',
      '适用场景：submit（已演示）+ 支付 / 短信发送（待新增 section，避免快速连点）。',
      '与 v-inputDebounce 的差异：click 事件没有中文输入法 composition 问题，实现更简单。',
    ]"
  >
    <!-- 默认防抖 -->
    <section id="demo-default">
      <DemoField label="默认 500ms 防抖（v-buttonDebounce）" :code="defaultDebounceCode">
        <el-button v-buttonDebounce="onDefaultClick" type="primary">点击我（500ms 防抖）</el-button>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">触发记录（仅防抖后的回调被记入）：</p>
          <p v-for="(line, idx) in defaultLog" :key="`d-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!defaultLog.length" :class="bem.e('log-empty')">（疯狂点击按钮验证）</p>
        </div>
        <p :class="bem.e('hint')">
          连续快速点击 5 次：仅最后一次（或第一次静默期结束后的那次）会被回调——共触发 1 次。
        </p>
      </DemoField>
    </section>

    <!-- 自定义延迟 -->
    <section id="demo-custom">
      <DemoField label="自定义延迟（v-buttonDebounce:1000）" :code="customDebounceCode">
        <el-button v-buttonDebounce:1000="onCustomClick" type="success">
          点击我（1000ms 防抖）
        </el-button>
        <p :class="bem.e('hint')">
          arg 语法指定 1000ms 延迟；适用于短信发送、支付等需要更长冷却期的按钮。
        </p>
      </DemoField>
    </section>

    <!-- 对比无防抖 -->
    <section id="demo-compare">
      <DemoField label="对比：无防抖" :code="rawClickCode">
        <el-button @click="onRawClick" type="warning">点击我（无防抖）</el-button>
        <el-button @click="startRawAutoBurst" type="info" plain>
          3 秒内连点 10 次（一键演示）
        </el-button>
        <p :class="bem.e('log')">
          无防抖累计触发：
          <strong>{{ rawClickCount }}</strong>
          次
        </p>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">时间戳分布（毫秒级）—— 直观感受连点频率：</p>
          <p v-for="(line, idx) in rawLog" :key="`raw-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!rawLog.length" :class="bem.e('log-empty')">（手动连点或点上方一键演示）</p>
        </div>
        <p :class="bem.e('hint')">
          同样连续点 5 次：回调触发 5 次——这正是 v-buttonDebounce 要避免的场景。
          <strong>5 次连点耗时 1.5s（300ms/次）vs 防抖后只触发 1 次（耗时 0.5s 静默期）</strong>
          ，请求量降低 5 倍。一键演示按 300ms/次触发 10 次（合计 3 秒），观察时间戳分布与默认 500ms
          防抖按钮的对照差异。
        </p>
      </DemoField>
    </section>

    <!-- submit 模拟 -->
    <section id="demo-submit">
      <DemoField label="实战：连续点击按钮（独立计数演示）" :code="submitCode">
        <el-button v-buttonDebounce="onSubmitClick" type="danger" :loading="submitLoading">
          提交订单（防重）
        </el-button>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">submit 回调触发记录（独立计数）：</p>
          <p v-for="(line, idx) in submitLog" :key="`s-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!submitLog.length" :class="bem.e('log-empty')">（连点 submit 按钮验证）</p>
        </div>
        <p :class="bem.e('hint')">
          用户提交订单时多次点击同一个按钮：v-buttonDebounce 保证只有第一次（或冷却后的那次）
          会真正发起请求，避免重复扣款 / 重复创建订单等严重 bug。
        </p>
      </DemoField>
    </section>

    <!-- input vs button 对照演示 -->
    <section id="demo-input-vs-button">
      <DemoField label="v-inputDebounce vs v-buttonDebounce（触发次数对照）" :code="''">
        <div :class="bem.e('control-row')">
          <el-input
            v-inputDebounce="onInputVsButtonInput"
            placeholder="v-inputDebounce 防抖输入框"
            style="width: 240px"
            clearable
          />
          <el-button v-buttonDebounce="onInputVsButtonBtn" type="primary">
            v-buttonDebounce 防抖按钮
          </el-button>
          <el-button @click="startInputVsButtonBurst" type="info" plain>
            一键并行触发（5 轮 × 300ms）
          </el-button>
        </div>
        <div :class="bem.e('counters')">
          <span>
            input 命中：
            <strong>{{ inputVsButtonInputCount }}</strong>
          </span>
          <span>
            button 命中：
            <strong>{{ inputVsButtonBtnCount }}</strong>
          </span>
        </div>
        <div :class="bem.e('log')">
          <p :class="bem.e('log-title')">时间戳合并日志（[input]/[button] 区分）：</p>
          <p v-for="(line, idx) in inputVsButtonLog" :key="`ivb-${idx}`" :class="bem.e('log-line')">
            {{ line }}
          </p>
          <p v-if="!inputVsButtonLog.length" :class="bem.e('log-empty')">（手动操作或一键触发）</p>
        </div>
        <p :class="bem.e('hint')">
          一键并行触发 5 轮后，理论上 input 与 button 命中数应该相等（同步触发）， 但
          <strong>v-inputDebounce 会受中文输入法 composition 影响</strong>
          —— 拼音阶段不计数、组合结束才触发；v-buttonDebounce 不存在该问题 （click 事件天然无 IME
          概念）。
        </p>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="Binding" :items="bindingItems" anchor="api-binding" />
    <ApiTable title="Arg（修饰参数）" :items="argItems" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-button-debounce {
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
    min-height: 60px;
    font-family: monospace;
    font-size: 13px;
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

  &__control-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  &__counters {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;
    font-size: 14px;

    strong {
      font-family: monospace;
      color: var(--el-color-primary);
      margin: 0 4px;
    }
  }
}
</style>
