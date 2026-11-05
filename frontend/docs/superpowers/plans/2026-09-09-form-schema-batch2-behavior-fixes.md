# Form-Schema 批次 2 行为修复实施计划（H3 + H1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审计确认的两个 HIGH 行为缺陷 —— H3（跨字段嵌套路径直改漏触发）与 H1（字段级 `disabled`/`hidden` 函数形态不求值），使实现与文档承诺一致。

**Architecture:**
- **2-1（H3）**：`use-cross-field-trigger.ts` 的 model watch 从"顶层浅拷贝 diff"改为"按 rule 的 deps 值快照 diff"（对齐 `use-reaction.ts:133` 的 deps 快照模式），同时快照 target 当前值覆盖正向重算语义。
- **2-2（H1）**：`use-reaction.ts` 的 `containsReaction`/`applyReactions` 在克隆阶段把 standalone 函数/`{{ }}` 形态的 `disabled`/`hidden` 归一化为 reaction 条目，走既有 watch 求值管线，求值结果以 boolean 写回 node —— 渲染层 3 处 spread 与 `use-render-root.ts` 的 truthy 判定无需改动即自动正确。
- 修复面收窄说明：审计 §3 批次 2-2 提及 disabled/readonly/hidden/permission 四字段，实测后确认 `permission`（`use-field-permission.ts:26` 渲染时求值）与顶层 `disabled`/`readonly`（`use-top-level-fields.ts:134,150` computed 求值）已有工作正常的求值路径，**实际修复面 = 字段级 `disabled` + `hidden`**。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest + lodash-es + element-plus 2.14

**前置批准（src/ Architecture Lockdown §2.4）：** 本计划**零新增 / 零删除 / 零移动文件**，全部修改落在既有文件内，无需修改申请。批次 2 的立项前置（H1/H3 浏览器实测确认）已于 2026-09-09 完成（审计 §5，证据见 §2.1 验证行）。

---

### Task 1: 2-1 失败测试 —— deps 快照 diff（H3 回归）

**Files:**
- Modify: `src/components/form-schema/composables/use-cross-field-trigger.spec.ts`（`describe('useCrossFieldTrigger / model watch 兜底路径')` 块 341-412 行区域追加；其中 365-394 行的弱测试一并替换）

- [x] **Step 1: 替换弱测试 + 新增 H3 回归测试**

`use-cross-field-trigger.spec.ts` 中，将 365-394 行的 `it('model 嵌套字段深度变化 → 仍触发（deep watch）', ...)` 整个替换为以下两个测试，并在 `describe('useCrossFieldTrigger / model watch 兜底路径')` 块末尾（`it('model 从 undefined → {} 不抛错')` 之后）追加三个测试：

```ts
  it('H3 回归：直改嵌套路径（绕过 v-model）→ deps 快照 diff 命中 → 触发 crossValidator', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (_v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    // 用 reactive() 让嵌套属性可 deep watch
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0 // 排除 setup 期可能的初始触发计数

    // H3 场景：demo 程序直改嵌套路径（不走 v-model / onValueChange）
    ;(model.user as { age: number }).age = 30
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
    expect(opts.clearValidate).toHaveBeenCalledWith(['label'])
  })

  it('H3 回归：与任何 rule 无关的字段变化 → 不触发（新旧逻辑行为等价，新逻辑不再空跑 run）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x', noise: 1 })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    model.noise = 999
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(0)
  })

  it('H3 修复附带语义：直改 target 值（绕过 v-model）→ target 快照变化 → 正向重算', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 || v === '' ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 30 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    model.label = 'y'
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
  })

  it('H3 修复：同 tick trigger(dep) + 直改同路径 → 去重窗口保留，只执行 1 次', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('user.age') // 路径 1：onValueChange 精确触发（同步）
    ;(model.user as { age: number }).age = 11 // 路径 2：同 tick deep watch diff
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
  })

  it('H3 修复：rules 整体替换后快照重置，不因旧快照误触发', async () => {
    let call = 0
    const rulesA: ReverseRule[] = [
      {
        target: 'label',
        deps: ['a'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'a',
          trigger: 'change',
        },
      },
    ]
    const rulesRef = ref(rulesA)
    const model = reactive<Record<string, unknown>>({ a: 1, label: 'x' })
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    useCrossFieldTrigger({
      crossRules: () => rulesRef.value,
      model: () => model,
      setFieldError,
      clearValidate,
    })
    await nextTick()
    call = 0

    // 替换为无关 rule（deps 完全不同），随后改旧 dep → 不应触发旧 rule
    rulesRef.value = [
      {
        target: 'other',
        deps: ['b'],
        rule: {
          crossValidator: () => 'other err',
          dependsOn: 'b',
          trigger: 'change',
        },
      },
    ]
    await nextTick()
    model.a = 2
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(0)
  })
```

- [x] **Step 2: 跑测试确认按预期失败**

Run: `pnpm test src/components/form-schema/composables/use-cross-field-trigger.spec.ts`
Expected: **FAIL** —— H3 回归测试"直改嵌套路径"断言 `call` 为 1 但实际为 0（旧浅拷贝 diff 检测不到嵌套变化）；"无关字段不触发"通过（旧逻辑 run 空跑，call 不变）可不作失败依据；其余新测试按新旧逻辑差异失败。

---

### Task 2: 2-1 实现 —— deps 快照替换浅拷贝 diff

**Files:**
- Modify: `src/components/form-schema/composables/use-cross-field-trigger.ts:193-223`（model watch 块整体替换）+ `:178-191`（crossRules watch 末尾加快照重置）+ 声明顺序调整

- [x] **Step 1: 在 crossRules watch 之前插入快照工具（文件级）**

在 `use-cross-field-trigger.ts` 第 173 行注释块（`// 跨字段规则重建...`）**之前**插入：

```ts
  // ──────────────────────────────────────────────────────────────────────
  // H3 修复（审计 2026-09-09）：deps 值快照 diff —— 对齐 use-reaction deps 快照模式
  // ──────────────────────────────────────────────────────────────────────
  // 背景：旧实现对 model 做顶层浅拷贝 `{ ...model }` diff —— 嵌套 mutate
  // （如 model.user.age = 30）时新旧快照是同一对象引用，isEqual 恒 true 恒判未变；
  // 且就算 diff 出顶层 key 'user'，deps 精确匹配（'user.age' ≠ 'user'）也让 run 空跑。
  // 改为：每条 rule 记录 deps 各路径取值快照 + target 当前值，watch 触发时逐项 isEqual。
  interface RuleSnapshot {
    depsValues: unknown[]
    targetValue: unknown
  }
  function takeSnapshot(): Map<ReverseRule, RuleSnapshot> {
    const m = new Map<ReverseRule, RuleSnapshot>()
    const model = opts.model()
    if (!model) return m
    for (const r of rules) {
      m.set(r, {
        depsValues: r.deps.map((d) => get(model, d)),
        targetValue: get(model, r.target),
      })
    }
    return m
  }
  // 初始快照基于 setup 时的 rules（crossRules watch immediate 同步重建后也会重置）
  let oldSnapshot = takeSnapshot()
```

- [x] **Step 2: crossRules watch handler 末尾重置快照**

`use-cross-field-trigger.ts` crossRules watch 回调（原 181-189 行）在 `targetSeqMap.clear()` 之后追加一行：

```ts
        oldSnapshot = takeSnapshot()
```

- [x] **Step 3: 替换 model watch 块**

将原 193-223 行（`// 阶段 3.1 修复：watch model 兜底 + 精确 diff 触发` 至 `{ deep: true }` 的整块）替换为：

```ts
  // watch model 兜底：deep 监听 + deps 快照精确 diff（H3 修复，见文件头快照工具注释）
  // - dep 值变化 → run(depPath)（deps 精确匹配命中该 rule）
  // - target 值变化 → run(target)（正向重算 + 空值跳过语义，覆盖绕过 v-model 直改 target）
  // - 与任何 rule 无关的 key 变化不再 run（旧逻辑顶层 diff 对无关 key 也是空跑，行为等价且更省）
  stops.push(
    watch(
      () => opts.model(),
      (newModel) => {
        if (!newModel) {
          oldSnapshot = new Map()
          return
        }
        const fresh = takeSnapshot()
        const changed: string[] = []
        for (const [r, snap] of fresh) {
          const prev = oldSnapshot.get(r)
          // rules 重建时已同步重置快照，prev 恒存在；防御性跳过缺失项
          if (!prev) continue
          r.deps.forEach((d, i) => {
            if (!isEqual(snap.depsValues[i], prev.depsValues[i])) changed.push(d)
          })
          if (!isEqual(snap.targetValue, prev.targetValue)) changed.push(r.target)
        }
        oldSnapshot = fresh
        for (const key of changed) {
          // trigger() 同 tick 已精确处理过的字段跳过（嵌套路径如 user.age
          // 在 onValueChange 路径以完整 name 登记，同 tick 去重窗口保留）
          if (triggeredFields.has(key)) continue
          run(key)
        }
        triggeredFields.clear()
      },
      { deep: true } // 关键:deep 监听 model 内部属性变化（嵌套路径依赖此触发）
    )
  )
```

- [x] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/form-schema/composables/use-cross-field-trigger.spec.ts`
Expected: PASS（新增 5 个 + 既有全部）

- [x] **Step 5: 全量回归 + 提交**

```bash
pnpm test src/components/form-schema
pnpm type-check:full
```

```bash
git add src/components/form-schema/composables/use-cross-field-trigger.ts src/components/form-schema/composables/use-cross-field-trigger.spec.ts
git commit -m "fix(form-schema): useCrossFieldTrigger deps 快照对齐 reaction 模式，修复嵌套路径直改漏触发（H3）"
```

---

### Task 3: 2-2 失败测试 —— standalone disabled/hidden 归一化

**Files:**
- Modify: `src/components/form-schema/composables/use-reaction.spec.ts`（追加新 describe 块；若文件不存在则先看 `use-reaction.ts` 现有测试挂在哪个 spec —— `ls src/components/form-schema/composables/use-reaction*` 确认）

- [x] **Step 1: 确认测试挂载点**

Run: `ls src/components/form-schema/composables/use-reaction*`
Expected: 存在 `use-reaction.spec.ts`。以下代码追加到该文件末尾。

- [x] **Step 2: 追加失败测试**

```ts
describe('H1 修复：standalone disabled/hidden 函数形态克隆阶段归一化', () => {
  it('containsReaction：standalone 函数 / {{ }} 形态 disabled/hidden 视为含 reaction', () => {
    expect(
      containsReaction({ component: 'Input', name: 'a', disabled: () => true } as SchemaNode)
    ).toBe(true)
    expect(
      containsReaction({ component: 'Input', name: 'a', hidden: '{{ (m) => !!m.x }}' } as SchemaNode)
    ).toBe(true)
    // 字面量 boolean 维持原状（不触发 watch 管线）
    expect(
      containsReaction({ component: 'Input', name: 'a', disabled: true, hidden: false } as SchemaNode)
    ).toBe(false)
    expect(containsReaction({ component: 'Input', name: 'a' } as SchemaNode)).toBe(false)
  })

  it('applyReactions：函数 disabled 求值写回 node，且随 model 联动', async () => {
    const model = reactive<Record<string, unknown>>({ agree: false })
    const node = reactive({
      component: 'Input',
      name: 'a',
      disabled: (m: Record<string, unknown>) => !m.agree,
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    // sync 策略 setup 立即求值一次：agree=false → disabled=true
    expect(node.disabled).toBe(true)
    model.agree = true
    await nextTick()
    expect(node.disabled).toBe(false)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：{{ }} 表达式 hidden 求值写回 node.hidden', async () => {
    const model = reactive<Record<string, unknown>>({ vip: true })
    const node = reactive({
      component: 'Input',
      name: 'a',
      hidden: '{{ (m) => !m.vip }}',
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    expect(node.hidden).toBe(false)
    model.vip = false
    await nextTick()
    expect(node.hidden).toBe(true)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：reaction 已有同名 key 时 reaction 优先，standalone 被忽略', async () => {
    const model = reactive<Record<string, unknown>>({ agree: false })
    const node = reactive({
      component: 'Input',
      name: 'a',
      disabled: () => true, // standalone：reaction 已有 disabled → 被忽略
      reaction: { disabled: (m: Record<string, unknown>) => !m.agree },
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    // reaction 求值：agree=false → disabled=true；standalone 的 () => true 未生效
    expect(node.disabled).toBe(true)
    model.agree = true
    await nextTick()
    expect(node.disabled).toBe(false)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：无 reaction 且无 standalone 动态形态 → 不注册 watcher', () => {
    const model = reactive<Record<string, unknown>>({})
    const node = reactive({ component: 'Input', name: 'a', disabled: true }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)
    expect(stoppers).toHaveLength(0)
  })
})
```

文件顶部 import 需补 `reactive`（若既有 `import { ref, ... } from 'vue'` 则合并）与 `containsReaction`（若未导入）：

```ts
import { ref, reactive, nextTick } from 'vue'
import { containsReaction, applyReactions } from './use-reaction'
```

（以现有 import 实际形态为准做最小合并，禁止整段覆写。）

- [x] **Step 3: 跑测试确认失败**

Run: `pnpm test src/components/form-schema/composables/use-reaction.spec.ts`
Expected: **FAIL** —— "函数 disabled 求值写回 node" 中 `expect(node.disabled).toBe(true)` 实际为函数（未求值）；"containsReaction standalone" 中函数形态预期 `true` 实际 `false`。

---

### Task 4: 2-2 实现 —— containsReaction + applyReactions 归一化

**Files:**
- Modify: `src/components/form-schema/composables/use-reaction.ts:54-88`（containsReaction）、`:98-151`（applyReactions 入口）

- [x] **Step 1: containsReaction 检测 standalone 动态形态**

`use-reaction.ts` 在 `containsReaction` 函数前（第 53 行 `/** 是否含 reaction 字段...` 注释之前）插入文件级 helper：

```ts
/** H1 修复：standalone 函数 / '{{ }}' 形态的 disabled/hidden 视为 reaction 源
 * （克隆阶段由 applyReactions 归一化为 reaction 条目求值，与 README「✅ 完整（推荐）」承诺对齐） */
function hasReactiveStandaloneField(o: Record<string, unknown>): boolean {
  return (
    typeof o.disabled === 'function' ||
    (typeof o.disabled === 'string' && o.disabled.startsWith('{{')) ||
    typeof o.hidden === 'function' ||
    (typeof o.hidden === 'string' && o.hidden.startsWith('{{'))
  )
}
```

`containsReaction` 内（原第 61 行）把：

```ts
    if (o.reaction) {
```

改为：

```ts
    if (o.reaction || hasReactiveStandaloneField(o)) {
```

- [x] **Step 2: applyReactions 归一化入口**

`use-reaction.ts` `applyReactions` 函数体开头（原第 104 行 `if (node.reaction) {` 处）替换为：

```ts
  // H1 修复：standalone 函数/'{{' }}'形态 disabled/hidden 归一化为 reaction 条目。
  // 背景：字段级 disabled/hidden 此前只有字面量 boolean 被实现层消费 —— 函数形态被
  // render-form-item/render-schema-node/render-visual-container 原样 spread 进组件 props
  // （dev 报 prop type 警告 + 字段永久禁用），hidden 函数形态被 use-render-root 当 truthy
  // 恒隐藏。归一化后走既有 watch 求值管线，boolean 写回 node，全部消费点自动正确。
  // 合并优先级：node.reaction 已有同名 key 时以 reaction 为准（显式配置优先于简写）。
  const standaloneReactive: Record<string, unknown> = {}
  for (const key of ['disabled', 'hidden'] as const) {
    const raw = (node as Record<string, unknown>)[key]
    if (typeof raw === 'function' || (typeof raw === 'string' && raw.startsWith('{{'))) {
      if (node.reaction?.[key] === undefined) standaloneReactive[key] = raw
      delete (node as Record<string, unknown>)[key]
    }
  }
  if (node.reaction || Object.keys(standaloneReactive).length > 0) {
    // 保存本地引用：watchEffect 立即同步执行时 node.reaction 已被 delete
    const reactionConfig = {
      ...node.reaction,
      ...standaloneReactive,
    } as NonNullable<SchemaNode['reaction']>
    delete node.reaction
```

原 `hasDynamic` 起的逻辑保持不变（`reactionConfig` 变量名沿用，后续 `Object.values(reactionConfig)` 求值对合并后 config 自然生效）。

- [x] **Step 3: 跑测试确认通过**

Run: `pnpm test src/components/form-schema/composables/use-reaction.spec.ts`
Expected: PASS（新增 5 个 + 既有全部）

- [x] **Step 4: 全量回归 + 提交**

```bash
pnpm test src/components/form-schema
pnpm type-check:full
pnpm check:doc-currency   # 确认 5/5（无新增文件，composer 行数不变）
```

```bash
git add src/components/form-schema/composables/use-reaction.ts src/components/form-schema/composables/use-reaction.spec.ts
git commit -m "fix(form-schema): standalone disabled/hidden 函数形态克隆阶段归一化 reaction 求值（H1）"
```

---

### Task 5: 浏览器手动验证（审计 §5.1 / §5.2 重做）

**Files:** 无代码改动（验证用）

- [ ] **Step 1: H1 验证**

1. `pnpm dev` 启动，打开 `/demo/xform-cross-field`
2. 临时把某字段改造为 standalone 函数形态：`disabled: (m) => !m.agree`（验证后还原）
3. 切换 agree 开关 → **预期**：字段随 agree 联动禁用/启用；dev 控制台**无** `Invalid prop: type check failed for prop "disabled"` 警告
4. 恢复 demo 原状

- [ ] **Step 2: H3 验证**

1. 同页改造：`model.user = { age: 0 }`、字段 name `'user.age'`、跨字段规则 `dependsOn: ['user.age']`（crossValidator：`Number(age) >= 18 || '未成年'`）
2. 用 `@mousedown.prevent` 按钮直改 `model.user.age = 30`（阻断焦点转移，排除 blur 路径干扰 —— 上轮验证的关键实验设计）
3. **预期**：model 变 30 后红字「未成年」自动消失（修复前保持不动）
4. 对照组：输入框 v-model 路径改值 → 红字正常（不回归）
5. 恢复 demo 原状

- [ ] **Step 3: 批次 1 回归抽查**

`/demo/xform-server-error`（422 映射）、`/demo/xform-reaction`（联动）各过一遍，表现与批次 1 验收时一致。

---

### Task 6: 文档同步 + 收尾验收

**Files:**
- Modify: `src/components/form-schema/ARCHITECTURE.md`（reaction 章节 + 跨字段章节，各补一段修复说明）
- Modify: `src/components/form-schema/README.md`（`reaction` 用法示例区 489-495 行附近补 standalone 等价说明）
- Modify: `CHANGELOG.md`（fix 段落）

- [x] **Step 1: ARCHITECTURE.md 补充**

在 reaction 机制描述章节追加（锚点：搜索 `applyReactions` 或「reaction」章节标题）：

```markdown
> **H1 修复（2026-09-09）**：字段级 `disabled`/`hidden` 的函数 / `'{{ fn }}'` 形态在克隆阶段
> 由 `applyReactions` 归一化为 reaction 条目求值（`use-reaction.ts` 入口），boolean 结果写回 node。
> `permission`（渲染时 `resolvePermission` 求值）与顶层 `disabled`/`readonly`
> （`useTopLevelFields` computed 求值）本就工作，不在归一化范围。
```

在跨字段校验章节（锚点：`useCrossFieldTrigger`）追加：

```markdown
> **H3 修复（2026-09-09）**：model watch 兜底从顶层浅拷贝 diff 改为按 rule 的 deps 值快照 diff
> （`use-cross-field-trigger.ts`，对齐 use-reaction deps 快照模式），嵌套路径直改
> （`model.user.age = 30` 绕过 v-model）不再漏触发。
```

- [x] **Step 2: README.md 补充**

form-schema README 的 reaction 示例（489-495 行）下方追加一行说明：

```markdown
// standalone 简写（与 reaction.disabled 完全等价，克隆阶段自动归一化）：
//   disabled: (m) => !m.enablePath
```

- [x] **Step 3: CHANGELOG.md**

按项目约束 #12 追加两条 `fix` 记录（H3 / H1，各一句 + 文件引用）。

- [x] **Step 4: 全量验收**

```bash
pnpm test                # 全绿（较批次 1 新增 10 个用例）
pnpm type-check:full     # 0 error
pnpm check:doc-currency  # 5/5
pnpm lint                # 无新增 warning
```

- [x] **Step 5: 合规简报**

附「本次对 src/ 的所有写操作清单」（§2.5）：use-cross-field-trigger.ts、use-cross-field-trigger.spec.ts、use-reaction.ts、use-reaction.spec.ts、ARCHITECTURE.md、README.md、CHANGELOG.md。

---

## 范围外（本计划不覆盖）

| 项 | 原因 |
| --- | --- |
| 批次 2-3（H2 表达式沙箱实例级化） | 需先完成"同页多 XForm 实例"场景验证（审计 §7） |
| 批次 3（walkSchema / 性能项） | 排期项，与本次行为修复独立 |
| 顶层 `disabled`/`readonly` 归一化 | `useTopLevelFields` computed 已正确求值，不动 |
| `permission` 归一化 | `resolvePermission` 渲染时求值已工作，不动 |

---

## 自检记录（writing-plans Self-Review）

- **Spec 覆盖**：审计 §3 批次 2 的 2-1（方案 A：deps 快照对齐 reaction 模式）→ Task 1-2；2-2（克隆阶段归一化）→ Task 3-4；审计 §5 手动验证 → Task 5；文档同步 → Task 6。2-3 明确排除。无缺口。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码与精确行号锚点。
- **类型一致性**：`RuleSnapshot`/`takeSnapshot()`/`oldSnapshot` 在定义与两处使用点（初始值、crossRules 重置、model watch）签名一致；`standaloneReactive`/`hasReactiveStandaloneField` 在 containsReaction 与 applyReactions 间一致；`reactionConfig` 沿用既有变量名，后续 `hasDynamic`/`applyReactionFields` 消费不变。
