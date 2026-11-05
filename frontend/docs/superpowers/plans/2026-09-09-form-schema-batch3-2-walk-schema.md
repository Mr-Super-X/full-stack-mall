# Form-Schema 批次 3-2 实施计划（M5 抽 walkSchema 公共遍历器）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 M5 —— schema 树「children / slots / formItem.slots / array.itemSchema」四向递归在 7 处手写（审计 §2.2 M5），抽 `walkSchema(node, visitor, opts?)` 公共遍历器。新增容器字段类型从改 5+ 处降到改 1 处（walkSchema 内部）。

**盘点结论（2026-09-09，7 处形态矩阵见审计文档 M5）：**

| # | 位置 | 形态 | 迁移策略 |
| --- | --- | --- | --- |
| 1 | `use-reaction.ts` containsReaction | 同步 + early-exit + 五向 | ✅ 迁移（visit 返回 false 终止） |
| 2 | `use-reaction.ts` applyReactions | 同步副作用 + 五向 | ✅ 迁移（visit 闭包携带 model/stoppers/budget/resolve） |
| 3 | `use-schema-renderer.ts` registerAsyncOptions | 同步副作用 + **children/slots 两向** | ⚠️ 迁移但 `opts` 关闭 formItemSlots/arrayItemSchema，**保留既有漏遍历行为**（行为修复不属本批次） |
| 4 | `use-schema-renderer.ts` containsAsyncOptions | 同步 + early-exit + 五向 | ✅ 迁移 |
| 5 | `use-validate.ts` traverseCross | **模型驱动异步**（array 按 model 行展开） | ❌ 不迁移（语义本质不同） |
| 6 | `use-validate.ts` collectCrossRuleFields 内 traverse | 同步 visitor + 四向（无 node.slots）+ **keyPath 死参数** | ✅ 迁移 + 删 keyPath 死参数 |
| 7 | `use-schema-index.builder.ts` traverse | 同步 visitor + 四向（无 node.slots）+ isSchemaNodeLike 守卫 | ✅ 迁移（守卫内聚进 walkSchema） |

**核心约束 —— 行为等价优先：** 各调用方遍历方向集合不一致且不一致是有行为的（如 buildIndex 补 node.slots 会改变 fieldNames/byName/dirty 追踪范围）。walkSchema 用 opts 参数化方向，各调用方保持现有方向集合，**零行为变化**。

**Architecture:**
- **新增**：`src/components/form-schema/utils/walk-schema.ts`（§2.3 例外：用户在批次 3 确认时已批准「抽 walkSchema 公共遍历器」，此处显式记录）
- **API 设计**：
  ```ts
  export interface WalkSchemaOptions {
    includeNodeSlots?: boolean      // 默认 true
    includeFormItemSlots?: boolean  // 默认 true
    includeArrayItemSchema?: boolean // 默认 true
  }
  /** visit 返回 false 终止整个遍历（early-exit） */
  export function walkSchema(
    node: SchemaNode | SchemaNode[] | undefined,
    visit: (n: SchemaNode) => void | false,
    opts?: WalkSchemaOptions
  ): void
  ```
- **守卫内聚**：formItem.slots 的值可能是 string/VNode/函数 —— walkSchema 内部统一 `isSchemaNodeLike` 启发式守卫（从 builder.ts :154-166 迁入），slots 函数值一律 skip
- **不迁移**：traverseCross（#5）保持独立，文件头注释加 `@see utils/walk-schema` 说明为何不复用

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest

**前置批准（src/ Architecture Lockdown §2.4）：** 新增 1 个 util 文件 + 1 个 spec 文件（见上），其余全部修改落在既有文件内。

---

### Task 1: walkSchema util + spec（TDD）

**Files:**
- Create: `src/components/form-schema/utils/walk-schema.ts`
- Create: `src/components/form-schema/utils/walk-schema.spec.ts`

- [x] **Step 1: 写 spec（先失败）**
  - 用例：children 数组/单对象、node.slots（skip 函数 + object/array）、formItem.slots（isSchemaNodeLike 守卫：string/VNode-like 跳过）、array itemSchema（数组/单对象）、visit 返回 false 终止、opts 三方向独立关闭、数组根节点
- [x] **Step 2: 实现 walkSchema**
- [x] **Step 3: 跑 spec 确认通过**

### Task 2: 迁移 early-exit 形态（#1 containsReaction + #4 containsAsyncOptions）

**Files:**
- Modify: `src/components/form-schema/composables/use-reaction.ts`
- Modify: `src/components/form-schema/composables/use-schema-renderer.ts`

- [x] **Step 1: 两处替换为 walkSchema + 跑 use-reaction.spec / use-schema-renderer.spec 回归**
- 注意：containsReaction 的 `found` 逻辑变为 `walkSchema(schema, (n) => { if (命中) { found = true; return false } })`
- 实施备注：slots 守卫从「正例启发式」翻转为「反向守卫（只跳过 __v_isVNode）」——正例守卫会漏遍历退化节点（slots 内仅 `{ reaction }` 单字段对象），use-reaction.spec 四向用例回归失败暴露了这一点；已在 walk-schema.spec 补退化节点契约用例锁定

### Task 3: 迁移副作用形态（#2 applyReactions + #3 registerAsyncOptions）

**Files:**
- Modify: `src/components/form-schema/composables/use-reaction.ts`
- Modify: `src/components/form-schema/composables/use-schema-renderer.ts`

- [x] **Step 1: applyReactions 递归主体换 walkSchema（visit 闭包携带 model/stoppers/budget/resolve；H1 归一化 delete 逻辑留在 visit 内不动）**
- [x] **Step 2: registerAsyncOptions 换 walkSchema，`opts: { includeFormItemSlots: false, includeArrayItemSchema: false }` + 注释说明「保留既有漏遍历行为，行为修复不在本批次」**
- [x] **Step 3: 跑回归**

### Task 4: 迁移 visitor 形态（#6 collectCrossRuleFields + #7 buildIndex）

**Files:**
- Modify: `src/components/form-schema/composables/use-validate.ts`
- Modify: `src/components/form-schema/composables/use-schema-index.builder.ts`
- Modify: `src/components/form-schema/composables/use-validate.spec.ts`（如 keyPath 断言存在）

- [x] **Step 1: #6 删 keyPath 死参数 + 换 walkSchema（opts 关 includeNodeSlots）；#7 删本地 traverse/isSchemaNodeLike 换 walkSchema（同 opts）**
- [x] **Step 2: 跑 use-validate.spec / use-schema-index.builder.spec 回归**
- [x] **Step 3: traverseCross 文件头加 `@see ../utils/walk-schema` 注释（说明模型驱动不复用原因）**

### Task 5: 全量回归 + 文档同步 + 收尾

**Files:**
- Modify: `src/components/form-schema/ARCHITECTURE.md`（utils 目录行）
- Modify: `docs/superpowers/specs/2026-09-09-form-schema-arch-audit.md`（批次 3 表格 3-2 标完成）

- [x] **Step 1: `pnpm test` + `pnpm type-check:full` + `pnpm check:doc-currency` + `pnpm lint` 全绿**（129 文件 / 1656 用例全过；type-check 0 error；doc-currency 5/5；lint 0）
- [x] **Step 2: 文档同步**
- [x] **Step 3: 合规简报（src/ 写操作清单）**
