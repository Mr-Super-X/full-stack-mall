# XFormReactionAdvanced —— reaction 进阶场景 demo 设计文档

> 为 `form-schema` 组件的 reaction 联动补一个进阶 demo 页面（`XFormReactionAdvanced.vue`），覆盖真实业务里比基础场景更复杂的 4 类 reaction 用法，作为业务侧参考代码。

| 属性 | 值 |
|------|-----|
| 版本 | v1.0.0 |
| 日期 | 2026-08-27 |
| 状态 | 设计稿待用户复核 |
| 关联项目 | `vue3-vite-project` |
| 关联分支 | `feature/form-engine` |
| 关联文档 | `docs/superpowers/specs/2026-08-19-form-schema-design.md`（form-schema 总设计） |
| 上游 demo | `src/modules/demo/examples/XFormReaction.vue`（基础 4 场景） |

---

## 1. 背景 & 需求

### 1.1 现状

`XFormReaction.vue`（301 行）覆盖了 4 个基础场景：

1. `debounce` 远程搜索
2. `throttle` 自动保存
3. `sync` 联动禁用（Switch → Select disabled）
4. `sync` 联动显隐（Switch → Input hidden，必填同步恢复）

但 `use-reaction.ts` 暴露的真实能力远超这 4 个场景：

| 能力 | 现状 | 是否被 demo 覆盖 |
|------|------|----------|
| 字面量 / 函数 / `{{ fn }}` 三种值 | 实现完整 | 隐含；`{{ }}` 仅在 `XFormExpression.vue` 演示 |
| `strategy: 'sync' \| 'debounce' \| 'throttle'` + `delay` | 实现完整 | ✅ 现有 demo |
| **`deps` 精确监听（lodash 路径）** | 实现完整 | ❌ README 第 281 行提及但 demo 未落地 |
| **写 model 副作用** | 实现完整（见 use-reaction.ts applyReactionFields） | ⚠️ 现有 demo 把计数器写到 model 外部 hack，未演示"写 model 又避免死循环"的安全写法 |
| **数组项内嵌 reaction** | 实现完整（见 use-reaction.ts 第 159-166 行 `kind: 'array'` 递归） | ❌ |
| **反应式 props / rules / options / label** | 实现完整（任意 node 字段都可反应式） | ❌ |
| **跨字段级联清空** | 业务常见，需配合 `node.on.change` 写 model | ❌ |
| 预算兜底（防 reaction 循环联动卡死） | 实现完整 | 单元测试覆盖 |

README 第 281-287 行的示例提到 `deps: ['qty', 'price']` 但没落地。

### 1.2 目标

新建一个独立 demo `XFormReactionAdvanced.vue`，以 4 个真实业务场景为载体，演示 reaction 的进阶用法：

1. **计算字段 + deps 精确监听** — 实时合计（数量 × 单价 × 折扣 = 折后价），用 `deps` 精确监听 + 函数内写 model 的安全写法
2. **跨字段级联清空** — 省/市/区三级级联 + 改了上级清空下级；商品类型切换清空型号
3. **反应式 props / rules / options 动态切换** — 度量单位切换 → label/min/max/precision/placeholder 全部联动
4. **数组行内嵌 reaction** — 多行采购明细，每行数量 × 单价 = 小计，每行「含税/不含税」切换显示/隐藏税率字段并参与小计

每个场景独立成节，**配真实业务语义 + 计数器 / 状态面板可视化联动效果**，让读者点开 demo 即可看到「一个 reaction 函数在真实表单里是怎么落地的」。

### 1.3 范围

**包含**：

- 新 demo `src/modules/demo/examples/XFormReactionAdvanced.vue`（≤ 300 行）
- sidebar 配置 `src/modules/demo/config/sidebar-groups.ts` 加一条 `XFormReactionAdvanced: '反应式联动·进阶'`
- demo 关联 API 数据追加（新增 4 个 ApiTable 项到 `xform-demos-api.ts` 或复用 `reactionItems`）
- CHANGELOG.md `Unreleased` 记录

**不包含**（YAGNI）：

- 新增 reaction API / 修改 `use-reaction.ts` / `types.ts`（能力已存在，本任务只补 demo）
- 新增单元测试（API 不变；demo 是端到端演示，由浏览器验证）
- 修改 `XFormReaction.vue`（基础 demo 保持不动；按用户决策拆出独立 demo 避免 300 行超限）
- 新增 demo 路由（`routes/index.ts` 的 `import.meta.glob` 自动注册，零路由配置）

---

## 2. 关键决策摘要

| # | 决策维度 | 选择 | 关键依据 |
| --- | -------------- | --------------------------------------- | ---------------------------------------- |
| 1 | 文件归属 | 新建独立 demo `XFormReactionAdvanced.vue` | 现有 `XFormReaction.vue` 已 301 行，4 个进阶场景再追加必超 300 行上限；按用户决策拆为独立文件 |
| 2 | sidebar 命名 | `反应式联动·进阶` | 中文名体现进阶关系，参考 `数组节点` vs `数组行拖拽排序` 的并列命名风格 |
| 3 | 场景组合方式 | 单一 XForm + 4 个 Card 分区，共享 model/formRef | 真实业务单表单多联动；共享 model 减少状态管理负担；Card 分区天然隔离视觉 |
| 4 | model 命名空间 | `model.calc.* / model.cascade.* / model.dynamic.* / model.array.*` | 4 个分区用前缀隔离字段，避免同名冲突；贴近中后台真实字段命名风格 |
| 5 | 副作用输出位置 | 反应式计算结果回写 model 子字段（如 `model.calc.total`），通过外层 `v-model`/`computed` 展示 | 演示「reaction 函数内写 model + deps 精确监听避开自触发」的安全写法；不沿用 XFormReaction 的「写到 model 外」hack |
| 6 | 数组行 deps 路径 | 相对路径（如 `'qty'`），不写 `array.items.0.qty` | use-reaction.ts 第 118 行 `get(model, d)` 在数组行 model 子树内即相对路径；与组件实现一致 |
| 7 | 计数器/日志面板 | 4 个 section 各配 1 个 ref 计数；汇总放 demo 底部 | 可视化联动效果（计算次数、字段清空次数等），让用户一眼看到 reaction 是否被触发 |

---

## 3. 架构与文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/modules/demo/examples/XFormReactionAdvanced.vue` | 新增 | demo 主文件（≤ 300 行） |
| `src/modules/demo/config/sidebar-groups.ts` | 修改 | `CN_NAMES` 追加 `XFormReactionAdvanced: '反应式联动·进阶'` |
| `src/modules/demo/examples/xform-demos-api.ts` | 修改 | 追加 4 个 ApiTable 数据（每 section 一组，或合并 1 组），描述 reaction 进阶字段 |
| `CHANGELOG.md` | 修改 | Unreleased 段追加条目 |

**零改动**：

- `use-reaction.ts` / `types.ts` / `XForm.vue` — reaction 能力已完整，不动核心
- `XFormReaction.vue` — 基础 demo 不动（用户决策：拆出独立 demo）
- `routes/index.ts` — `import.meta.glob` 自动注册新 demo 组件

**依赖**：无新增 npm 包；用到的 `lodash-es get` 已在 use-reaction.ts 内部使用，demo 不直接引用。

**模块边界**：demo 在 `modules/demo/`，引用 `components/form-schema/` 公共出口（`XForm.vue` / `types.ts`），不跨模块深路径。

---

## 4. demo 设计：4 个 section

demo 用单一 XForm + 4 个 Card 容器分区，共享 model。

### 4.1 顶层结构

```ts
const model = reactive({
  // Section ① 计算字段 + deps
  calc: { qty: 1, price: 100, discount: 1, total: 100, calcCount: 0 },
  // Section ② 跨字段级联清空
  cascade: {
    province: '', city: '', district: '', itemType: '', model: '',
    clearCount: 0,
  },
  // Section ③ 反应式 props/rules/options 动态切换
  dynamic: { metric: 'weight', value: 0, discountLevel: 'normal' },
  // Section ④ 数组行内嵌 reaction
  array: {
    rows: [
      { id: 1, name: '商品 A', qty: 1, price: 100, taxed: false, taxRate: 0.13, subtotal: 100 },
    ],
  },
})

const schema: SchemaNode = {
  column: 1,
  children: [
    /* 4 个 Card 节点，每个含一组字段 + reaction */
  ],
}
```

### 4.2 Section ① 计算字段 + deps 精确监听（购物车小计）

业务语义：数量 × 单价 × 折扣 = 折后价，实时计算；其他字段变化不触发重算。

```ts
{
  component: 'Card',
  props: { header: '① 计算字段 + deps 精确监听（购物车小计）' },
  column: 4,
  children: [
    { name: 'calc.qty', label: '数量', component: 'InputNumber', props: { min: 1, controlsPosition: 'right' } },
    { name: 'calc.price', label: '单价', component: 'InputNumber', props: { min: 0, precision: 2, controlsPosition: 'right' } },
    { name: 'calc.discount', label: '折扣', component: 'InputNumber', props: { min: 0, max: 1, step: 0.1, precision: 1, controlsPosition: 'right' } },
    {
      name: 'calc.total',
      label: '折后价（自动计算）',
      component: 'InputNumber',
      props: { precision: 2, controlsPosition: 'right' },
      reaction: {
        // ★ 关键：deps 精确监听 3 个字段，其他字段（如 cascade.*）变化不触发
        deps: ['calc.qty', 'calc.price', 'calc.discount'],
        // ★ 关键：函数内通过闭包写 model 副作用（演示 reaction 写 model）
        // deps 精确监听切断自触发 → 不会死循环
        // 注意：reaction 的字段返回值最终写入 node[field]，本字段没用上，
        // 副作用完全靠闭包写 model.calc.total + model.calc.calcCount
      },
      on: {
        // 监听 deps 三个字段变化 → 重算 total；用 on.change 写 model 是更显式的方式
        // 但 on.change 只在用户输入触发；programmatic 修改 model 不会触发
        // 所以选择：reaction 函数内部做副作用（demo 必须展示 deps 切断自触发）
      },
    },
  ],
}
```

**关键设计**：reaction 函数体本身在 setup 同步跑一次 + 后续 deps 变化时跑。函数体内通过闭包写 `model.calc.total = qty * price * discount`，因为 deps 是精确监听，`model.calc.total` 的写入不再触发该 reaction（deps 不含 `calc.total`）→ 安全无环。

副作用计数 `model.calc.calcCount++` 也写在闭包里，用于可视化「deps 精确监听确实只在 3 个字段变化时触发」。

**对比现有 demo hack**：现有 `XFormReaction.vue` 把计数器放到 `model` 外的 `ref(0)`，是因为未声明 deps → deep watch 整棵 model → 写 model 任何字段都触发。声明 deps 后闭包写 model 是安全的。

### 4.3 Section ② 跨字段级联清空（省市区 + 商品型号）

业务语义：地址三级级联 + 商品类型/型号联动，改上级自动清空下级。

```ts
{
  component: 'Card',
  props: { header: '② 跨字段级联清空（省市区 + 商品型号）' },
  column: 3,
  children: [
    {
      name: 'cascade.province', label: '省份', component: 'Select',
      props: { options: PROVINCES, clearable: true },
      on: {
        change: () => {
          // 关键：node.on.change 写 model 是显式副作用，不依赖 reaction
          model.cascade.city = ''
          model.cascade.district = ''
          model.cascade.clearCount++
        },
      },
    },
    {
      name: 'cascade.city', label: '城市', component: 'Select',
      props: { options: CITIES_BY_PROVINCE, clearable: true },
      reaction: {
        // 城市 options 随省份变化（用本地静态字典模拟真实业务）
        props: (m) => ({ options: CITIES_BY_PROVINCE[m.cascade.province] ?? [] }),
      },
      on: {
        change: () => { model.cascade.district = '' },
      },
    },
    {
      name: 'cascade.district', label: '区/县', component: 'Select',
      props: { options: DISTRICTS_BY_CITY, clearable: true },
      reaction: {
        props: (m) => ({ options: DISTRICTS_BY_CITY[m.cascade.city] ?? [] }),
      },
    },
    {
      name: 'cascade.itemType', label: '商品类型', component: 'Select',
      props: { options: ITEM_TYPES, clearable: true },
      on: {
        change: () => {
          // 改类型清空型号
          model.cascade.model = ''
          model.cascade.clearCount++
        },
      },
    },
    {
      name: 'cascade.model', label: '型号', component: 'Select',
      props: { options: MODELS_BY_TYPE, clearable: true },
      reaction: {
        props: (m) => ({ options: MODELS_BY_TYPE[m.cascade.itemType] ?? [] }),
      },
    },
  ],
}
```

**关键设计**：
- 上级字段用 `node.on.change` 写 model 清空下级（最显式、最常见）
- 下级字段用 `reaction.props` 动态切换 options（按上级值查表）
- 计数器 `clearCount` 可视化「清空动作被触发了多少次」

### 4.4 Section ③ 反应式 props/rules/options 动态切换（度量单位切换）

业务语义：度量单位在「重量/体积/数量」之间切换 → label / min / max / precision / placeholder 全部联动。

```ts
{
  component: 'Card',
  props: { header: '③ 反应式 props/rules/options 动态切换' },
  column: 2,
  children: [
    {
      name: 'dynamic.metric', label: '度量单位', component: 'RadioGroup',
      props: {
        options: [
          { value: 'weight', label: '重量 (kg)' },
          { value: 'volume', label: '体积 (m³)' },
          { value: 'count', label: '数量 (件)' },
        ],
      },
    },
    {
      name: 'dynamic.value', component: 'InputNumber',
      reaction: {
        // ★ 关键：单个字段 label + props 同时联动
        // 注意 use-reaction.ts 是直接赋值 target[key] = value，不是深合并
        // 所以 reaction.props 返回的对象会完全替换原 props
        // 写法：schema.props 只放静态字段，反应式变化的全量字段都放到 reaction.props
        label: (m) => METRIC_LABEL[m.dynamic.metric],
        props: (m) => ({
          min: METRIC_MIN[m.dynamic.metric],
          max: METRIC_MAX[m.dynamic.metric],
          precision: METRIC_PRECISION[m.dynamic.metric],
          placeholder: METRIC_PLACEHOLDER[m.dynamic.metric],
          controlsPosition: 'right', // 静态部分保留在 reaction 里
        }),
      },
      rules: '{{ (m) => m.dynamic.value > 0 ? [] : [{ required: true, message: \'必须 > 0\' }] }}',
    },
    {
      name: 'dynamic.discountLevel', label: '折扣等级', component: 'Select',
      props: {
        options: [
          { value: 'normal', label: '普通 (无折扣)' },
          { value: 'silver', label: '银卡 (95 折)' },
          { value: 'gold', label: '金卡 (9 折)' },
          { value: 'diamond', label: '钻石 (8 折)' },
        ],
        clearable: true,
      },
    },
    {
      name: 'dynamic.discountRate', label: '折扣率（自动）', component: 'InputNumber',
      props: { disabled: true, precision: 2, controlsPosition: 'right' },
      reaction: {
        deps: ['dynamic.discountLevel'],
        // 计算结果闭包写 model.dynamic.discountRate，避开自触发
      },
    },
  ],
}
```

**关键设计**：
- `reaction.label` + `reaction.props` 同时联动：演示「单个 reaction 节点可同时控制多个 node 字段」
- `reaction.props` 返回完整 props 对象（因为 use-reaction 是赋值非合并，不能只返回差异字段）
- `rules` 用 `{{ fn }}` 表达式形式：演示与 reaction 的协同（reaction 控制 props，表达式控制 rules）

### 4.5 Section ④ 数组行内嵌 reaction（采购明细行内联动）

业务语义：多行采购明细，每行：数量 × 单价 = 小计；「含税/不含税」切换 → 显示/隐藏税率字段 + 税率参与小计。

```ts
{
  component: 'Card',
  props: { header: '④ 数组行内嵌 reaction（采购明细行内联动）' },
  column: 1,
  children: [
    {
      kind: 'array',
      name: 'array.rows',
      label: '采购明细',
      array: {
        initialLength: 2,
        itemSchema: {
          column: 6,
          children: [
            { name: 'name', label: '商品', component: 'Input' },
            { name: 'qty', label: '数量', component: 'InputNumber', props: { min: 1 } },
            { name: 'price', label: '单价', component: 'InputNumber', props: { precision: 2 } },
            { name: 'taxed', label: '含税', component: 'Switch' },
            {
              name: 'taxRate', label: '税率', component: 'InputNumber',
              props: { min: 0, max: 1, step: 0.01, precision: 2 },
              reaction: {
                // 行内 reaction 写 deps 路径用相对路径（get(model, d) 在行内 model 子树生效）
                hidden: (m) => !m.taxed,
              },
            },
            {
              name: 'subtotal', label: '小计', component: 'InputNumber',
              props: { precision: 2, disabled: true },
              reaction: {
                // 行内 deps 用相对路径，不写 array.rows.0.qty
                deps: ['qty', 'price', 'taxed', 'taxRate'],
                // 计算并写 model.*.subtotal（闭包写 model，deps 精确监听切断自触发）
              },
            },
          ],
        },
      },
    },
  ],
}
```

**关键设计**：
- `kind: 'array'` + `array.itemSchema` 演示 use-reaction 第 159-166 行的数组节点递归注册
- 行内 `reaction.deps` 用相对路径（`'qty'` 而非 `'array.rows.0.qty'`）：因 use-reaction 用 `get(model, d)`，在行内 model 子树上即相对解析
- 行内 `reaction.hidden` 控制税率字段显隐
- 行内小计字段闭包写 model 行内的 subtotal，演示「行内 reaction 写行内 model 的安全模式」

---

## 5. 文件结构与行数估算

```text
src/modules/demo/examples/XFormReactionAdvanced.vue  (≤ 300 行)
├─ <script setup>
│   ├─ imports (~10 行)
│   ├─ 静态字典 (PROVINCES / CITIES_BY_PROVINCE / ITEM_TYPES / METRIC_*) (~25 行)
│   ├─ model 初始化 (~15 行)
│   ├─ schema (4 个 Card 节点) (~120 行)
│   ├─ formRef + onSave + copySchema + tocItems (~30 行)
│   └─ 子模板用到的 constants (~5 行)
├─ <template>
│   ├─ DocLayout + DemoFrame + 4 个 DemoField section (~70 行)
│   └─ 4 个 ApiTable (~10 行)
└─ <style lang="scss"> (~25 行)
合计：约 310 行（临界；需要小心控制 schema 注释精简）
```

**控制行数的策略**：

- 静态字典（PROVINCES 等）拆到独立 `cascader-data.ts` mock 文件（demo 模块内私有）
- schema 内每个 reaction 函数保留必要的「关键设计」注释（≤ 2 行），复杂说明放 introductions 数组
- ApiTable 数据复用现有 `reactionItems`，仅追加 1 组进阶字段说明

---

## 6. 验收标准

1. `pnpm dev` 启动后 `http://localhost:5173/demo/xform-reaction-advanced` 可访问
2. sidebar 出现「XFormReactionAdvanced 反应式联动·进阶」条目，点击进入新 demo
3. 4 个 section 在同一 XForm 表单中正常渲染，无 TS / ESLint 报错
4. 视觉验证清单：
   - Section ①：输入数量/单价/折扣 → 折后价实时更新；改动其他分区字段 → 折后价不变；计数器 `calcCount` 仅在 3 个字段变化时 +1
   - Section ②：选省份 → 城市 options 切换 + 城市/区清空；改城市 → 区清空；选商品类型 → 型号清空；`clearCount` 计数同步
   - Section ③：切度量单位 → label / min / max / precision / placeholder 全部联动；切折扣等级 → 折扣率实时更新
   - Section ④：每行改数量或单价 → 小计更新；切换含税 → 税率字段显隐；税率变化参与小计计算
5. `pnpm test` 全绿；`pnpm type-check:full` 通过；`pnpm lint` 通过
6. demo 行数 ≤ 300 行（不含 mock 数据文件）
7. CHANGELOG.md Unreleased 段已记录

---

## 7. 风险登记

| 风险 | 等级 | 对策 |
|------|------|------|
| demo 超 300 行 | 中 | 静态字典外置 mock 文件；reaction 函数注释精简 |
| `reaction.props` 完全替换而非合并的陷阱 | 中 | demo 注释明确说明「reaction.props 需返回完整对象」；不混用静态 props 与反应式 props |
| 数组行 reaction 闭包写 model 的循环联动 | 低 | deps 精确监听 + use-reaction 的预算兜底双保险 |
| 多个 reaction 共享 formRef/memo 时跨字段污染 | 低 | 4 个 section 用命名空间前缀（`calc.` / `cascade.` 等），model 字段不重名 |

---

## 8. 不在范围

- 新增 reaction 能力 / API（如 `reaction.batch`、`reaction.once` 等）
- 新增 `useFieldReaction` composable（业务组件之外不暴露）
- 数组行拖拽排序与行内反应式联动组合（已在 `XFormArrayDraggable.vue` 演示拖拽）
- 表单与 Pinia store / Vue Router 的深度联动（属于业务集成，非 demo 主题）

---

*文档版本：v1.0.0 | 生成日期：2026-08-27 | 状态：待用户复核*
