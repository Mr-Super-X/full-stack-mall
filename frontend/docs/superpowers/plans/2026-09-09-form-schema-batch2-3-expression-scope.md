# Form-Schema 批次 2-3 实施计划（H2 表达式沙箱实例级化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 H2 —— 表达式沙箱白名单函数表是模块级共享状态导致同页多 XForm 实例互相污染（浏览器实测已于 2026-09-09 确认三种污染形态，证据见审计 §2.1 H2「验证」行补录）。composer 全面改用 per-instance `createExpressionScope()`，模块级 API 保留但标 `@deprecated`。

**浏览器验证结论（阶段 A，已完成）：**
1. B mount 覆盖模块表 → A 的 `{{ tag() }}` 重算后显示 from-B ✅
2. A unmount 触发 onScopeDispose 清表 → B 的表达式重算 ReferenceError（控制台实证）✅
3. A 重挂载覆盖模块表 → B 显示 from-A ✅

**Architecture:**
- **核心改动**：`use-xform-composer.ts` 持有 `const exprScope = createExpressionScope()`（setup 顶部，先于 useSchemaRenderer），所有表达式消费点从「模块级 import」改为「scope 注入透传」：
  - `useTopLevelFields` —— 接缝现成（deps 已有 `resolveFunctionExpression` 参数），composer 改传 `exprScope.resolveFunctionExpression`
  - reaction 管线：`use-schema-renderer.ts`(options 加参) → `traverse` → `applyReactions`(第 5 可选参，递归透传 children/slots/array) → `apply-reaction-fields.ts`(第 4 可选参，缺省回退模块级保持向后兼容)
  - render 层：`use-render-root.ts`(deps 加参 → renderOpts) → `render-schema-node.ts`(RenderSchemaNodeOptions 加参；`buildOnBindings` 第 3 可选参 + `resolvePermission` opts 加参) → `render-form-item.ts`(透传)
  - `use-expression-functions.ts` —— 改操作注入 scope（deps 加 `scope: ExpressionScope`），删除模块级写入与 onScopeDispose 清表（scope 随实例 GC，无需清理）
- **模块级 API 处置**：`index.ts` re-export 的 `resolveFunctionExpression`/`setExpressionFunctions` 保留并标 `@deprecated`（对外公共 API，直接删除是 breaking change；审计 §3 批次 2-3 允许二选一）

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest + lodash-es

**前置批准（src/ Architecture Lockdown §2.4）：** 本计划**零新增 / 零删除 / 零移动文件**（计划文档自身在 docs/ 除外），全部修改落在既有文件内。

---

### Task 1: useExpressionFunctions scope 注入（TDD）

**Files:**
- Modify: `src/components/form-schema/composables/use-expression-functions.ts`（签名 + 实现）
- Modify: `src/components/form-schema/composables/use-expression-functions.spec.ts`（重写 spec 适配新契约）

- [x] **Step 1: 重写 spec（先失败）**

新契约测试（fake scope 直接观察）：

```ts
/**
 * useExpressionFunctions 单元测试
 *
 * 覆盖（H2 修复后契约）：
 * - immediate: true —— 同步写入注入的 ExpressionScope
 * - watch 触发：getter 返回新对象时重新写入 scope
 * - scope 隔离：A/B 实例各自写各自 scope，互不感知（不再污染模块级表）
 * - 无 onScopeDispose 清表：scope 随实例 GC，停止实例不应再有任何写入
 *
 * 设计：fake ExpressionScope（setExpressionFunctions 用 vi.fn 观察），
 * 直接断言「写入的是哪个 scope」—— 这是 H2 修复的核心契约。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { ExpressionScope } from './use-expression'
import { useExpressionFunctions } from './use-expression-functions'

/** 造一个 fake ExpressionScope：setExpressionFunctions 可观察，resolve 行为不重要 */
function makeFakeScope() {
  const setExpressionFunctions = vi.fn()
  return {
    scope: {
      setExpressionFunctions,
      resolveFunctionExpression: () => null,
    } as unknown as ExpressionScope,
    setExpressionFunctions,
  }
}

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useExpressionFunctions / 立即注册（H2：写入注入 scope）', () => {
  it('immediate: true —— 同步调用注入 scope.setExpressionFunctions(fns)', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const fns = { greet: (s: string) => `hi ${s}` }
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => fns })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(fns)
  })

  it('getter 返回 undefined → scope.setExpressionFunctions(undefined)', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => undefined })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(undefined)
  })
})

describe('useExpressionFunctions / watch 触发（H2）', () => {
  it('getter 返回新对象 → nextTick 后 scope 被再次写入（新对象）', async () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const oldFns = { v: () => 'old' }
    const newFns = { v: () => 'new' }
    const currentRef = ref(oldFns)
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => currentRef.value })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(oldFns)

    currentRef.value = newFns
    await nextTick()
    expect(setExpressionFunctions).toHaveBeenCalledTimes(2)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(newFns)
  })

  it('getter 连续返回相同对象 → 不重复写入', async () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const stable = { v: () => 'stable' }
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => stable })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    await nextTick()
    await nextTick()
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
  })
})

describe('useExpressionFunctions / 多实例隔离（H2 核心回归）', () => {
  it('A/B 实例各自写各自 scope：B 注册后 A 的 scope 不被二次触碰', () => {
    const a = makeFakeScope()
    const b = makeFakeScope()
    const scopeA = effectScope()
    const scopeB = effectScope()
    scopeA.run(() => {
      useExpressionFunctions({ scope: a.scope, expressionFunctions: () => ({ fromA: () => 'A' }) })
    })
    scopeB.run(() => {
      useExpressionFunctions({ scope: b.scope, expressionFunctions: () => ({ fromB: () => 'B' }) })
    })
    // 每个 scope 各写一次（immediate），互不知道对方存在
    expect(a.setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(b.setExpressionFunctions).toHaveBeenCalledTimes(1)
    scopeA.stop()
    scopeB.stop()
  })

  it('scope.stop() 不再产生任何写入（无 onScopeDispose 清表；旧模块级清表是 H2 污染源）', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const inner = effectScope()
    inner.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => ({ f: () => 1 }) })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    inner.stop()
    // 关键断言：停止后调用次数不增加（旧实现会追加一次 undefined 清表调用）
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm test src/components/form-schema/composables/use-expression-functions.spec.ts`
Expected: **FAIL（编译错误也算失败）** —— `UseExpressionFunctionsDeps` 无 `scope` 字段。

- [x] **Step 2: 实现 scope 注入**

`use-expression-functions.ts` 整体替换（去掉模块级 import 与 onScopeDispose）：

```ts
/**
 * useExpressionFunctions —— 表达式沙箱白名单函数表生命周期管理（H2：实例级 scope）
 *
 * watch props.expressionFunctions → 写入**注入的 ExpressionScope**（非模块级表）。
 * immediate: true 保证 setup 期同步注册一次（首屏 {{ fn }} 表达式可用）。
 *
 * 为什么无 onScopeDispose 清理：scope 是 per-instance 对象（composer 持有），
 * 组件卸载后随闭包 GC；旧实现清模块表正是 H2 污染源（A 卸载毁掉 B 的注册）。
 *
 * @see ./use-expression.ts ExpressionScope / createExpressionScope —— 实例级沙箱工厂
 * @see ../types/xform.ts XFormProps.expressionFunctions —— 业务入参契约
 *
 * @group 表单编排：表达式
 */
import { watch } from 'vue'

import type { ExpressionScope } from './use-expression'

/** useExpressionFunctions 入参 */
export interface UseExpressionFunctionsDeps {
  /** H2：目标 scope（composer 用 createExpressionScope() 创建，每实例一份） */
  scope: ExpressionScope
  /** getter 形式：props.expressionFunctions 可能在运行时改变（demo 模式切换等） */
  expressionFunctions: () => Record<string, (...args: never[]) => unknown> | undefined
}

/**
 * 注册白名单到实例级 scope（副作用函数，不返回值）
 *
 * 用法：useExpressionFunctions({ scope, expressionFunctions: () => props.expressionFunctions })
 */
export function useExpressionFunctions(deps: UseExpressionFunctionsDeps): void {
  // 类型归因：XFormProps.expressionFunctions 的 Record<string, Function> 与 fns 表签名
  // （Record<string, (...args: never[]) => unknown>）变参约束不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；
  // 运行时已验证沙箱执行无越界，TS 层用 as never 兜底。
  watch(
    () => deps.expressionFunctions(),
    (fns) => deps.scope.setExpressionFunctions(fns as never),
    { immediate: true }
  )
}
```

Run: `pnpm test src/components/form-schema/composables/use-expression-functions.spec.ts`
Expected: PASS

- [x] **Step 3: 全量回归该文件相关**

```bash
pnpm test src/components/form-schema/composables/use-expression-functions.spec.ts
pnpm test src/components/form-schema/composables/use-expression.spec.ts
```

---

### Task 2: composer 接线 + composer spec H2 回归（TDD）

**Files:**
- Modify: `src/components/form-schema/composables/use-xform-composer.ts`（scope 创建 + 三处下传 + 注释更新）
- Modify: `src/components/form-schema/composables/use-xform-composer.spec.ts`（:224-242 旧测试替换为双实例隔离回归）

- [x] **Step 1: composer spec —— 替换模块级断言为 H2 双实例隔离回归（先失败）**

将 `use-xform-composer.spec.ts` 224-242 行的 `it('expressionFunctions 透传到 setExpressionFunctions —— scope dispose 前可调用', ...)` 整体替换为：

```ts
  it('H2 回归：同页两个 composer 实例的 expressionFunctions 互不污染', async () => {
    // 实例 A 注册 double，实例 B 注册 triple；B 的 setup 不得覆盖 A 的函数表
    const schema = [{ component: 'Input', name: 'a' }]
    const mountA = mount({
      schema,
      model: reactive({ a: '' }),
      expressionFunctions: { tag: () => 'from-A' },
    } as unknown as XFormProps)
    const mountB = mount({
      schema,
      model: reactive({ a: '' }),
      expressionFunctions: { tag: () => 'from-B' },
    } as unknown as XFormProps)

    await nextTick()
    // A 的表达式求值仍用 A 的 fns（修复前 B 的 immediate 注册会覆盖模块表，A 重算后变 from-B）
    expect(evaluateTagThroughComposerA(mountA)).toBe('from-A')

    mountA.scope.stop()
    await nextTick()
    // A 卸载后 B 的表达式仍可用（修复前 A 的 onScopeDispose 清表会毁掉 B）
    expect(evaluateTagThroughComposerB(mountB)).toBe('from-B')

    mountB.scope.stop()
  })
```

其中求值辅助走 dev debug hook / reactiveSchema 上的 reaction 断言 —— **实施时以「渲染后 node.label 求值」或 `composer.exposed` 可达路径为准做最小可行断言**（composer spec 的 mount helper 返回 `{ composer, scope }`，具体求值路径实现时确认，不引入新依赖）。

Run: `pnpm test src/components/form-schema/composables/use-xform-composer.spec.ts`
Expected: **FAIL** —— 当前 composer 仍写模块级表，B 的 immediate 注册覆盖 A。

- [x] **Step 2: composer 实现接线**

`use-xform-composer.ts`：

1. import 改：`import { createExpressionScope } from './use-expression'`（替换 `resolveFunctionExpression` 模块级 import）
2. setup 顶部（errorBus 之后、useExpressionFunctions 处）：

```ts
  // H2 修复：表达式沙箱实例级化 —— 每实例独立函数表 + 编译缓存，
  // 消除「同页多 XForm 共享模块级表互相覆盖/清表」污染（审计 2026-09-09 浏览器实测确认）
  const exprScope = createExpressionScope()
```

3. `useExpressionFunctions({ scope: exprScope, expressionFunctions: () => props.expressionFunctions })`
4. useTopLevelFields 注入：`resolveFunctionExpression: exprScope.resolveFunctionExpression`
5. useSchemaRenderer 调用处加：`...(props 恒有 scope ? { resolveFunctionExpression: exprScope.resolveFunctionExpression } : {})` —— 该 option 为可选，直接条件展开或裸传（类型为可选时可裸传，exactOptionalPropertyTypes 下若类型是 `?: fn | undefined` 可裸传；实施时按 use-schema-renderer 的 option 类型定）
6. useRenderRoot deps 加：`resolveFunctionExpression: exprScope.resolveFunctionExpression`
7. 更新 105-107 行 race 注释：实例内注册仍须先于 useSchemaRenderer（schema watcher immediate 触发 reaction 求值时沙箱函数须已就绪），但跨实例竞争已消除（scope 是实例私有，不再有「B 的 immediate 清表毁掉 A」）

- [x] **Step 3: 跑测试确认通过**

Run: `pnpm test src/components/form-schema/composables/use-xform-composer.spec.ts`
Expected: PASS

---

### Task 3: reaction 管线透传（TDD）

**Files:**
- Modify: `src/components/form-schema/composables/apply-reaction-fields.ts`（第 4 可选参）
- Modify: `src/components/form-schema/composables/use-reaction.ts`（applyReactions 第 5 可选参 + 递归透传）
- Modify: `src/components/form-schema/composables/use-schema-renderer.ts`（options 加参 + traverse 透传）
- Modify: `src/components/form-schema/composables/use-reaction.spec.ts`（新增 H2 回归用例）

- [x] **Step 1: 失败测试 —— use-reaction.spec.ts 追加**

```ts
describe('H2：applyReactions 注入 resolveFunctionExpression（实例级沙箱）', () => {
  it('注入的 resolve 优先于模块级：node.label 用注入解析器的结果', () => {
    const model: Record<string, unknown> = {}
    const node = reactive({
      component: 'Input',
      name: 'a',
      reaction: { label: '{{ () => tag() }}' },
    }) as SchemaNode
    // 注入解析器：任何表达式都返回 () => 'INJECTED'
    const injectedResolve = () => (() => 'INJECTED') as never
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers, createBudget(), injectedResolve)

    expect(node.label).toBe('INJECTED')
    stoppers.forEach((s) => s())
  })

  it('未注入 resolve → 回退模块级（向后兼容）', () => {
    const model: Record<string, unknown> = {}
    const node = reactive({
      component: 'Input',
      name: 'a',
      reaction: { label: '{{ (m) => "plain" }}' },
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers) // 无第 5 参

    expect(node.label).toBe('plain')
    stoppers.forEach((s) => s())
  })
})
```

（import 需补 `createBudget` 若未导入。）
Run: `pnpm test src/components/form-schema/composables/use-reaction.spec.ts`
Expected: **FAIL** —— 注入的 resolve 被忽略（实现无第 4/5 参），label 非 'INJECTED'（模块级无 tag 注册 → 解析失败 label 保持原字符串或不变）。

- [x] **Step 2: 实现透传**

1. `apply-reaction-fields.ts`：签名加 `resolve: ExpressionScope['resolveFunctionExpression'] = resolveFunctionExpression`（模块级回退），函数体内 `resolveFunctionExpression(raw)` 改调 `resolve(raw)`
2. `use-reaction.ts`：applyReactions 签名加第 5 可选参 `resolve?: ExpressionScope['resolveFunctionExpression']`；递归调用点（children :182-184 / slots :190-198 / array itemSchema :205-207）透传 `resolve`；调 applyReactionFields 处传 `resolve`
3. `use-schema-renderer.ts`：options 加 `resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']`；traverse 签名加参并在 :128 透传；:89 traverse 调用点传 `opts.resolveFunctionExpression`

- [x] **Step 3: 跑测试确认通过 + use-schema-renderer spec 回归**

```bash
pnpm test src/components/form-schema/composables/use-reaction.spec.ts
pnpm test src/components/form-schema/composables/use-schema-renderer.spec.ts
```

---

### Task 4: render 层透传（TDD）

**Files:**
- Modify: `src/components/form-schema/composables/build-on-bindings.ts`（第 3 可选参）
- Modify: `src/components/form-schema/composables/use-field-permission.ts`（opts 加可选 resolve）
- Modify: `src/components/form-schema/composables/render-schema-node.ts`（RenderSchemaNodeOptions 加参 + 两处调用点）
- Modify: `src/components/form-schema/composables/render-form-item.ts`（buildOnBindings 透传）
- Modify: `src/components/form-schema/composables/use-render-root.ts`（deps 加参 → renderOpts）
- Modify: `src/components/form-schema/composables/build-on-bindings.spec.ts` / `use-field-permission.spec.ts`（H2 用例）

- [x] **Step 1: 失败测试**

`build-on-bindings.spec.ts` 追加：

```ts
  it('H2：注入 resolveFunctionExpression 优先于模块级（on 字符串表达式）', () => {
    const node = {
      component: 'Input',
      name: 'a',
      on: { customEvent: '{{ () => tag() }}' },
    } as unknown as Parameters<typeof buildOnBindings>[0]
    const injected = () => (() => 'INJECTED') as never
    const bindings = buildOnBindings(node, {}, injected)
    expect((bindings as Record<string, unknown>).onCustomEvent).toBeInstanceOf(Function)
    expect((bindings as Record<string, unknown>).onCustomEvent as () => string()).toBe('INJECTED')
  })
```

`use-field-permission.spec.ts` 追加：

```ts
  it('H2：opts.resolveFunctionExpression 注入优先于模块级', () => {
    const node = { component: 'Input', name: 'a', permission: '{{ () => tag() }}' } as SchemaNode
    const result = resolvePermission(node, {
      model: () => ({}),
      resolveFunctionExpression: () => (() => 'hidden') as never,
    })
    expect(result).toBe('hidden')
  })
```

Run: `pnpm test src/components/form-schema/composables/build-on-bindings.spec.ts src/components/form-schema/composables/use-field-permission.spec.ts`
Expected: **FAIL** —— 无注入参数位。

- [x] **Step 2: 实现透传**

1. `build-on-bindings.ts`：签名 `buildOnBindings(node, model, resolve = resolveFunctionExpression)`，调用点改 `resolve(raw)`
2. `use-field-permission.ts`：`ResolvePermissionOptions` 加 `resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']`；:43 处 `const fn = (opts.resolveFunctionExpression ?? resolveFunctionExpression)(raw)`
3. `render-schema-node.ts`：RenderSchemaNodeOptions 加 `resolveFunctionExpression?: ExpressionScope['resolveFunctionExpression']`；:153 `buildOnBindings(node, opts.model, opts.resolveFunctionExpression)`；resolvePermission 调用点加 `resolveFunctionExpression: opts.resolveFunctionExpression`（在 opts 对象内，注意 exactOptionalPropertyTypes —— 可选属性裸传 undefined 合法）
4. `render-form-item.ts`：:66 `buildOnBindings(node, opts.model, opts.resolveFunctionExpression)`
5. `use-render-root.ts`：deps 加 `resolveFunctionExpression: ExpressionScope['resolveFunctionExpression']`；renderOpts 加 `resolveFunctionExpression: deps.resolveFunctionExpression`（RenderSchemaNodeOptions 可选字段，裸传）

- [x] **Step 3: 跑测试确认通过**

```bash
pnpm test src/components/form-schema/composables/build-on-bindings.spec.ts src/components/form-schema/composables/use-field-permission.spec.ts src/components/form-schema/composables/render-form-item.spec.ts src/components/form-schema/composables/render-schema-node.spec.ts
```

---

### Task 5: 模块级 API 标 @deprecated

**Files:**
- Modify: `src/components/form-schema/composables/use-expression.ts`（模块级两个 API 的 JSDoc）
- Modify: `src/components/form-schema/index.ts`（re-export 处 JSDoc）

- [x] **Step 1: JSDoc 标注**

`use-expression.ts` 模块级 `setExpressionFunctions` / `resolveFunctionExpression` 的 JSDoc 首行加：

```
 * @deprecated 2026-09-09（H2）：模块级共享表导致多 XForm 实例互相污染。
 * 新代码请用 createExpressionScope()（每实例一份）。保留是为向后兼容已接入的旧调用方。
```

`index.ts` re-export 处同步标注。

- [x] **Step 2: 全量回归**

```bash
pnpm test src/components/form-schema
pnpm type-check:full
pnpm check:doc-currency
pnpm lint
```

---

### Task 6: 浏览器复验 + 文档同步 + 收尾

**Files:**
- Modify: `src/components/form-schema/ARCHITECTURE.md`（表达式沙箱章节补 H2 修复说明）
- Modify: `src/components/form-schema/README.md`（expressionFunctions 区补多实例安全说明）
- Modify: `CHANGELOG.md`（fix 记录）
- Modify: `docs/superpowers/specs/2026-09-09-form-schema-arch-audit.md`（H2 验证行补录浏览器证据 + §2.1 H2 状态）

- [x] **Step 1: 浏览器复验（双实例实验重做）**

临时改造 XFormReaction.vue（同阶段 A 实验装置）→ 预期：输入不再互相污染（A 恒 from-A、B 恒 from-B）、卸载 A 后 B 无 ReferenceError → 还原 demo。
**吸取 H3 验证教训：全程硬刷新（Ctrl+F5）后测试。**

- [x] **Step 2: 文档同步**

- ARCHITECTURE.md 表达式沙箱章节追加 H2 修复说明（scope 实例级化 + 4 处消费点注入）
- README.md expressionFunctions 段落补「同页多实例安全（2-3 起）」
- CHANGELOG.md 按约束 #12 追加 fix 记录
- 审计文档 H2「验证」行补录：2026-09-09 浏览器实测确认三种污染 + 修复后复验通过

- [x] **Step 3: 收尾验收 + 合规简报**

```bash
pnpm test                # 全绿
pnpm type-check:full     # 0 error
pnpm check:doc-currency  # 5/5
pnpm lint                # 无新增 warning
```

合规简报附「本次对 src/ 的所有写操作清单」（§2.5）。

---

## 范围外（本计划不覆盖）

| 项 | 原因 |
| --- | --- |
| 删除模块级 API | 对外 breaking change；标 deprecated 已消除 form-schema 内部全部使用 |
| 批次 3（walkSchema / 性能项） | 排期项，独立批次 |
| ExpressionScope 增加清理 API | scope 随实例 GC 无泄漏面，YAGNI |

## 自检记录（writing-plans Self-Review）

- **Spec 覆盖**：审计 §3 批次 2-3 → Task 1-5；§7 多实例验证 → 阶段 A（已完成）+ Task 6 复验；文档同步 → Task 6。无缺口。
- **类型一致性**：注入参数类型统一 `ExpressionScope['resolveFunctionExpression']`（use-expression.ts 既有接口索引签名，免新增导出）；applyReactions 第 5 参在声明与全部递归调用点一致。
- **向后兼容**：applyReactionFields / buildOnBindings 的缺省回退模块级；applyReactions / resolvePermission 可选参；useTopLevelFields 接口不动（composer 只换注入值）。
