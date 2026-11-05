# XForm

> 基于 schema DSL 的动态表单组件 · 参考开源 form-schema 实现

## 30 秒上手

```vue
<XForm :schema="schema" :model="form" />
```

```ts
const form = reactive({ email: '' })

const schema = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  defaultValue: 'a@b.com',
  rules: [{ required: true, type: 'email', message: '请输入有效邮箱' }],
}
```

完整 demo 在 `/demo/xform-minimum-demo`（详见 `src/modules/demo/examples/XForm/`，路由由 `src/modules/demo/routes/index.ts` 自动派生）。

---

## 文档导航图

XForm 共有 5 份文档 + 56 个 XForm demo + 4 个通用组件 demo（AsyncState / ErrorBoundary / Dict / RichTextEditor，位于 `examples/` 根），按角色 / 任务选读，避免到处翻：

| 你的角色 / 任务                                 | 先看这个                                                | 再看这个                                                                          | 跳过            |
| ----------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| **新人首次集成**（5 分钟上手）                  | 本 README 上方「30 秒上手」                             | `/demo/xform-minimum-demo`                                                        | —               |
| **业务开发者集成 XForm**                        | 本 README「DSL 字段速查表」+「链式构建器」+「决策指南」 | `/demo/xform-base`                                                                | ARCHITECTURE.md |
| **想理解底层机制**（reaction / 跨字段 / dirty） | ARCHITECTURE.md §3-5                                    | 对应 demo（`/demo/xform-reaction` `/demo/xform-cross-field` `/demo/xform-dirty`） | —               |
| **排查 bug 或自定义场景**                       | 本 README「故障排查」+「自定义组件类型扩展」            | `types/TYPE-CAST-AUDIT.md`（85 处类型断言归因）                                   | —               |
| **架构师 / 重构决策**                           | `ARCHITECTURE.md` §1-13                                 | `types/TYPE-CAST-AUDIT.md` + 项目根 `CLAUDE.md` §1-2                              | 各 demo         |

### 文档清单

| 文件                                                                 | 内容                                    | 受众                     |
| -------------------------------------------------------------------- | --------------------------------------- | ------------------------ |
| `src/components/form-schema/README.md`（本文件）                     | API 速查 + 上手 demo 入口               | 业务开发者（**最先读**） |
| `src/components/form-schema/ARCHITECTURE.md`                         | 设计原则 + 数据流 + 决策记录            | 进阶 / 架构师            |
| `src/components/form-schema/types/TYPE-CAST-AUDIT.md`                | 85 处 `as never` 归因（C1-C9 根因分类） | 维护者                   |
| `src/components/form-schema/composables/*.ts` 头部 JSDoc             | 各 composable 的设计意图                | 维护者                   |
| 项目根 `docs/24-XForm使用指南.md` + `docs/25-XForm架构与决策记录.md` | 历史决策档案 + 业务实战                 | 进阶 / 历史追溯          |

> **速记口诀**：先看 README 速查 → 跑对应 demo → 卡住了查 ARCHITECTURE → 改 cast 查 TYPE-CAST-AUDIT

### 小白上手路径（新人入门 4 步走）

> 共 56 个 XForm demo（`examples/XForm/`）+ 4 个通用组件 demo（`examples/` 根），按「先建体感 → 再深入单能力 → 最后查缺补漏」三阶段阅读，避免在 50+ demo 间来回跳转。

| 阶段                           | 路径                                                                  | 目标                                                                                 | 耗时   |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| **① 5 分钟建体感**             | `/demo/xform-minimum-demo` → `/demo/xform-base`                       | 跑通「写 schema → 传 model → 渲染 → 校验」最小闭环                                   | 5 min  |
| **② 30 分钟看完整业务形态**    | `/demo/xform-order-create`（**新人首选**）                            | 一个 demo 串联 7 大能力：基础校验 / 跨字段 / 反应式 / 异步级联 / 数组 / 草稿 / dirty | 30 min |
| **③ 按需深入单能力**           | reaction / dirty / persist / upload / array / cross-field（按症状选） | 单独吃透某个能力                                                                     | 半天   |
| **④ 查缺补漏（2026-09 新增）** | 见下方「补全 demo」清单                                               | 补齐 README §props / §schema 字段中**零示例**的能力点                                | 按需   |

#### 补全 demo 清单（2026-09 新增，10 个）

> 此前 README 列出的 props / 实例方法 / schema 字段中存在「无独立 demo」的能力点，本批新增 demo 一一覆盖。

| 路由                                 | 演示的能力点                                                            | 重要性 | 文件                            |
| ------------------------------------ | ----------------------------------------------------------------------- | ------ | ------------------------------- |
| `/demo/xform-before-change`          | `XFormProps.beforeChange` 拦截器（值写入 model 前）                     | 🥇 P0  | `XFormBeforeChange.vue`         |
| `/demo/xform-zod`                    | `XFormProps.zodSchema` + `validateWithZod()` 异步校验                   | 🥇 P0  | `XFormZod.vue`                  |
| `/demo/xform-custom-component`       | `XFormProps.components` 自定义组件注册                                  | 🥇 P0  | `XFormCustomComponent.vue`      |
| `/demo/xform-ignore`                 | `schema.ignore` 字段（不渲染、不校验、不入 getNames）                   | 🥈 P1  | `XFormIgnore.vue`               |
| `/demo/xform-custom-form-item`       | `schema.formItem` 自定义 form-item 包装（含 slots / props / component） | 🥈 P1  | `XFormCustomFormItem.vue`       |
| `/demo/xform-label-layout`           | 顶层 `labelPosition` / `labelWidth`（响应式布局）                       | 🥈 P1  | `XFormLabelLayout.vue`          |
| `/demo/xform-array-api`              | `addItem` / `removeItem` / `moveItem` 实例方法（编程式操控）            | 🥉 P2  | `XFormArrayApi.vue`             |
| `/demo/xform-expression-sandbox`     | `expressionFunctions` 白名单 + 沙箱安全（scanForForbidden）             | P3     | `XFormExpressionSandbox.vue`    |
| `/demo/xform-persist-schema-version` | `useFormPersist.restoreFilter`（schema 升级裁剪旧草稿）                 | P3     | `XFormPersistSchemaVersion.vue` |
| `/demo/xform-async-options-error`    | `asyncOptions.onError` 错误处理 + `immediate: false` 延迟加载           | P3     | `XFormAsyncOptionsError.vue`    |

#### 「按症状定位」对照表（出问题时快速跳转）

| 现象                              | 跳到 demo                               |
| --------------------------------- | --------------------------------------- |
| 反应式不响应 / 写 model 后无变化  | `/demo/xform-reaction-deps`             |
| 校验规则写了不触发                | `/demo/xform-validate-field`            |
| 跨字段校验不生效                  | `/demo/xform-cross-field-reverse`       |
| 表单填错很多要展示服务端错误      | `/demo/xform-server-error`              |
| 性能问题（100+ 字段卡顿）         | `/demo/xform-large-schema`              |
| 控制台报错但 UI 没提示            | `/demo/xform-invalid-component`         |
| 草稿数据回填字段对不上            | `/demo/xform-persist-schema-version` ⭐ |
| 自定义组件被识别为原生标签        | `/demo/xform-custom-component`          |
| 接入 schema 后字段全失效          | `/demo/xform-model-warn`                |
| 想拦截输入值（自动格式化 / 拒绝） | `/demo/xform-before-change`             |

---

## props（18 个）

> 18 个 prop 中 `schema` 必填；`scrollToError` / `scrollIntoViewOptions` 同时作为 schema 顶层字段（schema 优先，props 兜底）。

| 属性                    | 类型                                             | 必填 | 说明                                                                                                            |
| ----------------------- | ------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------- |
| `schema`                | `SchemaNode \| SchemaNode[]`                     | ✅   | 表单 schema                                                                                                     |
| `model`                 | `Record<string, unknown>`                        |      | 响应式数据对象（需用 `reactive()` 包装）                                                                        |
| `components`            | `Record<string, Component>`                      |      | 自定义组件映射                                                                                                  |
| `rules`                 | `Record<string, RuleItem>`                       |      | 校验规则命名引用                                                                                                |
| `directives`            | `Record<string, Directive>`                      |      | 自定义指令映射                                                                                                  |
| `t`                     | `XFormTranslateFn`                               |      | i18n 翻译函数注入：label 函数式 `(t) => t('form.email')` 渲染期以它求值（XForm 不绑定 i18n 库，缺省 identity）  |
| `beforeChange`          | `BeforeChangeFn`                                 |      | 全局 Props beforeChange（第 1 层：横切关注点：埋点 / 全局拦截）                                                 |
| `beforeChangeRules`     | `BeforeChangeRule[]`                             |      | 动态命名空间规则（第 2 层：按 pattern 匹配字段路径）                                                            |
| `zodSchema`             | `ZodType`                                        |      | zod 校验 schema（配合 `validateWithZod()`）                                                                     |
| `expressionFunctions`   | `Record<string, Function>`                       |      | 白名单函数表：{{ }} 表达式可直接引用注册名（**实例级沙箱**，同页多 XForm 实例互不污染，2-3 起）                 |
| `scrollToError`         | `boolean`                                        |      | 校验失败自动滚动到第一个错误字段（schema 优先、props 兜底，默认 false）                                         |
| `scrollIntoViewOptions` | `ScrollIntoViewOptions \| boolean`               |      | 滚动行为选项（schema 优先、props 兜底，默认 true）                                                              |
| `componentProps`        | `Record<string, Record<string, unknown>>`        |      | 按组件名注入默认 props（节点级 props 可覆盖）                                                                   |
| `permissionResolver`    | `(perm: string) => 'view' \| 'edit' \| 'hidden'` |      | 权限码 → 字段状态映射（节点 `permission` 为权限码字面量时调用；默认 identity）                                  |
| `showErrorToast`        | `boolean`                                        |      | 开启错误浮窗 OSD（XFormErrorToast，右上角 toast 展示 errorBus 事件；**全环境默认 false**，与 DebugBanner 独立） |
| `reactionBudget`        | `number`                                         |      | 单批次 reaction 执行预算（默认 50；防循环联动卡死，耗尽跳过大并报错）                                           |
| `size`                  | `'large' \| 'default' \| 'small'`                |      | 表单密度尺寸（F9）：透传 ElForm.size，未传入跟随全局 size。紧凑表格页内嵌紧凑筛选表单场景一处传入               |
| `showDirtyMark`         | `boolean`                                        |      | 字段级 dirty 视觉指示（F13，默认 false）：被修改字段 label 追加 `is-dirty` class + 橙色圆点                     |

---

## 实例方法（ref 引用）

```vue
<XForm ref="formRef" :schema="schema" :model="form" />
```

```ts
const formRef = ref()

// 校验（Promise 风格，非回调）
await formRef.value?.validate() // → boolean（el-form 字段规则 + 跨字段 crossValidator）
await formRef.value?.validateDetail() // → { isValid, errors: [{ keyPath, message }] }
formRef.value?.resetFields() // 全量重置；resetFields(['email']) 部分重置
await formRef.value?.validateField('email') // → boolean（校验指定字段，透传 el-form）
formRef.value?.clearValidate()
formRef.value?.scrollToField('email')
formRef.value?.getNames() // → ['email', 'name', ...]（includesIgnore=true 含 ignore 字段）
formRef.value?.getRef('email') // → Component | HTMLElement | null
formRef.value?.validateWithZod() // → { success, errors }（需配合 zodSchema prop）

// 服务端错误回显
formRef.value?.setFieldError('email', '邮箱已被占用') // 手动写入字段错误（422 场景）
formRef.value?.setFieldValidating('email') // 标记校验中（loading 图标）
formRef.value?.validateFromServer({ success: false, errors: { email: '已被占用' } }) // → 写入的错误条数

// 数组节点操作（仅 kind: 'array' 节点）
formRef.value?.addItem('items', { qty: 1 }) // 末尾追加一行
formRef.value?.removeItem('items', 0) // 删除指定行
formRef.value?.moveItem('items', 0, 2) // 行位置调整

// dirty 状态追踪
formRef.value?.isDirty() // → boolean
formRef.value?.getDirtyFields() // → ['email', 'address.city', ...]
formRef.value?.isTouched('email') // → boolean
formRef.value?.resetDirty() // 当前状态设为新基线（提交后归零）
```

---

## 概念地图（三组近义概念对照）

> XForm 有 ~20 个核心概念，其中「三套依赖 / 三种隐藏 / 三层拦截」三组近义词是新人主要认知税。本节一次性对照，避免在文档间来回跳。
>
> 详细决策树见 docs/24 §4.2（隐藏三态）/ §10（beforeChange 三层）。

### 三种「依赖」—— 都是「声明当前节点关心哪些字段」

| 机制           | 字段名                | 所在位置                                  | 用途                                  | 触发时机                        |
| -------------- | --------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------- |
| reaction       | `deps: string[]`      | 节点 `reaction`                           | 值联动（A 变 → B 自动算/禁用/改文案） | 任一 deps 变化时重算 effect     |
| asyncOptions   | `deps: string[]`      | 节点 `asyncOptions`                       | 选项联动（A 变 → 重新拉 B 的选项）    | 任一 deps 变化时重新执行 source |
| crossValidator | `dependsOn` 或 `deps` | 节点 `rules[].dependsOn` / `rules[].deps` | 跨字段校验（密码 == 确认密码）        | blur/change/validate 时跑一次   |

> **命名约定**：三套机制统一支持 `deps` 别名（crossValidator 的 `dependsOn` 是历史名，`deps` 是推荐写法）。同时声明时 `dependsOn` 优先。

### 三种「隐藏」—— 从「不显示」到「不存在」的语义光谱

| 关键字                 | 是否渲染 DOM       | 是否参与校验 | 是否入 model / 提交 | 是否入 getNames | 典型场景                                   |
| ---------------------- | ------------------ | ------------ | ------------------- | --------------- | ------------------------------------------ |
| `hidden: true`         | ❌（display:none） | ✅           | ✅                  | ✅              | 临时隐藏但仍需保留值（如高级选项默认收起） |
| `ignore: true`         | ✅                 | ❌           | ❌                  | ❌              | 纯展示字段（预览图、辅助说明），不提交     |
| `permission: 'hidden'` | ❌                 | ❌           | ❌                  | ❌              | 权限不足时的安全隐藏（服务端不回来字段）   |

> **决策口诀**：值还要提交 → `hidden`；纯展示不入提交 → `ignore`；按权限隐藏 → `permission:'hidden'`。
> 完整决策树见 docs/24 §4.2。

### 三层「写入前拦截」—— 全局 → 命名空间 → 字段

| 层  | 配置位置                                           | 作用范围                      | 典型场景                                                       |
| --- | -------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| 1   | `XFormProps.beforeChange`                          | 全表单所有字段                | 横切关注点：埋点、全局格式化、权限兜底                         |
| 2   | `XFormProps.beforeChangeRules: BeforeChangeRule[]` | 按 pattern 匹配的字段路径子集 | 数组节点（`items[i].phone`）字段级配置繁琐时按命名空间批量拦截 |
| 3   | 节点 `beforeChange`                                | 单字段                        | 字段专属逻辑：手机号格式化、金额取整、拒绝某些输入             |

> **执行顺序**：层 1 → 层 2 → 层 3，每层返回值作为下一层入参；任一返回非 `undefined` 即替换写入值。详见 docs/24 §10。

---

## schema 字段速查表（31 字段）

> **层级速记**：字段按生效范围分三类——
>
> - **字段级**（23 个）：写在每个节点上，控制该节点的行为（如 `Input` 的 `placeholder`）
> - **顶层 schema**（5 个）：仅在 `{ children: [...] }` 形态的最外层对象上生效，对应 element-plus `el-form` 实例级属性（控制整个表单行为）
> - **双层**（3 个）：`disabled` / `labelPosition` / `labelWidth` —— 字段级控制单字段，顶层配置整体默认（字段级 override 顶层）
>
> 同名 prop 与 schema 字段的关系：`scrollToError` / `scrollIntoViewOptions` 同时是 XForm props 和顶层 schema 字段，schema 字段优先（XForm props 主要供不写 schema 的简单场景）。

### 节点标识（4）

| 字段        | 类型                  | 层级   | 说明                                                                |
| ----------- | --------------------- | ------ | ------------------------------------------------------------------- |
| `component` | `string \| Component` | 字段级 | 组件名（短名 `'Input'` / 全名 `'ElInput'` / 直接传 Component 对象） |
| `name`      | `string`              | 字段级 | 字段名（双向绑定的 key，缺则不绑 model）                            |
| `key`       | `string \| number`    | 字段级 | v-for 唯一标识（建议必填，避免 DOM 复用导致状态残留）               |
| `label`     | `string`              | 字段级 | form-item 标签文字                                                  |

### 渲染属性（5）

| 字段         | 类型                                   | 层级   | 说明                                                            |
| ------------ | -------------------------------------- | ------ | --------------------------------------------------------------- |
| `props`      | `Record<string, unknown>`              | 字段级 | 透传给 component 的 props（受 `SchemaNodeFor<C>` 类型推导约束） |
| `on`         | `Record<string, Function \| string>`   | 字段级 | 事件回调（string 是 `{{ (m) => ... }}` 表达式）                 |
| `children`   | `SchemaNode \| SchemaNode[] \| string` | 字段级 | 子节点 / 文本                                                   |
| `slots`      | `Record<string, SchemaNode>`           | 字段级 | 具名插槽                                                        |
| `directives` | `DirectiveConfig[]`                    | 字段级 | 自定义指令                                                      |

### 布局（4）

| 字段       | 类型                                                 | 层级   | 说明                                                                  |
| ---------- | ---------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `row`      | `RowConfig`                                          | 字段级 | 栅格行（gutter）                                                      |
| `column`   | `number`                                             | 字段级 | 每行栅格数                                                            |
| `col`      | `boolean \| { span, offset }`                        | 字段级 | 子节点栅格列                                                          |
| `formItem` | `boolean \| { component, props, directives, slots }` | 字段级 | 自定义 form-item 包装（false=裸渲染组件，true=默认包装，对象=自定义） |

### 校验（2）

| 字段           | 类型                          | 层级   | 说明                                                                    |
| -------------- | ----------------------------- | ------ | ----------------------------------------------------------------------- |
| `rules`        | `string \| RuleItem \| Array` | 字段级 | 校验规则（async-validator 兼容）；string 是 `XFormProps.rules` 命名引用 |
| `defaultValue` | `unknown`                     | 字段级 | 字段初值（model 中缺该 key 时填入）                                     |

### 响应式（7）

| 字段           | 类型                                          | 层级              | 说明                                                                                  |
| -------------- | --------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `reaction`     | `ReactionConfig`                              | 字段级            | 反应式联动（支持 `deps` 精确监听依赖路径）                                            |
| `disabled`     | `ReactionValue<boolean>`                      | **字段级 + 顶层** | 字段级=字段禁用；顶层=整体禁用整个表单（透传 el-form disabled）                       |
| `permission`   | `ReactionValue<'view' \| 'edit' \| 'hidden'>` | 字段级            | 字段权限三态（view 只读 / edit 可编辑 / hidden 不渲染）                               |
| `readonly`     | `ReactionValue<boolean>`                      | **仅顶层**        | 整体只读（未 hidden 字段一律按 view 态纯文本展示）；字段级只读用 `permission: 'view'` |
| `hidden`       | `boolean \| ReactionValue<boolean>`           | 字段级            | 节点隐藏（仍创建，display:none，不参与校验）                                          |
| `ignore`       | `boolean`                                     | 字段级            | 跳过渲染（不参与 `getNames`）                                                         |
| `beforeChange` | `BeforeChangeFn \| BeforeChangeRule[]`        | 字段级            | 字段值拦截（详见 `XFormBeforeChange.vue` demo）                                       |

### 视觉容器（Card / Tabs / Steps，children 即面板）

`component: 'Card' | 'Tabs' | 'Steps'`（或全名 `'ElCard' | 'ElTabs' | 'ElSteps'`）的**无 name 节点**走视觉容器分支——不绑 formItem、不进 getNames，仅做视觉分组。children 每项即一个面板：

| 容器      | 面板组件    | 面板 label 来源                | 激活态 / 校验门控（EP 原生 props 透传）                                                                 |
| --------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `'Card'`  | —（单面板） | slots.header 或 props.header   | —                                                                                                       |
| `'Tabs'`  | `ElTabPane` | `child.label`（缺省 `面板 N`） | `props.modelValue` + `props.onTabChange`（绑 model）；`props.beforeLeave` 校验门控（返 false 阻止切换） |
| `'Steps'` | `ElStep`    | `child.label`（缺省 `面板 N`） | `props.active`（绑 model）+ 外层按钮驱动；`props.processStatus` 完成态                                  |

面板内布局：child 配 `row/column` 走栅格（同 Card）。示例见 `/demo/xform-tabs-steps`（Tabs + Steps + 校验门控完整桥接）与 `/demo/xform-nested`（Card 多组）。

### 数组节点（2）

| 字段    | 类型              | 层级   | 说明                                                                     |
| ------- | ----------------- | ------ | ------------------------------------------------------------------------ |
| `kind`  | `'array'`         | 字段级 | 节点类型（`'array'` = 数组容器）                                         |
| `array` | `ArrayNodeConfig` | 字段级 | 数组容器配置（`kind: 'array'` 时必填；`draggable: true` 开启行拖拽排序） |

### 数据加载（1）

| 字段           | 类型                 | 层级   | 说明                                                            |
| -------------- | -------------------- | ------ | --------------------------------------------------------------- |
| `asyncOptions` | `AsyncOptionsConfig` | 字段级 | 异步选项数据源（Select / Cascader / TreeSelect / Autocomplete） |

### 顶层 schema 配置（5）—— **仅顶层 schema 生效**

> 这些字段对应 element-plus `el-form` 实例级属性，必须从顶层 schema 派生而非 XForm props 配置。

| 字段                    | 类型                               | 层级          | 说明                                                                                    |
| ----------------------- | ---------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `labelPosition`         | `'left' \| 'right' \| 'top'`       | 顶层 + 字段级 | label 位置（顶层默认 `left`；字段级 override 顶层）；`'top'` 推荐用于响应式布局         |
| `labelWidth`            | `string \| number`                 | 顶层 + 字段级 | label 宽度（如 `'120px'` 或 `120`）；字段级 override 顶层                               |
| `scrollToError`         | `boolean`                          | **仅顶层**    | 校验失败自动滚动到第一个错误字段（默认 `false`；与 XForm props 同名，schema 优先）      |
| `scrollIntoViewOptions` | `ScrollIntoViewOptions \| boolean` | **仅顶层**    | 滚动行为选项（默认 `true`）                                                             |
| `debounceValidation`    | `number`                           | **仅顶层**    | 跨字段校验默认 debounce ms（`0` = 实时，默认 `0`；字段级 `rules[i].debounceMs` 可覆盖） |

### v-model 适配（1）

| 字段        | 类型     | 层级   | 说明                                                               |
| ----------- | -------- | ------ | ------------------------------------------------------------------ |
| `modelProp` | `string` | 字段级 | 自定义 v-model 属性名（默认 `modelValue`，Upload 用 `'fileList'`） |

---

> **速记总结**：
>
> - **字段级（23）**：节点自身行为——标识（4）+ 渲染（5）+ 布局（4）+ 校验（2）+ 响应式（7 含 1 个双层）+ 数组（2）+ 数据加载（1）+ v-model（1）
> - **顶层 schema（5 + 3 双层）**：表单整体行为——`scrollToError` / `scrollIntoViewOptions` / `debounceValidation` / `readonly` / `disabled`（双层）/ `labelPosition`（双层）/ `labelWidth`（双层）
> - **双层颗粒度**：`disabled` / `labelPosition` / `labelWidth` —— 顶层配置为整体默认，字段级配置 override 顶层
> - **关键约束**：`disabled` 在字段级只影响单个字段；在顶层禁用整个表单

---

## 链式构建器（fbuilder）

### 何时用 builder vs 裸对象 schema

XForm 接受**两种等价的 schema 写法**，根据场景选择：

| 场景                                 | 推荐写法                              | 原因                                   |
| ------------------------------------ | ------------------------------------- | -------------------------------------- |
| 业务模块内**手写**静态 schema        | **裸对象** + `SchemaNodeFor<'Input'>` | 直白、贴近底层 DSL，便于搜索/重构      |
| 组件复用 + IDE 自动补全 props        | **builder**（`xInput()`）             | 链式调用 + 类型推导，props 字段名补全  |
| 动态 schema（来自后端 / 配置）       | **裸对象**（JSON.parse 直接产出）     | builder 是 class，JSON 序列化不友好    |
| 复杂字段配置（数组 / 嵌套 / 动态列） | **builder**                           | `.item()` / `.column()` 等链式方法直观 |
| 字段数 < 5 的简单表单                | **裸对象**                            | 引入 builder 链增加理解成本            |
| 字段数 > 20 + 多类型混合             | **builder**                           | 链式调用比大块对象嵌套更易读           |
| 跨文件复用单字段定义                 | **builder factory** 提取为函数        | 比对象片段更易模块化                   |

**语法对照**（同一个邮箱字段的两种写法）：

```ts
// 裸对象写法（贴近 DSL，JSON 友好）
const emailNode: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  props: { placeholder: 'a@b.com', clearable: true },
  rules: [{ required: true, message: '请输入邮箱' }],
}

// builder 写法（链式 + 类型推导）
const emailNode = xInput('email')
  .label('邮箱')
  .placeholder('a@b.com')
  .prop('clearable', true)
  .validator((_rule, value, cb) => {
    if (!value) cb(new Error('请输入邮箱'))
    else cb()
  })
  .build()
```

> **关键约束**：
>
> - `build()` 之前**不会**校验 schema，只是构造 SchemaNodeFor —— 类型错误在 IDE hover 时即刻发现
> - 两种写法生成的 `SchemaNodeFor<C>` 类型完全等价，可混合使用（同一 schema 内部分字段用 builder，其他字段用裸对象）
> - builder 不增加运行时开销：`.build()` 仅返回 plain object，等价于裸对象
> - builder 文件 `builders.ts` 是纯函数式（无副作用），可 tree-shake（未使用的 xXxx 不进 bundle）

```ts
import {
  xInput,
  xSelect,
  xSwitch,
  xDatePicker,
  xTextarea,
  xColorPicker,
  xInputPassword,
  xInputTag,
  xInputTextArea,
  xMention,
  xRate,
  xRadioGroup,
  xCard,
} from '@/components/form-schema/builders'

const schema = {
  column: 2,
  row: { gutter: 24 },
  children: [
    xInput('email').label('邮箱').required().placeholder('a@b.com').defaultValue('a@b.com').build(),
    xSelect('role')
      .label('角色')
      .options([
        { value: 'admin', label: '管理员' },
        { value: 'user', label: '用户' },
      ])
      .required()
      .build(),
    xSwitch('enabled').label('启用').build(),
    xDatePicker('birthday').label('生日').format('YYYY-MM-DD').build(),
    xInputPassword('password').label('密码').placeholder('请输入密码').build(),
    xInputTextArea('remark').label('备注').prop('rows', 4).build(),
    xInputTag('skills').label('技能').prop('max', 5).build(),
    xColorPicker('theme').label('主题色').build(),
    xMention('owner').label('负责人').build(),
    xRate('score').label('评分').build(),
  ],
}
```

## 类型推导（SchemaNodeFor）

`SchemaNode` 是宽类型（`component: string` + `props: Record<string, unknown>`），写错不会报错。  
**`SchemaNodeFor<C>` 按 component 字段推导 props 类型**，IDE 自动校验：

```ts
import type { SchemaNodeFor } from '@/components/form-schema/types'

// 正确：placeholder 必为 string，clearable 必为 boolean
const email: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  props: { placeholder: 'a@b.com', clearable: true },
}

// 错误：placeholder 传 number（TS 类型错误，IDE 红波浪线）
const bad: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  props: { placeholder: 123, clearable: 'yes' as unknown as boolean },
}

// 多种 element-plus 组件类型自动支持
const selectNode: SchemaNodeFor<'Select'> = {
  component: 'Select',
  name: 'role',
  props: { multiple: true, clearable: true, filterable: true },
}
```

支持的 component 名（26 个内置 + ArrayNode 占位）：`Input | Select | Option | Switch | DatePicker | TimePicker | TimeSelect | TreeSelect | Upload | Autocomplete | Transfer | RadioGroup | Radio | CheckboxGroup | Checkbox | Cascader | InputNumber | InputPassword | InputTextArea | InputTag | ColorPicker | Mention | Rate | Slider | Card | FormItem`

自定义组件可通过 module augmentation 扩展类型推导（见下方“自定义组件类型扩展”）。

| 快捷名          | 默认 props                                  | 说明                                                                                                          |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Input`         | `{ clearable: true }`                       | 普通输入                                                                                                      |
| `InputNumber`   | `{ controlsPosition: 'right' }`             | 不限制最小值                                                                                                  |
| `InputPassword` | `{ type: 'password', showPassword: true }`  | 初始隐藏并允许切换                                                                                            |
| `InputTextArea` | `{ type: 'textarea', showWordLimit: true }` | 多行输入，默认显示字数统计（需配合 `maxlength`）                                                              |
| `InputTag`      | `{ clearable: true }`                       | `modelValue` 为 `string[]`                                                                                    |
| `Upload`        | 无                                          | 需配合 `modelProp: 'fileList'` 绑定 ElUpload 的 `file-list`；默认触发区见下方「Upload 默认触发区与 DOM 结构」 |
| `ColorPicker`   | 无                                          | 颜色和格式由节点配置                                                                                          |
| `Mention`       | 无                                          | options 和 prefix 由节点配置                                                                                  |
| `Rate`          | 无                                          | 星级、是否半星由节点配置                                                                                      |

### Upload 默认触发区与 DOM 结构

未自定义 `slots.default`（也无 `children`）时，XForm 按类型注入默认触发区内容：

| 节点配置                        | 注入内容                                                                      | 类名                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `listType: 'picture-card'`      | `<el-icon><Plus /></el-icon>`                                                 | `vv-x-form__upload-icon vv-x-form__upload-icon--picture-card`                                                             |
| `drag: true`                    | `<el-icon><UploadFilled /></el-icon>` + `<div>拖拽文件到这里或点击上传</div>` | 图标 `el-icon--upload vv-x-form__upload-icon vv-x-form__upload-icon--drag`；文案 `el-upload__text vv-x-form__upload-text` |
| 其余（`text` 默认 / `picture`） | `<el-button type="primary">点击上传</el-button>`                              | `vv-x-form__upload-button`                                                                                                |

- text / picture 必须兜底的原因：ElUpload 非 drag 分支的触发区**就是 default slot 本身**（`element-plus/upload-content.vue` 直接 `renderSlot($slots, 'default')`，不含任何内置 UI），插槽为空时 `.el-upload--text` 是零高度空元素，字段看起来没渲染、完全无法交互。
- 两者同时开启时取 Plus —— picture-card 触发区仅 148px，UploadFilled 的官方 67px 大图标会溢出。
- 保留 `el-icon--upload` / `el-upload__text` 是为了继承 Element Plus 官方拖拽区样式；`vv-x-form__upload-*` 类名供业务按类型精确覆盖，改其中一类不会误伤另一类。
- 需要换触发元素（自定义按钮文案 / 整块 drop 区）时写 `slots.default` 或 `children`，二者都优先于上表的默认注入。
- 配了 `slots.trigger` 时不注入 —— ElUpload 会把 `default` 渲染到触发区之外（`element-plus/upload.vue:85`），注入会让页面多出一个孤立按钮。
- 三种定制写法（类名覆盖 / `slots.default` 接管触发区 / `slots.file` 自定义列表项）见 `/demo/xform-upload` 的「自定义样式方案」小节。
- 函数式插槽（`SlotRenderFn`）既可用 `h()` 也可用 JSX。JSX 需要所在 `.vue` 的 script 块为 `lang="tsx"`，并且 `eslint.config.mjs` 的 `withVueTs` 已声明 `scriptLangs: ['ts', 'tsx']`；两种写法的对照示例见该 demo 的场景 10。
- **`el-form-item__content` 下那层无类名的 `<div>` 不是 XForm 加的**：它是 ElUpload 组件自身的模板根节点（`element-plus/upload.vue` 用它收拢 `upload-list` 与 `upload-content` 两个兄弟节点），XForm 侧无法移除。需要调整该层样式时用 `.el-form-item__content > div` 定位。

## 自定义组件类型扩展

如果业务写了自定义字段组件，可以让 `SchemaNodeFor` 和 builder 也识别它的 props：

```ts
// types/form-schema.d.ts
import type { ComponentPropsRegistry } from '@/components/form-schema/types'

interface MyInputProps {
  prefix?: string
  suffix?: string
  modelValue?: string
}

declare module '@/components/form-schema/types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}
```

扩展后：

```ts
const node: SchemaNodeFor<'MyInput'> = {
  component: 'MyInput',
  name: 'keyword',
  props: { prefix: 'Search:', suffix: '✓' }, // IDE 自动补全 + 类型校验
}
```

> 注意：类型扩展仅影响 TS 推导，运行时仍需在 `XForm` 的 `components` prop 中注册：`<XForm :components="{ MyInput: MyInputComp }" />`。

---

## asyncOptions（异步选项）

`Select`、`Cascader`、`TreeSelect`、`Autocomplete` 支持内置异步数据源：

```ts
{
  component: 'Select',
  name: 'city',
  asyncOptions: {
    source: async () => fetch('/api/cities').then(r => r.json()),
    transform: (raw: Array<{ id: number; name: string }>) =>
      raw.map((item) => ({ label: item.name, value: item.id })),
  },
}
```

带依赖联动：

```ts
{
  component: 'Select',
  name: 'district',
  asyncOptions: {
    source: async () => fetch(`/api/districts?city=${form.city}`).then(r => r.json()),
    deps: 'city',
    transform: (raw) => raw.map((item: { name: string }) => ({ label: item.name, value: item.name })),
  },
}
```

| 字段        | 说明                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `source`    | 返回选项数组的函数，支持 Promise；Autocomplete 可接收可选 query 参数 |
| `immediate` | 是否立即请求（默认 true）                                            |
| `deps`      | 依赖字段路径，变化时重新请求                                         |
| `transform` | 把 source 结果转为 `{ label, value }` 数组                           |
| `onError`   | 请求失败回调                                                         |

---

## reaction（响应式联动）

```ts
{
  component: 'Input',
  name: 'path',
  label: '路径',
  reaction: {
    disabled: (m) => !m.enablePath,                          // 字段值
    rules: (m) => m.enablePath ? 'required' : undefined,      // 校验
    props: { placeholder: (m) => m.enablePath ? '请输入' : '' }, // 组件 props
    label: (m) => m.enablePath ? '路径（必填）' : '路径',  // label
    hidden: (m) => !m.enablePath,                             // 隐藏
  },
}
```

> standalone 简写（与 `reaction.disabled` 完全等价，克隆阶段自动归一化）：
> `disabled: (m) => !m.enablePath`

**调度策略**：`strategy: 'sync' | 'debounce' | 'throttle'` + `delay`（ms）。

**性能优化 —— `deps` 精确监听**：默认情况下含动态值的 reaction 会 deep watch 整棵 model（任意字段变化都触发求值）。声明 `deps` 后仅监听指定路径：

```ts
{
  name: 'total',
  reaction: {
    deps: ['qty', 'price'],                     // 只有这两个字段变化才重算
    label: (m) => `合计：${m.qty * m.price}`,   // 配合 deps 后，函数内写 model 也安全（不会自触发）
  },
}
```

> 联动函数内写 model 是被允许的（副作用），但未声明 deps 时会触发自身 deep watch 形成循环风险——XForm 内置单批次执行预算（50 次/flush）兜底并 console.error 告警；声明 deps 可从根上避免。

---

## 草稿持久化（useFormPersist）

表单数据自动防抖落盘、刷新不丢、按需恢复。XForm 零改动：

```ts
import { useFormPersist } from '@/components/form-schema'

const model = reactive<Record<string, unknown>>({})
const persist = useFormPersist({
  key: 'orders.create.draft', // 草稿唯一标识（经 storage namespace 隔离）
  model,
  exclude: ['password', 'card.cvv'], // 敏感字段不落盘（必配！）
})

// 挂载时按需恢复
onMounted(() => {
  if (persist.hasDraft.value) {
    persist.load()
    formRef.value?.resetDirty() // 草稿为新基线，isDirty 从草稿起算
  }
})

// 提交成功后
persist.clear()
```

| 配置            | 默认      | 说明                                        |
| --------------- | --------- | ------------------------------------------- |
| `key`           | 必填      | 草稿唯一标识，建议 `<模块>.<表单名>.draft`  |
| `model`         | 必填      | 被监听的 reactive model                     |
| `storage`       | `'local'` | `'session'` 关标签页失效                    |
| `debounce`      | `400`     | 自动保存防抖 ms                             |
| `exclude`       | `[]`      | 敏感字段 lodash 路径，序列化剔除            |
| `restoreFilter` | —         | schema 升级后裁剪旧草稿；返回 null 丢弃草稿 |

返回：`{ save, load, clear, hasDraft, lastSavedAt }`——`save()` 立即 flush；`load()` 恢复草稿（草稿保留，可反复恢复）；`clear()` 清除草稿。

**已知限制**：File/Blob/函数等不可序列化值会退化丢失；多标签页并发编辑不同步（后写覆盖先写）；含密码/证件号等字段必须配置 `exclude`。

### 设计器演进接口预留（PM 审查发现 12，Wave4-3）

为低代码设计器铺路预留的**纯类型契约**字段（XForm 渲染/校验不消费；可视化工具有了锚点后再评估 PoC）：

| 字段                             | 层级        | 语义                                                                                                                         |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id?: string`                    | 节点级      | 节点稳定 id（同层唯一）—— 设计器选中/锚定/回写；XForm 仍按 `name`/`key` 做渲染与校验标识                                     |
| `meta?: Record<string, unknown>` | 节点级      | 节点扩展元数据（设计器私有状态/业务标注）—— 透传不透明键值对，不消费/不校验/不序列化到 model；建议仅放可 JSON 序列化的纯数据 |
| `schemaVersion?: string`         | 顶层 schema | schema 版本号（'major.minor.patch' 或业务自定义）—— `useFormPersist.restoreFilter` 升级裁剪 + 设计器 schema 升级策略锚定     |

业务手写 schema 无版本演进/设计器需求时，三个字段均可不填。

---

## 决策指南

**何时用 XForm / 何时用 element-plus 原生：**

| 场景                               | 推荐                  |
| ---------------------------------- | --------------------- |
| 简单表单（< 5 字段）固定结构       | **element-plus 原生** |
| 动态 schema（来自后端 / 配置文件） | **XForm**             |
| 复杂联动（> 3 字段互相关联）       | **XForm**             |
| 复用校验规则                       | **XForm**             |
| 跨组件共享表单状态                 | **XForm**             |
| 性能关键（> 100 字段）             | **element-plus 原生** |
| 多语言 + 动态 schema               | **XForm**             |

---

## 故障排查

| 现象             | 原因                                    | 修复                                 |
| ---------------- | --------------------------------------- | ------------------------------------ |
| 输入无反应       | `model` 不是 reactive 包装              | 用 `reactive({})` 包装               |
| 输入无反应       | 节点缺 `name` 字段                      | 添加 `name: 'fieldId'`               |
| 校验不触发       | `rules` 是字符串但未在 props.rules 注册 | 配置 props.rules                     |
| 反应式不响应     | reaction 函数体未引用 `model`           | `reaction: { disabled: (m) => ... }` |
| directive 不生效 | directive 名未注册到 vue app            | 用 `app.directive()` 全局注册        |
| 样式不对         | 直接 import 绕过了 CSS 自动注入         | XForm 内部已 import CSS              |

dev 模式下 XFormDebugBanner 会自动在右下角浮窗显示 schema 校验错误。

---

## 示例（下表 38 个高频入门 demo，全量 56 个见 docs/24 §19）

> 下表为按主题精选的入门子集；**完整索引（56 个，按主题分组、含新增即维护的单一来源）见
> [`docs/24-XForm使用指南.md`](../../../docs/24-XForm使用指南.md) §19**。新增 demo 只需维护 §19 一处，本表不再扩容。
>
> 其中 `/demo/x-form`（即 `XForm.vue`）是主入口，承载 Props/Events/Slots 完整 API 表。

完整在线演示站点：`pnpm dev` → `/demo`（左侧「XForm 表单引擎」分组），路由 = `/demo/xform-<kebab-case>`。

| 路由                              | 内容                                                |
| --------------------------------- | --------------------------------------------------- |
| `/demo/x-form`                    | 用法总览（主 demo：Props/Events/Slots 完整 API 表） |
| `/demo/xform-minimum-demo`        | 最小示例（5 分钟上手）                              |
| `/demo/xform-base`                | 基础用法（多字段 + 校验 + 重置）                    |
| `/demo/xform-nested`              | 复杂布局（Card 容器 + slots + 嵌套）                |
| `/demo/xform-builder`             | 链式构建器                                          |
| `/demo/xform-reaction`            | 反应式联动（含防抖/节流）                           |
| `/demo/xform-reaction-deps`       | reaction `deps` 精确监听                            |
| `/demo/xform-reaction-advanced`   | reaction 进阶用法                                   |
| `/demo/xform-expression`          | `{{ }}` 函数表达式沙箱                              |
| `/demo/xform-cross-field`         | 跨字段校验                                          |
| `/demo/xform-cross-field-reverse` | 反向跨字段（精确触发）                              |
| `/demo/xform-async-options`       | 异步选项                                            |
| `/demo/xform-async-validator`     | 异步校验（loading 态）                              |
| `/demo/xform-array`               | 数组节点（增删/上下移/min-max 限制）                |
| `/demo/xform-array-draggable`     | 数组行拖拽排序                                      |
| `/demo/xform-persist`             | 草稿持久化（自动保存 + 刷新恢复）                   |
| `/demo/xform-responsive`          | 响应式布局（断点拍平）                              |
| `/demo/xform-grid`                | row + column 栅格布局                               |
| `/demo/xform-dirty`               | 脏状态追踪                                          |
| `/demo/xform-disabled`            | 禁用状态（反应式）                                  |
| `/demo/xform-global-disabled`     | 整体禁用（顶层 schema `disabled`）                  |
| `/demo/xform-global-readonly`     | 整体只读（顶层 schema `readonly`）                  |
| `/demo/xform-field-permission`    | 字段权限（view/edit/hidden）                        |
| `/demo/xform-directives`          | 自定义指令                                          |
| `/demo/xform-events`              | `on` 事件绑定（函数 + 表达式）                      |
| `/demo/xform-server-error`        | 服务端错误映射                                      |
| `/demo/xform-slots`               | 插槽系统                                            |
| `/demo/xform-invalid-component`   | 无效组件校验（div 占位 + DebugBanner）              |
| `/demo/xform-large-schema`        | 大 schema 性能                                      |
| `/demo/xform-model-warn`          | model 缺失警告                                      |
| `/demo/xform-schema-index`        | 索引快照（getNames/getRef）                         |
| `/demo/xform-detail-fill`         | 详情页回填（加载 + resetDirty）                     |
| `/demo/xform-order-create`        | 业务综合示例（订单创建）                            |
| `/demo/xform-scroll-to-error`     | 校验失败自动滚动                                    |
| `/demo/xform-validate-field`      | `validateField` 单字段校验                          |
| `/demo/xform-validation-debounce` | 跨字段 debounce 调优                                |
| `/demo/xform-style-override`      | 样式覆盖（BEM 命名空间）                            |
| `/demo/xform-upload`              | 文件上传（单文件/多文件/拖拽/图片墙/校验/回显）     |

> 主 demo `/demo/x-form` 展示 Props/Events/Slots 完整 API 表，是查阅全部 prop 与实例方法的入口。

---

## prod 错误反馈：哪些错误用户在生产环境能看到

XForm 错误反馈分 4 层（form 红字 / OSD toast / console / Debug Banner），生产环境与开发环境可见性不同：

| 层                                              | 触发场景                                                                | dev 可见                                | prod 可见                               | 用户感知          |
| ----------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- | ----------------- |
| **form 红字**（el-form-item 下方）              | el-form 字段规则失败 / `setFieldError` 写入 / `validateFromServer` 回填 | ✅                                      | ✅                                      | ✅ 用户可感知     |
| **OSD 错误浮窗**（XFormErrorToast）             | 跨字段校验失败 / 服务端 422 回填 / schema 严重校验失败                  | ❌ 默认关闭（传 `showErrorToast` 开启） | ❌ 默认关闭（传 `showErrorToast` 开启） | ❌ 默认无感       |
| **Debug Banner**（右下角浮窗）                  | schema 静态校验失败 / 表达式含 forbidden 标识符 / model 缺失            | ✅                                      | ❌ 仅 dev                               | ❌ 仅 dev 可见    |
| **console**（`console.error` / `console.warn`） | 所有错误 + 部分 warn（如 model 缺失）                                   | ✅                                      | ✅ 保留 `console.error`                 | ❌ 仅开发者控制台 |

### 生产环境推荐配置

```ts
import XForm from '@/components/form-schema/components/XForm.vue'

// 默认行为已适合 prod：form 红字全环境可见，OSD / Banner 默认关闭
<XForm :schema="schema" :model="form" />

// 如果希望显示 OSD toast（错误诊断场景，不推荐面向终端用户）：
<XForm :schema="schema" :model="form" :show-error-toast="true" />
// 错误事件（跨字段失败 / 服务端 422 回填等）以右上角浮窗可见
```

### 重要行为

1. **默认 prod 用户能感知的错误** 仅 form 红字一种 —— 这与 element-plus 原生行为一致
2. **OSD toast 全环境默认关闭** —— 错误主反馈是字段红字 + console 留痕，toast 是补充提醒，显式传 `showErrorToast` 开启（与运行环境无关）
3. **console.error 全环境保留** —— 出问题时浏览器 console / Sentry 仍能捕获
4. **schema 静态校验失败不阻塞渲染** —— 字段仍会渲染，但 `console.error` + dev Banner 提示开发者

---

## `{{ }}` 表达式速查表（沙箱语法）

`reaction` / `disabled` / `readonly` / `hidden` 字段支持三种写法（字面量 / 函数 / 表达式字符串），本表给出对照与适用场景：

| 写法                        | 示例                                               | 何时用                                              | 类型推导                        |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| **字面量 boolean**          | `disabled: true`                                   | 静态条件（编译时已知）                              | ✅ 完整                         |
| **字面量 string**           | `rules: 'required'`                                | 命名规则引用（配合 `XFormProps.rules`）             | ✅ 完整                         |
| **函数 `(m) => value`**     | `disabled: (m) => !m.enable`                       | 动态求值（推荐）；IDE 能识别 `m` 是 model 类型      | ✅ 完整（`m` 自动推导为 model） |
| **表达式字符串 `{{ fn }}`** | `disabled: '{{ (m) => !m.enable ? "是" : "否" }}'` | **从后端 / JSON 配置下发 schema**（函数无法序列化） | ⚠️ 弱推导（`m` 是 `unknown`）   |

### 沙箱安全机制

- 表达式字符串走 `new Function('model', '__rest', ...)` 创建独立函数作用域（相对 `eval` 不污染闭包）
- dev 模式 `scanForForbidden` 黑名单扫描：`window` / `document` / `globalThis` / `eval` / `Function` / `setTimeout` / `setInterval` / `fetch` / `XMLHttpRequest` 命中即 `console.error` 拒绝
- **禁止把 schema 来自 URL 参数 / localStorage / 用户输入**（CSP 风险）—— 仅允许后端预校验 schema 或项目内硬编码

### 完整示例：reaction 同时用字面量 + 函数 + 表达式

```ts
{
  component: 'Input',
  name: 'path',
  label: '路径',
  reaction: {
    // 函数形式（IDE 类型推导完整）
    hidden: (m) => !m.enablePath,
    // 字面量（静态）
    rules: 'required',
    // 表达式字符串（从后端 schema JSON 下发也能跑）
    label: '{{ (m) => m.enablePath ? "路径（必填）" : "路径" }}',
    // 函数形式动态改 props
    props: (m) => ({ placeholder: m.enablePath ? '请输入' : '' }),
  },
}
```

> **坑**：未声明 `deps` 时 deep watch 整棵 model（重开销）。声明 `deps: ['a', 'b']` 后仅精确监听 —— 函数体内写 model 也安全（不会自触发）。XForm 内置 50 次/flush 兜底 + `console.error` 告警防循环 reaction。

### 表达式解析失败行为

- 函数写法：编译期类型错误，IDE 红波浪线；运行时按规则默认处理
- 表达式字符串：dev mode `console.error` + 跳过该字段更新（不阻塞其他字段）
- 表达式含 forbidden 标识符：dev mode `console.error` + Debug Banner 红字警告
