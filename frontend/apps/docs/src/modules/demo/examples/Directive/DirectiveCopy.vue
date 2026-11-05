<script setup lang="ts">
/**
 * v-copy 指令演示 —— 文本复制 + 兼容性降级
 *
 * 覆盖场景：
 *  - 静态字符串（字面量）
 *  - 响应式 ref（updated 时同步最新值）
 *  - 箭头函数（每次点击实时求值，避免闭包陈旧）
 *  - 空内容（warning 提示，底层 API 不调用）
 *  - 降级原理（secure context / clipboard API 不可用时的 textarea + execCommand 兜底）
 *
 * 路由：/demo/directive-copy
 */
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-copy')

/* ───── 演示数据 ───────────── */

// 静态字符串
const STATIC_TEXT = '客服电话：400-100-1001'

// 响应式 ref
const orderId = ref('ORD-2026-0911-001')
function regenerateOrderId(): void {
  orderId.value = `ORD-2026-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`
}

// 动态函数：每次点击实时求值
// 关键：函数体只返回新时间戳，无副作用；v-copy 接住返回值后通过 ElMessage 提示复制内容。
function copyTimestamp(): string {
  return new Date().toISOString()
}

// 空内容
const EMPTY_TEXT = ''

/* ───── 强制降级验证（P1H-6：可执行降级路径） ───────────── */
// 当前是否处于强制降级状态（用户点击「强制降级」后为 true）
const isDegradedForced = ref(false)
// 当前 window.isSecureContext 真实值（响应式追踪，配合强制降级按钮实时刷新）
const currentSecureContext = ref(window.isSecureContext)

/** 用 Object.defineProperty 把只读的 window.isSecureContext 强制改写为 false，
 * 模拟 HTTP 部署场景。注意：必须用 configurable: true 才能被 resetSecureContext 还原。 */
function forceDegrade(): void {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
  isDegradedForced.value = true
  currentSecureContext.value = false
  ElMessage.warning('已强制 isSecureContext=false，复制将走 textarea 降级路径')
}

/** 还原 window.isSecureContext 为初始真实值（devTools 加载页面时的真实状态） */
function resetSecureContext(): void {
  // 真实环境的 isSecureContext 无法被还原（浏览器原生只读）；
  // 但 Object.defineProperty 改过的属性可以通过 delete + 重新 define 还原
  // 此处直接恢复为 true —— 因为 Object.defineProperty 拦截了原型 getter，真实值已经丢失
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  isDegradedForced.value = false
  currentSecureContext.value = true
  ElMessage.success('已还原 isSecureContext=true')
}

const tocItems = [
  { id: 'demo-static', label: '静态字符串' },
  { id: 'demo-ref', label: '响应式 ref' },
  { id: 'demo-function', label: '动态函数' },
  { id: 'demo-empty', label: '空内容' },
  { id: 'demo-degrade', label: '降级原理' },
  { id: 'api-binding', label: 'Binding 类型' },
]

useDocToc(tocItems)

const bindingItems = [
  {
    name: 'value',
    type: 'string | (() => string)',
    required: true,
    // CopyValue 来自 src/directives/copy.d.ts:22 —— `string | (() => string)`，
    // 与此处 type 字段严格对齐（不要漏写函数返回类型 string，否则 copy.ts:40 resolveCopyValue 推导会失败）
    description: '复制内容。字符串直传；函数每次点击实时执行，避免闭包陈旧',
  },
]

/* ───── code 字符串（避免 inline `<>` 触发 Vue 模板解析错误） ───────────── */

const staticCode = `<el-button v-copy="'客服电话：400-100-1001'">复制客服电话</el-button>`

const refCode = `<el-input v-model="orderId" />
<el-button v-copy="orderId">复制订单号</el-button>`

const functionCode = `<el-button v-copy="() => { const now = new Date().toISOString(); return now }">复制当前时间戳</el-button>`

const emptyCode = `<el-button v-copy="">复制空字符串</el-button>`

const degradeCode = `// 1. secure context + clipboard API 可用 → navigator.clipboard.writeText
// 2. 上述 API 抛错兜底 / 非 secure context → textarea + execCommand('copy')`
</script>

<template>
  <DemoFrame
    title="v-copy 文本复制"
    source="src/directives/copy.ts"
    :introductions="[
      '全局指令：点击元素触发剪贴板复制，自动选择 navigator.clipboard.writeText 或降级到 execCommand。',
      '降级策略：HTTPS / localhost / file: 走现代 API；HTTP 环境或 API 失败时自动 fallback 到 textarea + execCommand。',
      '视觉反馈：通过 ElMessage 提示「复制成功」「复制失败」「内容为空」三种状态。',
      '验证步骤：步骤 1 点击按钮 → 步骤 2 打开任意输入框 → 步骤 3 Ctrl+V 粘贴验证。',
    ]"
  >
    <!-- 静态字符串 -->
    <section id="demo-static">
      <DemoField label="静态字符串（字面量）" :code="staticCode">
        <el-button v-copy="STATIC_TEXT">复制客服电话</el-button>
        <p :class="bem.e('hint')">
          STATIC_TEXT 是模块级常量；绑定后会随 updated 钩子同步到 ctx.binding。 此外，v-copy
          默认会给宿主元素添加
          <code>cursor: pointer</code>
          ；hover 时可观察到鼠标变化。
        </p>
      </DemoField>
    </section>

    <!-- 响应式 ref -->
    <section id="demo-ref">
      <DemoField label="响应式 ref（点击复制最新值）" :code="refCode">
        <div :class="bem.e('row')">
          <el-input v-model="orderId" placeholder="订单号" style="width: 280px" />
          <el-button v-copy="orderId" type="primary">复制订单号</el-button>
          <el-button @click="regenerateOrderId">换一个</el-button>
        </div>
        <p :class="bem.e('hint')">
          修改输入框或点「换一个」会改变 orderId；点击「复制订单号」时拿到当前最新值。 机制：updated
          钩子在每次 binding 变化时同步 ctx.binding 引用，使指令内部始终拿到最新值。
        </p>
      </DemoField>
    </section>

    <!-- 动态函数 -->
    <section id="demo-function">
      <DemoField label="动态函数（每次点击实时求值）" :code="functionCode">
        <el-button v-copy="copyTimestamp" type="success">复制当前时间戳</el-button>
        <p :class="bem.e('hint')">
          函数返回 ISO
          时间戳；连续点击若干次，到输入框粘贴能看到不同的时间——证明函数被实时调用，无闭包陈旧。
        </p>
      </DemoField>
    </section>

    <!-- 空内容 -->
    <section id="demo-empty">
      <DemoField label="空内容保护" :code="emptyCode">
        <el-button v-copy="EMPTY_TEXT" type="warning">复制空字符串</el-button>
        <p :class="bem.e('hint')">
          触发 ElMessage.warning("复制内容为空")，底层剪贴板 API
          不被调用，避免「点了没反应」的困惑。
        </p>
      </DemoField>
    </section>

    <!-- 降级原理 -->
    <section id="demo-degrade">
      <DemoField label="降级原理（决策矩阵）" :code="degradeCode">
        <p :class="bem.e('hint')">
          浏览器 Console 执行
          <code>window.isSecureContext</code>
          可查看当前是否为 HTTPS 环境。本地 dev（localhost）通常返回 true；部署到 HTTP 站点返回
          false。
        </p>
        <p :class="bem.e('hint')">
          非 secure context 下
          <code>navigator.clipboard === undefined</code>
          ，指令自动走 textarea 降级路径。
        </p>
        <!-- 强制降级验证：用 Object.defineProperty 改写只读属性，模拟 HTTP 部署环境 -->
        <div :class="bem.e('degrade-actions')">
          <el-button type="warning" @click="forceDegrade">
            强制降级（isSecureContext=false）
          </el-button>
          <el-button @click="resetSecureContext">还原</el-button>
          <el-button v-copy="'降级路径验证文本'" type="primary" :disabled="!isDegradedForced">
            点击复制（降级路径走 textarea）
          </el-button>
        </div>
        <p :class="bem.e('hint')">
          当前 isSecureContext：
          <code>{{ currentSecureContext }}</code>
          <span v-if="isDegradedForced" :class="bem.e('badge')">已强制降级</span>
        </p>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="v-copy Binding" :items="bindingItems" anchor="api-binding" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-copy {
  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  &__hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.6;

    code {
      padding: 1px 4px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  }

  &__degrade-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  &__badge {
    margin-left: 8px;
    padding: 1px 6px;
    background: var(--el-color-warning);
    color: #fff;
    border-radius: 3px;
    font-size: 11px;
  }
}
</style>
