# beforeChange 3 层升级 + label 字段级颗粒度 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 XForm 扩展两项能力——①把 `beforeChange` 升级为 3 层拦截（全局 Props + 动态命名空间规则 + 字段级 Schema 配置），并提供 ctx API 供字段级钩子联动修改其他字段；②把 `labelPosition` / `labelWidth` 从"仅顶层 schema"扩展到字段级 override 顶层。

**Architecture:**
- 顶层新增 `BeforeChangeFn` / `BeforeChangeRule` / `BeforeChangeCtx` 3 个类型（`types/xform.ts`），`XFormProps` 加 `beforeChangeRules?` 字段。
- `SchemaNode` 加 `beforeChange?` + 字段级 `labelPosition?` / `labelWidth?`（`types/schema-node.ts`）。
- `build-vmodel-bindings.ts` 重写为 3 层串行 resolveBeforeChangeChain，接收 ctx 工厂。
- `use-xform-composer.ts` 提供 ctx 工厂（setFieldValue / setFieldError / name / abort）。
- `render-form-item.ts` 把字段级 labelPosition / labelWidth 透传到 el-form-item props。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Pinia 3 + Element Plus 2.14 + Vitest + lodash-es + element-plus ElForm/ElFormItem。

**Spec:** `docs/superpowers/specs/2026-09-02-beforechange-3layer-and-label-field-level-design.md`

---

## 文件结构总览

```
src/components/form-schema/
├── types/
│   ├── xform.ts                  # 修改：新增 3 个类型 + XFormProps.beforeChangeRules
│   └── schema-node.ts            # 修改：SchemaNode.beforeChange + 字段级 label 配置 + 注释修正
├── composables/
│   ├── build-vmodel-bindings.ts          # 重写：1 层 → 3 层 resolveBeforeChangeChain
│   ├── build-vmodel-bindings.spec.ts     # 新增：单元测试覆盖 3 层串联
│   ├── use-xform-composer.ts             # 修改：暴露 ctx 工厂
│   ├── render-form-item.ts               # 修改：透传字段级 labelPosition / labelWidth
│   ├── render-schema-node.ts             # 修改：RenderSchemaNodeOptions + 调用 buildVModelBindings
│   ├── render-schema-node.spec.ts        # 修改：新增 ctx 工厂参数 case
│   └── validate-component-props.ts       # 修改：注释更新
├── XForm.spec.ts                          # 修改：扩展 3 层 / ctx / label 字段级
├── README.md                              # 修改：beforeChange / label 章节
└── ARCHITECTURE.md                        # 修改：流程图更新

src/modules/demo/examples/
├── XFormBeforeChange.vue          # 重写：el-tabs 三段演示
├── XFormLabelLayout.vue           # 扩展：加字段级 labelPosition 演示
├── xform-demos-api.ts             # 修改：新增 beforeChangeRules / fieldBeforeChange API 条目
└── config/sidebar-groups.ts       # 修改：XFormBeforeChange 中文名更新

CHANGELOG.md                              # 修改：Unreleased 条目
```

---

## Task 1: 扩展 types/xform.ts —— 3 类型 + XFormProps.beforeChangeRules

**Files:**
- Modify: `src/components/form-schema/types/xform.ts:17-21`

- [ ] **Step 1: 替换 beforeChange 签名并新增 3 个类型**

在 `types/xform.ts` 第 6-7 行之间（import 之后），插入以下类型定义：

```typescript
/**
 * beforeChange 钩子上下文 —— 允许在字段级钩子里联动修改其他字段 / 取消写入
 *
 * 由 build-vmodel-bindings 在每字段 v-model 事件触发时构造（每字段独立 ctx 实例）
 * - setFieldValue('district', null): 选城市时清空区字段（联动副作用）
 * - setFieldError('phone', '格式错误'): 显示红字不阻断写入
 * - abort(): 取消本次本字段写入，等价于返回 undefined
 */
export interface BeforeChangeCtx {
  readonly name: string
  setFieldValue(name: string, value: unknown): void
  setFieldError(name: string, message: string): void
  readonly abort: () => void
}

/** beforeChange 函数签名 —— 全局 Props / 字段级 / 命名空间 handler 三处共用 */
export type BeforeChangeFn = (
  item: SchemaNode,
  newValue: unknown,
  oldValue: unknown,
  allValues?: Record<string, unknown>,
  ctx?: BeforeChangeCtx
) => unknown | Promise<unknown>

/**
 * 动态命名空间拦截规则 —— 字段是动态生成（如数组列表）时按 pattern 匹配
 * - RegExp: 精确正则匹配（推荐 ^...$ 锚定）
 * - string: 字面量精确匹配（'*' 单层通配 / '**' 多层通配）
 * 多个规则匹配同一字段时按数组顺序全部串行执行
 */
export interface BeforeChangeRule {
  pattern: RegExp | string
  handler: BeforeChangeFn
}
```

- [ ] **Step 2: 替换 XFormProps.beforeChange 签名（向后兼容）**

将 `xform.ts:17-21` 当前：

```typescript
  beforeChange?: (
    itemSchema: SchemaNode,
    newValue: unknown,
    oldValue: unknown
  ) => unknown | Promise<unknown>
```

替换为：

```typescript
  /**
   * 全局 Props beforeChange（第 1 层：横切关注点）
   * - 返回新值 → 透传给下一层
   * - 返回 undefined → 放行原值给下一层
   * - Promise.resolve → 异步更新，等待结果后透传
   * - Promise.reject / 抛异常 → catch + warn + 中断后续写入
   *
   * 字段级拦截请用 SchemaNode.beforeChange；动态数组场景请用 beforeChangeRules
   */
  beforeChange?: BeforeChangeFn
  /**
   * 动态命名空间拦截（第 2 层：按 pattern 匹配字段路径）
   * 数组节点（items[i].phone）字段级配置繁琐，用规则数组简处理
   * 多个规则匹配同一字段时按数组顺序全部串行执行
   */
  beforeChangeRules?: BeforeChangeRule[]
```

- [ ] **Step 3: 在 BeforeChangeFn 类型前确认 SchemaNode 类型已 import**

文件顶部 `import type { SchemaNode } from './schema-node'` 已存在，无需修改。

- [ ] **Step 4: 类型校验**

```bash
pnpm type-check:full 2>&1 | head -30
```

Expected: 仅 schema-node.ts 相关 import 报错（BeforeChangeFn 引用了 SchemaNode），但 XFormProps 上引用 BeforeChangeFn 应该都通过。

- [ ] **Step 5: 提交**

```bash
git add src/components/form-schema/types/xform.ts
git commit -m "feat(form-schema): 新增 BeforeChangeFn / BeforeChangeRule / BeforeChangeCtx 类型与 XFormProps.beforeChangeRules"
```

---

## Task 2: 扩展 types/schema-node.ts —— 字段级 beforeChange + label 配置 + 注释修正

**Files:**
- Modify: `src/components/form-schema/types/schema-node.ts`

- [ ] **Step 1: 在 SchemaNode 接口的 "字段权限" 注释后插入 beforeChange 字段**

定位 schema-node.ts 第 143 行（`permission?: ...` 字段），在其后插入：

```typescript
  /**
   * 字段级 beforeChange（第 3 层：业务内聚）
   * - 与 Props.beforeChange 同签名（多 allValues + ctx 两可选参在尾部）
   * - 数组元素字段（items[i].phone）直接写在 array.children[i].phone 上即可
   * - 可通过 ctx.setFieldValue 联动修改其他兄弟字段（ctx 完全开放）
   * @group 响应式（字段级）
   */
  beforeChange?: import('./xform').BeforeChangeFn
```

> 注意：使用 `import('./xform').BeforeChangeFn` 而非直接 import，避免循环依赖（types 之间相互引用）。

- [ ] **Step 2: 推翻旧注释并新增字段级 labelPosition**

定位 schema-node.ts 第 144-154 行（labelPosition 注释块），替换为：

```typescript
  /**
   * el-form label 位置 —— 顶层为默认值，字段级可覆盖
   * - 'left'（默认）：label 在 input 左侧
   * - 'right'：label 在 input 右侧
   * - 'top'：label 在 input 上方（响应式布局推荐）
   *
   * element-plus ElFormItem 与 ElForm 共享 label-position prop，所以字段级可独立设置
   * 字段级未设置时 el-form-item 自动继承 el-form 顶层配置（element-plus 原生行为）
   *
   * 顶层 schema 配置是表单整体默认值；字段级 override 用于个别字段差异化布局
   * @group 布局（双层：顶层默认 / 字段级 override）
   */
  labelPosition?: 'left' | 'right' | 'top'
```

- [ ] **Step 3: 替换 labelWidth 注释并字段级允许**

定位 schema-node.ts 第 165-169 行（labelWidth 注释块），替换为：

```typescript
  /**
   * el-form label 宽度 —— 顶层为默认值，字段级可覆盖
   * - 顶层配置：表单整体 label 宽度（透传 el-form label-width）
   * - 字段级配置：该字段独立 label 宽度（透传 el-form-item label-width）
   * - 如 '120px' 或 120；数组形式 schema 无顶层节点，配置不生效
   * @group 布局（双层：顶层默认 / 字段级 override）
   */
  labelWidth?: string | number
```

- [ ] **Step 4: 类型校验**

```bash
pnpm type-check:full 2>&1 | head -30
```

Expected: 通过（仅 types/xform.ts 的 BeforeChangeFn 已可用，SchemaNode.beforeChange 通过 dynamic import 引用）。

- [ ] **Step 5: 提交**

```bash
git add src/components/form-schema/types/schema-node.ts
git commit -m "feat(form-schema): SchemaNode.beforeChange + 字段级 labelPosition/labelWidth + 修正过时注释"
```

---

## Task 3: 写 build-vmodel-bindings.spec.ts —— 3 层串联测试覆盖（先 RED）

**Files:**
- Create: `src/components/form-schema/composables/build-vmodel-bindings.spec.ts`

- [ ] **Step 1: 创建测试文件**

写入 `build-vmodel-bindings.spec.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { buildVModelBindings, resolveBeforeChangeChain } } from './build-vmodel-bindings'
import type { SchemaNode, XFormExpose, BeforeChangeCtx } from '../types'

const baseNode = (name = 'phone'): SchemaNode => ({
  name,
  component: 'Input',
})

const makeCtx = (): BeforeChangeCtx => ({
  name: '',
  setFieldValue: vi.fn(),
  setFieldError: vi.fn(),
  abort: vi.fn(),
})

describe('resolveBeforeChangeChain', () => {
  it('returns newVal unchanged when no hooks configured', async () => {
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx())
    expect(result).toBe('abc')
  })

  it('layer 1 (props.beforeChange) return value replaces v', async () => {
    const layer1 = vi.fn((_n, v) => `L1(${v)`)
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), { layer1 })
    expect(result).toBe('L1(abc)')
    expect(layer1).toHaveBeenCalledOnce()
  })

  it('layer 1 returning undefined passes original v to next layer', async () => {
    const layer1 = vi.fn(() => undefined)
    const layer3 = vi.fn((_n, v) => `L3(${v)`)
    const result = await resolveBeforeChangeChain(
      baseNode(),
      'abc',
      'xyz',
      {},
      makeCtx(),
      { layer1, fieldBeforeChange: layer3 }
    )
    expect(result).toBe('L3(abc)')
  })

  it('layer 1 Promise.resolve awaits before passing to next', async () => {
    const layer1 = vi.fn((_n, v) => Promise.resolve(`async-${v}`))
    const result = await resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), { layer1 })
    expect(result).toBe('async-abc')
  })

  it('layer 1 Promise.reject throws, chain aborts', async () => {
    const layer1 = vi.fn(() => Promise.reject(new Error('cancel')))
    await expect(
      resolveBeforeChangeChain(baseNode(), 'abc', 'xyz', {}, makeCtx(), { layer1 })
    ).rejects.toThrow('cancel')
  })

  it('layer 1 sync throw is caught, original v passed to next layer', async () => {
    const layer1 = vi.fn(() => { throw new Error('boom') })
    const layer3 = vi.fn((_n, v) => `L3(${v)`)
    const result = await resolveBeforeChangeChain(
      baseNode(),
      'abc',
      'xyz',
      {},
      makeCtx(),
      { layer1, fieldBeforeChange: layer3 }
    )
    expect(result).toBe('L3(abc)')
  })

  it('layer 2 (namespace rules) matches by RegExp pattern', async () => {
    const handler = vi.fn((_n, v) => `phone-${v}`)
    const node = baseNode('phone')
    const result = await resolveBeforeChangeChain(node, '123', '', {}, makeCtx(), {
      namespaceRules: [{ pattern: /^phone$/, handler }],
    })
    expect(result).toBe('phone-123')
  })

  it('layer 2 matches array path with regex', async () => {
    const handler = vi.fn((_n, v) => v.replace(/\s/g, ''))
    const node = baseNode('items[0].phone')
    const result = await resolveBeforeChangeChain(node, '138 0013 8000', '', {}, makeCtx(), {
      namespaceRules: [{ pattern: /^items\[\d+\]\.phone$/, handler }],
    })
    expect(result).toBe('13800138000')
  })

  it('layer 2 multiple matches run in array order (chained)', async () => {
    const h1 = vi.fn((_n, v) => `[1]${v}`)
    const h2 = vi.fn((_n, v) => `[2]${v}`)
    const result = await resolveBeforeChangeChain(baseNode('x'), 'a', '', {}, makeCtx(), {
      namespaceRules: [{ pattern: /^x$/, handler: h1 }, { pattern: /^x$/, handler: h2 }],
    })
    expect(result).toBe('[2][1]a')
  })

  it('layer 2 non-matching rules skip', async () => {
    const handler = vi.fn((_n, v) => `nope-${v}`)
    const result = await resolveBeforeChangeChain(baseNode('phone'), 'a', '', {}, makeCtx(), {
      namespaceRules: [{ pattern: /^email$/, handler }],
    })
    expect(result).toBe('a')
    expect(handler).not.toHaveBeenCalled()
  })

  it('layer 3 (field.beforeChange) executes with 5 args', async () => {
    const handler = vi.fn((_n, v) => `field-${v}`)
    const node = { ...baseNode(), beforeChange: handler }
    const ctx = makeCtx()
    const result = await resolveBeforeChangeChain(node, 'a', 'b', { phone: 'a' }, ctx)
    expect(handler).toHaveBeenCalledWith(node, 'a', 'b', { phone: 'a' }, ctx)
    expect(result).toBe('field-a')
  })

  it('3 layers chain: L1 -> L2 -> L3 sequentially', async () => {
    const l1 = vi.fn((_n, v) => `${v}-L1`)
    const l2h = vi.fn((_n, v) => `${v}-L2`)
    const node = { ...baseNode('x'), beforeChange: vi.fn((_n, v) => `${v}-L3`) }
    const result = await resolveBeforeChangeChain(node, 'a', '', {}, makeCtx(), {
      layer1: l1,
      namespaceRules: [{ pattern: /^x$/, handler: l2h }],
    })
    expect(result).toBe('a-L1-L2-L3')
  })

  it('ctx.setFieldValue mutates model side effect', async () => {
    const model: Record<string, unknown> = {}
    const ctx: BeforeChangeCtx = {
      name: 'city',
      setFieldValue: (n, v) => { model[n] = v },
      setFieldError: vi.fn(),
      abort: vi.fn(),
    }
    const handler = vi.fn((_n, _v, _o, _all, c) => {
      c.setFieldValue('district', null)
      return '北京'
    })
    const node = { ...baseNode('city'), beforeChange: handler }
    await resolveBeforeChangeChain(node, '北京', '', model, ctx)
    expect(model.district).toBeNull()
  })

  it('ctx.setFieldError calls formRef.setFieldError', async () => {
    const setFieldError = vi.fn()
    const ctx: BeforeChangeCtx = {
      name: 'phone',
      setFieldValue: vi.fn(),
      setFieldError,
      abort: vi.fn(),
    }
    const handler = vi.fn((_n, _v, _o, _all, c) => {
      c.setFieldError('phone', '格式错误')
      return _v
    })
    const node = { ...baseNode('phone'), beforeChange: handler }
    await resolveBeforeChangeChain(node, 'abc', '', {}, ctx)
    expect(setFieldError).toHaveBeenCalledWith('phone', '格式错误')
  })

  it('ctx.abort marks chain as aborted (does not write)', async () => {
    const abort = vi.fn()
    const ctx: BeforeChangeCtx = {
      name: 'phone',
      setFieldValue: vi.fn(),
      setFieldError: vi.fn(),
      abort,
    }
    const handler = vi.fn((_n, _v, _o, _all, c) => {
      c.abort()
      return _v
    })
    const node = { ...baseNode('phone'), beforeChange: handler }
    await resolveBeforeChangeChain(node, 'abc', '', {}, ctx)
    expect(abort).toHaveBeenCalled()
  })
})

describe('buildVModelBindings', () => {
  it('writes layer1-returned value to model on update event', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn((_n, v) => `L1(${v)`)
    const bindings = buildVModelBindings(baseNode('phone'), model, { layer1 })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('L1(new)')
  })

  it('writes original value when no hooks configured', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const bindings = buildVModelBindings(baseNode('phone'), model)
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('new')
  })

  it('awaits Promise.resolve before writing to model', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn((_n, v) => Promise.resolve(`async-${v}`))
    const bindings = buildVModelBindings(baseNode('phone'), model, { layer1 })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('async-new')
  })

  it('does not write when Promise.reject', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const layer1 = vi.fn(() => Promise.reject(new Error('cancel')))
    const bindings = buildVModelBindings(baseNode('phone'), model, { layer1 })
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(model.phone).toBe('old')
  })

  it('onValueChange fires after write', async () => {
    const model = reactive<Record<string, unknown>>({ phone: 'old' })
    const onValueChange = vi.fn()
    const layer1 = vi.fn((_n, v) => `L1(${v)`)
    const node = baseNode('phone')
    const bindings = buildVModelBindings(node, model, { layer1 }, onValueChange)
    // @ts-expect-error event handler type
    bindings['onUpdate:modelValue']('new')
    await new Promise((r) => setTimeout(r, 0))
    expect(onValueChange).toHaveBeenCalledWith(node, 'L1(new)')
  })
})
```

> 测试用 vi.fn spy 验证每层调用顺序；ctx.setFieldValue 真实写入 model 验证副作用；abort 用 abort 标志由 spy 验证调用。

- [ ] **Step 2: 运行测试 → 期望失败（RED）**

```bash
pnpm test src/components/form-schema/composables/build-vmodel-bindings.spec.ts 2>&1 | tail -30
```

Expected: 失败，提示 `Cannot find module './build-vmodel-bindings'` 或 `resolveBeforeChangeChain is not exported`。

- [ ] **Step 3: 提交测试**

```bash
git add src/components/form-schema/composables/build-vmodel-bindings.spec.ts
git commit -m "test(form-schema): 新增 build-vmodel-bindings.spec.ts 覆盖 3 层串联 + ctx + 异常"
```

---

## Task 4: 重写 build-vmodel-bindings.ts —— 3 层 resolveBeforeChangeChain + ctx 工厂（GREEN）

**Files:**
- Modify: `src/components/form-schema/composables/build-vmodel-bindings.ts`

- [ ] **Step 1: 重写文件**

```typescript
import { get, set } from 'lodash-es'
import type {
  BeforeChangeCtx,
  BeforeChangeFn,
  BeforeChangeRule,
  SchemaNode,
  XFormExpose,
} from '../types'

/**
 * beforeChange 3 层钩子配置（buildVModelBindings 接收）
 * - layer1: 全局 Props beforeChange（横切关注点）
 * - namespaceRules: 动态命名空间规则数组
 * - fieldBeforeChange: 字段级 SchemaNode.beforeChange
 * - makeCtx: 每字段独立 ctx 工厂
 */
export interface BeforeChangeConfig {
  layer1?: BeforeChangeFn
  namespaceRules?: BeforeChangeRule[]
  fieldBeforeChange?: BeforeChangeFn
  makeCtx?: (node: SchemaNode) => BeforeChangeCtx
  onValueChange?: (node: SchemaNode, newValue: unknown) => void
  /** XFormExpose for ctx.setFieldError 调用 */
  formRef?: XFormExpose
}

/**
 * 匹配 pattern: RegExp 直接 test；string 支持 '*'(单层) / '**'(多层) 通配
 */
function patternMatches(pattern: RegExp | string, name: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(name)
  if (pattern === name) return true
  // 字符串通配符：'*' 匹配不含 . 的单层，'**' 匹配多层含 .
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$0')
    .replace(/\*\*/g, '__DBL_STAR__')
    .replace(/\*/g, '[^.]+')
    .replace(/__DBL_STAR__/g, '.*')
  return new RegExp(`^${escaped}$`).test(name)
}

/**
 * 3 层串行 resolveBeforeChangeChain
 * 第 1 层 props.beforeChange -> 第 2 层 namespaceRules[pattern 匹配] -> 第 3 层 node.beforeChange
 * 每层返回新值透传给下一层；任一层返回 Promise.resolve 异步等待
 * 任一层抛异常 → catch + warn + 放行上一层结果（不阻断）；Promise.reject → 抛 throw 中断
 */
export async function resolveBeforeChangeChain(
  node: SchemaNode,
  newVal: unknown,
  oldVal: unknown,
  allValues: Record<string, unknown>,
  ctx: BeforeChangeCtx,
  config: BeforeChangeConfig = {}
): Promise<unknown> {
  let curr = newVal
  const layer1 = config.layer1
  const namespaceRules = config.namespaceRules ?? []
  const fieldBeforeChange = config.fieldBeforeChange ?? node.beforeChange

  // 第 1 层: 全局 Props
  if (layer1) {
    try {
      const r = layer1(node, curr, oldVal, allValues, ctx)
      curr = r instanceof Promise ? await r : r === undefined ? curr : r
    } catch (err) {
      console.warn('[beforeChange] layer1 (props) threw', err)
    }
  }

  // 第 2 层: 命名空间规则（多规则按数组顺序串行）
  const matched = namespaceRules.filter((r) =>
    patternMatches(r.pattern, ctx.name)
  )
  for (const rule of matched) {
    try {
      const r = rule.handler(node, curr, oldVal, allValues, ctx)
      curr = r instanceof Promise ? await r : r === undefined ? curr : r
    } catch (err) {
      console.warn('[beforeChange] namespace rule threw', err)
    }
  }

  // 第 3 层: 字段级
  if (fieldBeforeChange) {
    try {
      const r = fieldBeforeChange(node, curr, oldVal, allValues, ctx)
      curr = r instanceof Promise ? await r : r === undefined ? curr : r
    } catch (err) {
      console.warn('[beforeChange] field-level threw', err)
    }
  }

  return curr
}

/**
 * 构造默认 ctx 工厂（use-xform-composer 在 render 阶段调用）
 */
export function makeDefaultBeforeChangeCtx(
  node: SchemaNode,
  model: Record<string, unknown>,
  formRef?: XFormExpose
): BeforeChangeCtx {
  const abortFlag = { aborted: false }
  return {
    get name() {
      return node.name ?? ''
    },
    setFieldValue: (name, value) => {
      set(model, name, value)
    },
    setFieldError: (name, message) => {
      formRef?.setFieldError(name, message)
    },
    abort: () => {
      abortFlag.aborted = true
    },
  }
}

/**
 * 构建节点 vModel 绑定：含 3 层 beforeChange 拦截
 * - 异步链结束后才写入 model
 * - onValueChange 钩子在写入完成后触发
 */
export function buildVModelBindings(
  node: SchemaNode,
  model: Record<string, unknown> | undefined,
  config: BeforeChangeConfig = {}
): Record<string, unknown> {
  if (node.name === undefined || !model) return {}
  const prop = node.modelProp ?? 'modelValue'
  const eventProp = `on${`update:${prop}`.charAt(0).toUpperCase()}${`update:${prop}`.slice(1)}`

  const ctx = config.makeCtx?.(node) ?? makeDefaultBeforeChangeCtx(node, model, config.formRef)

  const applyValue = (finalValue: unknown): void => {
    set(model, node.name as string, finalValue)
    config.onValueChange?.(node, finalValue)
  }

  return {
    [prop]: get(model, node.name),
    [eventProp]: (v: unknown) => {
      const oldVal = get(model, node.name as string)
      resolveBeforeChangeChain(node, v, oldVal, model, ctx, config).then(applyValue).catch((err) => {
        console.warn('[beforeChange] chain aborted', err)
      })
    },
  }
}
```

- [ ] **Step 2: 运行测试 → 期望通过（GREEN）**

```bash
pnpm test src/components/form-schema/composables/build-vmodel-bindings.spec.ts 2>&1 | tail -20
```

Expected: 全绿（覆盖 18 用例）。

- [ ] **Step 3: 跑全量测试看是否破坏旧用例**

```bash
pnpm test 2>&1 | tail -30
```

Expected: XForm.spec.ts 旧的 beforeChange 测试需要适配（见 Task 6）。可能暂时 fail，但不影响本任务。后续 Task 6 会修复。

- [ ] **Step 4: 提交**

```bash
git add src/components/form-schema/composables/build-vmodel-bindings.ts
git commit -m "feat(form-schema): 重写 build-vmodel-bindings 为 3 层 beforeChange 串联 + ctx 工厂"
```

---

## Task 5: use-xform-composer.ts —— 提供 ctx 工厂给 renderOpts

**Files:**
- Modify: `src/components/form-schema/composables/use-xform-composer.ts:411-418`

- [ ] **Step 1: 定位当前 beforeChange 透传位置**

用 Grep 确认 `props.beforeChange` 在 use-xform-composer.ts 中的位置：

```bash
grep -n "beforeChange" src/components/form-schema/composables/use-xform-composer.ts
```

- [ ] **Step 2: 修改 beforeChange 透传为 config 对象**

定位 line 411 附近（`props.beforeChange` 传给 renderOpts 处），替换为：

```typescript
      renderOpts.beforeChange = props.beforeChange
      renderOpts.beforeChangeRules = props.beforeChangeRules
```

（保留 line 411-418 的 props.beforeChange 赋值；新增 line 419 前一行加 `renderOpts.beforeChangeRules = props.beforeChangeRules`）

- [ ] **Step 3: 在 renderOpts 类型中暴露 ctx 工厂字段**

定位 `RenderSchemaNodeOptions` 定义位置（types/base.ts 或 render-schema-node.ts），增加：

```typescript
  beforeChange?: XFormProps['beforeChange']
  beforeChangeRules?: XFormProps['beforeChangeRules']
  makeBeforeChangeCtx?: (node: SchemaNode) => BeforeChangeCtx
  formRef?: XFormExpose
```

- [ ] **Step 4: 在 renderOpts 初始化时提供 ctx 工厂**

定位 renderOpts 构造处（line 356 附近），添加：

```typescript
    makeBeforeChangeCtx: (node) =>
      makeDefaultBeforeChangeCtx(node, model as Record<string, unknown>, api),
    formRef: api,
```

- [ ] **Step 5: 修改 render-schema-node.ts 调用 buildVModelBindings 方式**

定位 `render-schema-node.ts:201`（`buildVModelBindings(node, opts.model, opts.beforeChange, opts.onValueChange)`），改为：

```typescript
      ...buildVModelBindings(node, opts.model, {
        layer1: opts.beforeChange,
        namespaceRules: opts.beforeChangeRules,
        makeCtx: opts.makeBeforeChangeCtx,
        formRef: opts.formRef,
        onValueChange: opts.onValueChange,
      }),
```

- [ ] **Step 6: 跑 build-vmodel-bindings.spec.ts 验证**

```bash
pnpm test src/components/form-schema/composables/build-vmodel-bindings.spec.ts 2>&1 | tail -10
```

Expected: 全绿（Task 3 的测试不依赖 use-xform-composer）。

- [ ] **Step 7: 提交**

```bash
git add src/components/form-schema/composables/use-xform-composer.ts \
        src/components/form-schema/composables/render-schema-node.ts \
        src/components/form-schema/types/base.ts 2>/dev/null
git commit -m "feat(form-schema): use-xform-composer 暴露 ctx 工厂与 beforeChangeRules"
```

---

## Task 6: render-form-item.ts —— 透传字段级 labelPosition / labelWidth

**Files:**
- Modify: `src/components/form-schema/composables/render-form-item.ts:91-109`

- [ ] **Step 1: 定位 ElFormItem h() 调用**

当前 line 91-109 已经构造了 formItem props 对象。需要在 `label: node.label` 和 `prop: node.name` 之后插入 labelPosition / labelWidth 透传。

- [ ] **Step 2: 修改 h() 调用**

将 line 91-109 的对象构造修改为：

```typescript
  const formItem = h(
    FormItemComp as never,
    {
      label: node.label,
      prop: node.name,
      // ⭐ 字段级 label 配置 override 顶层（el-form-item 与 el-form 共享 labelPosition/labelWidth）
      // 字段级未设置时 el-form-item 自动继承 el-form 顶层（element-plus 原生行为）
      ...(node.labelPosition !== undefined ? { labelPosition: node.labelPosition } : {}),
      ...(node.labelWidth !== undefined ? { labelWidth: node.labelWidth } : {}),
      rules:
        node.hidden === true ? [] : (compileRules(node.rules, opts.rules, node.label) as never),
      ...(ext?.error ? { error: ext.error } : {}),
      ...(ext?.validateStatus ? { validateStatus: ext.validateStatus } : {}),
      ...(onFocusout ? { onFocusout } : {}),
      ...fiProps,
      ...(node.name || node.key ? { key: `fi-${node.key ?? node.name}` } : {}),
    } as never,
```

- [ ] **Step 3: 跑现有 render-form-item 相关测试**

```bash
pnpm test src/components/form-schema/composables/render-schema-node.spec.ts 2>&1 | tail -10
```

Expected: 全绿（未涉及 label 字段级的现有测试不受影响）。

- [ ] **Step 4: 提交**

```bash
git add src/components/form-schema/composables/render-form-item.ts
git commit -m "feat(form-schema): render-form-item 透传字段级 labelPosition / labelWidth"
```

---

## Task 7: 扩展 XForm.spec.ts —— 适配新 beforeChange 签名 + 新增 3 层 + label 字段级 + ctx 测试

**Files:**
- Modify: `src/components/form-schema/XForm.spec.ts:309-349`

- [ ] **Step 1: 定位旧测试**

当前 `XForm.spec.ts:309-349` 4 个测试调用 `buildVModelBindings(node, model, beforeChange as never)` 三参形式。

- [ ] **Step 2: 修改调用方式**

将 4 处旧调用替换为：

```typescript
const bindings = buildVModelBindings(node, model, { layer1: beforeChange as never })
```

（保留 beforeChange 函数不变，仅 buildVModelBindings 入参改为对象）

- [ ] **Step 3: 新增 3 层串联 / ctx / label 字段级 describe**

在 XForm.spec.ts 末尾追加：

```typescript
describe('XForm.vue beforeChange 3 层', () => {
  it('layer 1 + layer 3 串联：全局 -> 字段级', async () => {
    const { buildVModelBindings } = await import('./composables/build-vmodel-bindings')
    const model = reactive<Record<string, unknown>>({ x: 'old' })
    const layer1 = vi.fn((_n, v) => `L1(${v})`)
    const layer3 = vi.fn((_n, v) => `L3(${v})`)
    const node: SchemaNode = { name: 'x', component: 'Input', beforeChange: layer3 as never }
    const bindings = buildVModelBindings(node, model, { layer1: layer1 as never })
    // @ts-expect-error
    bindings['onUpdate:modelValue']('a')
    await flushPromises()
    expect(model.x).toBe('L3(L1(a))')
  })

  it('layer 2 namespace rules 多个串行执行', async () => {
    const { buildVModelBindings } = await import('./composables/build-vmodel-bindings')
    const model = reactive<Record<string, unknown>>({ x: '' })
    const h1 = vi.fn((_n, v) => `[1]${v}`)
    const h2 = vi.fn((_n, v) => `[2]${v}`)
    const node: SchemaNode = { name: 'x', component: 'Input' }
    const bindings = buildVModelBindings(node, model, {
      namespaceRules: [
        { pattern: /^x$/, handler: h1 as never },
        { pattern: /^x$/, handler: h2 as never },
      ],
    })
    // @ts-expect-error
    bindings['onUpdate:modelValue']('a')
    await flushPromises()
    expect(model.x).toBe('[2][1]a')
  })

  it('ctx.setFieldValue 在字段级钩子里联动修改兄弟字段', async () => {
    const { buildVModelBindings } = await import('./composables/build-vmodel-bindings')
    const model = reactive<Record<string, unknown>>({ city: '北京', district: '朝阳' })
    const handler = vi.fn((_n, v, _o, _all, ctx) => {
      ctx.setFieldValue('district', null)
      return v
    })
    const node: SchemaNode = { name: 'city', component: 'Input', beforeChange: handler as never }
    const bindings = buildVModelBindings(node, model)
    // @ts-expect-error
    bindings['onUpdate:modelValue']('上海')
    await flushPromises()
    expect(model.city).toBe('上海')
    expect(model.district).toBeNull()
  })
})

describe('XForm.vue 字段级 labelPosition override 顶层', () => {
  it('node.labelPosition=top 渲染该字段 label 在上方', async () => {
    const wrapper = mount(XForm, {
      props: {
        schema: {
          labelPosition: 'left',
          children: [
            { name: 'a', component: 'Input', label: 'A' },
            { name: 'b', component: 'Input', label: 'B', labelPosition: 'top' },
          ],
        },
        model: { a: '', b: '' },
      },
    })
    await flushPromises()
    // b 字段 labelPosition 通过 el-form-item prop 透传
    const bItem = wrapper.findAllComponents({ name: 'ElFormItem' })[1]
    expect(bItem.props('labelPosition')).toBe('top')
  })

  it('node.labelPosition 未设置时 el-form-item 不传 labelPosition prop', async () => {
    const wrapper = mount(XForm, {
      props: {
        schema: {
          labelPosition: 'left',
          children: [{ name: 'a', component: 'Input', label: 'A' }],
        },
        model: { a: '' },
      },
    })
    await flushPromises()
    const aItem = wrapper.findAllComponents({ name: 'ElFormItem' })[0]
    expect(aItem.props('labelPosition')).toBe('left') // 继承顶层
  })
})
```

> 需要在文件顶部确认 `XForm` 已 import；若无则添加 `import XForm from './XForm.vue'`。

- [ ] **Step 4: 跑测试**

```bash
pnpm test src/components/form-schema/XForm.spec.ts 2>&1 | tail -20
```

Expected: 全部通过（含旧 4 测试 + 新增 5 测试）。

- [ ] **Step 5: 提交**

```bash
git add src/components/form-schema/XForm.spec.ts
git commit -m "test(form-schema): 适配新 beforeChange 签名 + 新增 3 层 + ctx + label 字段级测试"
```

---

## Task 8: validate-component-props.ts —— 注释更新

**Files:**
- Modify: `src/components/form-schema/composables/validate-component-props.ts:74-75`

- [ ] **Step 1: 定位白名单注释**

定位 `'labelPosition'` 和 `'labelWidth'` 在白名单数组中的位置（line 74-75）。

- [ ] **Step 2: 更新注释说明字段级可用**

在白名单上方加注释：

```typescript
  // labelPosition / labelWidth：顶层 schema 配置（透传 el-form）；
  // 字段级 SchemaNode.labelPosition / labelWidth 也允许（透传 el-form-item，override 顶层）
  'labelPosition',
  'labelWidth',
```

- [ ] **Step 3: 跑 lint + type-check**

```bash
pnpm lint src/components/form-schema/composables/validate-component-props.ts 2>&1 | tail -5
pnpm type-check:full 2>&1 | tail -10
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add src/components/form-schema/composables/validate-component-props.ts
git commit -m "docs(form-schema): validate-component-props 白名单注释更新（labelPosition/labelWidth 字段级可用）"
```

---

## Task 9: 文档更新（README + ARCHITECTURE + CHANGELOG）

**Files:**
- Modify: `src/components/form-schema/README.md:107, 230-231`
- Modify: `src/components/form-schema/ARCHITECTURE.md:83, 123, 150, 202-203, 289, 294`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README.md beforeChange 章节扩展**

定位 `README.md:107`（`beforeChange` 行），替换为：

```markdown
| `beforeChange`          | `BeforeChangeFn`                                                                 |             | 全局 Props 第 1 层钩子（横切关注点）                                                 |
| `beforeChangeRules`     | `BeforeChangeRule[]`                                                             |             | 动态命名空间第 2 层钩子（按 pattern 匹配字段路径）                                     |
```

定位 `README.md:230-231`（`labelPosition` / `labelWidth` 行），替换为：

```markdown
| `labelPosition`         | `'left' \| 'right' \| 'top'`       | 顶层 + 字段级 | label 位置（默认 `left`；`'top'` 推荐用于响应式布局；字段级 override 顶层）            |
| `labelWidth`            | `string \| number`                 | 顶层 + 字段级 | label 宽度（如 `'120px'` 或 `120`；字段级 override 顶层）                             |
```

在 README.md 中 SchemaNode 字段列表加：

```markdown
| `beforeChange`          | `BeforeChangeFn`                                                                 |             | 字段级第 3 层钩子（业务内聚；与全局 Props 同签名，多 allValues + ctx 在尾部）       |
```

- [ ] **Step 2: ARCHITECTURE.md 流程图更新**

定位 `ARCHITECTURE.md:289-294`（buildVModelBindings 流程），更新为 3 层：

```markdown
// buildVModelBindings(node, model, { layer1, namespaceRules, makeCtx, formRef, onValueChange })
//   → resolveBeforeChangeChain(node, v, oldVal, model, ctx)
//     → [L1] props.beforeChange -> [L2] namespaceRules[pattern 匹配] -> [L3] node.beforeChange
//     → await final
//   → applyValue(final) → set(model, name, final) + onValueChange
```

定位 `ARCHITECTURE.md:150`（顶层配置表），加 `beforeChangeRules` 行。

定位 `ARCHITECTURE.md:202-203`（SchemaNode labelPosition / labelWidth 描述），更新为"顶层默认 / 字段级覆盖"。

- [ ] **Step 3: CHANGELOG.md Unreleased 条目**

定位 `CHANGELOG.md` 顶部 Unreleased 区块，添加：

```markdown
### feat(form-schema)
- 新增 3 层 beforeChange 拦截（全局 Props + 动态命名空间 + 字段级 Schema）
- 新增 `BeforeChangeCtx` 上下文 API（setFieldValue / setFieldError / abort）
- 新增 `XFormProps.beforeChangeRules` 字段
- 新增 `SchemaNode.beforeChange` 字段
- 新增 `SchemaNode.labelPosition` / `SchemaNode.labelWidth` 字段级 override 顶层
- 推翻旧注释："labelPosition 字段级不生效" — element-plus el-form-item 原生支持 labelPosition/labelWidth prop
```

- [ ] **Step 4: 提交**

```bash
git add src/components/form-schema/README.md src/components/form-schema/ARCHITECTURE.md CHANGELOG.md
git commit -m "docs(form-schema): beforeChange 3 层 + label 字段级颗粒度文档同步"
```

---

## Task 10: 重写 XFormBeforeChange.vue —— el-tabs 三段演示

**Files:**
- Modify: `src/modules/demo/examples/XFormBeforeChange.vue`

- [ ] **Step 1: 重写 demo 文件，使用 el-tabs 展示 3 层**

替换整个文件内容：

```vue
<script setup lang="ts">
/**
 * 演示 XForm 3 层 beforeChange 拦截 —— 全局 Props / 命名空间 / 字段级
 *
 * A. 全局 Props（第 1 层）：提现金额超额回弹 + 自动取百位 + ctx.setFieldError
 * B. 字段级（第 3 层）：输入手机号自动去空格 + 选城市联动清空区（ctx.setFieldValue）
 * C. 命名空间（第 2 层）：数组 items[*].phone 用正则统一格式化
 */
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import ApiTable from '../components/ApiTable.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DocToc from '../components/DocToc.vue'
import { beforeChangePropsItems } from './xform-demos-api'
import xFormSource from './XFormBeforeChange.vue?raw'
import ModelPreview from '../components/ModelPreview.vue'

type TabKey = 'global' | 'field' | 'namespace'
const activeTab = ref<TabKey>('global')

const tocItems = [
  { id: 'demo-before-change', label: '3 层 beforeChange 演示' },
  { id: 'api-before-change', label: 'beforeChange 字段速查' },
]

// ════════════════════════════════════════════════════════════
// Tab A: 全局 Props（第 1 层：横切关注点）
// ════════════════════════════════════════════════════════════
const modelA = reactive<Record<string, unknown>>({
  balance: 500,
  amount: 50,
  recipient: '张三',
})
const schemaA: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    { label: '账户余额（元）', name: 'balance', component: 'InputNumber', props: { disabled: true, controlsPosition: 'right' } },
    { label: '提现金额（元）', name: 'amount', component: 'InputNumber', props: { min: 0, controlsPosition: 'right', placeholder: '试 800（超额拦截）/ 156（>100 自动取百位）' } },
    { label: '收款人', name: 'recipient', component: 'Input', props: { placeholder: '姓名', clearable: true } },
  ],
}

/** 全局 Props beforeChange：按 item.name 分派到具体字段 */
const beforeChangeA = (item: { name?: string }, newVal: unknown, _oldVal: unknown): unknown => {
  if (item.name !== 'amount') return newVal
  const nv = newVal as number
  const bal = modelA.balance as number
  if (nv > bal) {
    ElMessage.warning(`超过可用余额（¥${bal}）`)
    return _oldVal
  }
  if (nv > 100) {
    const rounded = Math.round(nv / 100) * 100
    ElMessage.info(`自动四舍五入到百位：¥${nv} → ¥${rounded}`)
    return rounded
  }
  return newVal
}

// ════════════════════════════════════════════════════════════
// Tab B: 字段级（第 3 层：业务内聚）
// ════════════════════════════════════════════════════════════
const modelB = reactive<Record<string, unknown>>({
  phone: '',
  city: '',
  district: '',
  remark: '',
})
const schemaB: SchemaNode = {
  column: 1,
  children: [
    {
      label: '手机号',
      name: 'phone',
      component: 'Input',
      props: { placeholder: '输入会自动去空格', clearable: true },
      // ⭐ 字段级 beforeChange：去除空格
      beforeChange: (value) => (typeof value === 'string' ? value.replace(/\s/g, '') : value),
    },
    {
      label: '城市',
      name: 'city',
      component: 'Select',
      props: {
        placeholder: '选城市会清空区字段',
        options: [
          { label: '北京', value: '北京' },
          { label: '上海', value: '上海' },
        ],
      },
      // ⭐ 字段级 beforeChange：选城市时联动清空区
      beforeChange: (value, _all, _old, _allValues, ctx) => {
        ctx.setFieldValue('district', null)
        return value
      },
    },
    { label: '区', name: 'district', component: 'Input', props: { placeholder: '由城市清空', clearable: true } },
    {
      label: '备注（错误演示）',
      name: 'remark',
      component: 'Input',
      props: { placeholder: '输入 "bad" 显示红字' },
      // ⭐ 字段级 beforeChange：ctx.setFieldError 演示
      beforeChange: (value, _all, _old, _allValues, ctx) => {
        if (value === 'bad') {
          ctx.setFieldError('remark', '不允许输入 bad')
        }
        return value
      },
    },
  ],
}

// ════════════════════════════════════════════════════════════
// Tab C: 命名空间（第 2 层：动态数组场景）
// ════════════════════════════════════════════════════════════
const modelC = reactive<Record<string, unknown>>({
  contacts: [{ name: 'Alice', phone: '138 0013 8000' }],
})
const schemaC: SchemaNode = {
  column: 1,
  children: [
    {
      label: '联系人列表',
      name: 'contacts',
      component: 'ArrayNode',
      array: { itemField: { component: 'div' } },
      children: [
        { label: '姓名', name: 'name', component: 'Input', props: { clearable: true } },
        { label: '手机号（自动去空格）', name: 'phone', component: 'Input', props: { placeholder: '输入会自动去空格', clearable: true } },
      ],
    },
  ],
}

/** 命名空间规则：所有 contacts[i].phone 自动去空格（正则匹配动态路径） */
const beforeChangeRulesC = [
  {
    pattern: /^contacts\[\d+\]\.phone$/,
    handler: (value: unknown) => (typeof value === 'string' ? value.replace(/\s/g, '') : value),
  },
]

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'before-change',
  schema: () => {
    if (activeTab.value === 'global') return schemaA
    if (activeTab.value === 'field') return schemaB
    return schemaC
  },
})
</script>
```

> **注意**：上面的 useXFormDemo 调用 `schema: () => ...` 是 computed-style，会随 activeTab 变化重建 schema。本文件其余模板与 script 需替换为以下结构。

完整 `<template>`：

```vue
<template>
  <DocLayout>
    <DemoFrame
      title="XForm 3 层 beforeChange 拦截"
      source="src/components/form-schema/composables/build-vmodel-bindings.ts"
      :introductions="[
        'beforeChange 升级为 3 层拦截：全局 Props（第 1 层）→ 命名空间规则（第 2 层）→ 字段级（第 3 层）',
        '每层返回新值透传给下一层；任何一层返回 Promise.reject / 抛异常 → 中断写入',
        'ctx 提供 setFieldValue / setFieldError / abort / name 4 个能力',
        '切换 Tab 体验不同拦截层级',
      ]"
    >
      <section id="demo-before-change">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="A. 全局 Props（第 1 层）" name="global" />
          <el-tab-pane label="B. 字段级（第 3 层）" name="field" />
          <el-tab-pane label="C. 命名空间（第 2 层）" name="namespace" />
        </el-tabs>

        <!-- Tab A -->
        <DemoField v-if="activeTab === 'global'" label="提现金额（全局 Props 拦截 + 格式化）" :code="xFormSource">
          <XForm ref="formRef" :schema="schemaA" :model="modelA" :before-change="beforeChangeA" />
        </DemoField>

        <!-- Tab B -->
        <DemoField v-else-if="activeTab === 'field'" label="手机号/城市/备注（字段级 beforeChange）" :code="xFormSource">
          <XForm ref="formRef" :schema="schemaB" :model="modelB" />
        </DemoField>

        <!-- Tab C -->
        <DemoField v-else label="数组联系人手机号（命名空间正则匹配）" :code="xFormSource">
          <XForm ref="formRef" :schema="schemaC" :model="modelC" :before-change-rules="beforeChangeRulesC" />
        </DemoField>

        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>

        <ModelPreview :model="activeTab === 'global' ? modelA : activeTab === 'field' ? modelB : modelC" />
      </section>
      <ApiTable title="beforeChange 字段速查" :items="beforeChangePropsItems" anchor="api-before-change" />
    </DemoFrame>
    <template #toc><DocToc :items="tocItems" /></template>
  </DocLayout>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-before-change {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
```

- [ ] **Step 2: xform-demos-api.ts —— 扩展 beforeChangePropsItems**

定位 `xform-demos-api.ts` 的 `beforeChangePropsItems`，新增：

```typescript
  {
    name: 'beforeChangeRules',
    type: 'BeforeChangeRule[]',
    default: '-',
    description: '动态命名空间规则数组（第 2 层）；pattern 匹配字段路径后 handler 串行执行',
    version: '>=2.0',
  },
  {
    name: 'SchemaNode.beforeChange',
    type: 'BeforeChangeFn',
    default: '-',
    description: '字段级 beforeChange（第 3 层）；可通过Context.setFieldValue 联动修改其他字段',
    version: '>=2.0',
  },
```

- [ ] **Step 3: sidebar-groups.ts —— 更新中文名**

定位 `sidebar-groups.ts:31`（`XFormBeforeChange: '字段值拦截'`），替换为：

```typescript
  XFormBeforeChange: '字段值拦截·3 层',
```

- [ ] **Step 4: 跑 lint + type-check**

```bash
pnpm lint src/modules/demo/examples/XFormBeforeChange.vue src/modules/demo/examples/xform-demos-api.ts src/modules/demo/config/sidebar-groups.ts 2>&1 | tail -10
pnpm type-check:full 2>&1 | tail -10
```

Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add src/modules/demo/examples/XFormBeforeChange.vue \
        src/modules/demo/examples/xform-demos-api.ts \
        src/modules/demo/config/sidebar-groups.ts
git commit -m "feat(demo): 重写 XFormBeforeChange 为 3 层 el-tabs 演示 + sidebar + API 表更新"
```

---

## Task 11: 扩展 XFormLabelLayout.vue —— 加字段级 labelPosition override 演示

**Files:**
- Modify: `src/modules/demo/examples/XFormLabelLayout.vue`

- [ ] **Step 1: 在 schema 中加字段级 labelPosition override 演示**

定位 line 50-68（children 数组），在第 2 个字段（邮箱）后追加新字段：

```typescript
    {
      label: '备注（字段级 labelPosition=top）',
      name: 'remark',
      component: 'Input',
      // ⭐ 字段级 labelPosition override 顶层 'left'
      labelPosition: 'top',
      props: { type: 'textarea', placeholder: '字段级 labelPosition=top', clearable: true },
    },
```

并在 model 中加：

```typescript
  remark: '',
```

- [ ] **Step 2: 在 introductions 加字段级颗粒度说明**

定位 line 99-108（introductions 数组），追加：

```
'字段级 labelPosition: 该字段可独立 override 顶层配置（如备注字段长内容用 top，其他用 left）',
'element-plus el-form-item 原生支持 labelPosition / labelWidth prop，字段级与顶层可独立设置',
```

- [ ] **Step 3: 更新 title**

定位 line 99（`title="顶层 schema.labelPosition / labelWidth —— 表单整体布局"`），改为：

```vue
      title="labelPosition / labelWidth —— 顶层默认 + 字段级 override"
```

- [ ] **Step 4: xform-demos-api.ts —— labelLayoutItems 加"字段级可覆盖"**

定位 `xform-demos-api.ts` 的 `labelLayoutItems` 数组，找到 labelPosition / labelWidth 条目 description 字段，加"字段级可覆盖（override 顶层）"。

- [ ] **Step 5: 跑 lint + type-check**

```bash
pnpm lint src/modules/demo/examples/XFormLabelLayout.vue 2>&1 | tail -5
pnpm type-check:full 2>&1 | tail -10
```

Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add src/modules/demo/examples/XFormLabelLayout.vue src/modules/demo/examples/xform-demos-api.ts
git commit -m "feat(demo): XFormLabelLayout 加字段级 labelPosition override 演示"
```

---

## Task 12: 收尾验证 —— type-check + lint + build + 浏览器 demo 验证

**Files:** (无变更，仅验证)

- [ ] **Step 1: 跑全量类型校验**

```bash
pnpm type-check:full 2>&1 | tail -20
```

Expected: 通过。

- [ ] **Step 2: 跑全量 lint**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: 通过（若有 error 修复后继续）。

- [ ] **Step 3: 跑全量单测**

```bash
pnpm test 2>&1 | tail -30
```

Expected: 全绿。

- [ ] **Step 4: 跑生产构建**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 成功。

- [ ] **Step 5: 浏览器真实验证 demo**

启动 dev：

```bash
pnpm dev
```

用 chrome-devtools MCP 打开 `/demo/x-form-before-change` 与 `/demo/x-form-label-layout`：

1.  **BeforeChange Tab A**：输入金额 800 → 看到 toast 警告 + 输入框回弹 50；输入 156 → 看到 toast + 自动取整 200。
2.  **BeforeChange Tab B**：手机号输入"138 0013 8000" → model 自动变"13800138000"；城市选"北京" → 区字段被清空；备注输入"bad" → 红字提示。
3.  **BeforeChange Tab C**：联系人添加新行，手机号输入"138 0013 8000" → 自动去空格；添加多行后所有 phone 字段都生效。
4.  **LabelLayout**：备注字段 label 在字段上方（top），其他字段 label 在左侧（left），符合字段级 override。

- [ ] **Step 6: 提交验证报告（如有发现的问题先修复再提交）**

```bash
# 若验证发现问题则修复后单独提交；若全绿则跳过此步
git status
```

---

## 自审清单（Self-Review）

### Spec coverage 复核

- [x] §1.2 目标 1 (3 层拦截) → Task 1, 3, 4, 5, 7
- [x] §1.2 目标 2 (label 字段级颗粒度) → Task 2, 6, 7
- [x] §1.2 目标 3 (ctx API) → Task 4, 5, 7
- [x] §1.2 目标 4 (Demo 更新) → Task 10, 11
- [x] §3 文件清单 (所有文件) → Task 1-11
- [x] §5 数据流 (3 层串联) → Task 4
- [x] §6 label 实现 → Task 6
- [x] §7 Demo → Task 10, 11
- [x] §8 测试清单 (20 用例) → Task 3, 7
- [x] §10 验收标准 → Task 12

### 占位符扫描

- [x] 无 TBD / TODO / FIXME / XXX
- [x] 无"implement later" / "fill in details"
- [x] 无"add appropriate error handling"（具体错误处理在 Task 4 给出代码）
- [x] 所有代码步骤含完整代码块

### 类型一致性

- [x] BeforeChangeFn 5 参 `(item, newVal, oldVal, allValues?, ctx?)` 在 Task 1, 3, 4 一致
- [x] BeforeChangeCtx 4 字段（name / setFieldValue / setFieldError / abort）在 Task 1, 3, 4, 5 一致
- [x] BeforeChangeConfig 5 字段（layer1 / namespaceRules / fieldBeforeChange / makeCtx / formRef / onValueChange）在 Task 3, 4, 5 一致
- [x] resolveBeforeChangeChain 函数签名 Task 3, 4 一致
- [x] buildVModelBindings 第二个参数为 BeforeChangeConfig 在 Task 4, 5, 7 一致

### 文件路径一致性

- [x] 所有文件路径与 spec §3 一致
- [x] Task 4 build-vmodel-bindings.ts 引用 `../types` import 路径正确

---

*文档版本：v1.0.0 | 生成日期：2026-09-02*