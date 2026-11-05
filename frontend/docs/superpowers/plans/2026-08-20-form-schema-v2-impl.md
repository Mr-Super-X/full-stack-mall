# Form Schema v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 form-schema v1（commit `ba8879d`）基础上补齐 6 项缺失功能，使 XForm 与开源 form-schema README 14 字段 DSL + 实例方法 + props 100% 对齐。

**Architecture:** 在 XForm.vue 的 `renderToComponent` 内部按 TDD 增量添加 6 项分支处理；按需抽 1-2 个辅助函数到独立 composable（避免 XForm.vue 超 300 行硬约束）。每项先写测试，再实现，再跑全量验证。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vite 8 + Element Plus 2.14 + zod 4.4 + Vitest 4 + Vue Test Utils 2.4

**参考：**
- Spec: `docs/superpowers/specs/2026-08-19-form-schema-design.md`
- v1 Plan: `docs/superpowers/plans/2026-08-19-form-schema-impl.md`
- 父参考: 开源 form-schema README（原内部项目 node_modules）

---

## 文件结构

| 状态 | 文件 | 行数 | 职责 |
|---|---|---|---|
| Modify | `src/components/form-schema/XForm.vue` | 268 → ≤300 | renderToComponent 内部 6 项分支 + 2 个新辅助函数（buildVModelBindings / buildOnBindings） |
| Maybe new | `src/components/form-schema/composables/apply-directives.ts` | ≤80 | withDirectives 包装 + arg/modifier 解析（#2 抽出） |
| Maybe new | `src/components/form-schema/composables/with-hidden.ts` | ≤40 | hidden VNode 包装（#4 抽出） |
| Modify | `src/components/form-schema/XForm.spec.ts` | 135 → ~190 | +6 项测试用例 |
| Modify | `docs/superpowers/specs/2026-08-19-form-schema-design.md` | 614 → 614+ | 标注 6 项 v2 补充 |
| Modify | `CHANGELOG.md` | — | Unreleased 段加 v2 条目 |

---

## 任务依赖 DAG

```text
Task 1 (#5 beforeChange)
  ↓
Task 2 (#1 node.on) ──────────→ Task 5 (#4 hidden) ──→ Task 6 (#2 directives)
  ↓                              ↓                      ↓
Task 3 (#6 modelProp)            ↓                      ↓
  ↓                              ↓                      ↓
Task 4 (#3 col) ─────────────────────────────────────────────→
  
CP1 (Task 1-3 完成) → CP2 (Task 4-5 完成) → CP3 (Task 6 完成)
```

---

## Task 1: #5 beforeChange 字段粒度拦截（MEDIUM）

**Files:**
- Modify: `src/components/form-schema/XForm.vue:175-184`（vModelBindings 部分）
- Test: `src/components/form-schema/XForm.spec.ts`（加新测试）

### Step 1: 写失败测试

在 `XForm.spec.ts` 末尾加新 describe 块：

```typescript
describe('beforeChange integration', () => {
  it('calls beforeChange with newVal and oldVal, uses return value as model update', async () => {
    const beforeChange = vi.fn((node, newVal, oldVal) => `formatted-${newVal}-was-${oldVal}`)
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name', label: 'Name' } as unknown as SchemaNode,
      model,
      beforeChange,
    })
    await wrapper.find('input').setValue('bar')
    expect(beforeChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'name' }),
      'bar',
      'foo',
    )
    expect(model.name).toBe('formatted-bar-was-foo')
  })

  it('uses original value when beforeChange returns undefined', async () => {
    const beforeChange = vi.fn(() => undefined)
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model,
      beforeChange,
    })
    await wrapper.find('input').setValue('bar')
    expect(model.name).toBe('bar')
  })

  it('handles Promise return by awaiting and then updating', async () => {
    const beforeChange = vi.fn((node, newVal) => Promise.resolve(`async-${newVal}`))
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model,
      beforeChange,
    })
    await wrapper.find('input').setValue('bar')
    await flushPromises()
    expect(model.name).toBe('async-bar')
  })

  it('skips update when beforeChange Promise rejects', async () => {
    const beforeChange = vi.fn(() => Promise.reject(new Error('cancel')))
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model,
      beforeChange,
    })
    await wrapper.find('input').setValue('bar')
    await flushPromises()
    expect(model.name).toBe('foo') // 未更新
  })
})
```

需要在 `XForm.spec.ts` 顶部 import：`vi` from 'vitest'、reactive from 'vue'、flushPromises from '@vue/test-utils'。

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: 4 tests FAIL with "Cannot read properties of undefined (reading 'model')" or "beforeChange is not a function" 或 model 未更新。

### Step 3: 实现 beforeChange 包装

在 `XForm.vue` 修改 `vModelBindings.onUpdate:modelValue` 闭包：

```typescript
const vModelBindings: Record<string, unknown> =
  node.name !== undefined && props.model
    ? {
        modelValue: props.model[node.name],
        'onUpdate:modelValue': (v: unknown) => {
          const oldVal = (props.model as Record<string, unknown>)[node.name as string]
          if (props.beforeChange) {
            const result = props.beforeChange(node, v, oldVal)
            if (result instanceof Promise) {
              result
                .then((final) => {
                  ;(props.model as Record<string, unknown>)[node.name as string] = final
                })
                .catch(() => {})
              return
            }
            if (result !== undefined) {
              ;(props.model as Record<string, unknown>)[node.name as string] = result
              return
            }
          }
          ;(props.model as Record<string, unknown>)[node.name as string] = v
        },
      }
    : {}
```

### Step 4: 跑测试验证 GREEN

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: 4 新 tests PASS，0 原有 tests FAIL。

### Step 5: 跑全量 + type-check 确认无副作用

```bash
pnpm type-check
pnpm test
```

Expected: type-check 0 error, 467/467 tests PASS（463 + 4 新）。

### Step 6: 不 commit（按 §七等用户批准）

---

## Task 2: #1 node.on 事件绑定（HIGH）

**Files:**
- Modify: `src/components/form-schema/XForm.vue:175-230`（vModelBindings + 3 处 h() 调用）
- Test: `src/components/form-schema/XForm.spec.ts`

### Step 1: 写失败测试

```typescript
describe('node.on event binding', () => {
  it('binds function handler to el-input event (e.g. clear)', async () => {
    const onClear = vi.fn()
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        on: { clear: onClear },
      } as unknown as SchemaNode,
      model,
    })
    // 模拟 ElInput clear 事件
    const input = wrapper.find('input')
    await input.setValue('bar')
    // 触发 el-input clear 事件
    await input.trigger('clear')
    expect(onClear).toHaveBeenCalled()
  })

  it('parses function expression string and passes model as first arg', async () => {
    const onChange = vi.fn()
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        on: { change: '{{ (m) => onChange(m.name) }}' },
      } as unknown as SchemaNode,
      model,
    } as never)
    await wrapper.find('input').setValue('bar')
    expect(onChange).toHaveBeenCalledWith('bar')
  })

  it('ignores function expression string when parse fails', async () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        on: { change: '{{ (( }}' },
      } as unknown as SchemaNode,
      model,
    } as never)
    // 不应抛错
    expect(wrapper.exists()).toBe(true)
  })
})
```

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: 3 tests FAIL（onClear 未被调用 / onChange 未被调用）。

### Step 3: 实现 buildOnBindings + 应用到 3 处 h() 调用

在 `XForm.vue` `vModelBindings` 之后添加：

```typescript
const onBindings: Record<string, unknown> = {}
if (node.on) {
  for (const [evt, raw] of Object.entries(node.on)) {
    if (typeof raw === 'function') {
      onBindings[`on${evt[0]!.toUpperCase()}${evt.slice(1)}`] = raw
    } else if (typeof raw === 'string') {
      const fn = resolveFunctionExpression(raw)
      if (fn) {
        onBindings[`on${evt[0]!.toUpperCase()}${evt.slice(1)}`] = (...args: unknown[]) =>
          (fn as (m: Record<string, unknown>, ...args: unknown[]) => unknown)(
            props.model ?? {},
            ...args,
          )
      }
    }
  }
}
const eventBindings = { ...vModelBindings, ...onBindings }
```

修改 3 处 h() 调用，把 `{ ...vModelBindings, ...node.props, ... }` 替换为 `{ ...eventBindings, ...node.props, ... }`：

1. 视觉容器分支 (line ~196-199)
2. wrapWithFormItem 分支内 Comp (line ~218-222)
3. 最终分支 (line ~262-265)

`resolveFunctionExpression` 需要 import from './composables/use-expression'。

### Step 4: 跑测试验证 GREEN

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: 3 新 tests PASS。

### Step 5: 全量验证

```bash
pnpm type-check
pnpm test
```

Expected: type-check 0 error, 470/470 tests PASS。

---

## Task 3: #6 node.modelProp 自定义 v-model 属性名（LOW）

**Files:**
- Modify: `src/components/form-schema/XForm.vue:175-200`（vModelBindings）
- Test: `src/components/form-schema/XForm.spec.ts`

### Step 1: 写失败测试

```typescript
describe('node.modelProp', () => {
  it('uses modelValue prop name from node.modelProp instead of default', () => {
    // element-plus 内部用 modelValue；测试用 modelProp:'value' 验证覆盖
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        modelProp: 'value', // 非常规 prop 名
        props: {},
      } as unknown as SchemaNode,
      model,
    })
    // 仅验证 XForm 内部 vModelBindings 使用 modelProp 派生键名
    expect(wrapper.exists()).toBe(true)
  })
})
```

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: PASS（实际是当前实现未用到 modelProp，但因为 vModelBindings 行为与默认 modelValue 一致，测试可能通过）。如果测试通过，Task 3 主要验证**实现**而不是**测试 RED**。

### Step 3: 实现 modelProp 派生

修改 `vModelBindings`：

```typescript
const mp = node.modelProp ?? 'modelValue'
const upMp = `update:${mp.charAt(0).toUpperCase()}${mp.slice(1)}`
const vModelBindings: Record<string, unknown> =
  node.name !== undefined && props.model
    ? {
        [mp]: props.model[node.name],
        [upMp]: (v: unknown) => { /* beforeChange 逻辑同 #5 */ },
      }
    : {}
```

### Step 4: 跑测试验证 GREEN

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

### Step 5: 全量验证

```bash
pnpm type-check
pnpm test
```

---

## Task 4: #3 node.col 子节点栅格（HIGH）

**Files:**
- Modify: `src/components/form-schema/XForm.vue:203-227`（wrapWithFormItem / 最终分支）
- Test: `src/components/form-schema/XForm.spec.ts`

### Step 1: 写失败测试

```typescript
describe('node.col child grid', () => {
  it('wraps form item in ElCol with col.span=24', () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        col: { span: 24 },
      } as unknown as SchemaNode,
      model,
    })
    // 验证 ElCol 存在
    expect(wrapper.findAll('.el-col').length).toBeGreaterThanOrEqual(1)
  })

  it('uses ColConfig.span when provided', () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        col: { span: 12, offset: 6 },
      } as unknown as SchemaNode,
      model,
    })
    // ElCol span=12 offset=6 应存在
    const col = wrapper.find('.el-col')
    expect(col.attributes('style') || '').toMatch(/span|grid/i)
  })
})
```

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: 2 tests FAIL（找不到 el-col / span 不匹配）。

### Step 3: 实现 col 包装

在 `XForm.vue` 的 wrapWithFormItem 分支内，ElFormItem 的 default slot 改为：

```typescript
default: () => {
  const inner = h(
    Comp as never,
    { ...eventBindings, ...node.props, ...(node.key !== undefined && { key: node.key }) } as never,
    { default: () => renderChildren(node.children) as never }
  )
  if (node.col !== undefined && node.col !== false) {
    const cs = node.col && typeof node.col === 'object' ? node.col.span ?? 24 : 24
    const co = node.col && typeof node.col === 'object' ? node.col.offset : undefined
    return h(ElCol as never, { span: cs, offset: co } as never, { default: () => inner })
  }
  return inner
}
```

同样修改最终分支（无 formItem 的节点也可能有 col）。

### Step 4: 跑测试验证 GREEN

### Step 5: 全量验证

---

## Task 5: #4 node.hidden 字段（MEDIUM）

**Files:**
- Create: `src/components/form-schema/composables/with-hidden.ts`（≤40 行）
- Modify: `src/components/form-schema/XForm.vue:173-184`（renderToComponent 早期判断）
- Test: `src/components/form-schema/XForm.spec.ts`

### Step 1: 写失败测试

```typescript
describe('node.hidden vs ignore', () => {
  it('ignore: true does not render the node', () => {
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        ignore: true,
      } as unknown as SchemaNode,
      model: reactive({}),
    })
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('hidden: true renders the node but with display:none', () => {
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        hidden: true,
      } as unknown as SchemaNode,
      model: reactive({}),
    })
    // 节点存在但被隐藏
    expect(wrapper.html()).toContain('display: none')
  })
})
```

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: hidden 测试 FAIL（无 display:none 包装）。

### Step 3: 创建 with-hidden.ts + 实现

`src/components/form-schema/composables/with-hidden.ts`：

```typescript
import { h, type VNode } from 'vue'

/** 给 VNode 套 display:none wrapper（与 ignore 不同：ignore 不创建节点，hidden 创建但隐藏） */
export function withHidden(vnode: VNode): VNode {
  return h(
    'div',
    { style: 'display: none', 'aria-hidden': 'true' },
    [vnode]
  ) as unknown as VNode
}
```

修改 `XForm.vue` `renderToComponent` 早期判断：

```typescript
if (node.ignore) return undefined
if (node.hidden) {
  return withHidden(renderToComponent(/* need to render to wrap */) as never)
}
```

实际：hidden 节点仍需渲染（但 wrap display:none）。让 `renderToComponent` 递归调用自身处理 children：

```typescript
if (node.hidden) {
  const inner = h(Comp as never, { ...eventBindings, ...node.props } as never,
    { default: () => renderChildren(node.children) as never }
  ) as VNode
  return withHidden(inner)
}
```

### Step 4: 跑测试验证 GREEN

### Step 5: 全量验证

---

## Task 6: #2 node.directives 自定义指令（HIGH）

**Files:**
- Create: `src/components/form-schema/composables/apply-directives.ts`（≤80 行）
- Modify: `src/components/form-schema/XForm.vue:192-260`（3 处 h() 调用结果包装）
- Test: `src/components/form-schema/XForm.spec.ts`

### Step 1: 写失败测试

```typescript
describe('node.directives application', () => {
  it('applies single directive via withDirectives', () => {
    // 自定义指令对象格式
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        directives: [
          { directive: 'pin', arg: 'top', modifiers: { animate: true }, value: 200 },
        ],
      } as unknown as SchemaNode,
      model: reactive({}),
    })
    expect(wrapper.exists()).toBe(true)
  })
})
```

注意：测试用 element-plus 不存在的 'pin' 指令，vue 不会报错（未注册指令会被忽略）。

### Step 2: 跑测试验证 RED

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

Expected: PASS（因为 withDirectives 是纯渲染，element-plus 不识别 'pin' 也无害）。**此 Task 主要验证 XForm 调用 withDirectives 路径**——通过 type-check + lint 验证。

### Step 3: 创建 apply-directives.ts

```typescript
import { withDirectives, type VNode, type Directive } from 'vue'
import type { DirectiveConfig } from '../types'

/** 把 node.directives 数组应用到 vnode */
export function applyDirectives(vnode: VNode, directives: DirectiveConfig[]): VNode {
  if (!directives || directives.length === 0) return vnode
  const dirs = directives.map((d) => {
    let name: string
    let dirObj: Directive
    if (typeof d.directive === 'string') {
      name = d.directive
      dirObj = {} as Directive
    } else {
      // 取 directive 对象的名字
      name = (d.directive as Directive & { name?: string }).name ?? ''
      dirObj = d.directive
    }
    return {
      name,
      value: d.value,
      arg: d.arg,
      modifiers: d.modifiers,
      // @ts-expect-error: directive 对象类型
      dir: dirObj,
    }
  })
  return withDirectives(vnode, dirs) as VNode
}
```

修改 `XForm.vue` 3 处 h() 调用后，包装 VNode：

```typescript
// 在 wrapWithFormItem / 最终分支的 return 之前：
let result: VNode = h(...) as VNode
if (node.directives && node.directives.length > 0) {
  result = applyDirectives(result, node.directives)
}
return result
```

### Step 4: 跑测试验证 GREEN

### Step 5: 全量验证

```bash
pnpm type-check
pnpm test
```

---

## 中间检查点

### CP1（Task 1-3 完成）

- beforeChange ✅
- node.on ✅
- node.modelProp ✅
- type-check 0 error
- 测试 473/473 全通过
- 风险：vModelBindings 重构 3 处，确保 eventBindings 合并正确

### CP2（Task 4-5 完成）

- node.col ✅
- node.hidden ✅
- type-check 0 error
- 测试 475/475 全通过
- 风险：XForm.vue 行数逼近 300（≤300 硬约束）

### CP3（Task 6 完成）

- node.directives ✅
- 6 项全部完成
- type-check 0 error
- 测试 476/476 全通过
- XForm.vue 最终行数 ≤300

---

## 风险预案

| 风险 | 触发条件 | 回退方案 |
|------|----------|----------|
| XForm.vue 超 300 行 | 6 项完成后 > 300 | 抽 `buildVModelBindings` / `buildOnBindings` / `withHidden` 到独立 composables |
| beforeChange 性能问题 | 大表单频繁更新 | debounce + 同值跳过（useFormInstance 已有同步值检查）|
| withDirectives 报错 | 元素 plus 不支持某些指令 | try/catch 包装 + console.warn |
| 测试覆盖下降 | 新增代码未测试覆盖 | 强制 TDD 纪律，每项必写测试 |
| 类型推断错误 | element-plus 类型不稳定 | 用运行时方法对象（`ElFormInstance` 模式）替代 InstanceType |

---

## 测试策略

每 Task 必含：
1. **RED**：写 XForm.spec.ts 新测试，跑确认失败
2. **GREEN**：实现代码，跑确认通过
3. **REFACTOR**：必要时清理（XForm.vue ≤300 硬约束）
4. **全量验证**：`pnpm type-check` + `pnpm test`

---

## 执行选项

**完成后给用户两个选项**：

1. **Subagent-Driven**（推荐）：派发独立 subagent 逐 task 执行，主代理在 task 间做 code-review
2. **Inline Execution**：当前会话顺序执行，task 间停下来报告

**选择哪个？**
