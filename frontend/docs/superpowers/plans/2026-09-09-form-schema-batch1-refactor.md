# Form-Schema 批次 1 内部重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 form-schema 校验/错误子系统的 3 份重复实现（el-form 字段错误扫描、validate Promise 包装、死代码），零公开 API 变更、零行为变更。

**Architecture:** 抽 2 个纯函数工具到 `utils/`（沿用 `read-ref-str.ts` 既有模式），3 个 composable 改为引用工具；删除死代码与 YAGNI 依赖；注释修正与 dev 计数器收敛。对应审计报告（`docs/superpowers/specs/2026-09-09-form-schema-arch-audit.md`）批次 1 的 1-1 ~ 1-6。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest + element-plus 2.14

**前置批准（src/ Architecture Lockdown §2.4）：** 本计划需新增 2 个文件 `src/components/form-schema/utils/collect-el-field-errors.ts`、`src/components/form-schema/utils/run-el-form-validate.ts`。新增理由：消除对 element-plus 内部结构（`ElFormItemContext`）的 3 份重复耦合，EP 3.0 升级时 diff 面从 3 处收敛到 1 处。回退：删除这 2 个文件并还原 import。**须用户在本计划执行前明确批准。**

---

### Task 1: 抽 `utils/collect-el-field-errors.ts`（消除 M1）

**Files:**
- Create: `src/components/form-schema/utils/collect-el-field-errors.ts`
- Test: `src/components/form-schema/utils/collect-el-field-errors.spec.ts`
- Modify: `src/components/form-schema/composables/use-form-instance.ts:115-142`
- Modify: `src/components/form-schema/composables/use-form-validation.ts:141-166, 255-276`

三处对 `ef.fields` 的 `toRaw → validateState==='error' → validateMessage → propString||prop` 扫描结构重复（审计 M1）。统一为单一工具，element-plus 3.0 升级只需改一处。

- [x] **Step 1: 写失败的工具单测**

创建 `src/components/form-schema/utils/collect-el-field-errors.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { collectElFieldErrors } from './collect-el-field-errors'

/** 构造一个模拟的 element-plus ElFormItemContext field */
function mockField(name: string, state: string, message: string, value?: unknown) {
  return {
    propString: { value: name },
    validateState: { value: state },
    validateMessage: { value: message },
    ...(value !== undefined ? { fieldValue: { value } } : {}),
  }
}

describe('collectElFieldErrors', () => {
  it('只收集 validateState=error 且有 message 的字段', () => {
    const ef = {
      fields: [
        mockField('email', 'error', '邮箱格式错误', 'abc'),
        mockField('name', 'success', ''),
        mockField('age', 'error', ''), // 无 message → 跳过
        mockField('city', 'error', '必填', 42),
      ],
    }
    const details = collectElFieldErrors(ef, { includeValue: true })
    expect(details).toEqual([
      { field: 'email', message: '邮箱格式错误', value: 'abc' },
      { field: 'city', message: '必填', value: 42 },
    ])
  })

  it('filterNames 只保留命中字段', () => {
    const ef = { fields: [mockField('email', 'error', '邮箱错误'), mockField('name', 'error', '姓名错误')] }
    const details = collectElFieldErrors(ef, { filterNames: new Set(['email']) })
    expect(details.map((d) => d.field)).toEqual(['email'])
  })

  it('不传 includeValue 时 value 字段缺省', () => {
    const ef = { fields: [mockField('email', 'error', '邮箱错误', 'abc')] }
    const details = collectElFieldErrors(ef)
    expect(details).toEqual([{ field: 'email', message: '邮箱错误' }])
  })

  it('fields 缺失 / 为空时返回空数组', () => {
    expect(collectElFieldErrors({})).toEqual([])
    expect(collectElFieldErrors({ fields: [] })).toEqual([])
  })
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/form-schema/utils/collect-el-field-errors.spec.ts`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现工具**

创建 `src/components/form-schema/utils/collect-el-field-errors.ts`：

```ts
/**
 * collectElFieldErrors —— 从 el-form fields 提取 validateState=error 的字段详情
 *
 * element-plus 的 ElFormItemContext 内部字段状态是 ref-like（propString / validateState /
 * validateMessage 可能是 string、Ref<string> 或 { value?: string }），XForm 三处调用方
 * （use-form-instance validateField / use-form-validation validateForm / validateDetail）
 * 此前各自手写同一套 toRaw + readRefStr 扫描逻辑，EP 3.0 升级需同步改 3 处。
 * 统一收敛到本工具后，升级 diff 面收敛到 1 处。
 *
 * @see types/TYPE-CAST-AUDIT.md（element-plus 内部结构属受控断言区）
 *
 * @group XForm 工具
 */
import { toRaw, type Ref } from 'vue'
import { readRefStr } from './read-ref-str'

/** 字段错误详情 —— errorBus.details / console.error 诊断输出载体 */
export interface ElFieldErrorDetail {
  field: string
  message: string
  value?: unknown
}

/** 解包 ref-like 字段值为 unknown（element-plus ElFormItemContext.fieldValue 是 ComputedRef<unknown>） */
function readRefVal(v: unknown): unknown {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object' && 'value' in v) {
    return (v as { value: unknown }).value
  }
  return v
}

/**
 * 从 el-form fields 提取 validateState=error 的字段详情
 *
 * @param ef 含 fields 数组的 el-form 实例（宽松结构签名）
 * @param opts.filterNames 可选过滤集合 —— 仅保留命中的字段名（validateField 场景）
 * @param opts.includeValue 可选 —— true 时解包 fieldValue 一并返回（诊断输出用实际值而非 ref）
 */
export function collectElFieldErrors(
  ef: { fields?: unknown[] },
  opts: { filterNames?: Set<string>; includeValue?: boolean } = {}
): ElFieldErrorDetail[] {
  const details: ElFieldErrorDetail[] = []
  for (const f of ef.fields ?? []) {
    const raw = toRaw(f) as {
      propString?: string | Ref<string>
      prop?: string | Ref<string>
      validateState?: string | Ref<string>
      validateMessage?: string | Ref<string>
      fieldValue?: unknown
    }
    if (readRefStr(raw.validateState) !== 'error') continue
    const msg = readRefStr(raw.validateMessage)
    if (!msg) continue
    const fieldName = readRefStr(raw.propString) || readRefStr(raw.prop)
    if (!fieldName) continue
    if (opts.filterNames && !opts.filterNames.has(fieldName)) continue
    details.push({
      field: fieldName,
      message: msg,
      ...(opts.includeValue ? { value: readRefVal(raw.fieldValue) } : {}),
    })
  }
  return details
}
```

> 说明：原 `use-form-instance` 版本把 `raw.fieldValue`（可能是 ComputedRef）原样放进 `value`；统一后解包为实际值。仅影响 errorBus/console 诊断输出的可读性，不改变任何校验行为。

- [x] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/form-schema/utils/collect-el-field-errors.spec.ts`
Expected: PASS（4 tests）

- [x] **Step 5: `use-form-instance.ts` 切换到工具**

删除 `use-form-instance.ts` 中本地 `collectElFieldErrors` 函数（第 115-142 行，含其 JSDoc），改为顶部 import：

```ts
import { collectElFieldErrors } from '../utils/collect-el-field-errors'
```

`validateField` 内调用点改为（原第 220 行）：

```ts
const details = collectElFieldErrors(efAny, { filterNames: new Set(targetNames), includeValue: true })
```

同时清理不再使用的 import：`toRaw`（`extractFieldName` 仍用 `toRaw`，**保留**）、`Ref` 类型（`extractFieldName` 仍用，**保留**）。如 `readRefStr` 已无其他引用则移除该 import。

- [x] **Step 6: `use-form-validation.ts` 切换到工具**

两处内联循环替换：

`validateForm` 中（原第 149-166 行）：

```ts
const details = collectElFieldErrors(ef as unknown as { fields?: unknown[] }, { includeValue: true })
```

`validateDetail` 中（原第 259-276 行）：

```ts
if (!elValid) {
  for (const d of collectElFieldErrors(ef as unknown as { fields?: unknown[] })) {
    errors.push({ keyPath: [d.field], message: d.message })
  }
}
```

顶部新增 import，删除本地 `readRefVal` / `toRawLike` 函数（grep 确认无其他引用后），清理 `toRaw`、`Ref`、`readRefStr` 的无用 import。

- [x] **Step 7: 全量回归 + 提交**

Run: `pnpm test src/components/form-schema` → Expected: 全绿
Run: `pnpm type-check:full` → Expected: 0 error

```bash
git add src/components/form-schema/utils/collect-el-field-errors.ts src/components/form-schema/utils/collect-el-field-errors.spec.ts src/components/form-schema/composables/use-form-instance.ts src/components/form-schema/composables/use-form-validation.ts
git commit -m "refactor(form-schema): 抽取 collect-el-field-errors 统一 el-form 字段错误扫描（消除 M1 三份重复）"
```

---

### Task 2: 抽 `utils/run-el-form-validate.ts`（消除 M2）

**Files:**
- Create: `src/components/form-schema/utils/run-el-form-validate.ts`
- Test: `src/components/form-schema/utils/run-el-form-validate.spec.ts`
- Modify: `src/components/form-schema/composables/use-form-validation.ts:141-145, 255-258`

- [x] **Step 1: 写失败的工具单测**

创建 `src/components/form-schema/utils/run-el-form-validate.spec.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { runElFormValidate } from './run-el-form-validate'

describe('runElFormValidate', () => {
  it('callback valid=true → resolve true', async () => {
    const efValidate = vi.fn((cb: (v: boolean) => void) => {
      cb(true)
      return Promise.resolve(true)
    })
    await expect(runElFormValidate(efValidate)).resolves.toBe(true)
  })

  it('callback valid=false → resolve false', async () => {
    const efValidate = vi.fn((cb: (v: boolean) => void) => {
      cb(false)
      return Promise.resolve(false)
    })
    await expect(runElFormValidate(efValidate)).resolves.toBe(false)
  })

  it('element-plus 即使传 callback 仍 reject errorsMap → catch 接住 resolve false', async () => {
    const efValidate = vi.fn(() => Promise.reject(new Error('validation failed')))
    await expect(runElFormValidate(efValidate as never)).resolves.toBe(false)
  })
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/form-schema/utils/run-el-form-validate.spec.ts`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现工具**

创建 `src/components/form-schema/utils/run-el-form-validate.ts`：

```ts
/**
 * runElFormValidate —— 包装 el-form.validate 的 Promise 回调双轨
 *
 * element-plus 2.x 的 validate 即使传入 callback 仍会 reject errorsMap（微任务），
 * 直接 await 会产生 unhandled rejection。统一用 Promise 包装：callback 优先 resolve，
 * reject 兜底 resolve(false)。此前 use-form-validation 两处各自手写同一模式。
 *
 * @group XForm 工具
 */

/**
 * 跑 el-form validate 并归一化为 Promise<boolean>
 *
 * @param efValidate el-form 实例的 validate 方法（调用方需先自行守卫未绑定场景）
 * @returns true=校验通过；false=校验失败或 EP reject（errorsMap 兜底）
 */
export function runElFormValidate(
  efValidate: (callback?: (valid: boolean) => void) => Promise<boolean>
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const maybePromise = efValidate((v: boolean) => resolve(v))
    // 关键：el-form 2.x 即使传 callback 仍 reject errorsMap（避免 unhandled rejection）
    Promise.resolve(maybePromise).catch(() => resolve(false))
  })
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/form-schema/utils/run-el-form-validate.spec.ts`
Expected: PASS（3 tests）

- [x] **Step 5: `use-form-validation.ts` 两处替换**

顶部新增 import：

```ts
import { runElFormValidate } from '../utils/run-el-form-validate'
```

`validateForm` 中（原第 141-145 行）：

```ts
const elValid = await runElFormValidate(efValidate)
```

`validateDetail` 中（原第 255-258 行）：

```ts
const elValid = await runElFormValidate(efValidate)
```

- [x] **Step 6: 回归 + 提交**

Run: `pnpm test src/components/form-schema/composables/use-form-validation.spec.ts` → Expected: 全绿

```bash
git add src/components/form-schema/utils/run-el-form-validate.ts src/components/form-schema/utils/run-el-form-validate.spec.ts src/components/form-schema/composables/use-form-validation.ts
git commit -m "refactor(form-schema): 抽取 run-el-form-validate 统一 el-form validate Promise 包装（消除 M2）"
```

---

### Task 3: 删除 useFormValidation 死依赖 + 合并重复守卫（消除 M4）

**Files:**
- Modify: `src/components/form-schema/composables/use-form-validation.ts:64-67, 98-107, 127-139, 286-287`
- Modify: `src/components/form-schema/composables/use-xform-composer.ts:197-207`
- Modify: `src/components/form-schema/composables/use-form-validation.spec.ts:47, 61, 74, 83`

- [x] **Step 1: 删除 deps 接口中的 crossFieldTrigger**

`use-form-validation.ts` 接口（原第 64-67 行）删除：

```ts
  /** 当前未直接使用 —— 保留以备扩展 */
  crossFieldTrigger: {
    trigger: (name: string) => void
  }
```

同步删除解构（原第 106 行 `crossFieldTrigger,`）与文件尾部（原第 286-287 行）：

```ts
  // 不直接调用 crossFieldTrigger —— 业务通过 onValueChange 显式触发 trigger
  void crossFieldTrigger
```

- [x] **Step 2: 合并 validateForm 重复守卫**

原第 127-139 行两个守卫分支体逐字重复，合并为一个（第二个检查恒等价于第一个）：

```ts
    const ef = elFormRef.value
    if (!ef?.validate) {
      // el-form 未挂载时降级只跑跨字段校验（开发场景）
      const result = await runCrossFieldValidation(reactiveSchema.value, m, rules.value)
      applyCrossErrors(result)
      scrollToFirstError(firstCrossErrorField(result))
      return result.isValid
    }
    const efValidate = ef.validate
```

- [x] **Step 3: composer 删除构造链路传参**

`use-xform-composer.ts` 第 197-207 行，`useFormValidation({...})` 调用中删除 `crossFieldTrigger,` 一行（`crossFieldTrigger` 变量本身保留 —— `useRenderRoot` 第 229 行仍在用）。

- [x] **Step 4: 同步 spec 的 mock deps**

`use-form-validation.spec.ts`：
- 删除第 47 行类型声明中的 `crossFieldTrigger: { trigger: ReturnType<typeof vi.fn> }`
- 删除第 61 行 `const crossFieldTrigger = { trigger: vi.fn() }`
- 删除第 74、83 行两处 deps 对象中的 `crossFieldTrigger,`

- [x] **Step 5: 回归 + 提交**

Run: `pnpm test src/components/form-schema/composables/use-form-validation.spec.ts src/components/form-schema/composables/use-xform-composer.spec.ts` → Expected: 全绿
Run: `pnpm type-check:full` → Expected: 0 error

```bash
git add src/components/form-schema/composables/use-form-validation.ts src/components/form-schema/composables/use-form-validation.spec.ts src/components/form-schema/composables/use-xform-composer.ts
git commit -m "refactor(form-schema): 删除 useFormValidation 死依赖 crossFieldTrigger 并合并重复守卫（M4）"
```

---

### Task 4: 删除 useFormInstance.validateForm 死代码（消除 M6）

**Files:**
- Modify: `src/components/form-schema/composables/use-form-instance.ts:81-95, 296`
- Modify: `src/components/form-schema/composables/use-form-instance.spec.ts:59-112`

该 `validateForm` 生产代码零调用方（composer 解构列表不含它，grep 已确认），与 `use-form-validation` 的 `validateForm` 同名不同语义，属维护陷阱。XFormExpose 上的 `validateForm` 来自 useFormValidation，删除后对外契约不变。

- [x] **Step 1: 删除实现**

`use-form-instance.ts`：
- 删除第 81-95 行 `validateForm` 函数（含 JSDoc）
- 第 296 行 return 对象中删除 `validateForm,`

- [x] **Step 2: 删除 spec 块**

`use-form-instance.spec.ts` 删除第 59-112 行整个 `describe('validateForm()', ...)` 块（4 个用例）。

- [x] **Step 3: grep 确认零残留**

Run: `pnpm test src/components/form-schema` → Expected: 全绿（若有遗漏调用方会编译/运行失败）
Grep: 在 `src/` 搜 `useFormInstance` 返回解构中无 `validateForm`。

- [x] **Step 4: 提交**

```bash
git add src/components/form-schema/composables/use-form-instance.ts src/components/form-schema/composables/use-form-instance.spec.ts
git commit -m "refactor(form-schema): 删除 useFormInstance.validateForm 死代码（消除与 useFormValidation.validateForm 的同名歧义，M6）"
```

---

### Task 5: composer fieldErrors watch 去 deep（消除 M3a）

**Files:**
- Modify: `src/components/form-schema/composables/use-xform-composer.ts:188`

`setFieldError` 对 `externalErrors` 的写入全部是顶层键赋值/删除（`use-set-field-error.ts:97,111`），浅 watch 即可捕获；`deep: true` 每次遍历白白增加成本（审计 M3 问题 a）。**注意：`use-set-field-error.ts:159-191` 内部的 deep watch 是路径 B 守护必需，不能动。**

- [x] **Step 1: 修改 watch**

`use-xform-composer.ts` 第 188 行：

```ts
  // 浅 watch 即可：setFieldError 对 externalErrors 的写入均为顶层键赋值/删除，
  // 无需 deep 遍历（deep watch 保留在 use-set-field-error 的路径 B 守护内）
  watch(fieldErrors, () => triggerRender())
```

- [x] **Step 2: 回归 + 提交**

Run: `pnpm test src/components/form-schema/composables/use-xform-composer.spec.ts src/components/form-schema/composables/use-schema-renderer.spec.ts` → Expected: 全绿

```bash
git add src/components/form-schema/composables/use-xform-composer.ts
git commit -m "perf(form-schema): composer fieldErrors watch 去 deep（写入均为顶层键变更，M3a）"
```

---

### Task 6: 修 render-form-item 过时注释 + dev 计数器收敛（M7 + L3）

**Files:**
- Modify: `src/components/form-schema/composables/render-form-item.ts:70-72`
- Modify: `src/components/form-schema/composables/use-dev-runtime.ts`（新增导出的 dev 计数函数）
- Modify: `src/components/form-schema/composables/use-schema-renderer.ts:111-115`

- [x] **Step 1: 修正过时注释**

`render-form-item.ts` 第 70-72 行注释声称"不直接修改 elForm.fields[i]"，但 `use-set-field-error.ts:132-203` 的路径 B watch 守护恰恰直接写字段内部 ref。改为：

```ts
  // 阶段 3.1：走 element-plus 官方 props 路径（error + validateStatus）触发 el-form-item 红字。
  // 注意：双路径设计 —— 本文件是路径 A（props 驱动）；
  // 路径 B（直接写 elForm.fields[i] 内部 validateState/validateMessage ref）存在于
  // @see ./use-set-field-error.ts 的 watch 守护（guardField），用于纠正 EP 内部状态机漂移。
  // 两条路径互补，删除任一条前必读 use-set-field-error.ts 文件头说明。
```

- [x] **Step 2: use-dev-runtime 导出计数函数**

`use-dev-runtime.ts` 文件底部（`installDevDebugHook` 之后）新增模块级函数：

```ts
// ────────────────────────────────────────────────────────────────────────────
// dev 计数器 —— 收敛散落的 window 调试副作用（use-schema-renderer 的 triggerRender 计数）
// ────────────────────────────────────────────────────────────────────────────

/** 记录一次 triggerRender 调用（window.__triggerRenderCalled，dev only，prod 零开销） */
export function trackTriggerRender(): void {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __triggerRenderCalled?: number }
  w.__triggerRenderCalled = (w.__triggerRenderCalled ?? 0) + 1
}
```

- [x] **Step 3: use-schema-renderer 改调计数函数**

`use-schema-renderer.ts`：
- 顶部新增 import：`import { trackTriggerRender } from './use-dev-runtime'`
- `triggerRender` 内（原第 111-115 行）替换为：

```ts
    triggerRender: () => {
      trackTriggerRender()
      reactiveSchema.value = { ...reactiveSchema.value } as SchemaNode | SchemaNode[]
    },
```

- [x] **Step 4: 回归 + 提交**

Run: `pnpm test src/components/form-schema` → Expected: 全绿
Run: `pnpm type-check:full` → Expected: 0 error

```bash
git add src/components/form-schema/composables/render-form-item.ts src/components/form-schema/composables/use-dev-runtime.ts src/components/form-schema/composables/use-schema-renderer.ts
git commit -m "docs(form-schema): 修正 render-form-item 双路径过时注释；dev 计数器收敛至 use-dev-runtime（M7+L3）"
```

---

### Task 7: 批次 1 收尾验收

- [x] **Step 1: 全量验证**

```bash
pnpm test                # 52 spec + 2 test-d 全绿（新增 2 个 util spec 后为 54 spec）
pnpm type-check:full     # 0 error
pnpm check:doc-currency  # 文档硬数据一致
pnpm lint                # 无新增 warning
```

- [x] **Step 2: 手动过核心 demo 流程（审计 §5.3）**

1. `/demo/xform-cross-field`：保存触发红字 + OSD toast 正常
2. `/demo/xform-server-error`：422 错误映射红字正常
3. `/demo/xform-reaction`：字段联动正常
4. validate / validateDetail / validateField 三条校验路径各触发一次，OSD 与红字表现与改动前一致

- [x] **Step 3: 同步 CHANGELOG.md**

按项目约束 #12 追加批次 1 变更记录（`refactor`/`perf` 段落）。

- [x] **Step 4: 输出合规简报**

附「本次对 src/ 的所有写操作清单」（§2.5）：2 新增 + 6 修改文件清单，供用户复核。

---

## 后续批次（本计划范围外，另行立项）

| 批次 | 内容 | 立项前置条件 |
| --- | --- | --- |
| 批次 2-1 | 修 useCrossFieldTrigger 嵌套 diff 失效（H3） | 先跑审计 §5.2 手动验证确认行为 |
| 批次 2-2 | standalone disabled/readonly/hidden 函数形态求值 or 收窄 README 承诺（H1） | 先跑审计 §5.1 手动验证确认行为 |
| 批次 2-3 | composer 改用 createExpressionScope 实例级沙箱（H2） | 需多 XForm 同页 demo 验证污染场景 |
| 批次 3-2 | 抽 walkSchema 公共遍历器（M5） | 建议在 EP 3.0 升级前完成 |
| 批次 3-1/3-3/3-4 | triggerRender 细粒度 / 守护 watcher 合并 / errorBus 窗口语义 | 需真实大表单性能数据 |

---

## 自检记录（writing-plans Self-Review）

- **Spec 覆盖**：审计批次 1 的 1-1~1-6 逐条映射 Task 1~6（1-1=M1→Task 1；M2→Task 2；1-2=M4→Task 3；1-3=M6→Task 4；1-4=M3a→Task 5；1-5+1-6=M7+L3→Task 6），验收含审计 §5.3 回归。无缺口。
- **占位符扫描**：无 TBD/TODO，所有代码步骤含完整代码与精确行号。
- **类型一致性**：`collectElFieldErrors(ef, opts?)` / `runElFormValidate(efValidate)` / `trackTriggerRender()` 三个新符号在定义与全部调用点签名一致；`ElFieldErrorDetail` 唯一命名。
