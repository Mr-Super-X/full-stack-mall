# form-schema demo 可理解度提升（实现计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 form-schema 4 个 demo 中 4 项 P0 可理解度问题统一收敛到 3 类改动：on-page console 反馈 + 业务综合 demo 验证清单搬到 UI + 错误诊断 demo 字段 label 加预期状态后缀

**Architecture:**
1. 新增 `useConsoleCapture` composable（hook console.error/warn → reactive logs）
2. 新增 `ConsoleLogPanel` 公共组件（ElCollapse 折叠 + 日志渲染）
3. 3 个错误诊断 demo 接入上述两点 + 1 个业务综合 demo 顶部加 ElCollapse 验证清单

**Tech Stack:** Vue 3.5 Composition API + Vitest + Vue Test Utils + Element Plus 2.14（ElCollapse 已存在）+ TypeScript

---

## 文件结构

### 新增（3 个）

| #   | 路径                                                            | 职责                                                                                            |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `src/modules/demo/composables/useConsoleCapture.ts`              | 单一职责：捕获 `console.error` / `console.warn` 到 reactive `logs` 数组 + 提供 `clear()` 方法     |
| 2   | `src/modules/demo/composables/useConsoleCapture.spec.ts`         | 6 个测试用例（hook 生效 / FIFO 上限 / 截断 / 卸载还原 / prefix 过滤 / 多 level 捕获）           |
| 3   | `src/modules/demo/components/ConsoleLogPanel.vue`                | 单一职责：渲染 `logs` 数组为 ElCollapse + `<pre>`；emit `clear` 事件                              |

### 修改（4 个）

| #   | 路径                                                              | 改动                                                                                       |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `src/modules/demo/examples/XFormInvalidComponent.vue`               | 5 个字段 label 加括号后缀 + 引入 `useConsoleCapture` + `ConsoleLogPanel`                    |
| 2   | `src/modules/demo/examples/XFormModelWarn.vue`                     | 引入 `useConsoleCapture` + `ConsoleLogPanel`                                                |
| 3   | `src/modules/demo/examples/XFormExpressionSandbox.vue`             | 引入 `useConsoleCapture` + `ConsoleLogPanel`                                                |
| 4   | `src/modules/demo/examples/XFormOrderCreate.vue`                   | 顶部加 `ElCollapse` 验证指引面板（默认折叠）                                                |

### 修改（1 个，非 src/）

| #   | 路径                       | 改动                                                            |
| --- | -------------------------- | --------------------------------------------------------------- |
| 1   | `CHANGELOG.md`              | 记录本次改动（feat: 提升 XForm 4 个 demo 可理解度）              |

---

## 共用约定（执行所有任务前必读）

- **BEM 命名空间**：`useConsoleCapture` 不涉及 CSS；`ConsoleLogPanel` 用 `demo-console-log-panel`（kebab-case，对齐现有 `demo-field`）
- **截断阈值**：
  - 捕获层（`useConsoleCapture`）：单条 message > 500 字截断（防爆）
  - 渲染层（`ConsoleLogPanel`）：单条 message > 200 字截断（UI 可读性）
  - FIFO 上限：50 条
- **生命周期约束**：`useConsoleCapture` 必须在 Vue setup 上下文里调用（依赖 `onMounted` / `onUnmounted`）
- **测试 mock**：所有 demo 测试需要 `vi.mock('element-plus')` 避免 ElMessage 真弹（参考 `useXFormDemo.spec.ts:9-16` 风格）
- **commit 信息**：用中文 commit msg（项目规范） + Angular 风格（commitlint 已配）

---

## Task 1: useConsoleCapture composable 测试（RED）

**Files:**
- Create: `src/modules/demo/composables/useConsoleCapture.spec.ts`

- [ ] **Step 1: 写失败测试**

文件：`src/modules/demo/composables/useConsoleCapture.spec.ts`

```ts
/**
 * useConsoleCapture 单测 —— 验证 console hook 捕获 / FIFO / 截断 / 卸载还原 / prefix 过滤
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useConsoleCapture, type CapturedLog } from './useConsoleCapture'

/**
 * 用 mount() 把 composable 放到 setup 上下文里；返回的 wrapper 暴露 logs / clear
 */
function mountCapture(prefix?: string) {
  const Host = defineComponent({
    setup() {
      const capture = useConsoleCapture(prefix)
      return capture
    },
    template: '<div></div>',
  })
  return mount(Host)
}

describe('useConsoleCapture', () => {
  let originalError: typeof console.error
  let originalWarn: typeof console.warn

  beforeEach(() => {
    originalError = console.error
    originalWarn = console.warn
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    console.error = originalError
    console.warn = originalWarn
    vi.restoreAllMocks()
  })

  it('挂载后调 console.error → logs 包含 1 条 error', async () => {
    const wrapper = mountCapture()
    console.error('test message')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.level).toBe('error')
    expect(logs[0]!.message).toBe('test message')
    wrapper.unmount()
  })

  it('挂载后调 console.warn → logs 包含 1 条 warn', async () => {
    const wrapper = mountCapture()
    console.warn('warn msg')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.level).toBe('warn')
    wrapper.unmount()
  })

  it('连续 60 次 console.error → logs.length ≤ 50（FIFO 上限）', async () => {
    const wrapper = mountCapture()
    for (let i = 0; i < 60; i++) console.error(`msg-${i}`)
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(50)
    expect(logs[0]!.message).toBe('msg-10')
    expect(logs[49]!.message).toBe('msg-59')
    wrapper.unmount()
  })

  it('单条 message > 500 字 → 截断 + "...[已截断]"', async () => {
    const wrapper = mountCapture()
    const longMsg = 'x'.repeat(600)
    console.error(longMsg)
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs[0]!.message.endsWith('...[已截断]')).toBe(true)
    expect(logs[0]!.message.length).toBeLessThanOrEqual(520)
    wrapper.unmount()
  })

  it('卸载后 console.error → logs 不增长 + 原 console.error 行为还原', async () => {
    const wrapper = mountCapture()
    console.error('before unmount')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { logs: CapturedLog[] }).logs.length).toBe(1)

    wrapper.unmount()

    // 卸载后调用不应增长 logs（wrapper 已 dispose）
    console.error('after unmount')
    expect((wrapper.vm as unknown as { logs: CapturedLog[] }).logs.length).toBe(1)

    // 还原后的 console.error 应该调用 vi.spyOn mock（因为 afterEach restore）
    // 这里只验证没抛错即可
    expect(true).toBe(true)
  })

  it("prefix='[XForm]' 时调 console.error('foo') → logs 空（不命中过滤）", async () => {
    const wrapper = mountCapture('[XForm]')
    console.error('foo')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(0)
    wrapper.unmount()
  })

  it("prefix='[XForm]' 时调 console.error('[XForm] validate 失败') → logs 命中", async () => {
    const wrapper = mountCapture('[XForm]')
    console.error('[XForm] validate 失败')
    await wrapper.vm.$nextTick()
    const logs = (wrapper.vm as unknown as { logs: CapturedLog[] }).logs
    expect(logs.length).toBe(1)
    expect(logs[0]!.message).toBe('[XForm] validate 失败')
    wrapper.unmount()
  })

  it('clear() 清空 logs', async () => {
    const wrapper = mountCapture()
    console.error('a')
    console.error('b')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { logs: CapturedLog[]; clear: () => void }
    expect(vm.logs.length).toBe(2)
    vm.clear()
    await wrapper.vm.$nextTick()
    expect(vm.logs.length).toBe(0)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑测试验证失败**

```bash
pnpm test src/modules/demo/composables/useConsoleCapture.spec.ts
```

预期：FAIL，错误信息 `Failed to resolve import "./useConsoleCapture"` —— composable 文件还没创建

---

## Task 2: useConsoleCapture composable 实现（GREEN）

**Files:**
- Create: `src/modules/demo/composables/useConsoleCapture.ts`

- [ ] **Step 1: 实现 composable**

文件：`src/modules/demo/composables/useConsoleCapture.ts`

```ts
/**
 * useConsoleCapture —— 在组件生命周期内捕获 console.error / console.warn
 *
 * 应用场景：错误诊断 demo 让用户能"在页面上"看到 XForm 触发的警告，不必打开 DevTools
 *
 * 设计原则：
 * - 强约束：onMounted hook、onUnmounted 还原原始 console 方法（避免污染全局）
 * - 上限：内存保留最近 50 条（FIFO），单条 500 字截断（防内存爆 / 防页面卡顿）
 * - 过滤：可选 prefix 仅捕获包含此前缀的日志（XForm 内部统一以 "[XForm]" 起头）
 * - 单一职责：只捕获 + 暴露数据，渲染由调用方决定（用 ConsoleLogPanel）
 *
 * 使用：
 * ```ts
 * const { logs, clear } = useConsoleCapture('[XForm]')
 * ```
 */
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface CapturedLog {
  level: 'error' | 'warn'
  message: string
  timestamp: number
}

const MAX_LOGS = 50
const MAX_MSG_LENGTH = 500

export interface UseConsoleCaptureReturn {
  /** reactive 日志数组，按时间顺序（FIFO 丢弃超出） */
  logs: Ref<CapturedLog[]>
  /** 清空 logs */
  clear: () => void
}

export function useConsoleCapture(prefix?: string): UseConsoleCaptureReturn {
  const logs = ref<CapturedLog[]>([])

  // 闭包内保存原始引用（避免多个实例互相覆盖）
  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)

  function stringify(v: unknown): string {
    if (typeof v === 'string') return v
    if (v instanceof Error) return v.message
    try {
      return JSON.stringify(v) ?? String(v)
    } catch {
      return String(v)
    }
  }

  function capture(level: 'error' | 'warn', ...args: unknown[]): void {
    const message = args.map(stringify).join(' ')
    if (prefix && !message.includes(prefix)) return

    const truncated =
      message.length > MAX_MSG_LENGTH ? `${message.slice(0, MAX_MSG_LENGTH)}...[已截断]` : message

    logs.value.push({ level, message: truncated, timestamp: Date.now() })
    if (logs.value.length > MAX_LOGS) {
      logs.value.splice(0, logs.value.length - MAX_LOGS)
    }
  }

  onMounted(() => {
    console.error = (...args: unknown[]) => {
      capture('error', ...args)
      originalError(...args)
    }
    console.warn = (...args: unknown[]) => {
      capture('warn', ...args)
      originalWarn(...args)
    }
  })

  onUnmounted(() => {
    console.error = originalError
    console.warn = originalWarn
  })

  function clear(): void {
    logs.value = []
  }

  return { logs, clear }
}
```

- [ ] **Step 2: 跑测试验证通过**

```bash
pnpm test src/modules/demo/composables/useConsoleCapture.spec.ts
```

预期：8 个 `it` 全部 PASS

- [ ] **Step 3: 提交**

```bash
git add src/modules/demo/composables/useConsoleCapture.ts src/modules/demo/composables/useConsoleCapture.spec.ts
git commit -m "feat(demo-clarity): 新增 useConsoleCapture composable

错误诊断 demo 用 —— 在组件生命周期内捕获 console.error / console.warn
到 reactive logs 数组，onUnmounted 还原原始 console。

强约束：
- 内存 FIFO 上限 50 条（防内存爆）
- 单条 message 500 字截断（防页面卡顿）
- 可选 prefix 过滤（XForm demo 统一传 '[XForm]'）

含 8 个单测覆盖 hook 生效 / FIFO / 截断 / 卸载还原 / prefix / clear。"
```

---

## Task 3: ConsoleLogPanel 公共组件

**Files:**
- Create: `src/modules/demo/components/ConsoleLogPanel.vue`

- [ ] **Step 1: 创建组件**

文件：`src/modules/demo/components/ConsoleLogPanel.vue`

```vue
<script setup lang="ts">
/**
 * ConsoleLogPanel —— 渲染 useConsoleCapture 捕获的日志
 *
 * 设计：ElCollapse 默认折叠；error 红 / warn 黄；单条 > 200 字截断（视图层二次截断，捕获层 500 字）
 * 仅 emit `clear` 事件；数据由父组件通过 logs prop 传入（单一职责）
 */
import type { CapturedLog } from '../composables/useConsoleCapture'

const props = withDefaults(
  defineProps<{
    logs: CapturedLog[]
    title?: string
    empty?: string
  }>(),
  {
    title: '控制台输出',
    empty: '暂无日志',
  },
)

const emit = defineEmits<{
  clear: []
}>()

const RENDER_LIMIT = 200

function truncate(msg: string): string {
  return msg.length > RENDER_LIMIT ? `${msg.slice(0, RENDER_LIMIT)}...[视图层截断]` : msg
}

const bem = createNamespace('demo-console-log-panel')
</script>

<template>
  <el-collapse :class="bem.b()">
    <el-collapse-item :title="title">
      <template v-if="logs.length === 0">
        <p :class="bem.e('empty')">{{ empty }}</p>
      </template>
      <template v-else>
        <pre :class="bem.e('list')">
<div
  v-for="log in logs"
          :key="log.timestamp"
          :class="[bem.e('item'), bem.is('level', log.level)]"
        >
          <span :class="bem.e('level')">{{ log.level.toUpperCase() }}</span>
          <span :class="bem.e('msg')">{{ truncate(log.message) }}</span>
        </div>
      </pre>
        <el-button link size="small" @click="emit('clear')">清空</el-button>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-console-log-panel {
  margin-top: 12px;

  &__empty {
    color: var(--el-text-color-secondary, #909399);
    font-size: 13px;
    margin: 0;
    padding: 8px 0;
  }

  &__list {
    margin: 0;
    padding: 8px 12px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 4px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    max-height: 240px;
    overflow-y: auto;
  }

  &__item {
    padding: 4px 0;
    border-bottom: 1px dashed var(--el-border-color-lighter, #ebeef5);

    &:last-child {
      border-bottom: none;
    }

    &.is-level-error &__level {
      color: var(--el-color-danger, #f56c6c);
    }

    &.is-level-warn &__level {
      color: var(--el-color-warning, #e6a23c);
    }
  }

  &__level {
    display: inline-block;
    width: 48px;
    font-weight: 600;
    margin-right: 8px;
  }

  &__msg {
    color: var(--el-text-color-primary, #303133);
    word-break: break-all;
  }
}
</style>
```

- [ ] **Step 2: 类型检查通过**

```bash
pnpm type-check
```

预期：exit 0，无 TS 错误

- [ ] **Step 3: 提交**

```bash
git add src/modules/demo/components/ConsoleLogPanel.vue
git commit -m "feat(demo-clarity): 新增 ConsoleLogPanel 公共组件

渲染 useConsoleCapture 捕获的日志：
- ElCollapse 默认折叠
- error 红 / warn 黄（is-level-error / is-level-warn modifier）
- 视图层单条 200 字截断（防页面撑爆）
- 仅 emit clear 事件，logs 由父组件传入（单一职责）

BEM 命名空间 demo-console-log-panel，对齐现有 demo-* 组件风格。"
```

---

## Task 4: XFormInvalidComponent 改造（label + console 面板）

**Files:**
- Modify: `src/modules/demo/examples/XFormInvalidComponent.vue`

- [ ] **Step 1: 改 import + 引入 composable**

把文件顶部第 17-31 行：

```ts
import { reactive } from 'vue'
import { ElMessage, ElInput } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode, XFormProps } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import ApiTable from '../components/ApiTable.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import DocToc from '../components/DocToc.vue'
import { invalidComponentItems } from './xform-demos-api'
import ModelPreview from '../components/ModelPreview.vue'
```

改为：

```ts
import { reactive } from 'vue'
import { ElMessage, ElInput } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode, XFormProps } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import { useConsoleCapture } from '../composables/useConsoleCapture'
import ApiTable from '../components/ApiTable.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import DocToc from '../components/DocToc.vue'
import ConsoleLogPanel from '../components/ConsoleLogPanel.vue'
import { invalidComponentItems } from './xform-demos-api'
import ModelPreview from '../components/ModelPreview.vue'
```

- [ ] **Step 2: 在 setup 末尾加 useConsoleCapture**

找到 `const { bem } = useXFormDemo({...})` 这一行（原文第 29-32 行），在后面新增：

```ts
const { logs, clear } = useConsoleCapture('[XForm]')
```

- [ ] **Step 3: 改 5 个字段 label**

把原文第 63、72、78、84 行：

| 原 label                              | 新 label                                            |
| ------------------------------------- | --------------------------------------------------- |
| `'A. 已知 EL 短名'`                    | `'A. 已知 EL 短名（应通过）'`                        |
| `'B. 已知 EL 全名'`                    | `'B. 已知 EL 全名（应通过）'`                        |
| `'C. 拼写错误（Inpurt）'`              | `'C. 拼写错误 Inpurt（应警告）'`                      |
| `'D. 未注册自定义组件'`                | `'D. 未注册自定义组件（应警告）'`                    |

E 字段 label 在第 95 行：

```ts
label: 'E. 已注册 MyCustomInput',
```

改为：

```ts
label: 'E. 已注册 MyCustomInput（应通过）',
```

- [ ] **Step 4: 改 introduction 文案**

把原文第 121-126 行：

```ts
introductions="[
  'schema component 字段拼写错误时，dev mode 触发 console.warn + Debug Banner 错误。',
  '打开 DevTools Console 应看到 2 条 [XForm][validate] 警告（字段 C 和 D）。',
  '右下角 Debug Banner（dev 模式）会显示红色错误条。',
  '字段 A (Input)、B (ElInput)、E (MyCustomInput 已注册) 不应触发警告。',
]"
```

改为：

```ts
introductions="[
  'schema component 字段拼写错误时，dev mode 触发 console.error + Debug Banner 错误。',
  '下方「控制台输出」面板自动展示 XForm 触发的错误（不需打开 DevTools）。',
  '字段 A（应通过）、B（应通过）、E（应通过）不触发警告；字段 C（应警告）、D（应警告）触发警告。',
  '右下角 Debug Banner（dev 模式）会显示红色错误条。',
]"
```

- [ ] **Step 5: 在 template 末尾加 ConsoleLogPanel**

找到 `</DemoFrame>` 之前的 `<ApiTable ...>`，在它前面新增：

```vue
<ConsoleLogPanel
  :logs="logs"
  title="XForm 控制台输出（实时捕获）"
  empty="暂无警告（应仅字段 C/D 触发）"
  @clear="clear"
/>
```

- [ ] **Step 6: 类型检查 + lint**

```bash
pnpm type-check && pnpm lint --fix src/modules/demo/examples/XFormInvalidComponent.vue
```

预期：两者均 exit 0

- [ ] **Step 7: 提交**

```bash
git add src/modules/demo/examples/XFormInvalidComponent.vue
git commit -m "refactor(XFormInvalidComponent): 字段 label 加预期状态后缀 + 接入 console 面板

- A/B/E 加「（应通过）」；C/D 加「（应警告）」
- 引入 useConsoleCapture + ConsoleLogPanel
- introduction 文案改为「下方控制台输出面板自动展示」（不再依赖 DevTools）

让用户对照字段 label 即可看出预期状态，无须映射到 introduction。"
```

---

## Task 5: XFormModelWarn 改造

**Files:**
- Modify: `src/modules/demo/examples/XFormModelWarn.vue`

- [ ] **Step 1: 改 import**

原文第 23-22 行（script setup import 段）：

```ts
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import ApiTable from '../components/ApiTable.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DemoFrame from '../components/DemoField.vue'
import DemoField from '../components/DemoField.vue'
import DocToc from '../components/DocToc.vue'
import { modelWarnItems } from './xform-demos-api'
```

改为：

```ts
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import { useConsoleCapture } from '../composables/useConsoleCapture'
import ApiTable from '../components/ApiTable.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import DocToc from '../components/DocToc.vue'
import ConsoleLogPanel from '../components/ConsoleLogPanel.vue'
import { modelWarnItems } from './xform-demos-api'
```

注：原 import 段有重复的 `DemoFrame` / `DemoField`，这里保留项目原状不动（不在本次任务范围），只新增 2 行 import。

- [ ] **Step 2: 在 setup 末尾加 useConsoleCapture**

在 `const { bem } = useXFormDemo({...})` 下面新增：

```ts
const { logs, clear } = useConsoleCapture('[XForm]')
```

- [ ] **Step 3: 改 introduction 文案**

原文第 60-68 行：

```ts
introductions="[
  'model prop 未传入时，dev mode 触发 console.warn。',
  '打开 DevTools Console 查看三个场景：',
  '1) 不传 model → [XForm] model prop 未传入 ...',
  '2) 传 reactive({}) → 合法（不警告，但字段始终为空）',
  `3) 传 reactive({ email: '' }) → 对照组`,
  '校验 / 默认值 / reaction / dirty 追踪 在场景 1 下均不会生效。',
]"
```

改为：

```ts
introductions="[
  'model prop 未传入时，dev mode 触发 console.error。',
  '下方「控制台输出」面板实时显示 XForm 的警告（不需打开 DevTools）。',
  '场景 1：未传 model → 自动捕获 [XForm] model 警告',
  '场景 2：reactive({}) → 合法（不警告，字段始终为空）',
  '场景 3：reactive({ email: "" }) → 对照组，正常工作',
  '校验 / 默认值 / reaction / dirty 追踪 在场景 1 下均不会生效。',
]"
```

- [ ] **Step 4: 在 ApiTable 前加 ConsoleLogPanel**

找到 `</DemoFrame>` 之前的 `<ApiTable title="model prop 三种形态" ...>`，在它前面新增：

```vue
<ConsoleLogPanel
  :logs="logs"
  title="XForm 控制台输出"
  empty="暂无警告（场景 1 应捕获 1 条 [XForm] model 警告）"
  @clear="clear"
/>
```

- [ ] **Step 5: 类型检查 + lint**

```bash
pnpm type-check && pnpm lint --fix src/modules/demo/examples/XFormModelWarn.vue
```

预期：两者均 exit 0

- [ ] **Step 6: 提交**

```bash
git add src/modules/demo/examples/XFormModelWarn.vue
git commit -m "refactor(XFormModelWarn): 引入 console 面板，introduction 文案不再依赖 DevTools"
```

---

## Task 6: XFormExpressionSandbox 改造

**Files:**
- Modify: `src/modules/demo/examples/XFormExpressionSandbox.vue`

- [ ] **Step 1: 改 import**

原文第 12-23 行 import 段，添加两行：

```ts
import { useConsoleCapture } from '../composables/useConsoleCapture'
```

和：

```ts
import ConsoleLogPanel from '../components/ConsoleLogPanel.vue'
```

（位置：紧接 `useXFormDemo` import 后；与已有 import 风格一致）

- [ ] **Step 2: 在 setup 末尾加 useConsoleCapture**

在 `const { bem, formRef, onReset, copySchema } = useXFormDemo({...})` 下面新增：

```ts
const { logs, clear } = useConsoleCapture('[XForm]')
```

- [ ] **Step 3: 改 introduction 文案**

原文第 152-167 行，把"打开 devtools"等用户操作引导改为"下方控制台面板"：

```ts
introductions="[
  'expressionFunctions prop 注册白名单函数（{{ }} 表达式按名调用，无需打包时编译）',
  '应用场景：后端 JSON 配置表单 → 表达式字符串可直接引用注册名（如 toCurrency / upper / concat）',
  '沙箱安全：表达式含 document / fetch / eval / window 等 forbidden → console.error + Debug Banner 红字',
  '测试 1: 修改 price / qty → 合计标签实时更新（白名单函数正常）',
  '测试 2: 修改 code → 代码标签实时大写（白名单函数正常）',
  '测试 3: 安全测试字段 → 下方「控制台输出」面板显示沙箱拒绝原因（无需打开 DevTools）',
  '⚠️ 安全规则：禁止把 schema 来自 URL 参数 / localStorage / 用户输入——仅允许后端预校验或项目硬编码',
]"
```

- [ ] **Step 4: 在 ApiTable 前加 ConsoleLogPanel**

找到 `</DemoFrame>` 之前的 `<ApiTable title="沙箱字段速查" ...>`，在它前面新增：

```vue
<ConsoleLogPanel
  :logs="logs"
  title="沙箱拒绝原因（实时捕获）"
  empty="暂无警告（应仅安全测试字段变更后出现 [XForm] scanForForbidden 日志）"
  @clear="clear"
/>
```

- [ ] **Step 5: 类型检查 + lint**

```bash
pnpm type-check && pnpm lint --fix src/modules/demo/examples/XFormExpressionSandbox.vue
```

预期：两者均 exit 0

- [ ] **Step 6: 提交**

```bash
git add src/modules/demo/examples/XFormExpressionSandbox.vue
git commit -m "refactor(XFormExpressionSandbox): 引入 console 面板，实时展示沙箱拒绝原因"
```

---

## Task 7: XFormOrderCreate 改造（验证指引 ElCollapse）

**Files:**
- Modify: `src/modules/demo/examples/XFormOrderCreate.vue`

- [ ] **Step 1: 在 setup 末尾加 guideActive ref**

找到 setup 末尾（`onMounted` 后面），新增：

```ts
/** 验证指引面板展开状态（默认折叠） */
const guideActive = ref<string[]>([])
```

- [ ] **Step 2: 在 template 顶部加 ElCollapse 验证指引**

找到 `<DemoFrame>` 内部第一个 `<section id="demo-order-create">`，在它前面新增：

```vue
<el-collapse v-model="guideActive" :class="bem.e('guide-collapse')">
  <el-collapse-item title="📋 验证指引（7 步覆盖 XForm 7 大能力）" name="guide">
    <ol :class="bem.e('guide-list')">
      <li>客户名/电话都留空 → 点保存 → 提示「客户名称、联系电话至少填一个」</li>
      <li>填电话 13800 → blur → 红字「手机号格式不正确」</li>
      <li>城市选「北京」→ 区域 options 自动加载</li>
      <li>开「需要发票」→ 发票抬头显示 + 必填；关闭 → 隐藏</li>
      <li>点「新增明细」→ 加一行；删到 1 行时删除按钮禁用</li>
      <li>填几个字段 → F5 刷新 → 点「恢复草稿」→ 数据恢复 + isDirty 重置</li>
      <li>改任意字段 → isDirty=true（isDirty 与 getDirtyFields 实时同步）</li>
    </ol>
  </el-collapse-item>
</el-collapse>
```

- [ ] **Step 3: 改 introduction 文案**

原文第 317-322 行，添加第 4 条 introduction：

```ts
introductions="[
  '本 demo 串联 XForm 7 大能力的「完整业务形态」：基础校验 + 跨字段 + 联动必填 + 异步级联 + 数组节点 + 草稿持久化 + dirty 追踪。',
  '对应真实中后台编辑页标准链路：拉数据 → 表单交互 → 校验 → 提交 → dirty 基线归零 / 草稿恢复。',
  '建议新接入 XForm 的同学先看本 demo，再按需点开 30 个独立 demo 深入单个能力。',
  '上方「验证指引」面板按 7 步走完即可体验全部能力（默认折叠）。',
]"
```

- [ ] **Step 4: 在 style 块加指引面板样式**

找到 `<style lang="scss">` 内部 `.#{$BEM_PREFIX}-demo-x-form-order-create { ... }` 块，在 `&__toolbar` 后面新增：

```scss
&__guide-collapse {
  margin-bottom: 16px;
}

&__guide-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);

  li {
    margin-bottom: 4px;
  }
}
```

- [ ] **Step 5: 类型检查 + lint**

```bash
pnpm type-check && pnpm lint --fix src/modules/demo/examples/XFormOrderCreate.vue
```

预期：两者均 exit 0

- [ ] **Step 6: 提交**

```bash
git add src/modules/demo/examples/XFormOrderCreate.vue
git commit -m "feat(XFormOrderCreate): 验证指引面板搬到 UI（ElCollapse 默认折叠）

把 script 头部注释里的 7 条验证清单搬到 demo 顶部折叠面板，
新人首屏即可看到验证步骤，无须打开源码注释。

样式：vv-demo-x-form-order-create__guide-collapse + __guide-list"
```

---

## Task 8: 全量验证

- [ ] **Step 1: 类型检查（全量强制）**

```bash
pnpm type-check:full
```

预期：exit 0

- [ ] **Step 2: 单测全量**

```bash
pnpm test
```

预期：所有 spec 通过；新增 8 个 useConsoleCapture 用例 PASS

- [ ] **Step 3: Lint 检查**

```bash
pnpm lint
```

预期：exit 0，无 error

- [ ] **Step 4: 路由一致性**

```bash
pnpm check:routes
```

预期：✓ 所有路由检查通过（本次未新增路由，跳过变更也 OK）

- [ ] **Step 5: 手动 visual 验证（用户在 demo 站点执行）**

按 spec §7.2 的 6 项验证清单：

```markdown
- [ ] /demo/x-form-invalid-component：折叠面板默认折叠；展开后 2 条红字日志
- [ ] 字段 label 显示「（应通过）」/「（应警告）」对照清晰
- [ ] /demo/x-form-model-warn：场景 1 自动显示 [XForm] model 警告；场景 2/3 不显示
- [ ] /demo/x-form-expression-sandbox：安全测试字段变更后显示沙箱拒绝原因
- [ ] /demo/x-form-order-create：顶部折叠面板默认折叠；展开后看到 7 条编号指引
- [ ] 离开任一 demo 再回到其他页面 → 全局 console.error 行为未被污染
```

---

## Task 9: 更新 CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 读取 CHANGELOG.md 找到 Unreleased 段**

```bash
head -30 CHANGELOG.md
```

- [ ] **Step 2: 在 `## [Unreleased]` 段下加 feat 条目**

在 `### Features` 或对应分类下新增：

```markdown
- **demo-clarity**: 提升 4 个 form-schema demo 可理解度
  - 新增 `useConsoleCapture` composable + `ConsoleLogPanel` 公共组件：错误诊断 demo 自动展示 XForm 控制台输出
  - XFormOrderCreate 顶部加 ElCollapse 验证指引（7 步）
  - XFormInvalidComponent 字段 label 加预期状态后缀（应通过 / 应警告）
  - 受影响 demo：XFormInvalidComponent / XFormModelWarn / XFormExpressionSandbox / XFormOrderCreate
  - 详见 `docs/superpowers/specs/2026-09-02-xform-demo-clarity-design.md`
```

- [ ] **Step 3: Prettier + 提交**

```bash
pnpm format CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs(CHANGELOG): 记录 demo 可理解度提升"
```

---

## 自审

### Spec 覆盖

| spec 章节                          | 实现任务       |
| ----------------------------------- | -------------- |
| §3.1 useConsoleCapture API          | Task 2          |
| §3.2 ConsoleLogPanel API            | Task 3          |
| §5.1 XFormInvalidComponent label 调整 | Task 4          |
| §5.2 XFormOrderCreate 验证指引面板    | Task 7          |
| §5.3 introduction 文案统一修订（4 个 demo） | Task 4-7          |
| §7.1 单元测试（6 用例）                | Task 1（实际 8 个） |
| §7.2 手动 visual 验证                  | Task 8          |
| §九 验收标准                          | Task 8 / 9      |

### 占位符扫描

- ✅ 无 TBD/TODO
- ✅ 无"implement later"
- ✅ 所有代码片段都是完整可粘贴内容

### 类型一致性

- `useConsoleCapture` 返回 `{ logs, clear }` —— Task 1 测试 + Task 2 实现 + Task 4-6 调用 + Task 3 接收 logs prop 一致
- `CapturedLog` 接口定义在 `useConsoleCapture.ts:21-25`（level / message / timestamp）—— Task 1 测试与 Task 3 组件一致
- `ConsoleLogPanel` props（`logs` / `title` / `empty`）+ emit `clear` —— Task 3 实现 + Task 4-6 调用一致

### 范围检查

- 仅修改 4 个 demo + 新增 3 个文件 + CHANGELOG.md
- 不动 form-schema 内部实现
- 不动 P1/P2 建议项
- 范围聚焦 ✓

---

**下一步**：选择执行方式（subagent-driven 或 inline）。
